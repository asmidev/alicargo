import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UZUM_API_BASE = 'https://api-seller.uzum.uz/api/seller-openapi';

// Smart timestamp conversion: Uzum Finance API requires Unix SECONDS, not milliseconds
function toUnixSeconds(ts: number): number {
  return ts > 1e12 ? Math.floor(ts / 1000) : ts;
}

// Rate limiting configuration
const API_DELAY_MS = 300;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch real order dates from single order endpoint
// Note: FBU (FBO) orders return 404 on FBS endpoint — skip silently
async function fetchOrderRealDate(orderId: string, apiKey: string): Promise<{ dateCreated?: number; acceptedDate?: number } | null> {
  try {
    const url = `${UZUM_API_BASE}/v1/fbs/order/${orderId}`;
    const resp = await fetchWithRetry(url, {
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    });
    if (resp.status === 404) {
      // FBU order — doesn't exist on FBS endpoint, skip silently
      return null;
    }
    if (!resp.ok) {
      console.log(`[uzum-finance] Single order ${orderId} fetch failed: ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const payload = data.payload || data;
    return {
      dateCreated: payload.dateCreated || null,
      acceptedDate: payload.acceptedDate || null,
    };
  } catch (e: any) {
    console.log(`[uzum-finance] Single order ${orderId} error:`, e.message);
    return null;
  }
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

// All finance statuses to query
const FINANCE_STATUSES = ['TO_WITHDRAW', 'PROCESSING', 'CANCELED', 'PARTIALLY_CANCELLED'];

// Build correct Finance API query params
// shopIds must be repeated for array format, statuses must be explicit
function buildFinanceParams(shopId: number, opts: {
  page?: number;
  size?: number;
  dateFrom?: number; // Unix seconds
  dateTo?: number;   // Unix seconds
  statuses?: string[];
} = {}): string {
  const params = new URLSearchParams();
  params.append('shopIds', String(shopId));

  const statuses = opts.statuses || FINANCE_STATUSES;
  for (const s of statuses) {
    params.append('statuses', s);
  }

  // Default: last 6 months if no dates provided — Uzum Finance API requires Unix SECONDS
  const nowSec = Math.floor(Date.now() / 1000);
  const sixMonthsAgoSec = nowSec - (180 * 24 * 60 * 60);
  params.append('dateFrom', String(opts.dateFrom ? toUnixSeconds(opts.dateFrom) : sixMonthsAgoSec));
  params.append('dateTo', String(opts.dateTo ? toUnixSeconds(opts.dateTo) : nowSec));

  params.append('size', String(opts.size || 50));
  params.append('page', String(opts.page || 0));

  return params.toString();
}

interface FinanceOrderItem {
  orderId: number;
  orderItemId: number;
  productId: number;
  productTitle: string | null;
  skuTitle: string;
  sellPrice: number;
  amount: number;
  commission: number;
  sellerProfit: number;
  purchasePrice: number;
  logisticDeliveryFee: number;
  status: string;
  date?: number;
}

interface FinanceExpense {
  id: number;
  type: string;
  amount: number;
  description?: string;
  date: string;
}

interface UzumApiResponse<T> {
  payload: T;
  errors: Array<{ code: string; message: string }>;
  timestamp: string;
  error: string | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      store_id,
      action = 'orders',
      date_from,
      date_to,
      status,
      page = 0,
      size = 50
    } = await req.json();

    if (!store_id) {
      throw new Error('store_id is required');
    }

    // Get store configuration
    const { data: store, error: storeError } = await supabase
      .from('marketplace_stores')
      .select('*')
      .eq('id', store_id)
      .eq('platform', 'uzum')
      .maybeSingle();

    if (storeError) {
      throw new Error(`Database error: ${storeError.message}`);
    }

    if (!store) {
      throw new Error(`Uzum store not found with id: ${store_id}`);
    }

    const apiKey = Deno.env.get(store.api_key_secret_name);
    if (!apiKey) {
      throw new Error(`API key not configured: ${store.api_key_secret_name}`);
    }

    const shopId = parseInt(store.shop_id);
    let result: unknown = null;

    if (action === 'orders') {
      // Get financial data for orders
      const params = new URLSearchParams();
      params.append('shopIds', String(shopId));
      if (status) {
        params.append('statuses', status);
      } else {
        for (const s of FINANCE_STATUSES) {
          params.append('statuses', s);
        }
      }
      const nowSec = Math.floor(Date.now() / 1000);
      const sixMonthsAgoSec = nowSec - (180 * 24 * 60 * 60);
      params.append('dateFrom', String(date_from ? toUnixSeconds(Number(date_from)) : sixMonthsAgoSec));
      params.append('dateTo', String(date_to ? toUnixSeconds(Number(date_to)) : nowSec));
      params.append('size', String(size));
      params.append('page', String(page));

      const url = `${UZUM_API_BASE}/v1/finance/orders?${params}`;
      console.log('[uzum-finance] Fetching finance orders:', url);

      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      });

      const responseText = await response.text();
      console.log('[uzum-finance] Finance API response status:', response.status);
      console.log('[uzum-finance] Finance API raw response (first 1000 chars):', responseText.substring(0, 1000));

      if (!response.ok) {
        throw new Error(`Uzum API error: ${response.status} - ${responseText}`);
      }

      const rawData = JSON.parse(responseText);
      console.log('[uzum-finance] Response top-level keys:', Object.keys(rawData));
      const items: FinanceOrderItem[] = rawData.orderItems || rawData.payload?.items || rawData.payload?.orderItems || rawData.items || [];
      const totalItems = rawData.totalElements || rawData.payload?.totalItems || rawData.payload?.totalElements || items.length;
      console.log('[uzum-finance] Finance API items count:', items.length, 'totalItems:', totalItems);

      // Calculate totals
      const totals = items.reduce((acc, item) => ({
        revenue: acc.revenue + (item.sellPrice * item.amount),
        commission: acc.commission + item.commission,
        profit: acc.profit + item.sellerProfit,
        deliveryFees: acc.deliveryFees + item.logisticDeliveryFee,
        itemCount: acc.itemCount + item.amount,
      }), { revenue: 0, commission: 0, profit: 0, deliveryFees: 0, itemCount: 0 });

      result = {
        action: 'orders',
        items,
        total_items: totalItems,
        totals,
        page,
        size,
      };

    } else if (action === 'expenses') {
      // Get platform expenses - expenses endpoint uses same shopIds format
      const expParams = new URLSearchParams();
      expParams.append('shopIds', String(shopId));
      expParams.append('page', String(page));
      expParams.append('size', String(size));
      if (date_from) expParams.append('dateFrom', String(toUnixSeconds(Number(date_from))));
      if (date_to) expParams.append('dateTo', String(toUnixSeconds(Number(date_to))));

      const url = `${UZUM_API_BASE}/v1/finance/expenses?${expParams}`;
      console.log('Fetching expenses:', url);

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

      const data: UzumApiResponse<{ expenses: FinanceExpense[]; totalExpenses: number }> = await response.json();
      const expenses = data.payload?.expenses || [];

      const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

      result = {
        action: 'expenses',
        expenses,
        total_expenses: data.payload?.totalExpenses || 0,
        total_amount: totalAmount,
        page,
        size,
      };

    } else if (action === 'summary') {
      // Get comprehensive financial summary - with correct params
      const now = Date.now();
      const ordersUrl = `${UZUM_API_BASE}/v1/finance/orders?${buildFinanceParams(shopId, { size: 1000, dateTo: now })}`;
      const expensesSummaryParams = new URLSearchParams();
      expensesSummaryParams.append('shopIds', String(shopId));
      expensesSummaryParams.append('size', '100');
      const expensesUrl = `${UZUM_API_BASE}/v1/finance/expenses?${expensesSummaryParams}`;

      const [ordersResponse, expensesResponse] = await Promise.all([
        fetchWithRetry(ordersUrl, {
          headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        }),
        (async () => {
          await delay(API_DELAY_MS); // Delay between parallel requests
          return fetchWithRetry(expensesUrl, {
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
          });
        })(),
      ]);

      let ordersTotals = { revenue: 0, commission: 0, profit: 0, deliveryFees: 0, itemCount: 0 };
      let expensesTotal = 0;

      if (ordersResponse.ok) {
        const ordersRaw = await ordersResponse.json();
        const items: FinanceOrderItem[] = ordersRaw.orderItems || ordersRaw.payload?.items || [];
        ordersTotals = items.reduce((acc, item) => ({
          revenue: acc.revenue + (item.sellPrice * item.amount),
          commission: acc.commission + item.commission,
          profit: acc.profit + item.sellerProfit,
          deliveryFees: acc.deliveryFees + item.logisticDeliveryFee,
          itemCount: acc.itemCount + item.amount,
        }), ordersTotals);
      }

      if (expensesResponse.ok) {
        const expensesData: UzumApiResponse<{ expenses: FinanceExpense[] }> = await expensesResponse.json();
        expensesTotal = (expensesData.payload?.expenses || []).reduce((sum, exp) => sum + exp.amount, 0);
      }

      result = {
        action: 'summary',
        shop_id: shopId,
        store_name: store.name,
        revenue: ordersTotals.revenue,
        commission: ordersTotals.commission,
        delivery_fees: ordersTotals.deliveryFees,
        gross_profit: ordersTotals.profit,
        platform_expenses: expensesTotal,
        net_profit: ordersTotals.profit - expensesTotal,
        total_items_sold: ordersTotals.itemCount,
        commission_rate: ordersTotals.revenue > 0
          ? ((ordersTotals.commission / ordersTotals.revenue) * 100).toFixed(2) + '%'
          : '0%',
      };

    } else if (action === 'scan_recent_fbu_orders') {
      // PROACTIVE SCAN: Fetch real dates for recent FBU orders before TTL expires
      // Runs every 15 min to catch orders within their 2-3 day TTL window
      const scanNowSec = Math.floor(Date.now() / 1000);
      const scanFromSec = scanNowSec - (7 * 24 * 60 * 60); // Last 7 days

      const scanParams = buildFinanceParams(shopId, {
        page: 0, size: 200,
        dateFrom: scanFromSec, dateTo: scanNowSec
      });
      const scanUrl = `${UZUM_API_BASE}/v1/finance/orders?${scanParams}`;

      const scanResp = await fetchWithRetry(scanUrl, {
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      });

      if (!scanResp.ok) throw new Error(`Finance API error: ${scanResp.status}`);

      const scanRaw = await scanResp.json();
      const scanItems: FinanceOrderItem[] = scanRaw.orderItems || scanRaw.payload?.items || [];
      const orderIdsFromFinance = [...new Set(scanItems.map(i => String(i.orderId)))];

      // Check which are already cached
      const { data: existingCache } = await supabase
        .from('fbu_order_date_cache')
        .select('order_id')
        .in('order_id', orderIdsFromFinance);
      const cachedIds = new Set((existingCache || []).map((c: any) => c.order_id));
      const uncachedIds = orderIdsFromFinance.filter(id => !cachedIds.has(id));

      console.log(`[scan_recent_fbu] ${orderIdsFromFinance.length} unique orders, ${uncachedIds.length} uncached`);

      let cachedCount = 0;
      let failedCount = 0;
      const cap = Math.min(uncachedIds.length, 50);

      for (let i = 0; i < cap; i++) {
        await delay(API_DELAY_MS);
        const orderData = await fetchOrderRealDate(uncachedIds[i], apiKey);

        if (orderData?.dateCreated) {
          const { error: cacheErr } = await supabase
            .from('fbu_order_date_cache')
            .upsert({
              order_id: uncachedIds[i],
              store_id,
              date_created: new Date(orderData.dateCreated).toISOString(),
              accepted_date: orderData.acceptedDate ? new Date(orderData.acceptedDate).toISOString() : null,
            }, { onConflict: 'order_id' });
          if (!cacheErr) cachedCount++;
          else failedCount++;
        } else {
          failedCount++;
        }
      }

      result = {
        action: 'scan_recent_fbu_orders',
        success: true,
        finance_orders_found: orderIdsFromFinance.length,
        already_cached: cachedIds.size,
        newly_cached: cachedCount,
        failed: failedCount,
        store_name: store.name,
      };

    } else if (action === 'sync_fbu_orders') {
      // Dedicated FBU order sync — uses fbu_order_date_cache for real dates
      // === FIX P2: NEW ORDERS GET PROBED AGAINST FBS ENDPOINT BEFORE BEING WRITTEN AS FBU ===
      // The Finance API returns BOTH FBS and FBU orders with NO fulfillment_type field.
      // For NEW orders (not yet in DB), we probe GET /v1/fbs/order/{id}:
      //   200 → genuine FBS order → write as 'fbs'
      //   404 → genuine FBU order → write as 'fbu'
      // Results are cached in fbu_order_date_cache (using cached_at to mark probe result).
      // For EXISTING orders, we preserve the stored fulfillment_type (post-upsert restore handles races).
      const syncNowSec = Math.floor(Date.now() / 1000);
      const syncSixMonthsSec = syncNowSec - (180 * 24 * 60 * 60);
      const syncDateFrom = date_from ? toUnixSeconds(Number(date_from)) : syncSixMonthsSec;
      const syncDateTo = date_to ? toUnixSeconds(Number(date_to)) : syncNowSec;

      let allItems: FinanceOrderItem[] = [];
      let currentPage = 0;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const syncParams = buildFinanceParams(shopId, {
          page: currentPage, size: pageSize,
          dateFrom: syncDateFrom, dateTo: syncDateTo
        });
        const syncUrl = `${UZUM_API_BASE}/v1/finance/orders?${syncParams}`;
        console.log(`[uzum-finance] sync_fbu_orders page ${currentPage}`);

        await delay(API_DELAY_MS);
        const syncResp = await fetchWithRetry(syncUrl, {
          headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        });

        if (!syncResp.ok) {
          console.error(`[uzum-finance] sync_fbu_orders API error:`, syncResp.status);
          break;
        }

        const syncRaw = await syncResp.json();
        const pageItems: FinanceOrderItem[] = syncRaw.orderItems || syncRaw.payload?.items || syncRaw.payload?.orderItems || [];
        const totalElements = syncRaw.totalElements || syncRaw.payload?.totalElements || 0;

        allItems = allItems.concat(pageItems);

        // FIX: Only stop when totalElements reached — don't exit early on partial pages.
        // Finance API can return incomplete pages (network glitches) which would stop
        // pagination prematurely and leave FBU orders unsynced.
        if (allItems.length >= totalElements || (pageItems.length === 0 && currentPage > 0)) {
          hasMore = false;
        } else {
          currentPage++;
        }
      }

      let upsertedCount = 0;
      let cacheHits = 0;

      if (allItems.length > 0) {
        const fboOrderMap = new Map<number, FinanceOrderItem[]>();
        for (const item of allItems) {
          if (!fboOrderMap.has(item.orderId)) fboOrderMap.set(item.orderId, []);
          fboOrderMap.get(item.orderId)!.push(item);
        }

        // Batch-fetch cached dates
        const allOrderIds = Array.from(fboOrderMap.keys()).map(String);
        const { data: cachedDates } = await supabase
          .from('fbu_order_date_cache')
          .select('order_id, date_created, accepted_date')
          .in('order_id', allOrderIds);

        const dateCache = new Map<string, { date_created: string | null; accepted_date: string | null }>();
        for (const c of (cachedDates || [])) {
          dateCache.set(c.order_id, { date_created: c.date_created, accepted_date: c.accepted_date });
        }

        // === FIX: Pre-fetch existing orders (both FBS and all) to determine what is new vs existing ===
        // The Finance API returns BOTH FBS and FBU settled orders with NO scheme/fulfillment_type field.
        // Strategy:
        //   - EXISTING orders: preserve their stored fulfillment_type (post-upsert restore handles races)
        //   - NEW orders not yet in DB: probe GET /v1/fbs/order/{id}
        //       200 → FBS order → write as 'fbs'
        //       404 → FBU order → write as 'fbu' (genuine FBU)
        const existingFbsIds = new Set<string>();
        const existingOrderIds = new Set<string>(); // ALL orders already in DB
        for (let i = 0; i < allOrderIds.length; i += 500) {
          const chunk = allOrderIds.slice(i, i + 500);
          const { data: existingBatch } = await supabase
            .from('marketplace_orders')
            .select('external_order_id, fulfillment_type')
            .eq('store_id', store_id)
            .in('external_order_id', chunk);
          for (const o of (existingBatch || [])) {
            existingOrderIds.add(o.external_order_id);
            if (o.fulfillment_type === 'fbs') existingFbsIds.add(o.external_order_id);
          }
        }

        // NEW orders not yet in DB → probe FBS single endpoint to determine true type
        const newOrderIds = allOrderIds.filter(id => !existingOrderIds.has(id));
        const probedFbsIds = new Set<string>();
        const probedFbuIds = new Set<string>();
        let probeCount = 0;
        // Cap probes per run to avoid timeout (Finance API can return hundreds of new orders)
        const MAX_PROBES = 80;
        const probeStartTime = Date.now();

        if (newOrderIds.length > 0) {
          console.log(`[uzum-finance] sync_fbu_orders: ${newOrderIds.length} NEW orders — probing up to ${MAX_PROBES} against FBS endpoint...`);
          for (const orderId of newOrderIds) {
            if (probeCount >= MAX_PROBES || Date.now() - probeStartTime > 20000) break;
            await delay(API_DELAY_MS);
            probeCount++;

            const probeUrl = `${UZUM_API_BASE}/v1/fbs/order/${orderId}`;
            const probeResp = await fetchWithRetry(probeUrl, {
              headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
            });

            if (probeResp.status === 200) {
              // Order exists on FBS endpoint → it's a genuine FBS order
              probedFbsIds.add(orderId);
            } else if (probeResp.status === 404) {
              // Not on FBS endpoint → genuine FBU order
              probedFbuIds.add(orderId);
            }
            // Other status codes: unknown, default to 'fbu' (safe fallback)
          }
          console.log(`[uzum-finance] Probe results: ${probedFbsIds.size} FBS, ${probedFbuIds.size} FBU, ${newOrderIds.length - probeCount} un-probed (default fbu)`);
        }

        console.log(`[uzum-finance] sync_fbu_orders: ${existingFbsIds.size} existing FBS orders will be preserved, ${probedFbsIds.size} new orders confirmed FBS via probe`);

        // === FIX: Preserve existing images before upsert ===
        const existingImageMap = new Map<string, Record<string, string>>();
        for (let i = 0; i < allOrderIds.length; i += 500) {
          const chunk = allOrderIds.slice(i, i + 500);
          const { data: existingWithItems } = await supabase
            .from('marketplace_orders')
            .select('external_order_id, items')
            .eq('store_id', store_id)
            .in('external_order_id', chunk);
          for (const eo of (existingWithItems || [])) {
            const images: Record<string, string> = {};
            for (const item of (eo.items || [])) {
              if (item.image && typeof item.image === 'string' && item.image.startsWith('http')) {
                images[String(item.productId)] = item.image;
              }
            }
            if (Object.keys(images).length > 0) {
              existingImageMap.set(eo.external_order_id, images);
            }
          }
        }
        console.log(`[uzum-finance] Image preservation: ${existingImageMap.size} orders have saved images`);

        // === FIX: Fetch images from marketplace_listings as fallback ===
        // This makes finance function SELF-SUFFICIENT — no dependency on enrichment
        const listingImageMap: Record<string, string> = {};
        const allProductIds = new Set<string>();
        for (const items of fboOrderMap.values()) {
          for (const i of items) {
            if (i.productId) allProductIds.add(String(i.productId));
          }
        }
        if (allProductIds.size > 0) {
          const productIdArr = Array.from(allProductIds);
          for (let i = 0; i < productIdArr.length; i += 500) {
            const chunk = productIdArr.slice(i, i + 500);
            const { data: listingsForImages } = await supabase
              .from('marketplace_listings')
              .select('external_product_id, image_url')
              .eq('store_id', store_id)
              .in('external_product_id', chunk)
              .not('image_url', 'is', null);
            for (const l of (listingsForImages || [])) {
              if (l.external_product_id && l.image_url) {
                listingImageMap[l.external_product_id] = l.image_url;
              }
            }
          }
        }
        console.log(`[uzum-finance] Listing image fallback: ${Object.keys(listingImageMap).length} images from listings`);

        const fboRows = Array.from(fboOrderMap.entries()).map(([orderId, items]) => {
          const allCanceled = items.every(i => i.status === 'CANCELED');

          const totalAmount = items.reduce((s, i) => {
            const qty = allCanceled ? i.amount : Math.max(i.amount, 1);
            return s + (i.sellPrice * qty);
          }, 0);
          const totalCommission = items.reduce((s, i) => s + (i.commission || 0), 0);
          const totalDeliveryFee = items.reduce((s, i) => s + (i.logisticDeliveryFee || 0), 0);
          const totalProfit = items.reduce((s, i) => s + (i.sellerProfit || 0), 0);

          // Use cached real date if available, fallback to finance date
          const cached = dateCache.get(String(orderId));
          let orderedAt: string | null = null;
          let acceptedAt: string | null = null;

          if (cached?.date_created) {
            orderedAt = cached.date_created;
            acceptedAt = cached.accepted_date || null;
            cacheHits++;
          } else if (items[0].date) {
            orderedAt = new Date(items[0].date).toISOString();
          }

          const isDelivered = !allCanceled;
          const orderIdStr = String(orderId);

          let fulfillmentType: string;
          if (existingFbsIds.has(orderIdStr)) {
            fulfillmentType = 'fbs';
          } else if (probedFbsIds.has(orderIdStr)) {
            fulfillmentType = 'fbs';
          } else {
            fulfillmentType = 'fbu';
          }

          // Merge saved images into finance items
          const savedImages = existingImageMap.get(orderIdStr) || {};

          const row: Record<string, unknown> = {
            store_id,
            external_order_id: orderIdStr,
            status: allCanceled ? 'CANCELED' : 'COMPLETED',
            fulfillment_status: allCanceled ? 'canceled' : 'delivered',
            fulfillment_type: fulfillmentType,
            total_amount: totalAmount,
            commission: totalCommission,
            delivery_fee: totalDeliveryFee,
            profit: totalProfit,
            currency: 'UZS',
            items: items.map(i => ({
              productId: i.productId,
              title: i.productTitle || i.skuTitle,
              skuTitle: i.skuTitle,
              price: i.sellPrice,
              quantity: allCanceled ? i.amount : Math.max(i.amount, 1),
              commission: i.commission,
              profit: i.sellerProfit,
              purchasePrice: i.purchasePrice,
              deliveryFee: i.logisticDeliveryFee,
              financeStatus: i.status,
              // Preserve existing image from DB
              image: savedImages[String(i.productId)] || listingImageMap[String(i.productId)] || null,
            })),
            ordered_at: orderedAt,
            last_synced_at: new Date().toISOString(),
          };
          if (acceptedAt) row.accepted_at = acceptedAt;
          if (isDelivered) {
            row.delivered_at = acceptedAt || orderedAt;
          }
          return row;
        });

        for (let i = 0; i < fboRows.length; i += 100) {
          const chunk = fboRows.slice(i, i + 100);
          const { error: upsertError } = await supabase
            .from('marketplace_orders')
            .upsert(chunk, { onConflict: 'store_id,external_order_id' });
          if (upsertError) {
            console.error('[uzum-finance] sync_fbu_orders upsert error:', upsertError.message);
          } else {
            upsertedCount += chunk.length;
          }
        }

        // === P5: POST-UPSERT FBS RESTORE ===
        // The upsert above may have overwritten FBS orders (those written by uzum-orders FBS sync
        // after we pre-fetched existingFbsIds). This step atomically restores any that got clobbered.
        // Race window: if FBS sync wrote a new FBS order BETWEEN our pre-fetch and the upsert above,
        // that order would now be 'fbu' again. This restore step catches it.
        if (existingFbsIds.size > 0) {
          const fbsIdsArray = Array.from(existingFbsIds);
          for (let i = 0; i < fbsIdsArray.length; i += 500) {
            const chunk = fbsIdsArray.slice(i, i + 500);
            const { error: restoreErr, count: restoreCount } = await supabase
              .from('marketplace_orders')
              .update({ fulfillment_type: 'fbs' })
              .eq('store_id', store_id)
              .in('external_order_id', chunk)
              .eq('fulfillment_type', 'fbu');  // only fix ones that actually got overwritten
            if (restoreErr) {
              console.error('[uzum-finance] FBS restore error:', restoreErr.message);
            } else if (restoreCount && restoreCount > 0) {
              console.log(`[uzum-finance] ✅ Post-upsert FBS restore: fixed ${restoreCount} orders that were overwritten`);
            }
          }
        }
      }

      result = {
        action: 'sync_fbu_orders',
        success: true,
        finance_items: allItems.length,
        unique_orders: upsertedCount,
        records_processed: upsertedCount,
        synced: upsertedCount,
        cache_hits: cacheHits,
        store_name: store.name,
      };

    } else if (action === 'debug_finance') {
      // Diagnostic action: test Finance API with various params including multi-shop & no-status
      const debugResults: Array<{ label: string; url: string; status: number; itemCount: number; totalElements: number; topKeys: string[]; rawResponse?: string; sampleItem?: unknown }> = [];

      // Seller groupings
      const sellerShops: Record<string, number[]> = {
        '316698': [49052, 69508, 88409, 69555, 70010],
        '356944': [89165, 92638],
      };
      const sellerId = store.seller_id ? String(store.seller_id) : null;
      const allShopsForSeller = sellerId ? (sellerShops[sellerId] || [shopId]) : [shopId];

      // Helper to build custom URL
      const buildCustomUrl = (shops: number[], statuses: string[] | null, dateFrom: number, dateTo: number) => {
        const p = new URLSearchParams();
        for (const s of shops) p.append('shopIds', String(s));
        if (statuses) { for (const st of statuses) p.append('statuses', st); }
        p.append('dateFrom', String(dateFrom));
        p.append('dateTo', String(dateTo));
        p.append('size', '10');
        p.append('page', '0');
        return `${UZUM_API_BASE}/v1/finance/orders?${p}`;
      };

      const now = Math.floor(Date.now() / 1000);
      const sixMonths = now - 180 * 24 * 60 * 60;
      const oneYear = now - 365 * 24 * 60 * 60;

      const testCases: Array<{ label: string; url: string }> = [
        // Original tests
        { label: 'Single shop, all statuses, 6mo', url: buildCustomUrl([shopId], FINANCE_STATUSES, sixMonths, now) },
        { label: 'Single shop, all statuses, 1yr', url: buildCustomUrl([shopId], FINANCE_STATUSES, oneYear, now) },
        // NEW: Multi-shop tests (all shops for this seller)
        { label: `Multi-shop (seller ${sellerId}), all statuses, 6mo`, url: buildCustomUrl(allShopsForSeller, FINANCE_STATUSES, sixMonths, now) },
        { label: `Multi-shop (seller ${sellerId}), all statuses, 1yr`, url: buildCustomUrl(allShopsForSeller, FINANCE_STATUSES, oneYear, now) },
        // NEW: No-status tests
        { label: 'Single shop, NO statuses, 6mo', url: buildCustomUrl([shopId], null, sixMonths, now) },
        { label: 'Single shop, NO statuses, 1yr', url: buildCustomUrl([shopId], null, oneYear, now) },
        // NEW: Combined: multi-shop + no statuses
        { label: `Multi-shop + NO statuses, 6mo`, url: buildCustomUrl(allShopsForSeller, null, sixMonths, now) },
        { label: `Multi-shop + NO statuses, 1yr`, url: buildCustomUrl(allShopsForSeller, null, oneYear, now) },
      ];

      for (const tc of testCases) {
        await delay(API_DELAY_MS);
        const tcResp = await fetchWithRetry(tc.url, {
          headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        });

        const tcText = await tcResp.text();
        let tcParsed: Record<string, unknown> = {};
        try { tcParsed = JSON.parse(tcText); } catch { /* skip */ }

        const tcItems = (tcParsed.orderItems || (tcParsed.payload as Record<string, unknown>)?.items || []) as unknown[];
        const tcTotal = (tcParsed.totalElements || (tcParsed.payload as Record<string, unknown>)?.totalElements || 0) as number;

        debugResults.push({
          label: tc.label,
          url: tc.url,
          status: tcResp.status,
          itemCount: Array.isArray(tcItems) ? tcItems.length : 0,
          totalElements: tcTotal,
          topKeys: Object.keys(tcParsed),
          rawResponse: tcText.substring(0, 500),
          sampleItem: Array.isArray(tcItems) && tcItems.length > 0 ? tcItems[0] : undefined,
        });
      }

      result = {
        action: 'debug_finance',
        shop_id: shopId,
        seller_id: sellerId,
        all_shops_for_seller: allShopsForSeller,
        store_name: store.name,
        api_key_name: store.api_key_secret_name,
        tests: debugResults,
      };

    } else if (action === 'profit_by_product') {
      // Analyze profit by product - with correct params
      const url = `${UZUM_API_BASE}/v1/finance/orders?${buildFinanceParams(shopId, { size: 1000 })}`;

      const response = await fetchWithRetry(url, {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch finance data: ${response.status}`);
      }

      const profitRaw = await response.json();
      const items: FinanceOrderItem[] = profitRaw.orderItems || profitRaw.payload?.items || [];

      // Group by product
      const productStats: Record<number, {
        productId: number;
        title: string;
        totalSold: number;
        revenue: number;
        commission: number;
        profit: number;
        roi?: string;
      }> = {};

      for (const item of items) {
        if (!productStats[item.productId]) {
          productStats[item.productId] = {
            productId: item.productId,
            title: item.productTitle || '',
            totalSold: 0,
            revenue: 0,
            commission: 0,
            profit: 0,
          };
        }
        productStats[item.productId].totalSold += item.amount;
        productStats[item.productId].revenue += item.sellPrice * item.amount;
        productStats[item.productId].commission += item.commission;
        productStats[item.productId].profit += item.sellerProfit;
      }

      // Calculate ROI and sort by profit
      const productList = Object.values(productStats)
        .map(p => ({
          ...p,
          roi: p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(2) + '%' : '0%',
        }))
        .sort((a, b) => b.profit - a.profit);

      result = {
        action: 'profit_by_product',
        products: productList,
        total_products: productList.length,
        top_profitable: productList.slice(0, 10),
        least_profitable: productList.slice(-10).reverse(),
      };

    } else if (action === 'invoices') {
      // Get FBO invoices (goods delivered to Uzum warehouse)
      let params = `page=${page}&size=${size}`;
      if (date_from) params += `&dateFrom=${date_from}`;
      if (date_to) params += `&dateTo=${date_to}`;

      const url = `${UZUM_API_BASE}/v1/shop/${shopId}/invoice?${params}`;
      console.log('Fetching invoices:', url);

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
      const invoices = data.payload?.items || data.payload || [];

      result = {
        action: 'invoices',
        invoices,
        total_invoices: Array.isArray(invoices) ? invoices.length : 0,
        page,
        size,
      };

    } else if (action === 'invoice_products') {
      // Get products in a specific invoice
      const { invoice_id } = await req.json().catch(() => ({}));

      if (!invoice_id) {
        throw new Error('invoice_id is required for invoice_products action');
      }

      const url = `${UZUM_API_BASE}/v1/shop/${shopId}/invoice/products?invoiceId=${invoice_id}`;
      console.log('Fetching invoice products:', url);

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
      const products = data.payload?.items || data.payload || [];

      result = {
        action: 'invoice_products',
        invoice_id,
        products,
        total_products: Array.isArray(products) ? products.length : 0,
      };

    } else if (action === 'fbo_returns') {
      // Get FBO returns (goods returned from Uzum warehouse)
      let params = `page=${page}&size=${size}`;
      if (date_from) params += `&dateFrom=${date_from}`;
      if (date_to) params += `&dateTo=${date_to}`;

      const url = `${UZUM_API_BASE}/v1/shop/${shopId}/return?${params}`;
      console.log('Fetching FBO returns:', url);

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
      const returns = data.payload?.items || data.payload || [];

      result = {
        action: 'fbo_returns',
        returns,
        total_returns: Array.isArray(returns) ? returns.length : 0,
        page,
        size,
      };

    } else if (action === 'test_fbs_orders_for_fbu') {
      // DIAGNOSTIC: Test if /v2/fbs/orders list endpoint returns FBU orders
      const testResults: Array<{ label: string; status: number; count: number; totalElements: number; sampleOrder?: unknown }> = [];

      // Get some known FBU order IDs from DB for cross-reference
      const { data: knownFbuOrders } = await supabase
        .from('marketplace_orders')
        .select('external_order_id')
        .eq('store_id', store_id)
        .eq('fulfillment_type', 'fbu')
        .order('ordered_at', { ascending: false })
        .limit(20);
      const knownFbuIds = new Set((knownFbuOrders || []).map((o: any) => o.external_order_id));

      // Test various status filters on /v2/fbs/orders
      const statusFilters = [
        { label: 'delivered', statuses: ['delivered'] },
        { label: 'all_statuses', statuses: ['delivering', 'delivered', 'cancelled', 'accepted'] },
        { label: 'no_filter', statuses: [] },
      ];

      for (const sf of statusFilters) {
        await delay(API_DELAY_MS);
        const p = new URLSearchParams();
        p.append('pageSize', '50');
        p.append('pageNumber', '0');
        for (const s of sf.statuses) p.append('statuses', s);
        // Last 30 days
        const fromMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
        p.append('dateFrom', String(fromMs));
        p.append('dateTo', String(Date.now()));

        const testUrl = `${UZUM_API_BASE}/v2/fbs/orders?${p}`;
        console.log(`[test_fbs_for_fbu] Testing ${sf.label}:`, testUrl);

        const resp = await fetchWithRetry(testUrl, {
          headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        });
        const text = await resp.text();
        let parsed: any = {};
        try { parsed = JSON.parse(text); } catch { }

        const orders = parsed.payload?.items || parsed.items || [];
        const totalElements = parsed.payload?.totalElements || parsed.totalElements || 0;

        // Check how many of these orders match known FBU order IDs
        let fbuMatches = 0;
        const sampleFbuMatch: any[] = [];
        for (const o of orders) {
          const oid = String(o.orderId || o.id);
          if (knownFbuIds.has(oid)) {
            fbuMatches++;
            if (sampleFbuMatch.length < 2) sampleFbuMatch.push(o);
          }
        }

        testResults.push({
          label: sf.label,
          status: resp.status,
          count: orders.length,
          totalElements,
          sampleOrder: orders[0] || null,
        });

        console.log(`[test_fbs_for_fbu] ${sf.label}: ${orders.length} orders, ${fbuMatches} FBU matches, total: ${totalElements}`);

        // Also log scheme field if present
        const schemes = orders.map((o: any) => o.scheme).filter(Boolean);
        const uniqueSchemes = [...new Set(schemes)];
        if (uniqueSchemes.length > 0) {
          console.log(`[test_fbs_for_fbu] Schemes found: ${uniqueSchemes.join(', ')}`);
        }
      }

      result = {
        action: 'test_fbs_orders_for_fbu',
        store_name: store.name,
        shop_id: shopId,
        known_fbu_order_ids: Array.from(knownFbuIds).slice(0, 10),
        tests: testResults,
      };

    } else if (action === 'fbo_summary') {
      // Get comprehensive FBO summary (invoices + returns + orders for last 3 months)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      // IMPORTANT: Uzum Finance API expects Unix timestamp in SECONDS
      const dateFromTimestamp = Math.floor(threeMonthsAgo.getTime() / 1000);
      const dateFromHuman = threeMonthsAgo.toISOString().split('T')[0]; // For UI display

      console.log('FBO Summary date range:', {
        shopId,
        dateFromTimestamp,
        dateFromHuman,
        now: new Date().toISOString()
      });

      const invoicesUrl = `${UZUM_API_BASE}/v1/shop/${shopId}/invoice?page=0&size=100`;
      const returnsUrl = `${UZUM_API_BASE}/v1/shop/${shopId}/return?page=0&size=100`;
      // FBO orders from Finance API - using Unix timestamp in SECONDS as required by API
      // Include ALL statuses: TO_WITHDRAW (settled), PROCESSING, CANCELED, PARTIALLY_CANCELLED
      const allStatuses = 'statuses=TO_WITHDRAW&statuses=PROCESSING&statuses=CANCELED&statuses=PARTIALLY_CANCELLED';
      const nowTs = Math.floor(Date.now() / 1000);
      const ordersUrl = `${UZUM_API_BASE}/v1/finance/orders?shopIds=${shopId}&dateFrom=${dateFromTimestamp}&dateTo=${nowTs}&${allStatuses}&size=500`;

      console.log('FBO Orders URL:', ordersUrl);

      const [invoicesResponse, returnsResponse, ordersResponse, defectsResponse] = await Promise.all([
        fetchWithRetry(invoicesUrl, {
          headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        }),
        (async () => {
          await delay(API_DELAY_MS);
          return fetchWithRetry(returnsUrl, {
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
          });
        })(),
        (async () => {
          await delay(API_DELAY_MS * 2);
          return fetchWithRetry(ordersUrl, {
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
          });
        })(),
        (async () => {
          // Attempt to fetch dedicated defects if the endpoint exists
          await delay(API_DELAY_MS * 3);
          const defectsUrl = `${UZUM_API_BASE}/v1/shop/${shopId}/defect?page=0&size=100`;
          return fetchWithRetry(defectsUrl, {
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
          });
        })(),
      ]);

      let invoices: unknown[] = [];
      let returns: any[] = [];
      let orders: FinanceOrderItem[] = [];
      let ordersTotals = { revenue: 0, commission: 0, profit: 0, deliveryFees: 0, itemCount: 0 };

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.ok ? await invoicesResponse.json() : {};
        invoices = invoicesData.payload?.items || invoicesData.payload || [];
      }

      if (returnsResponse.ok) {
        const returnsData = await returnsResponse.json();
        returns = returnsData.payload?.items || returnsData.payload || [];
      }

      if (defectsResponse.ok) {
        const defectsData = await defectsResponse.json();
        const defects = defectsData.payload?.items || defectsData.payload || [];
        // Tag them as defects to ensure they are picked up
        const taggedDefects = defects.map((d: any) => ({ ...d, status: d.status || 'DEFECTED', is_fbo_defect: true }));
        returns = [...returns, ...taggedDefects];
      }

      if (ordersResponse.ok) {
        const ordersRaw2 = await ordersResponse.json();
        const orderItems: FinanceOrderItem[] = ordersRaw2.orderItems || ordersRaw2.payload?.items || ordersRaw2.payload?.orderItems || [];
        orders = orderItems;
        ordersTotals = orders.reduce((acc, item) => {
          const qty = item.status === 'CANCELED' ? item.amount : Math.max(item.amount, 1);
          return {
            revenue: acc.revenue + (item.sellPrice * qty),
            commission: acc.commission + item.commission,
            profit: acc.profit + item.sellerProfit,
            deliveryFees: acc.deliveryFees + item.logisticDeliveryFee,
            itemCount: acc.itemCount + qty,
          };
        }, ordersTotals);
      }

      result = {
        action: 'fbo_summary',
        shop_id: shopId,
        store_name: store.name,
        invoices_count: Array.isArray(invoices) ? invoices.length : 0,
        returns_count: Array.isArray(returns) ? returns.length : 0,
        orders_count: orders.length,
        invoices,
        returns,
        orders,
        orders_totals: ordersTotals,
        date_range: {
          from: dateFromHuman,
          to: new Date().toISOString().split('T')[0],
        },
      };
    } else if (action === 'fbo_defects') {
      const url = `${UZUM_API_BASE}/v1/shop/${shopId}/defect?page=0&size=100`;
      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      result = {
        action: 'fbo_defects',
        defects: data.payload?.items || data.payload || [],
      };
    }

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
