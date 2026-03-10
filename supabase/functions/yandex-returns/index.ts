import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';

interface YandexReturn {
  id: number;
  orderId: number;
  creationDate: string;
  updateDate?: string;
  refundStatus: string;
  returnType?: string;
  logisticPickupPointId?: number;
  shipmentRecipientType?: string;
  shipmentStatus?: string;           // Shipment tracking status
  fastReturn?: boolean;              // Only for returnType=RETURN
  decisionRequired?: boolean;        // 48-hour decision needed
  decisionDeadline?: string;         // Decision deadline timestamp
  pickupTillDate?: string;           // Pickup deadline
  items?: Array<{
    marketSku: number;
    offerId: string;                 // Primary identifier
    shopSku?: string;                // Deprecated - use offerId
    count: number;
    decisionType?: string;
    amount?: number;                 // NEW: Replaces refundAmount
    refundAmount?: number;           // DEPRECATED
    partnerCompensationAmount?: number;  // Partner compensation for defects
  }>;
}

// Classify Yandex return type for UI filtering
// Returns 'skip' for non-return orders (UNREDEEMED) — these must NOT be saved to marketplace_returns
function classifyYandexReturn(returnType?: string, refundStatus?: string, campaignType: string = 'fbs'): string {
  // UNREDEEMED = buyurtma olinmagan (yo'qolgan buyurtma) — vozvrad emas, saqlamaslik
  if (returnType === 'UNREDEEMED') return 'skip';

  if (campaignType === 'fby') {
    // FBY kampaniyalari uchun barchasi FBO vozvrat (brak yoki odatiy)
    if (refundStatus === 'DEFECT' || returnType === 'DEFECT') return 'fbo_defect';
    return 'fbo_return';
  }
  if (returnType === 'UNREDEEMED') return 'skip';

  // Haqiqiy defekt vozvradlar
  if (refundStatus === 'DEFECT' || returnType === 'DEFECT') return 'fbs_defect';

  // Haqiqiy seller vozvradlari (qaytarib berilgan)
  if (returnType === 'RETURN') return 'fbs_seller';

  // Pul qaytarilgan yoki jarayondagi holatlar — bular ham haqiqiy vozvrad
  const validRefundStatuses = ['PARTIAL_MONEY_RETURN', 'FULL_MONEY_RETURN', 'WAITING', 'WAITING_FOR_DECISION'];
  if (validRefundStatuses.includes(refundStatus || '')) return 'fbs_seller';

  // Noma'lum holatlar — saqlamaslik
  return 'skip';
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

    const { store_id, days = 30, page_token, dateFrom: explicitDateFrom, dateTo: explicitDateTo } = await req.json();

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
      console.warn(`[yandex-returns] API key not configured: ${store.api_key_secret_name}`);
      return new Response(
        JSON.stringify({
          success: false,
          warning: `API key not configured: ${store.api_key_secret_name}`,
          returns_count: 0,
          total_items: 0,
          returns: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build list of campaigns — dual-campaign pattern (same as yandex-orders/stocks/finance)
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
      console.warn(`[yandex-returns] No campaign ID configured for ${store.name}`);
      return new Response(
        JSON.stringify({
          success: false,
          warning: `No campaign ID configured for ${store.name}`,
          returns_count: 0,
          total_items: 0,
          returns: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dateFrom = explicitDateFrom || getDateRange(days).dateFrom;
    const dateTo = explicitDateTo || getDateRange(days).dateTo;

    console.log(`[yandex-returns] Fetching returns for ${store.name} from ${campaignsToFetch.length} campaign(s) (${dateFrom} to ${dateTo})`);

    // Aggregate returns from all campaigns
    let allReturns: YandexReturn[] = [];
    let totalRefundAmount = 0;
    let totalCompensation = 0;
    let totalItems = 0;
    let pendingDecisions = 0;
    let lastNextPageToken: string | undefined;

    for (const campaign of campaignsToFetch) {
      console.log(`[yandex-returns] Fetching campaign ${campaign.id} (${campaign.type})`);

      let url = `${YANDEX_API_BASE}/v2/campaigns/${campaign.id}/returns?fromDate=${dateFrom}&toDate=${dateTo}`;
      if (page_token) {
        url += `&pageToken=${page_token}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yandex-returns] Campaign ${campaign.id} error: ${response.status} - ${errorText}`);
        continue; // Skip failed campaign, don't fail entirely
      }

      const data = await response.json();
      const returns: YandexReturn[] = data.result?.returns || data.returns || [];
      const nextPageToken = data.result?.paging?.nextPageToken;

      if (nextPageToken) {
        lastNextPageToken = nextPageToken;
      }

      console.log(`[yandex-returns] Campaign ${campaign.id}: ${returns.length} returns`);

      for (const ret of returns) {
        if (ret.decisionRequired && ret.decisionDeadline) {
          const deadline = new Date(ret.decisionDeadline);
          if (deadline > new Date()) {
            pendingDecisions++;
          }
        }
        for (const item of ret.items || []) {
          totalRefundAmount += item.amount || item.refundAmount || 0;
          totalCompensation += item.partnerCompensationAmount || 0;
          totalItems += item.count || 0;
        }
      }

      allReturns = allReturns.concat(returns.map((r: any) => ({ ...r, __campaignType: campaign.type })));
    }

    // Persist returns into marketplace_returns table
    if (allReturns.length > 0) {
      // Fetch product titles from marketplace_listings for SKU enrichment
      const allOfferIds = allReturns.flatMap(r => (r.items || []).map(i => i.offerId).filter(Boolean));
      const uniqueOfferIds = [...new Set(allOfferIds)];

      const skuToTitle: Record<string, string> = {};
      const skuToImage: Record<string, string> = {};
      if (uniqueOfferIds.length > 0) {
        const { data: listings } = await supabase
          .from('marketplace_listings')
          .select('external_sku, title, image_url')
          .in('external_sku', uniqueOfferIds)
          .eq('store_id', store_id);
        for (const l of listings || []) {
          if (l.external_sku && l.title) skuToTitle[l.external_sku] = l.title;
          if (l.external_sku && l.image_url) skuToImage[l.external_sku] = l.image_url;
        }
      }

      const returnRows: any[] = [];
      for (const r of allReturns) {
        const returnType = classifyYandexReturn(r.returnType, r.refundStatus, (r as any).__campaignType);

        // 'skip' = UNREDEEMED yoki noma'lum holat — marketplace_returns ga SAQLAMASLIK
        if (returnType === 'skip') {
          console.log(`[yandex-returns] Skipping orderId=${r.orderId} returnType=${r.returnType} refundStatus=${r.refundStatus}`);
          continue;
        }

        for (const item of r.items || []) {
          const offerId = item.offerId || item.shopSku || '';
          const productTitle = skuToTitle[offerId] || offerId || `SKU-${item.marketSku}`;
          const amount = item.amount || item.refundAmount || null;
          // Only store valid RUB amounts (>= 1 RUB)
          const validAmount = amount && amount >= 1 ? amount : null;
          returnRows.push({
            store_id,
            platform: 'yandex',
            store_name: store.name,
            external_order_id: String(r.orderId),
            nakladnoy_id: String(r.orderId),
            product_title: productTitle,
            sku_title: offerId || null,
            image_url: skuToImage[offerId] || null,
            quantity: item.count || 1,
            amount: validAmount,
            currency: 'RUB',
            return_reason: r.returnType || r.refundStatus || 'unknown',
            return_type: returnType,
            return_date: r.creationDate ? new Date(r.creationDate).toISOString() : new Date().toISOString(),
            resolution: 'pending',
          });
        }
      }

      // Batch upsert in chunks of 100 — use onConflict to prevent duplicates
      for (let i = 0; i < returnRows.length; i += 100) {
        const chunk = returnRows.slice(i, i + 100);
        const { error: upsertError } = await supabase
          .from('marketplace_returns')
          .upsert(chunk, {
            onConflict: 'platform,store_id,external_order_id,sku_title',
            ignoreDuplicates: false,
          });
        if (upsertError) {
          console.error(`[yandex-returns] Upsert error:`, upsertError.message);
        }
      }
      console.log(`[yandex-returns] Persisted ${returnRows.length} return items to marketplace_returns (skipped UNREDEEMED/unknown)`);

    }

    return new Response(
      JSON.stringify({
        success: true,
        store: store.name,
        campaigns_processed: campaignsToFetch.length,
        returns_count: allReturns.length,
        total_items: totalItems,
        total_refund_amount: totalRefundAmount,
        total_compensation: totalCompensation,
        pending_decisions: pendingDecisions,
        currency: 'RUB',
        next_page_token: lastNextPageToken,
        date_range: { dateFrom, dateTo },
        returns: allReturns.map(r => ({
          id: r.id,
          orderId: r.orderId,
          creationDate: r.creationDate,
          status: r.refundStatus,
          type: r.returnType,
          shipmentStatus: r.shipmentStatus,
          fastReturn: r.fastReturn,
          decisionRequired: r.decisionRequired,
          decisionDeadline: r.decisionDeadline,
          pickupTillDate: r.pickupTillDate,
          items: r.items?.map(i => ({
            sku: i.offerId || i.shopSku,
            marketSku: i.marketSku,
            count: i.count,
            decision: i.decisionType,
            amount: i.amount || i.refundAmount,
            compensation: i.partnerCompensationAmount,
          })),
        })),
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
