import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UZUM_API_BASE = 'https://api-seller.uzum.uz/api/seller-openapi';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 && attempt < retries) {
        const waitTime = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);
        await delay(waitTime);
        continue;
      }
      return response;
    } catch (fetchError) {
      if (attempt < retries) {
        const waitTime = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Fetch error, waiting ${waitTime}ms before retry ${attempt + 1}/${retries}:`, fetchError);
        await delay(waitTime);
        continue;
      }
      throw fetchError;
    }
  }
  return fetch(url, options);
}

interface StockItem {
  skuId: number;
  amount?: number;
  quantityAvailable?: number;
  quantityAdditional?: number;
  warehouseId?: number;
  skuTitle?: string;
  barcode?: string;
}

// ===== PRODUCT API FALLBACK =====
interface ProductSkuStock {
  skuId: number;
  quantityAvailable: number;
  quantityFbs: number;
  quantityFbu: number;
}

async function fetchStocksViaProductAPI(
  shopId: number,
  apiKey: string,
): Promise<ProductSkuStock[]> {
  const allStocks: ProductSkuStock[] = [];
  let page = 0;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `${UZUM_API_BASE}/v1/product/shop/${shopId}?size=${pageSize}&page=${page}&filter=ALL&sortBy=DEFAULT`;
    console.log(`[fallback] Fetching products page ${page}`);

    const response = await fetchWithRetry(url, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[fallback] Product API error: ${response.status}`);
      break;
    }

    const data = await response.json();
    
    let products: any[] = [];
    if (data.payload?.products) {
      products = data.payload.products;
    } else if (data.productList) {
      products = data.productList;
    } else if (Array.isArray(data)) {
      products = data;
    }

    if (!products.length) {
      hasMore = false;
      break;
    }

    for (const product of products) {
      const skus = product.skuList || product.skus || [];
      for (const sku of skus) {
        const fbs = sku.quantityFbs ?? 0;
        const fbu = sku.quantityActive ?? sku.quantityFbu ?? 0;
        const available = sku.quantityAvailable ?? (fbs + fbu);
        allStocks.push({
          skuId: sku.skuId || sku.id,
          quantityAvailable: available,
          quantityFbs: fbs,
          quantityFbu: fbu,
        });
      }
    }

    hasMore = products.length === pageSize;
    page++;

    if (hasMore) {
      await delay(300);
    }
  }

  console.log(`[fallback] Product API returned ${allStocks.length} SKU stocks`);
  return allStocks;
}

// ===== BATCH STOCK UPDATE: Fetch all listings once, then batch update =====
async function batchUpdateStocks(
  supabase: any,
  storeIds: string[],
  stockMap: Map<string, number>, // skuId -> stock quantity
  fulfillmentType: 'fbs' | 'fbu',
  stockField: 'stock_fbs' | 'stock_fbu',
): Promise<{ updated: number; unchanged: number; errors: number }> {
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  // Step 1: Fetch ALL listings for these stores + fulfillment type in one query
  let allListings: any[] = [];
  let offset = 0;
  const fetchSize = 1000;
  
  while (true) {
    const { data: batch, error: fetchErr } = await supabase
      .from('marketplace_listings')
      .select('id, external_sku, stock, store_id')
      .in('store_id', storeIds)
      .eq('fulfillment_type', fulfillmentType)
      .range(offset, offset + fetchSize - 1);
    
    if (fetchErr) {
      console.error(`[uzum-stocks] Error fetching listings:`, fetchErr.message);
      errors++;
      break;
    }
    if (!batch || batch.length === 0) break;
    allListings = allListings.concat(batch);
    if (batch.length < fetchSize) break;
    offset += fetchSize;
  }

  console.log(`[uzum-stocks] Fetched ${allListings.length} ${fulfillmentType} listings across ${storeIds.length} stores`);

  // Step 2: Match listings to stock data and collect updates
  const toUpdate: { id: string; newStock: number }[] = [];
  
  for (const listing of allListings) {
    const newStock = stockMap.get(String(listing.external_sku));
    if (newStock !== undefined) {
      // Only update if stock actually changed
      if (listing.stock !== newStock) {
        toUpdate.push({ id: listing.id, newStock });
      } else {
        unchanged++;
      }
    }
  }

  console.log(`[uzum-stocks] ${toUpdate.length} listings need stock update, ${unchanged} unchanged`);

  // Step 3: Batch update in chunks of 100 using listing IDs
  const BATCH_SIZE = 100;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    
    // Group by stock value for efficient updates
    const byStockValue = new Map<number, string[]>();
    for (const item of chunk) {
      if (!byStockValue.has(item.newStock)) {
        byStockValue.set(item.newStock, []);
      }
      byStockValue.get(item.newStock)!.push(item.id);
    }

    for (const [stockValue, ids] of byStockValue) {
      const { error: updateErr } = await supabase
        .from('marketplace_listings')
        .update({
          stock: stockValue,
          [stockField]: stockValue,
          last_synced_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (updateErr) {
        console.error(`[uzum-stocks] Batch update error:`, updateErr.message);
        errors++;
      } else {
        updated += ids.length;
      }
    }
  }

  return { updated, unchanged, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      store_id,
      action = 'get',
      stock_updates,
      scheme = 'FBS',
      sync_type,
    } = await req.json();

    const effectiveAction = sync_type === 'stocks' ? 'sync' : action;

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
    let recordsProcessed = 0;

    if (effectiveAction === 'get' || effectiveAction === 'sync') {
      // Get ALL active Uzum store IDs (Stock API returns all seller SKUs — one call covers all stores)
      const { data: allStores } = await supabase
        .from('marketplace_stores')
        .select('id, name')
        .eq('platform', 'uzum')
        .eq('is_active', true);
      
      const relatedStoreIds = allStores?.map((s: any) => s.id) || [store_id];
      const storeNames = allStores?.map((s: any) => s.name) || [store.name];
      console.log(`[uzum-stocks] Will update ${relatedStoreIds.length} stores: ${storeNames.join(', ')}`);

      // ===== STEP 1: FBS stocks (single seller-level API call) =====
      let allFbsStocks: StockItem[] = [];

      const fbsUrl = `${UZUM_API_BASE}/v2/fbs/sku/stocks`;
      console.log(`Fetching FBS stocks (seller-level): ${fbsUrl}`);

      const fbsResponse = await fetchWithRetry(fbsUrl, {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (fbsResponse.ok) {
        const fbsData = await fbsResponse.json();
        const parsed = fbsData.payload?.skuAmountList || fbsData.payload?.stocks || fbsData.stocks || [];
        allFbsStocks = Array.isArray(parsed) ? parsed : [];
        console.log(`FBS Stock API returned ${allFbsStocks.length} stocks`);
      } else {
        const errorText = await fbsResponse.text();
        console.error(`FBS Stock API error: ${fbsResponse.status} - ${errorText}`);
      }

      // ===== STEP 2: FBU stocks =====
      let allFbuStocks: StockItem[] = [];

      if (effectiveAction === 'sync') {
        try {
          const fbuUrl = `${UZUM_API_BASE}/v2/fbu/sku/stocks`;
          const fbuResponse = await fetchWithRetry(fbuUrl, {
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json',
            },
          });

          if (fbuResponse.ok) {
            const fbuData = await fbuResponse.json();
            const fbuParsed = fbuData.payload?.skuAmountList || fbuData.payload?.stocks || fbuData.stocks || [];
            allFbuStocks = Array.isArray(fbuParsed) ? fbuParsed : [];
            console.log(`FBU Stock API returned ${allFbuStocks.length} stocks`);
          } else {
            console.log(`FBU stocks not available: ${fbuResponse.status}`);
          }
        } catch (fbuError) {
          console.log('FBU stocks fetch error:', fbuError);
        }
      }

      // ===== STEP 3: Build stock maps =====
      const fbsStockMap = new Map<string, number>();
      let fbsSource = 'none';
      
      if (allFbsStocks.length > 0) {
        fbsSource = 'stock_api';
        for (const stock of allFbsStocks) {
          const qty = stock.amount ?? stock.quantityAvailable ?? 0;
          fbsStockMap.set(String(stock.skuId), qty);
        }
      } else {
        fbsSource = 'product_api_fallback';
        console.log(`[FBS fallback] Stock API returned 0, using Product API`);
        const productStocks = await fetchStocksViaProductAPI(shopId, apiKey);
        for (const stock of productStocks) {
          fbsStockMap.set(String(stock.skuId), stock.quantityFbs);
        }
      }

      const fbuStockMap = new Map<string, number>();
      let fbuSource = 'none';

      if (allFbuStocks.length > 0) {
        fbuSource = 'stock_api';
        for (const stock of allFbuStocks) {
          const qty = stock.amount ?? stock.quantityAvailable ?? 0;
          fbuStockMap.set(String(stock.skuId), qty);
        }
      } else if (effectiveAction === 'sync') {
        fbuSource = 'product_api_fallback';
        const fbuProductStocks = await fetchStocksViaProductAPI(shopId, apiKey);
        for (const stock of fbuProductStocks) {
          if (stock.quantityFbu > 0) {
            fbuStockMap.set(String(stock.skuId), stock.quantityFbu);
          }
        }
      }

      recordsProcessed = fbsStockMap.size + fbuStockMap.size;

      // ===== STEP 4: Batch update all listings =====
      console.log(`[uzum-stocks] Starting batch updates: ${fbsStockMap.size} FBS SKUs, ${fbuStockMap.size} FBU SKUs`);
      
      const fbsResult = await batchUpdateStocks(supabase, relatedStoreIds, fbsStockMap, 'fbs', 'stock_fbs');
      const fbuResult = fbuStockMap.size > 0 
        ? await batchUpdateStocks(supabase, relatedStoreIds, fbuStockMap, 'fbu', 'stock_fbu')
        : { updated: 0, unchanged: 0, errors: 0 };

      result = {
        action: effectiveAction,
        fbs_source: fbsSource,
        fbu_source: fbuSource,
        fbs_skus: fbsStockMap.size,
        fbu_skus: fbuStockMap.size,
        fbs_updated: fbsResult.updated,
        fbs_unchanged: fbsResult.unchanged,
        fbu_updated: fbuResult.updated,
        fbu_unchanged: fbuResult.unchanged,
        stores_count: relatedStoreIds.length,
        total_updated: fbsResult.updated + fbuResult.updated,
        total_errors: fbsResult.errors + fbuResult.errors,
      };

    } else if (effectiveAction === 'update') {
      if (!stock_updates?.length) {
        throw new Error('stock_updates array is required for update action');
      }

      const url = `${UZUM_API_BASE}/v2/fbs/sku/stocks`;

      const requestBody = {
        shopId,
        scheme,
        stocks: stock_updates.map((item: { skuId: number; quantity: number }) => ({
          skuId: item.skuId,
          quantityAvailable: item.quantity,
        })),
      };

      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`Stock update failed: ${response.status} - ${JSON.stringify(responseData)}`);
      }

      result = {
        action: 'update',
        success: true,
        updated_count: stock_updates.length,
        response: responseData,
      };

      // Update local database
      for (const item of stock_updates) {
        await supabase
          .from('marketplace_listings')
          .update({
            stock: item.quantity,
            last_synced_at: new Date().toISOString(),
          })
          .eq('store_id', store_id)
          .eq('external_sku', String(item.skuId))
          .eq('fulfillment_type', 'fbs');
      }

    } else if (effectiveAction === 'push') {
      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('external_sku, stock, fulfillment_type')
        .eq('store_id', store_id)
        .eq('fulfillment_type', 'fbs')
        .not('stock', 'is', null);

      if (!listings?.length) {
        throw new Error('No listings with stock found');
      }

      const stockUpdates = listings.map((listing: any) => ({
        skuId: parseInt(listing.external_sku),
        quantityAvailable: listing.stock,
      }));

      const url = `${UZUM_API_BASE}/v2/fbs/sku/stocks`;
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopId,
          scheme,
          stocks: stockUpdates,
        }),
      });

      result = {
        action: 'push',
        success: response.ok,
        pushed_count: stockUpdates.length,
        response: await response.json(),
      };
    }

    const duration = Date.now() - startTime;

    // Update store last sync
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
        records_processed: recordsProcessed,
        duration_ms: duration,
      }),
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
