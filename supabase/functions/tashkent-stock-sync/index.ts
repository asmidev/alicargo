import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UZUM_API_BASE = 'https://api-seller.uzum.uz/api/seller-openapi';

/**
 * tashkent-stock-sync: Sync Tashkent warehouse stock to FBS marketplace listings
 * 
 * CORRECT FULFILLMENT LOGIC:
 *   FBS (Fulfillment by Seller) = Seller's own warehouse (Tashkent). We store, pack, ship.
 *   FBU/FBO (Fulfillment by Marketplace) = Uzum/Yandex warehouse. They store, pack, ship.
 * 
 * This function:
 * 1. 'push' — Syncs tashkent_manual_stock → FBS listings in DB, then pushes to Uzum API via POST /v2/fbs/sku/stocks
 * 2. 'status' — Returns FBS listing link statistics
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      action = 'push',
      store_id,
      product_id,
    } = await req.json();

    let result: unknown = null;

    if (action === 'push') {
      // FBS = seller's warehouse = Tashkent. We CAN push stock to Uzum FBS API.
      console.log(`[tashkent-stock-sync] Push action: syncing tashkent_manual_stock → FBS listings + Uzum API`);

      // Step 1: Get FBS listings linked to products with tashkent_manual_stock
      let listingsQuery = supabase
        .from('marketplace_listings')
        .select('id, product_id, external_sku, stock, stock_fbs, store_id, products!inner(id, tashkent_manual_stock)')
        .eq('fulfillment_type', 'fbs')
        .not('product_id', 'is', null);

      if (store_id) {
        listingsQuery = listingsQuery.eq('store_id', store_id);
      }
      if (product_id) {
        listingsQuery = listingsQuery.eq('product_id', product_id);
      }

      const { data: listings, error: listingsError } = await listingsQuery;

      if (listingsError) {
        console.error(`[tashkent-stock-sync] Failed to fetch FBS listings:`, listingsError);
        throw new Error(`Failed to fetch FBS listings: ${listingsError.message}`);
      }

      let syncedCount = 0;
      const storeSkuUpdates = new Map<string, { skuId: number; quantity: number }[]>();

      if (listings?.length) {
        for (const listing of listings) {
          const product = Array.isArray(listing.products) ? listing.products[0] : listing.products;
          if (!product || product.tashkent_manual_stock === undefined || product.tashkent_manual_stock === null) continue;

          const newStock = product.tashkent_manual_stock || 0;

          // Update internal DB: sync tashkent_manual_stock → FBS listing stock
          const { error: updateError } = await supabase
            .from('marketplace_listings')
            .update({
              stock: newStock,
              stock_fbs: newStock,
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', listing.id);

          if (!updateError) {
            syncedCount++;

            // NULL rank fallback
            await supabase
              .from('marketplace_listings')
              .update({ product_rank: newStock > 0 ? 'C' : 'D' })
              .eq('id', listing.id)
              .is('product_rank', null);

            // Collect SKU updates grouped by store for API push
            if (listing.external_sku) {
              const skuId = parseInt(listing.external_sku);
              if (!isNaN(skuId)) {
                if (!storeSkuUpdates.has(listing.store_id)) {
                  storeSkuUpdates.set(listing.store_id, []);
                }
                storeSkuUpdates.get(listing.store_id)!.push({
                  skuId,
                  quantity: newStock,
                });
              }
            }
          }
        }

        console.log(`[tashkent-stock-sync] Internal DB sync: ${syncedCount}/${listings.length} FBS listings updated`);
      }

      // Step 2: Push to Uzum API per store
      let totalPushed = 0;
      let totalFailed = 0;
      const storeResults: Array<{ store_id: string; store_name: string; pushed: number; error?: string }> = [];

      for (const [storeId, skuUpdates] of storeSkuUpdates) {
        if (skuUpdates.length === 0) continue;

        try {
          // Get store config for API key
          const { data: store } = await supabase
            .from('marketplace_stores')
            .select('name, shop_id, api_key_secret_name, platform')
            .eq('id', storeId)
            .single();

          if (!store || store.platform !== 'uzum') {
            console.log(`[tashkent-stock-sync] Skipping non-Uzum store ${storeId}`);
            storeResults.push({ store_id: storeId, store_name: store?.name || 'unknown', pushed: 0, error: 'Not Uzum platform' });
            continue;
          }

          const apiKey = Deno.env.get(store.api_key_secret_name);
          if (!apiKey) {
            console.error(`[tashkent-stock-sync] API key not configured: ${store.api_key_secret_name}`);
            storeResults.push({ store_id: storeId, store_name: store.name, pushed: 0, error: 'API key not configured' });
            totalFailed += skuUpdates.length;
            continue;
          }

          const shopId = parseInt(store.shop_id);
          const url = `${UZUM_API_BASE}/v2/fbs/sku/stocks`;

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shopId,
              scheme: 'FBS',
              stocks: skuUpdates.map(u => ({
                skuId: u.skuId,
                quantityAvailable: u.quantity,
              })),
            }),
          });

          if (response.ok) {
            totalPushed += skuUpdates.length;
            storeResults.push({ store_id: storeId, store_name: store.name, pushed: skuUpdates.length });
            console.log(`[tashkent-stock-sync] Pushed ${skuUpdates.length} SKUs to Uzum FBS API for store ${store.name}`);
          } else {
            const errorText = await response.text();
            console.error(`[tashkent-stock-sync] Uzum API error for store ${store.name}: ${response.status} - ${errorText}`);
            storeResults.push({ store_id: storeId, store_name: store.name, pushed: 0, error: `API ${response.status}: ${errorText}` });
            totalFailed += skuUpdates.length;
          }
        } catch (storeError) {
          const errMsg = storeError instanceof Error ? storeError.message : 'Unknown error';
          console.error(`[tashkent-stock-sync] Store ${storeId} push error:`, errMsg);
          storeResults.push({ store_id: storeId, store_name: 'unknown', pushed: 0, error: errMsg });
          totalFailed += skuUpdates.length;
        }
      }

      result = {
        action: 'push',
        message: 'Tashkent stock synced to FBS listings and pushed to Uzum API',
        internal_synced: syncedCount,
        total_pushed: totalPushed,
        total_failed: totalFailed,
        stores: storeResults,
      };

    } else if (action === 'status') {
      // Get sync status — FBS listings linked vs unlinked (FBS = seller's warehouse = Tashkent)
      const { data: stats } = await supabase
        .from('marketplace_listings')
        .select('store_id, fulfillment_type, product_id')
        .eq('fulfillment_type', 'fbs');

      const linkedFbs = stats?.filter(s => s.product_id !== null).length || 0;
      const unlinkedFbs = stats?.filter(s => s.product_id === null).length || 0;

      result = {
        action: 'status',
        fbs_linked: linkedFbs,
        fbs_unlinked: unlinkedFbs,
        total_fbs: linkedFbs + unlinkedFbs,
        link_rate: linkedFbs + unlinkedFbs > 0
          ? Math.round((linkedFbs / (linkedFbs + unlinkedFbs)) * 100)
          : 0,
      };
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
