import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UZUM_API_BASE = 'https://api-seller.uzum.uz/api/seller-openapi';

// Rate limiting configuration
const API_DELAY_MS = 300;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_PAGES_PER_STATUS = 20;
const FULL_SYNC_MAX_PAGES = 100;
const MAX_EXECUTION_MS = 50000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Normalize epoch timestamp to seconds (Uzum API expects seconds, not milliseconds)
function normalizeEpoch(timestamp: number | undefined): number | undefined {
  if (!timestamp) return undefined;
  if (timestamp >= 1e12) {
    return Math.floor(timestamp / 1000);
  }
  return timestamp;
}

// Map Uzum status to normalized fulfillment_status
function mapToFulfillmentStatus(uzumStatus: string): string {
  const statusMap: Record<string, string> = {
    'CREATED': 'pending',
    'PACKING': 'pending',
    'PENDING_DELIVERY': 'pending',
    'DELIVERING': 'shipped',
    'DELIVERED': 'delivered',
    'ACCEPTED_AT_DP': 'shipped',
    'DELIVERED_TO_CUSTOMER_DELIVERY_POINT': 'shipped',
    'COMPLETED': 'delivered',
    'CANCELED': 'cancelled',
    'PENDING_CANCELLATION': 'cancelled',
    'RETURNED': 'returned',
  };
  return statusMap[uzumStatus] || 'pending';
}

// Normalize fulfillment type to lowercase database format
// NOTE: isFbuEndpoint parameter removed — it was dangerous and could stamp ALL orders as fbu
function normalizeFulfillmentType(scheme: string | undefined): string {
  if (!scheme) return 'fbs';
  const normalized = scheme.toLowerCase();
  if (normalized === 'fbo') return 'fbu';
  return normalized;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, options);
    
    if (response.status === 429 && attempt < retries) {
      const waitTime = RETRY_DELAY_MS * attempt;
      console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}`);
      await delay(waitTime);
      continue;
    }
    
    return response;
  }
  return fetch(url, options);
}

// All possible order statuses
const ORDER_STATUSES = [
  'CREATED',
  'PACKING', 
  'PENDING_DELIVERY',
  'DELIVERING',
  'DELIVERED',
  'ACCEPTED_AT_DP',
  'DELIVERED_TO_CUSTOMER_DELIVERY_POINT',
  'COMPLETED',
  'CANCELED',
  'PENDING_CANCELLATION',
  'RETURNED'
];

interface UzumOrder {
  id: number;
  status: string;
  dateCreated: number;
  acceptUntil?: number;
  deliverUntil?: number;
  deliveringDate?: number;
  deliveryDate?: number;
  acceptedDate?: number;
  completedDate?: number;
  dateCancelled?: number;
  returnDate?: number;
  cancelReason?: string;
  price: number;
  shopId: number;
  scheme: 'FBS' | 'DBS';
  invoiceNumber?: number;
  place?: string;
  stock?: {
    id: number;
    title: string;
    address: string;
  };
  orderItems: Array<{
    id: number;
    status: string;
    productId: number;
    productTitle: string;
    skuTitle: string;
    skuCharTitle?: string;
    skuCharValue?: string;
    sellerPrice: number;
    amount: number;
    amountReturns: number;
    commission: number;
    sellerProfit: number;
    purchasePrice: number;
    logisticDeliveryFee: number;
    cancelled: number;
    withdrawnProfit: number;
    productImage?: {
      photoKey: string;
      color?: string;
    };
  }>;
  deliveryInfo?: {
    customerFullname: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryComment?: string;
  };
  dropOffPoint?: {
    uuid: string;
    address: string;
    type: string;
  };
  timeSlot?: {
    timeFrom: string;
    timeTo: string;
  };
}

interface UzumApiResponse<T> {
  payload: T;
  errors: Array<{ code: string; message: string }>;
  timestamp: string;
  error: string | null;
}

// Convert Unix milliseconds to ISO string safely
function unixToIso(timestamp: number | undefined): string | null {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return null;
  }
}

// NOTE: FBO sync removed — handled exclusively by uzum-finance -> sync_fbu_orders
// Called from marketplace-auto-sync after FBS order sync

// Convert timestamp to Unix seconds for Finance API
function toUnixSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

// Enrich commission data from finance API
async function enrichCommissionData(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  store_id: string,
  shopId: number,
  apiKey: string
): Promise<{ updated: number; errors: number }> {
  console.log('[uzum-orders] Enriching commission data from finance API...');
  
  let updated = 0;
  let errors = 0;
  let page = 0;
  const maxPages = 20;
  
  const nowSeconds = toUnixSeconds(Date.now());
  const ninetyDaysAgoSeconds = nowSeconds - (90 * 24 * 60 * 60);
  
  try {
    while (page < maxPages) {
      if (page > 0) await delay(API_DELAY_MS);
      
      const params = new URLSearchParams();
      params.append('shopIds', String(shopId));
      for (const s of ['TO_WITHDRAW', 'PROCESSING', 'CANCELED', 'PARTIALLY_CANCELLED']) {
        params.append('statuses', s);
      }
      params.append('dateFrom', String(ninetyDaysAgoSeconds));
      params.append('dateTo', String(nowSeconds));
      params.append('size', '500');
      params.append('page', String(page));
      
      const financeUrl = `${UZUM_API_BASE}/v1/finance/orders?${params}`;
      console.log(`[uzum-orders] Finance API page ${page}: fetching...`);
      
      const financeResponse = await fetchWithRetry(financeUrl, {
        headers: { 
          'Authorization': apiKey, 
          'Content-Type': 'application/json' 
        }
      });
      
      if (!financeResponse.ok) {
        const errorText = await financeResponse.text();
        console.error(`[uzum-orders] Finance API error: ${financeResponse.status} - ${errorText}`);
        errors++;
        break;
      }
      
      const financeData = await financeResponse.json();
      const financeItems = financeData.orderItems || financeData.payload?.items || [];
      
      console.log(`[uzum-orders] Finance page ${page}: ${financeItems.length} items`);
      
      if (financeItems.length === 0) break;
      
      // Group by orderId
      const orderFinance: Record<string, { commission: number; deliveryFee: number; profit: number }> = {};
      
      for (const item of financeItems) {
        const orderId = String(item.orderId);
        if (!orderFinance[orderId]) {
          orderFinance[orderId] = { commission: 0, deliveryFee: 0, profit: 0 };
        }
        orderFinance[orderId].commission += item.commission || 0;
        orderFinance[orderId].deliveryFee += item.logisticDeliveryFee || 0;
        orderFinance[orderId].profit += item.sellerProfit || 0;
      }
      
      for (const [orderId, finance] of Object.entries(orderFinance)) {
        if (finance.commission > 0 || finance.deliveryFee > 0) {
          const { error: updateError } = await supabase
            .from('marketplace_orders')
            .update({ 
              commission: finance.commission,
              delivery_fee: finance.deliveryFee,
              profit: finance.profit > 0 ? finance.profit : null,
            })
            .eq('store_id', store_id)
            .eq('external_order_id', orderId)
            .or('commission.eq.0,commission.is.null');
          
          if (!updateError) {
            updated++;
          } else {
            errors++;
          }
        }
      }
      
      page++;
      if (financeItems.length < 500) break;
    }
    
    console.log(`[uzum-orders] Commission enrichment from API: ${updated} updated, ${errors} errors across ${page} pages`);
    
    // FALLBACK: For any delivered orders still with commission=0, try barcode→listing matching first
    {
      const { data: zeroCommOrders, error: fetchErr } = await supabase
        .from('marketplace_orders')
        .select('id, external_order_id, total_amount, items, delivery_fee')
        .eq('store_id', store_id)
        .eq('fulfillment_status', 'delivered')
        .or('commission.eq.0,commission.is.null')
        .gt('total_amount', 0)
        .limit(500);
      
      if (!fetchErr && zeroCommOrders && zeroCommOrders.length > 0) {
        console.log(`[uzum-orders] Found ${zeroCommOrders.length} delivered orders with commission=0, trying barcode matching...`);
        
        // Collect all barcodes from these orders
        const barcodes = new Set<string>();
        for (const order of zeroCommOrders) {
          const items = Array.isArray(order.items) ? order.items : [];
          for (const item of items) {
            if (item.barcode) barcodes.add(item.barcode);
          }
        }
        
        // Fetch commission rates from listings by barcode
        let listingRates: Record<string, number> = {};
        if (barcodes.size > 0) {
          const { data: listings } = await supabase
            .from('marketplace_listings')
            .select('external_barcode, commission_rate')
            .eq('store_id', store_id)
            .in('external_barcode', Array.from(barcodes))
            .gt('commission_rate', 0);
          
          if (listings) {
            for (const l of listings) {
              if (l.external_barcode && l.commission_rate > 0) {
                listingRates[l.external_barcode] = l.commission_rate;
              }
            }
          }
          console.log(`[uzum-orders] Found ${Object.keys(listingRates).length} barcode→commission_rate matches from listings`);
        }
        
        // Store average fallback rate
        let fallbackRate = 0.20;
        const { data: avgData } = await supabase
          .from('marketplace_orders')
          .select('commission, total_amount')
          .eq('store_id', store_id)
          .eq('fulfillment_status', 'delivered')
          .gt('commission', 0)
          .gt('total_amount', 0)
          .limit(200);
        
        if (avgData && avgData.length > 0) {
          const totalComm = avgData.reduce((s: number, o: { commission: number }) => s + o.commission, 0);
          const totalAmt = avgData.reduce((s: number, o: { total_amount: number }) => s + o.total_amount, 0);
          if (totalAmt > 0) fallbackRate = totalComm / totalAmt;
        }
        
        let barcodeUpdated = 0;
        let fallbackUpdated = 0;
        
        for (const order of zeroCommOrders) {
          const items = Array.isArray(order.items) ? order.items : [];
          const firstBarcode = items[0]?.barcode;
          
          // Priority 1: Use exact barcode→listing commission_rate
          let commissionRate = firstBarcode ? listingRates[firstBarcode] : undefined;
          let method = 'barcode_listing';
          
          // Priority 2: Store average fallback
          if (!commissionRate) {
            commissionRate = fallbackRate * 100; // convert to percentage
            method = 'store_average';
          }
          
          const commission = Math.round(order.total_amount * commissionRate / 100);
          const profit = order.total_amount - commission - (order.delivery_fee || 0);
          
          const { error: upErr } = await supabase
            .from('marketplace_orders')
            .update({ commission, profit: profit > 0 ? profit : null })
            .eq('id', order.id)
            .or('commission.eq.0,commission.is.null');
          
          if (!upErr) {
            if (method === 'barcode_listing') barcodeUpdated++;
            else fallbackUpdated++;
          }
        }
        
        console.log(`[uzum-orders] Commission enrichment fallback: ${barcodeUpdated} via barcode, ${fallbackUpdated} via store avg (${(fallbackRate * 100).toFixed(1)}%)`);
        updated += barcodeUpdated + fallbackUpdated;
      } else if (fetchErr) {
        console.error('[uzum-orders] Error fetching zero-commission orders:', fetchErr);
      } else {
        console.log('[uzum-orders] No delivered orders with zero commission found');
      }
    }
    
    console.log(`[uzum-orders] Commission enrichment complete: ${updated} total updated`);
    
  } catch (finErr) {
    console.error('[uzum-orders] Commission enrichment error:', finErr);
    errors++;
  }
  
  return { updated, errors };
}

// Post-sync enrichment: match order items to marketplace_listings for title/image
async function enrichOrderItemsWithListingData(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  store_id: string,
  backfillAll = false,
  maxOrders = 500
): Promise<{ enriched: number; skipped: number; errors: number; hasMore?: boolean }> {
  console.log(`[uzum-orders] Starting enrichment for store ${store_id}, backfillAll=${backfillAll}`);
  
  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  const { data: store } = await supabase
    .from('marketplace_stores')
    .select('id, platform')
    .eq('id', store_id)
    .maybeSingle();

  let listingsQuery = supabase
    .from('marketplace_listings')
    .select('external_product_id, external_sku, external_barcode, title, image_url, store_id');
  
  if (store?.platform === 'uzum') {
    const { data: uzumStores } = await supabase
      .from('marketplace_stores')
      .select('id')
      .eq('platform', 'uzum');
    const uzumStoreIds = uzumStores?.map((s: { id: string }) => s.id) || [store_id];
    listingsQuery = listingsQuery.in('store_id', uzumStoreIds);
  } else {
    listingsQuery = listingsQuery.eq('store_id', store_id);
  }

  const { data: listings, error: listingsError } = await listingsQuery;
  
  if (listingsError || !listings?.length) {
    console.log(`[uzum-orders] No listings found for store ${store_id}`);
    return { enriched: 0, skipped: 0, errors: listingsError ? 1 : 0 };
  }

  const listingByBarcode = new Map<string, { title: string; externalProductId: string | null; imageUrl: string | null }>();
  const listingByProductId = new Map<string, { title: string; externalProductId: string | null; imageUrl: string | null }>();
  const listingBySku = new Map<string, { title: string; externalProductId: string | null; imageUrl: string | null }>();
  
  for (const listing of listings) {
    const entry = {
      title: listing.title,
      externalProductId: listing.external_product_id,
      imageUrl: listing.image_url || null,
    };
    if (listing.external_barcode) {
      listingByBarcode.set(String(listing.external_barcode), entry);
    }
    if (listing.external_product_id) {
      listingByProductId.set(String(listing.external_product_id), entry);
    }
    if (listing.external_sku) {
      listingBySku.set(String(listing.external_sku), entry);
    }
  }

  console.log(`[uzum-orders] Loaded ${listings.length} listings, ${listingByBarcode.size} with barcode`);

  // deno-lint-ignore no-explicit-any
  let allOrders: any[] = [];
  let offset = 0;
  const batchSize = 500;
  const startTime = Date.now();

  while (true) {
    let query = supabase
      .from('marketplace_orders')
      .select('id, external_order_id, items')
      .eq('store_id', store_id)
      .range(offset, offset + batchSize - 1)
      .order('ordered_at', { ascending: backfillAll });

    if (!backfillAll) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('ordered_at', thirtyDaysAgo);
    }

    const { data: batch, error: batchError } = await query;
    if (batchError || !batch?.length) break;
    allOrders = allOrders.concat(batch);
    offset += batchSize;
    if (batch.length < batchSize) break;
    if (allOrders.length >= maxOrders) break;
  }

  console.log(`[uzum-orders] Found ${allOrders.length} orders to check for enrichment (max=${maxOrders})`);

  let processedCount = 0;
  for (const order of allOrders) {
    // Timeout guard: stop if approaching edge function timeout
    if (Date.now() - startTime > 45000) {
      console.log(`[uzum-orders] Enrichment timeout guard hit after ${processedCount} orders`);
      break;
    }
    processedCount++;
    // deno-lint-ignore no-explicit-any
    const items: any[] = order.items || [];
    if (items.length === 0) { skipped++; continue; }

    let modified = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.image && typeof item.image === 'object') {
        const photoKey = item.image?.photoKey || item.image?.photo?.photoKey;
        if (photoKey) {
          items[i] = { ...item, image: `https://images.uzum.uz/${photoKey}/t_product_240_high.jpg` };
          modified = true;
        } else {
          items[i] = { ...item, image: null };
          modified = true;
        }
      }
      
      const hasRealTitle = item.title && item.title !== item.skuTitle;
      const hasUndefined = item.skuFullTitle && String(item.skuFullTitle).startsWith('undefined');
      const hasImageUrl = item.image && typeof item.image === 'string' && item.image.startsWith('http');
      const needsEnrichment = !hasRealTitle || hasUndefined || !hasImageUrl;

      if (!needsEnrichment && !backfillAll) continue;

      if (item.barcode) {
        const listing = listingByBarcode.get(String(item.barcode));
        if (listing) {
          items[i] = {
            ...items[i],
            title: listing.title,
            image: items[i].image || listing.imageUrl || null,
            skuFullTitle: `${listing.title} - ${item.skuTitle || ''}`.trim(),
            productId: item.productId || listing.externalProductId || null,
          };
          modified = true;
          continue;
        }
      }

      const skuId = String(item.skuId || item.id);
      const listingBySku_ = listingBySku.get(skuId);
      if (listingBySku_) {
        items[i] = {
          ...items[i],
          title: listingBySku_.title,
          image: items[i].image || listingBySku_.imageUrl || null,
          skuFullTitle: `${listingBySku_.title} - ${item.skuTitle || ''}`.trim(),
          productId: item.productId || listingBySku_.externalProductId || null,
        };
        modified = true;
        continue;
      }

      if (item.productId) {
        const listing = listingByProductId.get(String(item.productId));
        if (listing) {
          items[i] = {
            ...items[i],
            title: listing.title,
            image: items[i].image || listing.imageUrl || null,
            skuFullTitle: `${listing.title} - ${item.skuTitle || ''}`.trim(),
          };
          modified = true;
          continue;
        }
      }

      if (!items[i].title && item.skuTitle) {
        items[i] = {
          ...items[i],
          title: item.skuTitle,
          skuFullTitle: item.skuTitle,
        };
        modified = true;
        continue;
      }

      if (hasUndefined) {
        items[i] = {
          ...items[i],
          skuFullTitle: item.skuTitle || item.title || null,
        };
        modified = true;
      }
    }

    if (modified) {
      const { error: updateError } = await supabase
        .from('marketplace_orders')
        .update({ items })
        .eq('id', order.id);

      if (updateError) {
        errors++;
      } else {
        enriched++;
      }
    } else {
      skipped++;
    }
  }

  const hasMore = processedCount < allOrders.length || allOrders.length >= maxOrders;
  console.log(`[uzum-orders] Enrichment complete: ${enriched} enriched, ${skipped} skipped, ${errors} errors, hasMore=${hasMore}`);
  return { enriched, skipped, errors, hasMore };
}

// Transform a single Uzum API order to DB record
function transformOrderToRecord(
  order: UzumOrder, 
  store_id: string,
): Record<string, unknown> {
  return {
    store_id,
    external_order_id: String(order.id),
    status: order.status,
    fulfillment_status: mapToFulfillmentStatus(order.status),
    customer_name: order.deliveryInfo?.customerFullname,
    customer_phone: order.deliveryInfo?.customerPhone,
    shipping_address: order.dropOffPoint?.address || order.deliveryInfo?.deliveryAddress,
    total_amount: order.price,
    currency: 'UZS',
    fulfillment_type: normalizeFulfillmentType(order.scheme),
    delivery_fee: order.orderItems?.reduce((sum, item) => sum + (item.logisticDeliveryFee || 0), 0) || 0,
    items: order.orderItems?.map((item) => {
      // deno-lint-ignore no-explicit-any
      const rawItem = item as any;
      const actualTitle = rawItem.title !== rawItem.skuTitle ? rawItem.title : null;
      const skuTitle = rawItem.skuTitle ?? null;
      let imageUrl: string | null = null;
      if (rawItem.photo?.photoKey) {
        imageUrl = `https://images.uzum.uz/${rawItem.photo.photoKey}/t_product_240_high.jpg`;
      } else if (rawItem.productImage?.photoKey) {
        imageUrl = `https://images.uzum.uz/${rawItem.productImage.photoKey}/t_product_240_high.jpg`;
      }
      return {
        id: rawItem.id,
        status: rawItem.status ?? null,
        productId: rawItem.productId ?? null,
        skuId: rawItem.skuId ?? rawItem.id,
        barcode: rawItem.barcode ? String(rawItem.barcode) : null,
        title: actualTitle,
        skuTitle: skuTitle,
        skuFullTitle: actualTitle 
          ? `${actualTitle} - ${skuTitle || ''}`.trim()
          : skuTitle,
        variant: rawItem.skuCharValue ?? rawItem.identifierInfo ?? null,
        price: rawItem.sellerPrice ?? rawItem.price ?? null,
        quantity: rawItem.amount,
        returned: rawItem.amountReturns ?? null,
        cancelled: rawItem.cancelled ?? null,
        commission: rawItem.commission ?? null,
        profit: rawItem.sellerProfit ?? null,
        purchasePrice: rawItem.purchasePrice ?? null,
        deliveryFee: rawItem.logisticDeliveryFee ?? null,
        image: imageUrl,
      };
    }) || [],
    ordered_at: unixToIso(order.dateCreated),
    accepted_at: unixToIso(order.acceptedDate),
    cancelled_at: unixToIso(order.dateCancelled),
    cancellation_reason: order.cancelReason,
    // Only write commission if API returns > 0, otherwise preserve existing value
    ...((() => {
      const apiCommission = order.orderItems?.reduce((sum, item) => sum + (item.commission || 0), 0) || 0;
      return apiCommission > 0 ? { commission: apiCommission } : {};
    })()),
    // Calculate profit: prefer API sellerProfit sum, fallback to total - commission - delivery
    ...((() => {
      const itemsProfit = order.orderItems?.reduce(
        (sum: number, item: { sellerProfit?: number }) => sum + (item.sellerProfit || 0), 0
      ) || 0;
      if (itemsProfit > 0) return { profit: itemsProfit };
      const apiCommission = order.orderItems?.reduce(
        (sum: number, item: { commission?: number }) => sum + (item.commission || 0), 0
      ) || 0;
      const apiDeliveryFee = order.orderItems?.reduce(
        (sum: number, item: { logisticDeliveryFee?: number }) => sum + (item.logisticDeliveryFee || 0), 0
      ) || 0;
      if (apiCommission > 0 || apiDeliveryFee > 0) {
        return { profit: (order.price || 0) - apiCommission - apiDeliveryFee };
      }
      return {};
    })()),
    // Set delivered_at when order is delivered (for delivery-date revenue recognition)
    // Use API dates if available, fallback to ordered_at (NOT new Date() which would stamp sync time)
    ...(mapToFulfillmentStatus(order.status) === 'delivered'
      ? { delivered_at: unixToIso(order.acceptedDate) || unixToIso(order.completedDate) || unixToIso(order.dateCreated) || new Date().toISOString() }
      : {}),
    last_synced_at: new Date().toISOString(),
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

    const { 
      store_id, 
      action = 'sync', 
      statuses = ORDER_STATUSES,
      scheme,
      date_from,
      date_to,
      size = 50,
      order_id,
      enrich_commission = true,
      lightweight = false,
      backfill_all = false,
    } = await req.json();

    // bulk_reverse_reconcile does NOT need store_id — it handles ALL stores internally
    if (action === 'bulk_reverse_reconcile') {
      console.log('[uzum-orders] bulk_reverse_reconcile: starting across ALL Uzum stores...');
      const bulkStart = Date.now();
      
      const { data: allStores } = await supabase
        .from('marketplace_stores')
        .select('id, name')
        .eq('platform', 'uzum');
      
      const storeResults: Array<{
        store_id: string;
        name: string;
        scanned: number;
        finance_stamped: number;
        updated_to_fbu: number;
      }> = [];
      
      let totalFixed = 0;
      
      // XIT MARKET EXCLUDED: dual-listed store where FBS orders also have financeStatus.
      // Xit market must use probe_fbu_for_fbs action instead for safe API-based restoration.
      const XIT_MARKET_NAME = 'Xit market';
      
      for (const uzumStore of (allStores || [])) {
        // Skip Xit market — it requires API probe, not bulk fingerprint matching
        if (uzumStore.name === XIT_MARKET_NAME) {
          storeResults.push({
            store_id: uzumStore.id,
            name: uzumStore.name,
            scanned: 0,
            finance_stamped: 0,
            updated_to_fbu: 0,
          });
          console.log(`[bulk_reverse_reconcile] Skipping ${uzumStore.name} (dual-listing store — use probe_fbu_for_fbs instead)`);
          continue;
        }
        
        // Fetch ALL fbs orders with pagination (Supabase default limit is 1000)
        const allFbs: any[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data: pageData, error: pageErr } = await supabase
            .from('marketplace_orders')
            .select('id, external_order_id, items')
            .eq('store_id', uzumStore.id)
            .eq('fulfillment_type', 'fbs')
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (pageErr || !pageData || pageData.length === 0) break;
          allFbs.push(...pageData);
          if (pageData.length < pageSize) break;
          page++;
        }
        
        const financeStamped = allFbs.filter((o: any) => {
          try {
            const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]');
            return items.some((item: any) => 'financeStatus' in item);
          } catch { return true; }
        });
        
        let storeFixed = 0;
        const ids = financeStamped.map((o: any) => o.external_order_id).filter(Boolean);
        
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          const { error: updateErr } = await supabase
            .from('marketplace_orders')
            .update({ fulfillment_type: 'fbu' })
            .eq('store_id', uzumStore.id)
            .in('external_order_id', chunk);
          
          if (!updateErr) {
            storeFixed += chunk.length;
          } else {
            console.error(`[bulk_reverse_reconcile] ${uzumStore.name} error:`, updateErr.message);
          }
        }
        
        totalFixed += storeFixed;
        storeResults.push({
          store_id: uzumStore.id,
          name: uzumStore.name,
          scanned: allFbs.length,
          finance_stamped: financeStamped.length,
          updated_to_fbu: storeFixed,
        });
        
        console.log(`[bulk_reverse_reconcile] ${uzumStore.name}: scanned=${allFbs.length}, finance_stamped=${financeStamped.length}, fixed=${storeFixed}`);
      }
      
      const elapsed = Math.round((Date.now() - bulkStart) / 1000);
      const bulkResult = {
        action: 'bulk_reverse_reconcile',
        elapsed_seconds: elapsed,
        total_stores: allStores?.length || 0,
        total_fixed: totalFixed,
        stores: storeResults.sort((a, b) => b.updated_to_fbu - a.updated_to_fbu),
        message: `Bulk fix complete: ${totalFixed} Finance-stamped FBS orders restored to fbu across ${allStores?.length} stores in ${elapsed}s`,
      };
      
      return new Response(
        JSON.stringify({ success: true, result: bulkResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!store_id) {
      throw new Error('store_id is required');
    }

    // Get store configuration
    const { data: store, error: storeError } = await supabase
      .from('marketplace_stores')
      .select('*')
      .eq('id', store_id)
      .eq('platform', 'uzum')
      .single();

    if (storeError || !store) {
      throw new Error(`Store not found: ${storeError?.message}`);
    }

    const apiKey = Deno.env.get(store.api_key_secret_name);
    if (!apiKey) {
      throw new Error(`API key not configured: ${store.api_key_secret_name}`);
    }

    const shopId = parseInt(store.shop_id);
    let result: unknown = null;

    if (action === 'sync') {
      // FIX: NO sync log here -- marketplace-auto-sync creates its own log.
      // This eliminates duplicate "running" logs that never complete.

      let totalOrders = 0;
      let totalSynced = 0;
      let totalFailed = 0;

      // Full sync mode when explicit date_from is provided
      const isFullSync = !!date_from;
      const maxPages = isFullSync ? FULL_SYNC_MAX_PAGES : MAX_PAGES_PER_STATUS;
      const syncStartTime = Date.now();
      
      // FIX: Lightweight mode uses status-dependent lookback
      // terminalLookbackDays increased from 30→90 to allow the fbu→fbs correction
      // check to heal more wrongly-classified orders that Finance API writes 6 months back
      const now = Date.now();
      const defaultLookbackDays = lightweight ? 7 : 60;
      const terminalLookbackDays = lightweight ? 90 : 180;  // was: 30 / 60
      const terminalStatuses = ['COMPLETED', 'RETURNED', 'CANCELED', 'PENDING_CANCELLATION'];
      const defaultLookbackMs = now - (defaultLookbackDays * 24 * 60 * 60 * 1000);
      console.log(`[uzum-orders] Mode: ${lightweight ? 'LIGHTWEIGHT (7d normal / 90d terminal)' : 'FULL (60d normal / 180d terminal)'}`);
      
      const dateToParam = normalizeEpoch(date_to || now);
      
      // Collect all orders from API
      const ordersMap = new Map<number, UzumOrder>();

      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];
        let page = 0;
        let hasMore = true;
        
        const isTerminal = terminalStatuses.includes(status);
        const statusLookbackMs = isTerminal 
          ? now - (terminalLookbackDays * 24 * 60 * 60 * 1000)
          : defaultLookbackMs;
        const dateFromParam = normalizeEpoch(date_from || statusLookbackMs);
        
        while (hasMore && page < maxPages) {
          // Timeout guard for full sync mode
          if (isFullSync && Date.now() - syncStartTime > MAX_EXECUTION_MS) {
            console.log(`[uzum-orders] Timeout guard triggered at status=${status}, page=${page}`);
            hasMore = false;
            break;
          }
          if (page > 0 || i > 0) {
            await delay(API_DELAY_MS);
          }
          
          const params = new URLSearchParams({
            shopIds: String(shopId),
            status,
            page: String(page),
            size: String(size),
          });
          if (scheme) params.append('scheme', scheme);
          if (dateFromParam) params.append('dateFrom', String(dateFromParam));
          if (dateToParam) params.append('dateTo', String(dateToParam));

          const url = `${UZUM_API_BASE}/v2/fbs/orders?${params}`;
          
          if (page === 0) {
            console.log(`[uzum-orders] Fetching ${status} orders...`);
          }

          const response = await fetchWithRetry(url, {
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            console.error(`[uzum-orders] Failed to fetch ${status} page ${page}: ${response.status}`);
            break;
          }

          const data: UzumApiResponse<{ orders: UzumOrder[]; totalAmount: number }> = await response.json();
          const orders = data.payload?.orders || [];
          
          console.log(`[uzum-orders] Status ${status} page ${page}: ${orders.length} orders`);
          
          for (const order of orders) {
            ordersMap.set(order.id, order);
          }
          
          hasMore = orders.length === size;
          page++;
        }
      }
      
      // Fallback: if zero orders, try without date filter
      if (ordersMap.size === 0) {
        console.log(`[uzum-orders] No orders found with date filter. Trying fallback...`);
        
        for (const status of ['CREATED', 'PACKING', 'DELIVERING', 'DELIVERED']) {
          await delay(API_DELAY_MS);
          
          const url = `${UZUM_API_BASE}/v2/fbs/orders?shopIds=${shopId}&status=${status}&page=0&size=50`;
          
          const response = await fetchWithRetry(url, {
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            const orders = data.payload?.orders || [];
            console.log(`[uzum-orders] Fallback ${status}: ${orders.length} orders`);
            
            for (const order of orders) {
              ordersMap.set(order.id, order);
            }
          }
        }
      }

      const allOrders = Array.from(ordersMap.values());
      totalOrders = allOrders.length;
      
      console.log(`[uzum-orders] Fetched ${totalOrders} unique orders from API`);

      // === INCREMENTAL SYNC: Only upsert NEW or STATUS-CHANGED orders ===
      // Pre-fetch existing orders
      const allExternalIds = allOrders.map(o => String(o.id));
      const existingOrdersMap = new Map<string, { id: string; status: string; fulfillment_status: string; delivered_at: string | null; fulfillment_type: string }>();
      for (let i = 0; i < allExternalIds.length; i += 500) {
        const chunk = allExternalIds.slice(i, i + 500);
        const { data: existingBatch } = await supabase
          .from('marketplace_orders')
          .select('external_order_id, id, status, fulfillment_status, delivered_at, fulfillment_type')
          .eq('store_id', store_id)
          .in('external_order_id', chunk);
        for (const eo of existingBatch || []) {
          existingOrdersMap.set(eo.external_order_id, { id: eo.id, status: eo.status, fulfillment_status: eo.fulfillment_status, delivered_at: eo.delivered_at, fulfillment_type: eo.fulfillment_type });
        }
      }
      console.log(`[uzum-orders] Pre-fetched ${existingOrdersMap.size} existing orders`);

      // Filter: only new, status-changed, or misclassified orders
      // CRITICAL FIX: Also include orders that exist as 'fbu' but come from the FBS API endpoint
      // This corrects the race condition where uzum-finance stamps 'fbu' before uzum-orders can write 'fbs'
      const ordersToUpsert: UzumOrder[] = [];
      let skippedUnchanged = 0;
      let fbuCorrected = 0;
      for (const order of allOrders) {
        const existing = existingOrdersMap.get(String(order.id));
        if (!existing) {
          // New order — insert
          ordersToUpsert.push(order);
        } else if (existing.status !== order.status) {
          // Status changed — update
          ordersToUpsert.push(order);
        } else if (existing.fulfillment_type === 'fbu') {
          // ORDER FROM FBS API ENDPOINT BUT STAMPED AS FBU — correct it
          // transformOrderToRecord will write fulfillment_type:'fbs' since order.scheme is 'FBS'
          ordersToUpsert.push(order);
          fbuCorrected++;
        } else {
          skippedUnchanged++;
        }
      }
      if (fbuCorrected > 0) {
        console.log(`[uzum-orders] ⚠️ FBU→FBS correction: ${fbuCorrected} orders will be reclassified as fbs`);
      }
      console.log(`[uzum-orders] Incremental: ${ordersToUpsert.length} to upsert, ${skippedUnchanged} unchanged (skipped)`);

      // Pre-fetch listings for stock operations
      const allProductIds = new Set<string>();
      for (const order of ordersToUpsert) {
        if (order.scheme === 'FBS' && ['CREATED', 'PACKING', 'CANCELED', 'PENDING_CANCELLATION'].includes(order.status)) {
          for (const item of order.orderItems || []) {
            if (item.productId) allProductIds.add(String(item.productId));
          }
        }
      }
      const listingProductMap = new Map<string, string>();
      if (allProductIds.size > 0) {
        const productIdArr = Array.from(allProductIds);
        for (let i = 0; i < productIdArr.length; i += 500) {
          const chunk = productIdArr.slice(i, i + 500);
          const { data: listingsBatch } = await supabase
            .from('marketplace_listings')
            .select('external_product_id, product_id')
            .eq('store_id', store_id)
            .in('external_product_id', chunk)
            .not('product_id', 'is', null);
          for (const l of listingsBatch || []) {
            if (l.product_id) listingProductMap.set(l.external_product_id, l.product_id);
          }
        }
      }

      // Stock operations (only for new/changed orders)
      for (const order of ordersToUpsert) {
        if (order.scheme !== 'FBS') continue;
        const existing = existingOrdersMap.get(String(order.id));

        // Stock decrement for new CREATED/PACKING orders
        if (['CREATED', 'PACKING'].includes(order.status) && !existing) {
          for (const item of order.orderItems || []) {
            const productId = listingProductMap.get(String(item.productId));
            // Try variant resolution via variant_sku_mappings
            let variantId: string | null = null;
            const itemBarcode = (item as any).barcode ? String((item as any).barcode) : null;
            const itemSkuTitle = item.skuTitle || null;
            if (productId) {
              // Try by barcode first, then by skuTitle
              const skuCandidates = [itemBarcode, itemSkuTitle, String((item as any).skuId || item.id)].filter(Boolean);
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
              await supabase.rpc('decrement_tashkent_stock', {
                p_product_id: productId,
                p_quantity: item.amount,
                p_variant_id: variantId,
              });
            }
          }
        }

        // Stock restore for CANCELED orders
        if (['CANCELED', 'PENDING_CANCELLATION'].includes(order.status) && 
            existing && ['CREATED', 'PACKING'].includes(existing.status)) {
          for (const item of order.orderItems || []) {
            const productId = listingProductMap.get(String(item.productId));
            let variantId: string | null = null;
            const itemBarcode = (item as any).barcode ? String((item as any).barcode) : null;
            const skuCandidates = [itemBarcode, item.skuTitle, String((item as any).skuId || item.id)].filter(Boolean);
            if (productId) {
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
              await supabase.rpc('decrement_tashkent_stock', {
                p_product_id: productId,
                p_quantity: -(item.amount),
                p_variant_id: variantId,
              });
            }
          }
        }
      }

      // === BATCH UPSERT: Only changed/new orders, chunks of 200 ===
      const BATCH_SIZE = 200;
      const orderBatch: Record<string, unknown>[] = [];

      for (const order of ordersToUpsert) {
        const record = transformOrderToRecord(order, store_id);
        // Preserve existing delivered_at: don't overwrite with sync timestamp
        const existing = existingOrdersMap.get(String(order.id));
        if (existing?.delivered_at && record.delivered_at) {
          // Keep the original delivered_at from DB
          record.delivered_at = existing.delivered_at;
        }
        orderBatch.push(record);

        if (orderBatch.length >= BATCH_SIZE) {
          const { error: batchError } = await supabase
            .from('marketplace_orders')
            .upsert(orderBatch, { onConflict: 'store_id,external_order_id' });
          if (batchError) {
            console.error(`[uzum-orders] Batch upsert failed (${orderBatch.length}):`, batchError.message);
            totalFailed += orderBatch.length;
          } else {
            totalSynced += orderBatch.length;
          }
          orderBatch.length = 0;
        }
      }

      // Flush remaining
      if (orderBatch.length > 0) {
        const { error: batchError } = await supabase
          .from('marketplace_orders')
          .upsert(orderBatch, { onConflict: 'store_id,external_order_id' });
        if (batchError) {
          console.error(`[uzum-orders] Final batch upsert failed (${orderBatch.length}):`, batchError.message);
          totalFailed += orderBatch.length;
        } else {
          totalSynced += orderBatch.length;
        }
      }

      console.log(`[uzum-orders] Batch upsert complete: ${totalSynced} synced, ${totalFailed} failed, ${skippedUnchanged} unchanged`);

      // FBO sync
      let fboResult = { synced: 0, errors: 0, skipped: 0 };
      let commissionEnrichment = { updated: 0, errors: 0 };
      let itemEnrichment = { enriched: 0, skipped: 0, errors: 0 };

      // FBO sync removed — handled by uzum-finance -> sync_fbu_orders via marketplace-auto-sync
      console.log('[uzum-orders] FBO sync delegated to uzum-finance function');

      if (!lightweight) {
        if (enrich_commission) {
          commissionEnrichment = await enrichCommissionData(supabase, store_id, shopId, apiKey);
        }
      } else {
        console.log(`[uzum-orders] Lightweight mode: skipping commission enrichment`);
      }

      // Item enrichment (images + titles) ALWAYS runs — no longer gated by totalSynced
      // This ensures finance-created orders (with no images) get enriched every sync cycle
      itemEnrichment = await enrichOrderItemsWithListingData(supabase, store_id, false);

      result = {
        action: 'sync',
        lightweight,
        total_orders: totalOrders,
        synced: totalSynced,
        skipped_unchanged: skippedUnchanged,
        fbs_orders: totalOrders,
        fbo_synced: fboResult.synced,
        fbo_errors: fboResult.errors,
        failed: totalFailed,
        commission_enrichment: commissionEnrichment,
        item_enrichment: itemEnrichment,
      };

    } else if (action === 'get') {
      if (!order_id) throw new Error('order_id is required for get action');
      const url = `${UZUM_API_BASE}/v1/fbs/order/${order_id}`;
      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`Failed to get order: ${response.status}`);
      result = await response.json();

    } else if (action === 'confirm') {
      if (!order_id) throw new Error('order_id is required for confirm action');
      const url = `${UZUM_API_BASE}/v1/fbs/order/${order_id}/confirm`;
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      });
      result = { action: 'confirm', order_id, success: response.ok, response: await response.json() };

    } else if (action === 'cancel') {
      if (!order_id) throw new Error('order_id is required for cancel action');
      const url = `${UZUM_API_BASE}/v1/fbs/order/${order_id}/cancel`;
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      });
      result = { action: 'cancel', order_id, success: response.ok, response: await response.json() };

    } else if (action === 'count') {
      const url = `${UZUM_API_BASE}/v2/fbs/orders/count?shopIds=${shopId}`;
      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      });
      result = await response.json();
      
    } else if (action === 'resync_delivered') {
      console.log('[uzum-orders] Starting resync_delivered action...');
      
      // deno-lint-ignore no-explicit-any
      let ordersToResync: any[] = [];
      let resyncFrom = 0;
      const resyncBatch = 1000;
      while (true) {
        const { data: batch, error: queryError } = await supabase
          .from('marketplace_orders')
          .select('external_order_id, total_amount')
          .eq('store_id', store_id)
          .eq('fulfillment_status', 'delivered')
          .eq('commission', 0)
          .range(resyncFrom, resyncFrom + resyncBatch - 1);
        if (queryError) throw new Error(`Failed to query orders: ${queryError.message}`);
        if (!batch || batch.length === 0) break;
        ordersToResync = ordersToResync.concat(batch);
        if (batch.length < resyncBatch) break;
        resyncFrom += resyncBatch;
      }
      
      console.log(`[uzum-orders] Found ${ordersToResync.length} delivered orders with commission=0`);
      
      // Use Finance API enrichment instead of per-order fetch (much faster)
      const commResult = await enrichCommissionData(supabase, store_id, shopId, apiKey);
      
      result = {
        action: 'resync_delivered',
        orders_checked: ordersToResync.length,
        updated: commResult.updated,
        failed: commResult.errors,
      };

    } else if (action === 'enrich_items') {
      const enrichResult = await enrichOrderItemsWithListingData(supabase, store_id, !!backfill_all);
      result = { action: 'enrich_items', ...enrichResult };

    } else if (action === 'resync_batch') {
      const pageNum = date_from || 0;
      const pageSize = size || 50;
      const targetStatus = statuses?.[0] || 'DELIVERED';
      
      console.log(`[uzum-orders] Batch resync: status=${targetStatus}, page=${pageNum}, size=${pageSize}`);
      
      const params = new URLSearchParams({
        shopIds: String(shopId),
        status: targetStatus,
        page: String(pageNum),
        size: String(pageSize),
      });
      
      const url = `${UZUM_API_BASE}/v2/fbs/orders?${params}`;
      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      const apiOrders = data.payload?.orders || [];
      
      let updated = 0;
      let failed = 0;
      
      // Batch upsert
      const batchRecords = apiOrders.map((order: UzumOrder) => transformOrderToRecord(order, store_id));
      for (let i = 0; i < batchRecords.length; i += 100) {
        const chunk = batchRecords.slice(i, i + 100);
        const { error: upsertError } = await supabase
          .from('marketplace_orders')
          .upsert(chunk, { onConflict: 'store_id,external_order_id' });
        if (upsertError) failed += chunk.length;
        else updated += chunk.length;
      }
      
      const hasMore = apiOrders.length === pageSize;
      result = {
        action: 'resync_batch',
        status: targetStatus,
        page: pageNum,
        batch_size: pageSize,
        fetched: apiOrders.length,
        updated,
        failed,
        next_page: hasMore ? pageNum + 1 : null,
        done: !hasMore,
      };
    } else if (action === 'fix_fulfillment_types') {
      // BACKFILL ACTION: Restore correct fulfillment_type='fbs' for orders wrongly stamped as 'fbu'
      // 
      // STRATEGY (2-phase):
      // Phase 1 — Bulk FBS API: fetch from /v2/fbs/orders bulk list (catches active/recent FBS orders)
      // Phase 2 — Single order probe: for all current 'fbu' orders in DB, probe /v1/fbs/order/{id}.
      //           If the order exists on the FBS endpoint (200 OK, not 404), it is FBS.
      //           Completed FBS orders don't appear in the bulk list but DO appear on single endpoint.
      //
      // This is a surgical fix — only fulfillment_type is updated, nothing else.
      console.log('[uzum-orders] Starting fix_fulfillment_types backfill (Phase 1: bulk FBS list)...');
      
      const fixNow = Date.now();
      const fixSixMonthsAgo = fixNow - (180 * 24 * 60 * 60 * 1000);
      const fixDateFrom = normalizeEpoch(date_from || fixSixMonthsAgo);
      const fixDateTo = normalizeEpoch(date_to || fixNow);
      
      const fbsOrderIds = new Set<string>();
      
      // === Phase 1: Bulk FBS list (catches active/recent FBS orders) ===
      const fbsStatuses = ['CREATED', 'PACKING', 'DELIVERING', 'DELIVERED', 'COMPLETED', 'CANCELED', 'RETURNED', 'ACCEPTED_AT_DP', 'DELIVERED_TO_CUSTOMER_DELIVERY_POINT', 'PENDING_CANCELLATION', 'PENDING_DELIVERY'];
      
      for (const fbsStatus of fbsStatuses) {
        let fbsPage = 0;
        let fbsHasMore = true;
        const fbsPageSize = 200;
        
        while (fbsHasMore && fbsPage < 50) {
          await delay(API_DELAY_MS);
          
          const fbsParams = new URLSearchParams({
            shopIds: String(shopId),
            status: fbsStatus,
            page: String(fbsPage),
            size: String(fbsPageSize),
          });
          if (fixDateFrom) fbsParams.append('dateFrom', String(fixDateFrom));
          if (fixDateTo) fbsParams.append('dateTo', String(fixDateTo));
          
          const fbsUrl = `${UZUM_API_BASE}/v2/fbs/orders?${fbsParams}`;
          const fbsResp = await fetchWithRetry(fbsUrl, {
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
          });
          
          if (!fbsResp.ok) break;
          
          const fbsData = await fbsResp.json();
          const fbsOrders: UzumOrder[] = fbsData.payload?.orders || [];
          
          for (const o of fbsOrders) fbsOrderIds.add(String(o.id));
          
          fbsHasMore = fbsOrders.length === fbsPageSize;
          fbsPage++;
        }
      }
      
      console.log(`[uzum-orders] fix_fulfillment_types Phase 1: ${fbsOrderIds.size} FBS IDs from bulk list`);
      
      // === Phase 2: Probe existing 'fbu' orders in DB against single FBS endpoint ===
      // Fetch up to 2000 current 'fbu' order IDs from DB (limit per run to avoid timeout)
      const probeLimit = Number(size) || 500; // caller can set size to control probe batch
      const { data: fbuOrders } = await supabase
        .from('marketplace_orders')
        .select('external_order_id')
        .eq('store_id', store_id)
        .eq('fulfillment_type', 'fbu')
        .order('ordered_at', { ascending: false })
        .limit(probeLimit);
      
      const fbuOrderIds = (fbuOrders || [])
        .map(o => o.external_order_id)
        .filter(id => !fbsOrderIds.has(id)); // skip already found in bulk
      
      console.log(`[uzum-orders] fix_fulfillment_types Phase 2: probing ${fbuOrderIds.length} FBU orders against FBS single endpoint...`);
      
      let probeChecked = 0;
      let probeFoundFbs = 0;
      const fixStartTime = Date.now();
      
      for (const orderId of fbuOrderIds) {
        // Timeout guard: 45s
        if (Date.now() - fixStartTime > 45000) {
          console.log(`[uzum-orders] fix_fulfillment_types Phase 2: timeout at ${probeChecked} probes`);
          break;
        }
        
        await delay(API_DELAY_MS);
        probeChecked++;
        
        const probeUrl = `${UZUM_API_BASE}/v1/fbs/order/${orderId}`;
        const probeResp = await fetchWithRetry(probeUrl, {
          headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        });
        
        if (probeResp.status === 200) {
          // Order EXISTS on FBS endpoint → it is an FBS order wrongly marked as FBU
          fbsOrderIds.add(orderId);
          probeFoundFbs++;
          console.log(`[uzum-orders] fix_fulfillment_types: FBS confirmed for order ${orderId} (probe)`);
        }
        // 404 = genuine FBU order, skip
      }
      
      console.log(`[uzum-orders] fix_fulfillment_types Phase 2: probed ${probeChecked}, found ${probeFoundFbs} additional FBS orders`);
      
      // === Apply the fix: UPDATE fulfillment_type='fbs' for all confirmed FBS order IDs ===
      const allConfirmedFbsIds = Array.from(fbsOrderIds);
      let fixUpdated = 0;
      let fixErrors = 0;
      
      for (let i = 0; i < allConfirmedFbsIds.length; i += 500) {
        const chunk = allConfirmedFbsIds.slice(i, i + 500);
        const { error: fixErr, count } = await supabase
          .from('marketplace_orders')
          .update({ fulfillment_type: 'fbs' })
          .eq('store_id', store_id)
          .eq('fulfillment_type', 'fbu')
          .in('external_order_id', chunk);
        
        if (fixErr) {
          console.error(`[uzum-orders] fix_fulfillment_types chunk error:`, fixErr.message);
          fixErrors++;
        } else {
          fixUpdated += (count || 0);
        }
      }
      
      console.log(`[uzum-orders] fix_fulfillment_types complete: ${fixUpdated} orders restored to FBS`);
      
      result = {
        action: 'fix_fulfillment_types',
        phase1_fbs_from_bulk: fbsOrderIds.size - probeFoundFbs,
        phase2_probed: probeChecked,
        phase2_found_fbs: probeFoundFbs,
        total_fbs_confirmed: allConfirmedFbsIds.length,
        orders_restored_to_fbs: fixUpdated,
        chunk_errors: fixErrors,
        store_name: store.name,
        message: `Restored ${fixUpdated} orders from 'fbu' → 'fbs' using last 6 months of FBS API data`,
      };
    } else if (action === 'nightly_reconcile') {
      // NIGHTLY RECONCILIATION: Self-healing mechanism for fulfillment type misclassification.
      // 
      // This action:
      // 1. Finds all orders stamped as 'fbu' that are within 90 days (still visible on FBS endpoint)
      // 2. Probes each against GET /v1/fbs/order/{id}
      // 3. Corrects any that are confirmed FBS (200 response)
      //
      // Called nightly via cron to catch any orders that slip through the race condition.
      // Also used post-bulk-fix to restore genuine FBU orders misclassified by the bulk SQL fix.
      console.log('[uzum-orders] nightly_reconcile: starting...');
      
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const reconcileLimit = Number(size) || 300; // process N orders per run
      
      // Find fbu orders within 90 days that came from Finance API (have financeStatus in items)
      const { data: fbuToProbe, error: probeQueryErr } = await supabase
        .from('marketplace_orders')
        .select('external_order_id, ordered_at, items')
        .eq('store_id', store_id)
        .eq('fulfillment_type', 'fbu')
        .gte('ordered_at', ninetyDaysAgo)
        .order('ordered_at', { ascending: false })
        .limit(reconcileLimit);
      
      if (probeQueryErr) throw new Error(`Reconcile query failed: ${probeQueryErr.message}`);
      
      // Filter to those that came from Finance API (have financeStatus field in items)
      const financeApiOrders = (fbuToProbe || []).filter(o => {
        try {
          const items = Array.isArray(o.items) ? o.items : (typeof o.items === 'string' ? JSON.parse(o.items) : []);
          return items.some((item: Record<string, unknown>) => 'financeStatus' in item);
        } catch { return true; } // include if can't parse
      });
      
      console.log(`[uzum-orders] nightly_reconcile: found ${financeApiOrders.length} Finance API fbu orders within 90 days to probe`);
      
      let reconcileProbed = 0;
      let reconcileFoundFbs = 0;
      let reconcileFoundFbu = 0;
      const reconcileStartTime = Date.now();
      const fbsToFix: string[] = [];
      
      for (const order of financeApiOrders) {
        // 40s timeout guard
        if (Date.now() - reconcileStartTime > 40000) {
          console.log(`[uzum-orders] nightly_reconcile: timeout after ${reconcileProbed} probes`);
          break;
        }
        
        await delay(API_DELAY_MS);
        reconcileProbed++;
        
        const probeUrl = `${UZUM_API_BASE}/v1/fbs/order/${order.external_order_id}`;
        const probeResp = await fetchWithRetry(probeUrl, {
          headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        });
        
        if (probeResp.status === 200) {
          // Confirmed FBS — was wrongly classified as FBU
          fbsToFix.push(order.external_order_id);
          reconcileFoundFbs++;
        } else if (probeResp.status === 404) {
          reconcileFoundFbu++;
          // Genuine FBU — correct as-is, no action needed
        }
        // Consume response body to avoid resource leaks
        try { await probeResp.text(); } catch { /* ignore */ }
      }
      
      // Apply corrections
      let reconcileFixed = 0;
      if (fbsToFix.length > 0) {
        for (let i = 0; i < fbsToFix.length; i += 500) {
          const chunk = fbsToFix.slice(i, i + 500);
          const { error: fixErr, count } = await supabase
            .from('marketplace_orders')
            .update({ fulfillment_type: 'fbs' })
            .eq('store_id', store_id)
            .in('external_order_id', chunk)
            .eq('fulfillment_type', 'fbu');
          
          if (fixErr) {
            console.error(`[uzum-orders] nightly_reconcile fix error:`, fixErr.message);
          } else {
            reconcileFixed += (count || 0);
          }
        }
        console.log(`[uzum-orders] nightly_reconcile: corrected ${reconcileFixed} fbu→fbs`);
      }
      
      result = {
        action: 'nightly_reconcile',
        store_name: store.name,
        fbu_orders_in_window: financeApiOrders.length,
        probed: reconcileProbed,
        confirmed_fbs: reconcileFoundFbs,
        confirmed_fbu: reconcileFoundFbu,
        corrected_to_fbs: reconcileFixed,
        message: `Reconciled ${reconcileProbed} orders: ${reconcileFixed} corrected fbu→fbs`,
      };

    } else if (action === 'reverse_reconcile') {
      // REVERSE RECONCILE: Find FBS-stamped orders that actually belong to FBU.
      //
      // Problem: The bulk SQL fix set ALL 14,950+ Uzum orders to 'fbs'.
      // But dual-listed stores (Uzum China Market, Atlas, Xit, ALI BRAND) have REAL FBU orders.
      // These are identifiable because Finance API orders contain 'financeStatus' in their items JSON.
      // Real FBS sync orders (from /v2/fbs/orders) never contain 'financeStatus'.
      //
      // Logic:
      // 1. Select orders with fulfillment_type='fbs' AND items containing 'financeStatus' key
      // 2. Probe each via GET /v1/fbs/order/{id}:
      //    200 OK  → genuinely FBS, leave as-is
      //    404 Not Found → genuinely FBU, restore to 'fbu'
      // 3. Batch update all confirmed FBU orders
      
      console.log('[uzum-orders] reverse_reconcile: starting (FBS→FBU restoration)...');
      
      const reverseLimit = Number(size) || 300;
      const reverseStart = Date.now();
      
      // Step 1: Fetch recent fbs orders for this store
      const { data: fbsCandidates, error: fbsQueryErr } = await supabase
        .from('marketplace_orders')
        .select('external_order_id, items')
        .eq('store_id', store_id)
        .eq('fulfillment_type', 'fbs')
        .order('ordered_at', { ascending: false })
        .limit(reverseLimit * 4); // fetch more to filter down
      
      if (fbsQueryErr) throw new Error(`reverse_reconcile query failed: ${fbsQueryErr.message}`);
      
      // Filter: only those with 'financeStatus' in items — Finance API fingerprint
      const financeStampedFbs = (fbsCandidates || []).filter(o => {
        try {
          const items = Array.isArray(o.items) ? o.items : (typeof o.items === 'string' ? JSON.parse(o.items) : []);
          return items.some((item: Record<string, unknown>) => 'financeStatus' in item);
        } catch { return true; } // include if items can't be parsed (may be Finance API)
      }).slice(0, reverseLimit);
      
      console.log(`[uzum-orders] reverse_reconcile: ${fbsCandidates?.length || 0} total fbs candidates, ${financeStampedFbs.length} with Finance API fingerprint`);
      
      // Step 2: Probe each against FBS single-order endpoint
      let reverseProbed = 0;
      let reverseConfirmedFbs = 0;
      let reverseFoundFbu = 0;
      const fbuToRestore: string[] = [];
      
      for (const order of financeStampedFbs) {
        if (Date.now() - reverseStart > 40000) {
          console.log(`[uzum-orders] reverse_reconcile: 40s timeout after ${reverseProbed} probes`);
          break;
        }
        
        await delay(API_DELAY_MS);
        reverseProbed++;
        
        const probeResp = await fetchWithRetry(
          `${UZUM_API_BASE}/v1/fbs/order/${order.external_order_id}`,
          { headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' } }
        );
        
        if (probeResp.status === 404) {
          // 404 = NOT found on FBS endpoint → genuine FBU order
          fbuToRestore.push(order.external_order_id);
          reverseFoundFbu++;
        } else if (probeResp.status === 200) {
          // 200 = confirmed FBS
          reverseConfirmedFbs++;
        }
        // Consume response body to avoid resource leaks
        try { await probeResp.text(); } catch { /* ignore */ }
      }
      
      console.log(`[uzum-orders] reverse_reconcile: probed=${reverseProbed}, fbs=${reverseConfirmedFbs}, fbu=${reverseFoundFbu}`);
      
      // Step 3: Restore genuine FBU orders
      let reverseFixed = 0;
      if (fbuToRestore.length > 0) {
        for (let i = 0; i < fbuToRestore.length; i += 500) {
          const chunk = fbuToRestore.slice(i, i + 500);
          const { error: restoreErr } = await supabase
            .from('marketplace_orders')
            .update({ fulfillment_type: 'fbu' })
            .eq('store_id', store_id)
            .eq('fulfillment_type', 'fbs')
            .in('external_order_id', chunk);
          
          if (restoreErr) {
            console.error(`[uzum-orders] reverse_reconcile restore error:`, restoreErr.message);
          } else {
            reverseFixed += chunk.length; // use chunk.length since Supabase update doesn't return count without extra option
          }
        }
        console.log(`[uzum-orders] reverse_reconcile: restored ${reverseFixed} orders to fbu`);
      }
      
      result = {
        action: 'reverse_reconcile',
        store_name: store.name,
        fbs_candidates_scanned: fbsCandidates?.length || 0,
        finance_stamped_fbs_found: financeStampedFbs.length,
        probed: reverseProbed,
        confirmed_fbs: reverseConfirmedFbs,
        genuine_fbu_found: reverseFoundFbu,
        restored_to_fbu: reverseFixed,
        message: `Probed ${reverseProbed} Finance-stamped FBS orders: ${reverseFixed} restored to fbu`,
      };

    } else if (action === 'probe_fbu_for_fbs') {
      // PROBE FBU FOR FBS: For Xit market (dual-listing store), probe each 'fbu' order
      // against GET /v1/fbs/order/{id}. If 200 OK → it's actually FBS → restore.
      // This is needed because bulk_reverse_reconcile excluded Xit market to avoid
      // over-converting its genuine FBS orders (which also have financeStatus fingerprint).
      //
      // Usage: POST {"store_id": "<xit_market_id>", "action": "probe_fbu_for_fbs", "size": 200}
      // Call multiple times until done=true (1,322 orders / 200 per call = ~7 calls)
      
      console.log('[uzum-orders] probe_fbu_for_fbs: starting for store', store.name);
      
      const probeSize = Number(size) || 200;
      const probeStartTime = Date.now();
      const fbsToRestore: string[] = [];
      
      // Fetch next batch of fbu orders (oldest first to process all in sequence)
      const { data: fbuBatch, error: fbuBatchErr } = await supabase
        .from('marketplace_orders')
        .select('external_order_id, items')
        .eq('store_id', store_id)
        .eq('fulfillment_type', 'fbu')
        .order('ordered_at', { ascending: true })
        .limit(probeSize);
      
      if (fbuBatchErr) throw new Error(`probe_fbu_for_fbs query failed: ${fbuBatchErr.message}`);
      
      const batch = fbuBatch || [];
      console.log(`[uzum-orders] probe_fbu_for_fbs: probing ${batch.length} fbu orders...`);
      
      let probed = 0;
      let foundFbs = 0;
      let confirmedFbu = 0;
      
      for (const order of batch) {
        // 40s timeout guard
        if (Date.now() - probeStartTime > 40000) {
          console.log(`[uzum-orders] probe_fbu_for_fbs: 40s timeout after ${probed} probes`);
          break;
        }
        
        await delay(API_DELAY_MS);
        probed++;
        
        const probeResp = await fetchWithRetry(
          `${UZUM_API_BASE}/v1/fbs/order/${order.external_order_id}`,
          { headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' } }
        );
        
        if (probeResp.status === 200) {
          // 200 OK → confirmed FBS order (was wrongly set to fbu by bulk_reverse_reconcile)
          fbsToRestore.push(order.external_order_id);
          foundFbs++;
          console.log(`[uzum-orders] probe_fbu_for_fbs: FBS confirmed for order ${order.external_order_id}`);
        } else if (probeResp.status === 404) {
          // 404 → genuine FBU order — no action needed
          confirmedFbu++;
        }
        try { await probeResp.text(); } catch { /* ignore */ }
      }
      
      console.log(`[uzum-orders] probe_fbu_for_fbs: probed=${probed}, foundFbs=${foundFbs}, confirmedFbu=${confirmedFbu}`);
      
      // Restore confirmed FBS orders
      let restored = 0;
      if (fbsToRestore.length > 0) {
        for (let i = 0; i < fbsToRestore.length; i += 500) {
          const chunk = fbsToRestore.slice(i, i + 500);
          const { error: restoreErr } = await supabase
            .from('marketplace_orders')
            .update({ fulfillment_type: 'fbs' })
            .eq('store_id', store_id)
            .eq('fulfillment_type', 'fbu')
            .in('external_order_id', chunk);
          
          if (restoreErr) {
            console.error('[uzum-orders] probe_fbu_for_fbs restore error:', restoreErr.message);
          } else {
            restored += chunk.length;
          }
        }
        console.log(`[uzum-orders] probe_fbu_for_fbs: restored ${restored} orders to fbs`);
      }
      
      // Check remaining fbu count
      const { count: remainingFbu } = await supabase
        .from('marketplace_orders')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store_id)
        .eq('fulfillment_type', 'fbu');
      
      result = {
        action: 'probe_fbu_for_fbs',
        store_name: store.name,
        batch_size: probeSize,
        probed,
        found_fbs: foundFbs,
        confirmed_fbu: confirmedFbu,
        restored_to_fbs: restored,
        remaining_fbu: remainingFbu || 0,
        done: (batch.length < probeSize) || probed < probeSize,
        message: `Probed ${probed} fbu orders: ${restored} restored to fbs, ${confirmedFbu} confirmed genuine fbu`,
      };

    } else if (action === 'trigger_all_stores_fix') {
      // ADMIN ACTION: Trigger fix_fulfillment_types for all 7 Uzum stores.
      // This is the systematic fix for the bulk SQL over-correction:
      // - Probes every 'fbu' order against GET /v1/fbs/order/{id}
      // - Genuine FBU (404 from FBS endpoint) stays as 'fbu'  
      // - Wrongly-stamped FBS (200 from FBS endpoint) gets corrected to 'fbs'
      // 
      // Call this once per store by iterating all Uzum store IDs.
      // Due to timeout limits, each call processes ~500 orders (set via size param).
      console.log('[uzum-orders] trigger_all_stores_fix: fetching all Uzum stores...');
      
      const { data: allUzumStores } = await supabase
        .from('marketplace_stores')
        .select('id, name, fulfillment_type')
        .eq('platform', 'uzum')
        .eq('fulfillment_type', 'fbs');
      
      const storeResults: Array<{ store_id: string; name: string; fbu_count: number }> = [];
      
      for (const uzumStore of (allUzumStores || [])) {
        // Count fbu orders for each store
        const { count: fbuCount } = await supabase
          .from('marketplace_orders')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', uzumStore.id)
          .eq('fulfillment_type', 'fbu');
        
        storeResults.push({
          store_id: uzumStore.id,
          name: uzumStore.name,
          fbu_count: fbuCount || 0,
        });
      }
      
      result = {
        action: 'trigger_all_stores_fix',
        message: 'Run fix_fulfillment_types action for each store_id below to probe and correct fbu orders. Process stores with highest fbu_count first.',
        instruction: 'For each store: POST {"store_id": "<id>", "action": "fix_fulfillment_types", "size": 500}',
        stores: storeResults.sort((a, b) => b.fbu_count - a.fbu_count),
        total_stores: storeResults.length,
        total_fbu_orders: storeResults.reduce((s, r) => s + r.fbu_count, 0),
      };
    }
    await supabase
      .from('marketplace_stores')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: 'success',
        sync_error: null,
      })
      .eq('id', store_id);

    return new Response(
      JSON.stringify({
        success: true,
        store: store.name,
        shop_id: shopId,
        result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[uzum-orders] Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
