import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';

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

    const { store_id, days = 30, report_type = 'orders' } = await req.json();

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

    // Build list of campaigns — same dual-campaign pattern as yandex-orders
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
          type: store.fulfillment_type?.toLowerCase() || 'fbs',
        });
      }
    }

    if (campaignsToFetch.length === 0) {
      throw new Error('No campaign ID configured');
    }

    const { dateFrom, dateTo } = getDateRange(days);

    console.log(`[yandex-finance] Fetching financial data for ${store.name} from ${campaignsToFetch.length} campaign(s) (${dateFrom} to ${dateTo})`);

    // Aggregated totals across all campaigns
    let totalRevenue = 0;
    let totalCommissions = 0;
    let totalPayments = 0;
    let totalDeliveryFees = 0;
    let totalItemDeliveryFees = 0;
    let orderCount = 0;
    let itemCount = 0;

    const commissionBreakdown: Record<string, number> = {};
    const statusBreakdown: Record<string, number> = {};
    const perCampaign: Record<string, {
      type: string;
      orders: number;
      revenue: number;
      commissions: number;
      payments: number;
    }> = {};

    for (const campaign of campaignsToFetch) {
      console.log(`[yandex-finance] Processing campaign ${campaign.id} (${campaign.type})`);

      let campaignRevenue = 0;
      let campaignCommissions = 0;
      let campaignPayments = 0;
      let campaignOrders = 0;

      // Paginated fetch — loop until no more pages
      let pageToken: string | undefined;
      let totalOrdersForCampaign = 0;

      do {
        const requestBody: Record<string, unknown> = {
          dateFrom,
          dateTo,
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
          console.error(`[yandex-finance] Campaign ${campaign.id} error: ${response.status} - ${errorText}`);
          break; // Stop pagination for this campaign but don't fail entirely
        }

        const data = await response.json();
        const orders = data.result?.orders || [];
        pageToken = data.result?.paging?.nextPageToken;
        totalOrdersForCampaign += orders.length;

        console.log(`[yandex-finance] Campaign ${campaign.id}: page with ${orders.length} orders (total so far: ${totalOrdersForCampaign})`);

        for (const order of orders) {
        campaignOrders++;
        orderCount++;

        statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;

        for (const item of order.items || []) {
          // Skip "Delivery" pseudo-item — capture separately
          if (item.offerName === 'Delivery') {
            const deliveryPrice = item.prices?.find((p: any) => p.type === 'BUYER')?.total || 0;
            totalItemDeliveryFees += deliveryPrice;
            continue;
          }
          const buyerPrice = item.prices?.find((p: any) => p.type === 'BUYER');
          if (buyerPrice) {
            campaignRevenue += buyerPrice.total || 0;
            totalRevenue += buyerPrice.total || 0;
          }
          itemCount += item.count || 0;
        }

        for (const commission of order.commissions || []) {
          const amt = commission.actual || 0;
          campaignCommissions += amt;
          totalCommissions += amt;
          commissionBreakdown[commission.type] =
            (commissionBreakdown[commission.type] || 0) + amt;
          // Track delivery-specific commission types
          if (commission.type === 'DELIVERY_TO_CUSTOMER' || commission.type === 'EXPRESS_DELIVERY_TO_CUSTOMER') {
            totalDeliveryFees += amt;
          }
        }

        for (const payment of order.payments || []) {
          campaignPayments += payment.total || 0;
          totalPayments += payment.total || 0;
        }
      }

      } while (pageToken);

      console.log(`[yandex-finance] Campaign ${campaign.id} total: ${totalOrdersForCampaign} orders`);

      perCampaign[campaign.id] = {
        type: campaign.type,
        orders: campaignOrders,
        revenue: Math.round(campaignRevenue * 100) / 100,
        commissions: Math.round(campaignCommissions * 100) / 100,
        payments: Math.round(campaignPayments * 100) / 100,
      };
    }

    const netProfit = totalRevenue - totalCommissions;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
    const commissionRate = totalRevenue > 0 ? (totalCommissions / totalRevenue) * 100 : 0;

    return new Response(
      JSON.stringify({
        success: true,
        store: store.name,
        campaigns_processed: campaignsToFetch.length,
        period: { dateFrom, dateTo },
        summary: {
          total_orders: orderCount,
          total_items: itemCount,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          total_commissions: Math.round(totalCommissions * 100) / 100,
          total_delivery_fees: Math.round(totalDeliveryFees * 100) / 100,
          total_item_delivery_fees: Math.round(totalItemDeliveryFees * 100) / 100,
          total_payments: Math.round(totalPayments * 100) / 100,
          net_profit: Math.round(netProfit * 100) / 100,
          avg_order_value: Math.round(avgOrderValue * 100) / 100,
          commission_rate_percent: Math.round(commissionRate * 100) / 100,
          currency: 'RUB',
        },
        breakdown: {
          by_status: statusBreakdown,
          by_commission_type: commissionBreakdown,
          by_campaign: perCampaign,
        },
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
