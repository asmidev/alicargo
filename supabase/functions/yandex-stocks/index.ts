import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';
const API_DELAY_MS = 300;
const MAX_OFFERS = 2000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { store_id, action = 'get' } = await req.json();

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
      if (store.fbs_campaign_id) {
        campaignsToFetch.push({ id: store.fbs_campaign_id, type: 'fbs' });
      }
      if (store.fby_campaign_id) {
        campaignsToFetch.push({ id: store.fby_campaign_id, type: 'fby' });
      }
    } else {
      const campaignId = store.campaign_id || store.fbs_campaign_id || store.fby_campaign_id;
      if (campaignId) {
        campaignsToFetch.push({ id: campaignId, type: store.fulfillment_type?.toLowerCase() || 'fbs' });
      }
    }

    if (campaignsToFetch.length === 0) {
      throw new Error('No campaign ID configured');
    }

    console.log(`[yandex-stocks] Fetching stocks for ${store.name} from ${campaignsToFetch.length} campaign(s)`);

    let synced = 0;
    let failed = 0;
    let totalOffers = 0;
    const stockData: Array<{
      offerId: string;
      warehouseId: string;
      warehouseName: string;
      totalStock: number;
      stocks: any[]; // New: explicit stocks with types (FIT, DEFECT, etc.)
      campaignType: string;
    }> = [];

    for (const campaign of campaignsToFetch) {
      let pageToken: string | undefined;
      let pageCount = 0;

      console.log(`[yandex-stocks] Processing campaign ${campaign.id} (${campaign.type})`);

      do {
        if (pageCount > 0) {
          await delay(API_DELAY_MS);
        }

        const requestBody: Record<string, unknown> = { limit: 200 };
        if (pageToken) {
          requestBody.pageToken = pageToken;
        }

        const response = await fetch(
          `${YANDEX_API_BASE}/v2/campaigns/${campaign.id}/offers/stocks`,
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
          console.error(`[yandex-stocks] API error on campaign ${campaign.id} page ${pageCount}: ${response.status} - ${errorText}`);
          if (pageCount === 0 && campaignsToFetch.length === 1) {
            throw new Error(`Yandex API error: ${response.status} - ${errorText}`);
          }
          break;
        }

        const data = await response.json();
        const warehouses = data.result?.warehouses || [];
        pageToken = data.result?.paging?.nextPageToken;

        let pageOffers = 0;

        for (const warehouse of warehouses) {
          for (const offer of warehouse.offers || []) {
            pageOffers++;
            totalOffers++;

            const totalStock = (offer.stocks || []).reduce(
              (sum: number, s: { count: number }) => sum + (s.count || 0),
              0
            );

            stockData.push({
              offerId: offer.offerId,
              warehouseId: warehouse.warehouseId,
              warehouseName: warehouse.warehouseName,
              totalStock,
              stocks: offer.stocks || [], // New: explicit stocks with types (FIT, DEFECT, etc.)
              campaignType: campaign.type,
            });

            try {
              const updateData: Record<string, unknown> = {
                last_synced_at: new Date().toISOString()
              };

              if (campaign.type === 'fby') {
                // FBY campaign: Yandex warehouse fulfillment
                // FIX: Write to stock_fby (not stock_fbu) to prevent conflating
                // Yandex warehouse stock with Uzum FBU warehouse stock in cross-store analytics
                updateData.stock = totalStock;
                updateData.stock_fby = totalStock;
                updateData.stock_fbu = null;  // Clear any legacy FBU value
                updateData.stock_fbs = null;  // Ensure no cross-contamination
              } else {
                // FBS campaign: update stock and stock_fbs
                updateData.stock = totalStock;
                updateData.stock_fbs = totalStock;
                updateData.stock_fbu = null;  // Ensure no cross-contamination
                updateData.stock_fby = null;  // Ensure no cross-contamination
              }

              const targetFulfillmentType = campaign.type === 'fby' ? 'fby' : 'fbs';
              const { error: updateError } = await supabase
                .from('marketplace_listings')
                .update(updateData)
                .eq('store_id', store_id)
                .eq('external_sku', offer.offerId)
                .eq('fulfillment_type', targetFulfillmentType);

              if (updateError) {
                console.error(`[yandex-stocks] Failed to update ${offer.offerId}:`, updateError.message);
                failed++;
              } else {
                synced++;
                // Update rank based on stock level
                const stockRank = totalStock > 20 ? 'B' : (totalStock > 0 ? 'C' : 'D');
                await supabase
                  .from('marketplace_listings')
                  .update({ product_rank: stockRank })
                  .eq('store_id', store_id)
                  .eq('external_sku', offer.offerId)
                  .eq('fulfillment_type', targetFulfillmentType);
              }
            } catch (err) {
              console.error(`[yandex-stocks] Exception updating ${offer.offerId}:`, err);
              failed++;
            }
          }
        }

        console.log(`[yandex-stocks] Campaign ${campaign.id} page ${pageCount}: processed ${pageOffers} offers${pageToken ? ' (has more)' : ''}`);
        pageCount++;

        if (totalOffers >= MAX_OFFERS) {
          console.log(`[yandex-stocks] Reached max offers limit (${MAX_OFFERS})`);
          break;
        }

      } while (pageToken);

      console.log(`[yandex-stocks] Campaign ${campaign.id} complete: ${pageCount} page(s)`);
    }

    console.log(`[yandex-stocks] Sync complete: ${synced} synced, ${failed} failed, ${campaignsToFetch.length} campaign(s)`);

    // Update store last sync
    await supabase
      .from('marketplace_stores')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: synced > 0 ? 'success' : 'partial',
        sync_error: failed > 0 ? `${failed} offers failed to update` : null,
      })
      .eq('id', store_id);

    return new Response(
      JSON.stringify({
        success: true,
        store: store.name,
        records_processed: synced,
        warehouses_count: stockData.length > 0 ? new Set(stockData.map(s => s.warehouseId)).size : 0,
        offers_processed: totalOffers,
        synced,
        failed,
        stocks: stockData, // Added for frontend processing of defects
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
