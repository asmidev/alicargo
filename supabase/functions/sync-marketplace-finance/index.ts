import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_DELAY_MS = 300;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface FinanceSummary {
  gross_revenue: number;
  net_revenue: number;
  commission_total: number;
  delivery_fees: number;
  storage_fees: number;
  return_fees: number;
  other_fees: number;
  orders_count: number;
  delivered_count: number;
  cancelled_count: number;
  returned_count: number;
  items_sold: number;
  currency: string;
}

interface OrderItem {
  id?: number;
  skuId?: number;
  productId?: number;
  barcode?: string;
  title?: string;
  skuTitle?: string;
  price?: number;
  quantity?: number;
  commission?: number;
}

interface MarketplaceOrder {
  id: string;
  store_id: string;
  order_date: string;
  ordered_at?: string;
  created_at?: string;
  delivered_at?: string;
  total_amount: number;
  commission: number;
  delivery_fee?: number;
  delivery_cost?: number;
  storage_fee?: number;
  fulfillment_status: string;
  status: string;
  substatus?: string;
  quantity?: number;
  items?: OrderItem[];
}

interface MarketplaceStore {
  id: string;
  name: string;
  platform: string;
  is_active: boolean;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

// Commission rate lookup map
interface CommissionRates {
  byBarcode: Record<string, number>;
  byProductId: Record<string, number>;
  avgRate: number;
}

function isDeliveredOrder(order: MarketplaceOrder): boolean {
  const deliveredFulfillmentStatuses = ['delivered', 'completed'];
  const deliveredRawStatuses = ['COMPLETED', 'DELIVERED', 'PICKUP_USER_RECEIVED'];
  const deliveredSubstatuses = ['PICKUP', 'PICKUP_SERVICE_RECEIVED'];
  return deliveredFulfillmentStatuses.includes(order.fulfillment_status?.toLowerCase() || '') ||
         deliveredRawStatuses.includes(order.status?.toUpperCase() || '') ||
         deliveredSubstatuses.includes(order.substatus?.toUpperCase() || '');
}

function isCancelledOrder(order: MarketplaceOrder): boolean {
  const cancelledStatuses = ['cancelled', 'canceled'];
  const cancelledRawStatuses = ['CANCELED', 'CANCELLED', 'PENDING_CANCELLATION'];
  return cancelledStatuses.includes(order.fulfillment_status?.toLowerCase() || '') ||
         cancelledRawStatuses.includes(order.status?.toUpperCase() || '');
}

function isReturnedOrder(order: MarketplaceOrder): boolean {
  return (order.fulfillment_status?.toLowerCase() || '') === 'returned' ||
         (order.status?.toUpperCase() || '') === 'RETURNED';
}

// deno-lint-ignore no-explicit-any
async function fetchAllRows(query: any, batchSize = 1000) {
  // deno-lint-ignore no-explicit-any
  let allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return allRows;
}

function getOrderDate(order: MarketplaceOrder): string {
  // For delivered orders, use delivered_at (delivery-date revenue recognition)
  if (isDeliveredOrder(order) && order.delivered_at) {
    return order.delivered_at.split('T')[0];
  }
  // For non-delivered orders (cancelled, returned, pending), use ordered_at
  const raw = order.ordered_at || order.created_at || order.order_date;
  if (!raw) return new Date().toISOString().split('T')[0];
  return raw.split('T')[0];
}

function groupOrdersByDate(orders: MarketplaceOrder[]): Map<string, MarketplaceOrder[]> {
  const grouped = new Map<string, MarketplaceOrder[]>();
  for (const order of orders) {
    const date = getOrderDate(order);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(order);
  }
  return grouped;
}

function emptyFinanceSummary(currency: string): FinanceSummary {
  return {
    gross_revenue: 0, net_revenue: 0, commission_total: 0,
    delivery_fees: 0, storage_fees: 0, return_fees: 0, other_fees: 0,
    orders_count: 0, delivered_count: 0, cancelled_count: 0, returned_count: 0,
    items_sold: 0, currency,
  };
}

// Batch fetch commission rates for a store (eliminates N+1 queries)
async function fetchStoreCommissionRates(supabase: SupabaseClient, storeId: string): Promise<CommissionRates> {
  const { data: storeListings } = await supabase
    .from('marketplace_listings')
    .select('external_barcode, external_product_id, commission_rate')
    .eq('store_id', storeId)
    .not('commission_rate', 'is', null)
    .gt('commission_rate', 0);

  const byBarcode: Record<string, number> = {};
  const byProductId: Record<string, number> = {};
  let sum = 0;

  for (const l of storeListings || []) {
    if (l.commission_rate && l.commission_rate > 0) {
      if (l.external_barcode) byBarcode[l.external_barcode] = l.commission_rate;
      if (l.external_product_id) byProductId[l.external_product_id] = l.commission_rate;
      sum += l.commission_rate;
    }
  }

  const avgRate = storeListings && storeListings.length > 0
    ? sum / storeListings.length
    : 10;

  return { byBarcode, byProductId, avgRate };
}

// Calculate commission in-memory using pre-fetched rates
function calculateCommissionInMemory(order: MarketplaceOrder, rates: CommissionRates): number {
  const items = order.items || [];
  const orderAmount = Number(order.total_amount) || 0;

  if (items.length === 0 || orderAmount === 0) {
    return Math.round(orderAmount * (rates.avgRate / 100));
  }

  let totalCommission = 0;
  let matchedItems = 0;

  for (const item of items) {
    const barcode = String(item.barcode || '');
    const productId = String(item.productId || '');
    const rate = rates.byBarcode[barcode] || rates.byProductId[productId] || null;
    const itemValue = (item.price || 0) * (item.quantity || 1);

    if (rate !== null) {
      totalCommission += itemValue * (rate / 100);
      matchedItems++;
    }
  }

  if (matchedItems === 0) {
    return Math.round(orderAmount * (rates.avgRate / 100));
  }

  return Math.round(totalCommission);
}

function convertToUSD(amount: number, currency: string, rates: Record<string, number>): number {
  const rate = rates[currency] || 1;
  return amount / rate;
}

function getExchangeRate(currency: string, rates: Record<string, number>): number {
  return rates[currency] || 1;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { store_id, date_from, date_to } = body;

    const now = new Date();
    // Extend date_from by -7 days to catch cross-month deliveries (orders placed late prev month, delivered this month)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const extendedStart = new Date(monthStart);
    extendedStart.setDate(extendedStart.getDate() - 7);
    const defaultDateFrom = date_from || extendedStart.toISOString().split('T')[0];
    const defaultDateTo = date_to || now.toISOString().split('T')[0];

    console.log(`Syncing marketplace finance (daily): ${defaultDateFrom} to ${defaultDateTo}`);

    let storesQuery = supabase
      .from('marketplace_stores')
      .select('*')
      .eq('is_active', true);

    if (store_id) {
      storesQuery = storesQuery.eq('id', store_id);
    }

    const { data: stores, error: storesError } = await storesQuery;
    if (storesError) throw storesError;
    if (!stores || stores.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active stores found', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get exchange rates
    const { data: ratesData } = await supabase.functions.invoke('exchange-rates');
    const exchangeRates = ratesData || { USD: 1, UZS: 12800, RUB: 95 };

    const results: Array<{
      store_id: string;
      store_name: string;
      platform: string;
      success: boolean;
      days_synced?: number;
      orders_processed?: number;
      error?: string;
    }> = [];

    for (const store of stores as MarketplaceStore[]) {
      try {
        await delay(API_DELAY_MS);

        // Fetch orders where delivered_at OR ordered_at falls in range
        // This ensures we capture: delivered orders by delivery date, and non-delivered by order date
        const orders = await fetchAllRows(
          supabase
            .from('marketplace_orders')
            .select('*')
            .eq('store_id', store.id)
            .or(`delivered_at.gte.${defaultDateFrom},ordered_at.gte.${defaultDateFrom}`)
            .or(`delivered_at.lte.${defaultDateTo}T23:59:59,ordered_at.lte.${defaultDateTo}T23:59:59`)
        ) as MarketplaceOrder[];

        console.log(`[${store.name}] Fetched ${orders.length} orders for ${defaultDateFrom} to ${defaultDateTo}`);

        // FIX: Batch fetch commission rates once per store (eliminates N+1)
        const commissionRates = store.platform === 'uzum'
          ? await fetchStoreCommissionRates(supabase, store.id)
          : null;

        const grouped = groupOrdersByDate(orders);
        const dailySummaries = new Map<string, FinanceSummary>();
        const currency = 'UZS';

        for (const [date, dayOrders] of grouped) {
          const summary = emptyFinanceSummary(currency);
          summary.orders_count = dayOrders.length;

          for (const order of dayOrders) {
            const amount = Number(order.total_amount) || 0;
            let commission = Number(order.commission) || 0;
            const deliveryFee = Number(order.delivery_fee) || Number(order.delivery_cost) || 0;
            const storageFee = Number(order.storage_fee) || 0;

            // Calculate missing commission using batch-fetched rates
            if (commission === 0 && isDeliveredOrder(order) && amount > 0) {
              if (store.platform === 'uzum' && commissionRates) {
                commission = calculateCommissionInMemory(order, commissionRates);
              } else if (store.platform === 'yandex') {
                commission = Math.round(amount * 0.05);
              }
              // Update the order record with calculated commission
              if (commission > 0) {
                await supabase.from('marketplace_orders')
                  .update({ commission })
                  .eq('id', order.id);
                // Also update finance_transactions to keep P&L in sync
                await supabase.from('finance_transactions')
                  .update({ 
                    amount: amount - commission,
                    marketplace_commission: commission 
                  })
                  .eq('reference_id', order.id)
                  .eq('reference_type', 'marketplace_order');
              }
            }

            if (isDeliveredOrder(order)) {
              summary.delivered_count++;
              summary.gross_revenue += amount;
              summary.net_revenue += amount - commission - deliveryFee - storageFee;
              summary.commission_total += commission;
              summary.delivery_fees += deliveryFee;
              summary.storage_fees += storageFee;
              summary.items_sold += order.quantity || 1;
            } else if (isCancelledOrder(order)) {
              summary.cancelled_count++;
            } else if (isReturnedOrder(order)) {
              summary.returned_count++;
              summary.return_fees += amount;
            }
          }

          dailySummaries.set(date, summary);
        }

        // Zero-fill stale dates
        const allDatesInRange: string[] = [];
        const startDate = new Date(defaultDateFrom);
        const endDate = new Date(defaultDateTo);
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          allDatesInRange.push(d.toISOString().split('T')[0]);
        }
        const staleDates = allDatesInRange.filter(d => !dailySummaries.has(d));

        for (const date of staleDates) {
          const rate = getExchangeRate(currency, exchangeRates);
          await supabase
            .from('marketplace_finance_summary')
            .upsert({
              store_id: store.id,
              period_date: date,
              period_type: 'daily',
              gross_revenue: 0, net_revenue: 0, commission_total: 0,
              delivery_fees: 0, storage_fees: 0, return_fees: 0, other_fees: 0,
              orders_count: 0, delivered_count: 0, cancelled_count: 0, returned_count: 0,
              items_sold: 0, currency,
              usd_equivalent: 0, exchange_rate_used: rate,
              synced_at: new Date().toISOString(), sync_source: 'zero_fill',
            }, { onConflict: 'store_id,period_date,period_type' });
        }

        // Upsert daily summaries
        for (const [date, summary] of dailySummaries) {
          const usdEquivalent = convertToUSD(summary.net_revenue, summary.currency, exchangeRates);
          const rate = getExchangeRate(summary.currency, exchangeRates);

          const { error: upsertError } = await supabase
            .from('marketplace_finance_summary')
            .upsert({
              store_id: store.id,
              period_date: date,
              period_type: 'daily',
              gross_revenue: summary.gross_revenue,
              net_revenue: summary.net_revenue,
              commission_total: summary.commission_total,
              delivery_fees: summary.delivery_fees,
              storage_fees: summary.storage_fees,
              return_fees: summary.return_fees,
              other_fees: summary.other_fees,
              orders_count: summary.orders_count,
              delivered_count: summary.delivered_count,
              cancelled_count: summary.cancelled_count,
              returned_count: summary.returned_count,
              items_sold: summary.items_sold,
              currency: summary.currency,
              usd_equivalent: usdEquivalent,
              exchange_rate_used: rate,
              synced_at: new Date().toISOString(),
              sync_source: 'calculated',
            }, { onConflict: 'store_id,period_date,period_type' });

          if (upsertError) {
            console.error(`Error upserting ${store.name} for ${date}:`, upsertError);
          }
        }

        results.push({
          store_id: store.id,
          store_name: store.name,
          platform: store.platform,
          success: true,
          days_synced: dailySummaries.size,
          orders_processed: orders.length,
        });

      } catch (error) {
        console.error(`Error syncing store ${store.name}:`, error);
        results.push({
          store_id: store.id,
          store_name: store.name,
          platform: store.platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalDays = results.reduce((sum, r) => sum + (r.days_synced || 0), 0);
    const totalOrders = results.reduce((sum, r) => sum + (r.orders_processed || 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        synced: successCount,
        total: stores.length,
        total_days_synced: totalDays,
        total_orders_processed: totalOrders,
        results,
        period: { from: defaultDateFrom, to: defaultDateTo },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
