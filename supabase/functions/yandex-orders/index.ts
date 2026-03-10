import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';

// Map Yandex status to normalized fulfillment_status
function normalizeYandexStatus(rawStatus: string | undefined, substatus?: string): string {
  const s = (rawStatus || '').toUpperCase();
  const sub = (substatus || '').toUpperCase();
  
  // Delivered states
  if (['DELIVERED', 'PICKUP', 'PARTIALLY_DELIVERED', 'PICKUP_SERVICE_RECEIVED', 'PICKUP_USER_RECEIVED'].includes(s)) {
    return 'delivered';
  }
  
  // Cancelled states - including new substatuses (Feb 2026)
  const cancelledSubstatuses = [
    'TOO_MANY_DELIVERY_DATE_CHANGES',
    'TOO_LONG_DELIVERY',
    'PICKUP_EXPIRED',
    'USER_CHANGED_MIND',
    'USER_REFUSED_DELIVERY',
    'USER_REFUSED_QUALITY',
    'SHOP_FAILED',
    'DELIVERY_SERVICE_FAILED',
  ];
  if (s.startsWith('CANCELLED') || s === 'CANCELED' || cancelledSubstatuses.includes(sub)) {
    return 'cancelled';
  }
  
  // Pending states - customs or data issues need attention
  if (sub === 'INCORRECT_PERSONAL_DATA') {
    return 'pending';
  }
  
  // Returned states
  if (['RETURNED', 'RETURN_ARRIVED', 'RETURN_ARRIVED_DELIVERY'].includes(s)) {
    return 'returned';
  }
  
  // Shipped/In transit states
  if (['PROCESSING', 'DELIVERY', 'SHIPPED', 'READY_TO_SHIP', 'SENDER_SENT'].includes(s)) {
    return 'shipped';
  }
  
  return 'pending';
}
const API_DELAY_MS = 300;
const MAX_PAGES = 50;
const CHUNK_DAYS = 14;
const MAX_EXECUTION_MS = 50000; // 50s timeout guard

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface YandexOrderItem {
  offerName: string;
  marketSku?: number;
  offerId: string;
  shopSku?: string;  // Deprecated since 2024, kept for backward compat
  count: number;
  prices?: Array<{
    type: string;
    costPerItem: number;
    total: number;
  }>;
  subsidies?: Array<{
    type: string;
    amount: number;
  }>;
  tags?: string[];  // ULTIMA, SAFE_TAG, TURBO
  countryCode?: string;  // ISO 3166-1 alpha-2
}

interface YandexOrder {
  id: number;
  creationDate: string;
  statusUpdateDate?: string;
  status: string;
  substatus?: string;
  partnerOrderId?: string;
  externalOrderId?: string;
  paymentType?: string;
  currency?: string;
  fake?: boolean;
  deliveryRegion?: {
    id: number;
    name: string;
  };
  buyer?: {
    type?: string;
    trusted?: boolean;
  };
  items?: YandexOrderItem[];
  payments?: Array<{
    id: number;
    date: string;
    type: string;
    source: string;
    total: number;
  }>;
  commissions?: Array<{
    type: string;
    actual: number;
  }>;
}

function getDateRange(days: number = 30): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const daysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    dateFrom: daysAgo.toISOString().split('T')[0],
    dateTo: now.toISOString().split('T')[0],
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { store_id, days = 30, dateFrom: explicitDateFrom, dateTo: explicitDateTo } = await req.json();

    if (!store_id) {
      throw new Error('store_id is required');
    }

    const { data: store, error: storeError } = await supabase
      .from('marketplace_stores')
      .select('*')
      .eq('id', store_id)
      .eq('platform', 'yandex')
      .single();

    if (storeError || !store) {
      throw new Error(`Store not found: ${storeError?.message}`);
    }

    const apiKey = Deno.env.get(store.api_key_secret_name);
    if (!apiKey) {
      throw new Error(`API key not configured: ${store.api_key_secret_name}`);
    }

    // Build list of campaigns to fetch - support dual FBY+FBS for fby_fbs stores
    const campaignsToFetch: Array<{ id: string; type: string }> = [];
    
    if (store.fulfillment_type === 'fby_fbs') {
      if (store.fby_campaign_id) {
        campaignsToFetch.push({ id: store.fby_campaign_id, type: 'fby' });
      }
      if (store.fbs_campaign_id) {
        campaignsToFetch.push({ id: store.fbs_campaign_id, type: 'fbs' });
      }
    } else {
      const campaignId = store.campaign_id || store.fbs_campaign_id || store.fby_campaign_id;
      if (campaignId) {
        campaignsToFetch.push({ 
          id: campaignId, 
          type: store.fulfillment_type?.toLowerCase() || 'fbs' 
        });
      }
    }

    if (campaignsToFetch.length === 0) {
      throw new Error('No campaign ID configured');
    }

    // Determine date range: explicit params or calculated from days
    const globalDateFrom = explicitDateFrom || getDateRange(days).dateFrom;
    const globalDateTo = explicitDateTo || getDateRange(days).dateTo;
    
    console.log(`[yandex-orders] Fetching orders for ${store.name} from ${campaignsToFetch.length} campaign(s) (${globalDateFrom} to ${globalDateTo})`);

    let totalSynced = 0;
    let totalFailed = 0;
    let totalReceived = 0;
    const startTime = Date.now();
    let nextDateFrom: string | null = null;
    let completed = true;

    // Generate date chunks (14-day windows)
    const dateChunks: Array<{ from: string; to: string }> = [];
    {
      let chunkStart = new Date(globalDateFrom);
      const endDate = new Date(globalDateTo);
      while (chunkStart <= endDate) {
        const chunkEnd = new Date(chunkStart.getTime() + (CHUNK_DAYS - 1) * 24 * 60 * 60 * 1000);
        const actualEnd = chunkEnd > endDate ? endDate : chunkEnd;
        dateChunks.push({
          from: chunkStart.toISOString().split('T')[0],
          to: actualEnd.toISOString().split('T')[0],
        });
        chunkStart = new Date(actualEnd.getTime() + 24 * 60 * 60 * 1000);
      }
    }
    console.log(`[yandex-orders] Split into ${dateChunks.length} date chunks`);

    // Process each date chunk
    for (const chunk of dateChunks) {
      // Timeout guard
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        nextDateFrom = chunk.from;
        completed = false;
        console.log(`[yandex-orders] Timeout approaching, stopping at ${chunk.from}`);
        break;
      }

      for (const campaign of campaignsToFetch) {
        let pageToken: string | undefined;
        let pageCount = 0;

        do {
          if (pageCount > 0) {
            await delay(API_DELAY_MS);
          }

          // Check timeout inside pagination loop too
          if (Date.now() - startTime > MAX_EXECUTION_MS) {
            nextDateFrom = chunk.from;
            completed = false;
            console.log(`[yandex-orders] Timeout in pagination at chunk ${chunk.from}`);
            break;
          }

          const requestBody: Record<string, unknown> = {
            dateFrom: chunk.from,
            dateTo: chunk.to,
            limit: 200,
          };
          
          if (pageToken) {
            requestBody.pageToken = pageToken;
          }

          const response = await fetch(
            `${YANDEX_API_BASE}/v2/campaigns/${campaign.id}/stats/orders`,
          {
            method: 'POST',
            headers: {
              'Api-Key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[yandex-orders] Campaign ${campaign.id} page ${pageCount} error: ${response.status} - ${errorText}`);
          break; // Exit pagination loop on error
        }

        const data = await response.json();
        const orders: YandexOrder[] = data.result?.orders || [];
        pageToken = data.result?.paging?.nextPageToken || data.paging?.nextPageToken;
        
        console.log(`[yandex-orders] Campaign ${campaign.id} page ${pageCount}: ${orders.length} orders${pageToken ? ' (has more)' : ''}`);
        totalReceived += orders.length;

        for (const order of orders) {
        try {
            let totalAmount = 0;
            let itemsTotal = 0;
            const itemsData: Record<string, unknown>[] = [];

            // Pre-fetch listing images for this order's items (cross-store fallback)
            const offerIds = (order.items || []).map(it => it.offerId || it.shopSku).filter(Boolean);
            let imageMap: Record<string, string> = {};
            if (offerIds.length > 0) {
              // First try: same store
              const { data: sameStoreListings } = await supabase
                .from('marketplace_listings')
                .select('external_sku, image_url')
                .eq('store_id', store_id)
                .in('external_sku', offerIds);
              if (sameStoreListings) {
                for (const ml of sameStoreListings) {
                  if (ml.external_sku && ml.image_url) {
                    imageMap[ml.external_sku] = ml.image_url;
                  }
                }
              }
              // Fallback: cross-store for missing SKUs
              const missingSkus = offerIds.filter(sku => !imageMap[sku]);
              if (missingSkus.length > 0) {
                const { data: crossStoreListings } = await supabase
                  .from('marketplace_listings')
                  .select('external_sku, image_url')
                  .neq('store_id', store_id)
                  .in('external_sku', missingSkus)
                  .not('image_url', 'is', null);
                if (crossStoreListings) {
                  for (const ml of crossStoreListings) {
                    if (ml.external_sku && ml.image_url && !imageMap[ml.external_sku]) {
                      imageMap[ml.external_sku] = ml.image_url;
                    }
                  }
                }
              }
            }
            
            // Extract delivery fee from "Delivery" pseudo-item and filter it out
            let deliveryFee = 0;
            for (const item of order.items || []) {
              // Skip the "Delivery" pseudo-item — capture its price separately
              if (item.offerName === 'Delivery') {
                deliveryFee += item.prices?.find(p => p.type === 'BUYER')?.total || 0;
                continue;
              }

              const itemPrice = item.prices?.find(p => p.type === 'BUYER')?.total || 
                                item.prices?.[0]?.total || 0;
              itemsTotal += itemPrice;
              
              const itemSku = item.offerId || item.shopSku;
              itemsData.push({
                offerId: itemSku,
                offerName: item.offerName,
                title: item.offerName,
                quantity: item.count,
                count: item.count,
                price: item.prices?.find(p => p.type === 'BUYER')?.costPerItem || 0,
                marketSku: item.marketSku,
                image: itemSku ? (imageMap[itemSku] || null) : null,
              });
            }
            
            totalAmount = order.payments?.reduce((sum, p) => sum + (p.total || 0), 0) || itemsTotal;

            const fulfillmentType = campaign.type === 'standard' ? 'fbs' : (campaign.type || 'fbs');
            const fulfillmentStatus = normalizeYandexStatus(order.status, order.substatus);

            // Check if this order already exists (for detecting status changes)
            let previousStatus: string | null = null;
            if (fulfillmentType === 'fbs') {
              const { data: existingOrder } = await supabase
                .from('marketplace_orders')
                .select('fulfillment_status')
                .eq('store_id', store_id)
                .eq('external_order_id', String(order.id))
                .maybeSingle();
              previousStatus = existingOrder?.fulfillment_status || null;
            }

            // Extract real commissions from API — separate marketplace commission from delivery fees
            let marketplaceCommission = 0;
            let deliveryCommission = 0;
            for (const c of order.commissions || []) {
              if (c.type === 'DELIVERY_TO_CUSTOMER' || c.type === 'EXPRESS_DELIVERY_TO_CUSTOMER') {
                deliveryCommission += c.actual || 0;
              } else {
                marketplaceCommission += c.actual || 0;
              }
            }
            // Fallback: if no commission data from API for delivered orders, use 5% estimate
            if (marketplaceCommission === 0 && deliveryCommission === 0 && fulfillmentStatus === 'delivered') {
              marketplaceCommission = Math.round(totalAmount * 0.05);
            }

            const orderData: Record<string, unknown> = {
              store_id,
              external_order_id: String(order.id),
              order_number: order.partnerOrderId || String(order.id),
              fulfillment_type: fulfillmentType,
              status: order.status,
              fulfillment_status: fulfillmentStatus,
              substatus: order.substatus,
              payment_status: order.paymentType,
              shipping_address: order.deliveryRegion ? { region: order.deliveryRegion.name } : null,
              notes: order.externalOrderId ? `extId:${order.externalOrderId}${order.fake ? ' [TEST]' : ''}` : (order.fake ? '[TEST]' : null),
              total_amount: totalAmount,
              items_total: itemsTotal,
              commission: marketplaceCommission,
              delivery_fee: deliveryFee || deliveryCommission,
              delivery_cost: deliveryCommission,
              currency: 'UZS',
              items: itemsData,
              ordered_at: order.creationDate,
              last_synced_at: new Date().toISOString(),
            };

            // Set delivered_at when order is delivered (for delivery-date revenue recognition)
            if (fulfillmentStatus === 'delivered') {
              orderData.delivered_at = order.statusUpdateDate || new Date().toISOString();
            }

            const { error: upsertError } = await supabase
              .from('marketplace_orders')
              .upsert(orderData, { onConflict: 'store_id,external_order_id' });

            if (upsertError) {
              totalFailed++;
              console.error(`[yandex-orders] Failed to upsert order ${order.id}:`, upsertError);
            } else {
              totalSynced++;

              // === FBS STOCK DECREMENT: Auto-decrease Tashkent warehouse stock ===
              if (fulfillmentType === 'fbs') {
                const isNewOrder = previousStatus === null && ['shipped', 'pending'].includes(fulfillmentStatus);
                const isCancelled = fulfillmentStatus === 'cancelled' && previousStatus !== null && previousStatus !== 'cancelled';
                const isReturned = fulfillmentStatus === 'returned' && previousStatus !== null && previousStatus !== 'returned';

                if (isNewOrder || isCancelled || isReturned) {
                  for (const item of order.items || []) {
                    // Find product by offerId (SKU) in marketplace_listings with fallback search
                    const itemSku = item.offerId || item.shopSku;
                    let listing: { product_id: string } | null = null;

                    // Primary: search by external_sku
                    if (itemSku) {
                      const { data } = await supabase
                        .from('marketplace_listings')
                        .select('product_id')
                        .eq('store_id', store_id)
                        .eq('external_sku', itemSku)
                        .not('product_id', 'is', null)
                        .maybeSingle();
                      listing = data;
                    }

                    // Fallback: search by external_barcode
                    if (!listing && itemSku) {
                      const { data } = await supabase
                        .from('marketplace_listings')
                        .select('product_id')
                        .eq('store_id', store_id)
                        .eq('external_barcode', itemSku)
                        .not('product_id', 'is', null)
                        .maybeSingle();
                      listing = data;
                    }

                    if (listing?.product_id) {
                      // Try variant resolution via variant_sku_mappings
                      let variantId: string | null = null;
                      const skuCandidates = [itemSku].filter(Boolean);
                      for (const candidate of skuCandidates) {
                        if (!candidate) continue;
                        const { data: mapping } = await supabase
                          .from('variant_sku_mappings')
                          .select('variant_id')
                          .eq('store_id', store_id)
                          .eq('external_sku', candidate)
                          .maybeSingle();
                        if (mapping?.variant_id) {
                          variantId = mapping.variant_id;
                          break;
                        }
                      }

                      if (isNewOrder) {
                        // Decrement stock for new FBS orders
                        await supabase.rpc('decrement_tashkent_stock', {
                          p_product_id: listing.product_id,
                          p_quantity: item.count,
                          p_variant_id: variantId,
                        });
                        console.log(`[yandex-orders] Stock decremented: product=${listing.product_id}, variant=${variantId}, qty=${item.count}`);
                      } else {
                        // Restore stock for cancelled/returned orders (negative quantity = increment)
                        await supabase.rpc('decrement_tashkent_stock', {
                          p_product_id: listing.product_id,
                          p_quantity: -(item.count),
                          p_variant_id: variantId,
                        });
                        console.log(`[yandex-orders] Stock restored: product=${listing.product_id}, variant=${variantId}, qty=${item.count} (${fulfillmentStatus})`);
                      }
                    }
                  }
                }
              }
            }
          } catch (err) {
            totalFailed++;
            console.error(`[yandex-orders] Error processing order ${order.id}:`, err);
          }
        }

          pageCount++;
          
          if (pageCount >= MAX_PAGES) {
            console.log(`[yandex-orders] Reached max pages (${MAX_PAGES}) for campaign ${campaign.id}`);
            break;
          }
          
        } while (pageToken && completed);
        
        if (!completed) break;
      }

      if (!completed) break;
      console.log(`[yandex-orders] Chunk ${chunk.from}-${chunk.to}: done`);
    }

    await supabase
      .from('marketplace_stores')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', store_id);

    return new Response(
      JSON.stringify({
        success: true,
        store: store.name,
        campaigns_processed: campaignsToFetch.length,
        orders_received: totalReceived,
        synced: totalSynced,
        failed: totalFailed,
        date_range: { dateFrom: globalDateFrom, dateTo: globalDateTo },
        nextDateFrom,
        completed,
        chunks_total: dateChunks.length,
        elapsed_ms: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
