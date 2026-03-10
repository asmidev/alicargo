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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// Product filters
type ProductFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'WITH_SKU' | 'ARCHIVE' | 'DEFECTED';
type ProductRank = 'A' | 'B' | 'C' | 'N' | 'D';
type SortBy = 'DEFAULT' | 'ORDERS' | 'PRICE' | 'ID' | 'ROI' | 'CONVERSION' | 'LEFTOVERS';

interface UzumProduct {
  productId: number;
  categoryId: number;
  categoryTitle: string;
  title: string;
  description?: string;
  status: {
    value: string;
    text?: string;
  } | string;
  moderationStatus?: string;
  archived?: boolean;
  // Commission data from Product API (Phase J: Capture commission rates)
  commissionDto?: {
    maxCommission: number;
    minCommission: number;
  };
  skuList: Array<{
    skuId: number;
    barCode?: string;
    barcode?: number; // Some APIs return this as number
    fullPrice: number;
    sellPrice: number;
    price?: number;
    marketPrice?: number;
    quantityAvailable: number;
    quantityAdditional?: number;
    // FBS/FBU stock quantities - key for dual fulfillment
    quantityFbs?: number;      // Stock at seller warehouse (Tashkent)
    quantityActive?: number;   // Stock at Uzum warehouse (FBU)
    quantityPending?: number;
    quantityReturned?: number;
    // SKU-level commission rate (5-20% based on category)
    commission?: number;
    characteristics?: Array<{
      title: string;
      value: string;
    }>;
  }>;
  productRank?: {
    rank: ProductRank;
    rankValue: number;
    dateUpdated: string;
  };
  statistics?: {
    ordersCount?: number;
    views?: number;
    addToCart?: number;
    conversion?: number;
    roi?: number;
  };
  mainPhoto?: {
    photoKey: string;
  };
}

interface UzumApiResponse<T> {
  payload: T;
  errors: Array<{ code: string; message: string }>;
  timestamp: string;
  error: string | null;
}

serve(async (req) => {
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
      action = 'sync',
      filter = 'ALL' as ProductFilter,
      product_rank,
      sort_by = 'DEFAULT' as SortBy,
      page = 0,
      size = 100, // Increased default size for efficiency
      product_id // For single product operations
    } = await req.json();

    // Normalize fulfillment type for Uzum - map 'standard' to 'fbs'
    const normalizeUzumFulfillmentType = (storeType: string | null): string => {
      const type = (storeType || 'FBS').toLowerCase();
      if (type === 'standard' || type === 'fbs') return 'fbs';
      if (type === 'fby' || type === 'dbs') return 'fby';
      return 'fbs'; // default
    };

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

    // Normalize fulfillment type for this store
    const normalizedFulfillmentType = normalizeUzumFulfillmentType(store.fulfillment_type);
    console.log(`[uzum-products] Store ${store.name}, normalized fulfillment_type: ${normalizedFulfillmentType}`);

    if (action === 'sync' || action === 'list') {
      // Fetch ALL products with complete pagination
      let allProducts: UzumProduct[] = [];
      let currentPage = page;
      let totalProducts = 0;

      console.log(`[uzum-products] Starting ${action} for store ${store.name} (shop_id: ${shopId})`);

      // Auto-cleanup: 1 soatdan oshiq "running" loglarni error ga o'zgartirish
      if (action === 'sync') {
        await supabase
          .from('marketplace_sync_logs')
          .update({
            status: 'error',
            error_message: 'Auto-cleaned: function timeout or crash',
            completed_at: new Date().toISOString(),
          })
          .eq('store_id', store_id)
          .eq('status', 'running')
          .lt('started_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
      }

      // Create sync log entry at start for sync action
      let syncLogId: string | null = null;
      if (action === 'sync') {
        const { data: syncLog } = await supabase
          .from('marketplace_sync_logs')
          .insert({
            store_id,
            sync_type: 'listings',
            fulfillment_type: normalizedFulfillmentType,
            status: 'running',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();
        syncLogId = syncLog?.id || null;
      }

      // Fetch all pages until we have all products
      do {
        let params = `size=${size}&page=${currentPage}&filter=${filter}&sortBy=${sort_by}`;
        if (product_rank) params += `&productRank=${product_rank}`;

        const url = `${UZUM_API_BASE}/v1/product/shop/${shopId}?${params}`;
        console.log(`[uzum-products] Fetching page ${currentPage}:`, url);

        const response = await fetchWithRetry(url, {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Uzum API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Handle both response formats:
        // 1. Old format: { payload: { products: [], totalProducts: N } }
        // 2. New format: { productList: [], total: N } or direct array
        let pageProducts: UzumProduct[] = [];
        let apiTotalProducts = 0;

        if (data.payload?.products) {
          // Old API format
          pageProducts = data.payload.products;
          apiTotalProducts = data.payload.totalProducts || 0;
        } else if (data.productList) {
          // New API format - productList at top level
          pageProducts = data.productList;
          apiTotalProducts = data.total || data.productList.length;
        } else if (Array.isArray(data)) {
          // Direct array response
          pageProducts = data;
          apiTotalProducts = data.length;
        }

        console.log(`[uzum-products] Page ${currentPage}: found ${pageProducts.length} products`);

        // QADAM 1: Debug logging — check rankInfo and top-level stats
        if (pageProducts.length > 0 && currentPage === 0) {
          const sample = pageProducts[0] as any;
          console.log('[uzum-products] Sample product keys:', Object.keys(sample).join(', '));
          console.log('[uzum-products] Sample rankInfo:', JSON.stringify(sample.rankInfo));
          console.log('[uzum-products] Sample quantitySold:', sample.quantitySold, 'clicks:', sample.clicks, 'viewers:', sample.viewers);
        }

        // Get total count on first page
        if (currentPage === page) {
          totalProducts = apiTotalProducts;
          console.log(`[uzum-products] Total products in catalog: ${totalProducts}`);
        }

        allProducts = [...allProducts, ...pageProducts];

        // Check if more pages available
        const hasMorePages = pageProducts.length >= size;
        currentPage++;

        // Rate limit between pages
        if (hasMorePages && allProducts.length < 10000) { // Safety limit
          await delay(API_DELAY_MS);
        } else {
          break; // No more pages
        }
      } while (currentPage < 100); // Safety limit

      console.log(`[uzum-products] Fetched ${allProducts.length}/${totalProducts} products`);

      if (action === 'list') {
        // Just return the products without syncing
        result = {
          products: allProducts,
          total: totalProducts,
          page,
          size,
          fetched: allProducts.length,
        };
      } else {
        // Sync products to database
        let synced = 0;
        let failed = 0;
        const failedSkuDetails: Array<{ sku: string, error: string }> = [];
        const totalSkus = allProducts.reduce((sum, p) => sum + (p.skuList?.length || 0), 0);
        console.log(`[uzum-products] Syncing ${totalSkus} SKUs to database`);

        for (const product of allProducts) {
          for (const sku of product.skuList || []) {
            try {
              // Extract FBS and FBU stock quantities per SKU
              const stockFbs = sku.quantityFbs ?? 0;
              const stockFbu = sku.quantityActive ?? 0;

              // Extract barcode - handle both string and number formats
              const externalBarcode = sku.barCode
                ? String(sku.barCode)
                : (sku.barcode ? String(sku.barcode) : null);

              // Defensive status parsing — bypass TypeScript interface with `as any`
              const rawStatus = product.status as any;
              const statusValue = rawStatus?.value || (typeof rawStatus === 'string' ? rawStatus : '');
              const statusTitle = rawStatus?.title || rawStatus?.text || '';

              const isArchived = statusValue === 'ARCHIVED' || statusTitle === 'Arxiv';
              const isActive = !isArchived && (
                ['IN_STOCK', 'ACTIVE', 'IN_SALE', 'MODERATED'].includes(statusValue) ||
                ['Sotuvda', 'Активный', 'Active'].includes(statusTitle)
              );

              // Log status format for first few products to debug
              if (synced < 3) {
                console.log(`[uzum-products] Product ${product.productId} status:`, JSON.stringify(product.status));
              }

              // PHASE J: Capture commission rate from SKU or product level
              // Priority: SKU-level rate > Product commissionDto > null (for lookup fallback)
              const sellPrice = sku.sellPrice || sku.price || sku.marketPrice || 1;
              let skuCommissionRate = null;

              const rawSkuComm = sku.commission ||
                product.commissionDto?.maxCommission ||
                product.commissionDto?.minCommission;

              if (rawSkuComm) {
                if (rawSkuComm > 100) {
                  // Likely an absolute UZS value. Convert to a true percentage.
                  skuCommissionRate = Math.round((rawSkuComm / sellPrice) * 1000) / 10;
                } else {
                  // Already a percentage (e.g. 15, 20.5)
                  skuCommissionRate = rawSkuComm;
                }
              }

              const totalStock = stockFbs + stockFbu;

              // Extract image URL from Uzum product
              // API returns `image` as full URL string (e.g. "https://images.uzum.uz/xxx/t_product_540_high.jpg")
              // Also check `previewImg` and legacy `mainPhoto.photoKey` fields
              const p = product as any;
              let imageUrl: string | null = null;

              const imgPrefix = 'https://images.uzum.uz/';
              if (typeof p.image === 'string' && p.image.length > 0) {
                imageUrl = p.image.startsWith('http') ? p.image : `${imgPrefix}${p.image}`;
              } else if (typeof p.previewImg === 'string' && p.previewImg.length > 0) {
                imageUrl = p.previewImg.startsWith('http') ? p.previewImg : `${imgPrefix}${p.previewImg}`;
              } else if (product.mainPhoto?.photoKey) {
                imageUrl = `${imgPrefix}${product.mainPhoto.photoKey}`;
              } else if (p.photo?.photoKey) {
                imageUrl = `${imgPrefix}${p.photo.photoKey}`;
              }

              const commonListingData = {
                store_id,
                external_sku: String(sku.skuId),
                external_product_id: String(product.productId),
                external_barcode: externalBarcode,
                title: product.title,
                price: sku.sellPrice || sku.price || sku.marketPrice,
                compare_price: sku.fullPrice || sku.marketPrice,
                status: isActive ? 'active' : 'inactive',
                moderation_status: product.moderationStatus,
                image_url: imageUrl,
                last_synced_at: new Date().toISOString(),
                product_rank: (() => {
                  const p = product as any;
                  const isActiveProduct = isActive;
                  const hasStock = totalStock > 0;
                  const sold = p.quantitySold ?? 0;

                  if (synced < 5) {
                    console.log(`[uzum-products] Rank debug: product=${product.productId}, active=${isActiveProduct}, stock=${totalStock}, sold=${sold}, rankInfo=${JSON.stringify(p.rankInfo)}, status=${JSON.stringify(product.status)}`);
                  }

                  const apiRank = p.rankInfo?.rank || (typeof p.rankInfo === 'string' ? p.rankInfo : null);
                  if (apiRank && isActiveProduct && ['A', 'B', 'C', 'D', 'N'].includes(String(apiRank).toUpperCase())) {
                    return String(apiRank).toUpperCase();
                  }

                  if (isActiveProduct && hasStock) {
                    if (sold > 50) return 'A';
                    if (sold > 20) return 'B';
                    return 'C';
                  }
                  if (isActiveProduct && !hasStock) return 'D';
                  if (sold > 20) return 'C';
                  return 'D';
                })(),
                commission_rate: skuCommissionRate,
                category_title: product.categoryTitle,
              };

              // === FBS listing (ALWAYS created) ===
              const fbsData = {
                ...commonListingData,
                stock: stockFbs,
                stock_fbs: stockFbs,
                stock_fbu: null,
                fulfillment_type: 'fbs' as const,
              };

              const { error: fbsError } = await supabase
                .from('marketplace_listings')
                .upsert(fbsData, { onConflict: 'store_id,external_sku,fulfillment_type' });

              if (fbsError) {
                failed++;
                failedSkuDetails.push({ sku: String(sku.skuId), error: fbsError.message });
                console.error(`[uzum-products] Failed to upsert FBS SKU ${sku.skuId}:`, JSON.stringify(fbsError));
              } else {
                synced++;
              }

              // === FBU listing (always upsert, even at zero stock) ===
              // FIX: Previously skipped when stockFbu === 0, leaving stale non-zero stock values in DB
              // Now always upsert to prevent FBU listings from showing incorrect stock after it hits zero
              const fbuData = {
                ...commonListingData,
                stock: stockFbu,
                stock_fbs: null,
                stock_fbu: stockFbu,
                fulfillment_type: 'fbu' as const,
              };

              const { error: fbuError } = await supabase
                .from('marketplace_listings')
                .upsert(fbuData, { onConflict: 'store_id,external_sku,fulfillment_type' });

              if (fbuError) {
                failed++;
                failedSkuDetails.push({ sku: `${sku.skuId}-fbu`, error: fbuError.message });
                console.error(`[uzum-products] Failed to upsert FBU SKU ${sku.skuId}:`, JSON.stringify(fbuError));
              } else {
                synced++;
              }
            } catch (err) {
              failed++;
              console.error(`[uzum-products] Error processing SKU:`, err);
            }

            // Rate limit DB operations
            if ((synced + failed) % 100 === 0) {
              await delay(50);
            }
          }
        }

        // Update sync log
        if (syncLogId) {
          await supabase
            .from('marketplace_sync_logs')
            .update({
              status: failed > 0 ? (synced > 0 ? 'partial' : 'error') : 'success',
              records_processed: totalSkus,
              records_created: synced,
              records_failed: failed,
              error_message: failed > 0 ? `${failed} SKU(s) failed to upsert` : null,
              error_details: failed > 0 ? { failed_skus: failedSkuDetails.slice(0, 20) } : null,
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - startTime,
            })
            .eq('id', syncLogId);
        }

        console.log(`[uzum-products] Sync complete:`, { synced, failed, totalProducts: allProducts.length, totalSkus });

        result = {
          action: 'sync',
          total_products: allProducts.length,
          total_skus: totalSkus,
          synced,
          failed,
          records_processed: totalSkus,
        };
      }

    } else if (action === 'get') {
      // Get single product details
      if (!product_id) {
        throw new Error('product_id is required for get action');
      }

      const url = `${UZUM_API_BASE}/v1/product/${product_id}`;
      const response = await fetchWithRetry(url, {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get product: ${response.status}`);
      }

      result = await response.json();

    } else if (action === 'debug_images') {
      // Debug action: fetch a small page and return ALL raw fields for image inspection
      const url = `${UZUM_API_BASE}/v1/product/shop/${shopId}?size=3&page=0&filter=ALL&sortBy=DEFAULT`;
      console.log(`[uzum-products] debug_images: fetching ${url}`);
      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Uzum API error: ${response.status} - ${await response.text()}`);
      }
      const rawData = await response.json();

      // Extract products from whatever format
      let debugProducts: any[] = [];
      if (rawData.payload?.products) debugProducts = rawData.payload.products;
      else if (rawData.productList) debugProducts = rawData.productList;
      else if (Array.isArray(rawData)) debugProducts = rawData;

      // For each product, list all top-level keys and image-related values
      const debugOutput = debugProducts.map((p: any) => ({
        productId: p.productId,
        title: p.title,
        allKeys: Object.keys(p),
        image: p.image,
        previewImg: p.previewImg,
        mainPhoto: p.mainPhoto,
        photo: p.photo,
        photoKey: p.photoKey,
        photos: p.photos,
        imageUrl: p.imageUrl,
        thumbnailUrl: p.thumbnailUrl,
        // Check SKU-level image fields
        skuImageFields: (p.skuList || []).slice(0, 2).map((s: any) => ({
          skuId: s.skuId,
          allKeys: Object.keys(s),
          photo: s.photo,
          image: s.image,
          photoKey: s.photoKey,
          characteristicsWithPhotos: Array.isArray(s.characteristics) ? s.characteristics.filter((c: any) => c.photo || c.image) : null,
        })),
      }));

      // Also try fetching single product detail for the first product
      let singleProductDetail: any = null;
      if (debugProducts.length > 0) {
        const detailUrl = `${UZUM_API_BASE}/v1/product/${debugProducts[0].productId}`;
        try {
          await delay(API_DELAY_MS);
          const detailResp = await fetchWithRetry(detailUrl, {
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
          });
          if (detailResp.ok) {
            const detailData = await detailResp.json();
            const dp = detailData.payload || detailData;
            singleProductDetail = {
              allKeys: Object.keys(dp),
              image: dp.image,
              previewImg: dp.previewImg,
              mainPhoto: dp.mainPhoto,
              photo: dp.photo,
              photoKey: dp.photoKey,
              photos: dp.photos,
              galleryPhotos: dp.galleryPhotos,
              characteristics: dp.characteristics,
            };
          }
        } catch (e) {
          singleProductDetail = { error: String(e) };
        }
      }

      result = {
        action: 'debug_images',
        rawResponseTopKeys: Object.keys(rawData),
        productCount: debugProducts.length,
        products: debugOutput,
        singleProductDetail,
      };

    } else if (action === 'update_price') {
      // Update product prices
      const { price_data } = await req.json();
      if (!price_data) {
        throw new Error('price_data is required for update_price action');
      }

      const url = `${UZUM_API_BASE}/v1/product/${shopId}/sendPriceData`;
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(price_data),
      });

      result = {
        action: 'update_price',
        success: response.ok,
        response: await response.json(),
      };

    } else if (action === 'rank_analysis') {
      // Fetch products by rank for competitor analysis
      const ranks: ProductRank[] = ['A', 'B', 'C', 'N', 'D'];
      const rankResults: Record<string, { count: number; products: UzumProduct[] }> = {};

      for (let i = 0; i < ranks.length; i++) {
        const rank = ranks[i];

        // Add delay between rank queries
        if (i > 0) {
          await delay(API_DELAY_MS);
        }

        const url = `${UZUM_API_BASE}/v1/product/shop/${shopId}?size=50&page=0&productRank=${rank}&sortBy=ORDERS`;

        try {
          const response = await fetchWithRetry(url, {
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data: UzumApiResponse<{ products: UzumProduct[]; totalProducts: number }> = await response.json();
            rankResults[rank] = {
              count: data.payload?.totalProducts || 0,
              products: data.payload?.products || [],
            };
          }
        } catch (err) {
          console.error(`Failed to fetch rank ${rank}:`, err);
        }
      }

      result = {
        action: 'rank_analysis',
        shop_id: shopId,
        ranks: rankResults,
        summary: {
          A: rankResults['A']?.count || 0,
          B: rankResults['B']?.count || 0,
          C: rankResults['C']?.count || 0,
          N: rankResults['N']?.count || 0,
          D: rankResults['D']?.count || 0,
        },
      };
    }

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
