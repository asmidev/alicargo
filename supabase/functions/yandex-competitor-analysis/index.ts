import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { 
      action = 'analyze',
      store_id,
      listing_id,
      category_id,
      limit = 20,
      competitor_sku,
      competitor_name,
      competitor_url,
      competitor_shop,
    } = body;

    let result: any = null;

    // Get store credentials
    const { data: store, error: storeError } = await supabase
      .from('marketplace_stores')
      .select('*')
      .eq('id', store_id)
      .eq('platform', 'yandex')
      .single();

    if (storeError || !store) {
      throw new Error(`Yandex store not found: ${storeError?.message}`);
    }

    const apiKey = Deno.env.get(store.api_key_secret_name);
    if (!apiKey) {
      throw new Error(`API key not configured: ${store.api_key_secret_name}`);
    }

    const businessId = store.business_id;
    const campaignId = store.campaign_id || store.fbs_campaign_id || store.fby_campaign_id;

    if (action === 'get_price_position') {
      // Combined approach: offer-prices + stats/skus for Yandex Go Market sellers
      
      // Build offer IDs list
      let offerIds: string[] = [];
      
      if (listing_id) {
        offerIds = [listing_id];
      } else {
        const { data: listings } = await supabase
          .from('marketplace_listings')
          .select('external_sku')
          .eq('store_id', store_id)
          .eq('status', 'active')
          .not('external_sku', 'is', null)
          .limit(limit);
        
        offerIds = (listings || []).map((l: any) => l.external_sku?.trim()).filter(Boolean);
      }

      if (offerIds.length === 0) {
        throw new Error('No SKUs found for price position analysis');
      }

      console.log(`[yandex-competitor] Analyzing ${offerIds.length} offers in store: ${store.name}`);

      // Step 1: Get current prices via offer-prices
      const currentPrices = new Map<string, number>();
      if (businessId) {
        try {
          const pricesResponse = await fetch(
            `${YANDEX_API_BASE}/v2/businesses/${businessId}/offer-prices`,
            {
              method: 'POST',
              headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ offerIds: offerIds.slice(0, 100) }),
            }
          );
          if (pricesResponse.ok) {
            const pricesData = await pricesResponse.json();
            for (const offer of pricesData.result?.offers || pricesData.offers || []) {
              const offerId = offer.offerId || offer.offer?.offerId;
              const price = offer.price?.value || offer.price?.discountBase || 0;
              if (offerId) currentPrices.set(offerId, price);
            }
            console.log(`[yandex-competitor] Got prices for ${currentPrices.size} offers`);
          }
        } catch (err) {
          console.error('[yandex-competitor] Prices API error:', err);
        }
      }

      // Step 2: Try recommendations endpoint (works for Russian Market, may fail for Go Market)
      let recsAvailable = false;
      const recsMap = new Map<string, any>();
      
      if (businessId) {
        try {
          const recsResponse = await fetch(
            `${YANDEX_API_BASE}/v2/businesses/${businessId}/offers/recommendations`,
            {
              method: 'POST',
              headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ offerIds: offerIds.slice(0, 100) }),
            }
          );
          if (recsResponse.ok) {
            const recsData = await recsResponse.json();
            for (const offer of recsData.result?.offers || recsData.offers || []) {
              const offerId = offer.offerId || offer.offer?.offerId;
              if (offerId) { recsMap.set(offerId, offer); recsAvailable = true; }
            }
            console.log(`[yandex-competitor] Got recommendations for ${recsMap.size} offers`);
          } else {
            console.log(`[yandex-competitor] Recommendations API not available (${recsResponse.status}), using fallback`);
          }
        } catch (err) {
          console.log('[yandex-competitor] Recommendations API error, using fallback');
        }
      }

      // Step 3: Fallback to stats/skus for any market data
      const statsMap = new Map<string, any>();
      if (!recsAvailable && campaignId) {
        try {
          const statsResponse = await fetch(
            `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/stats/skus`,
            {
              method: 'POST',
              headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ shopSkus: offerIds.slice(0, 500) }),
            }
          );
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            for (const sku of statsData.result?.shopSkus || []) {
              statsMap.set(sku.shopSku, sku);
            }
            console.log(`[yandex-competitor] Got stats for ${statsMap.size} SKUs`);
          }
        } catch (err) {
          console.error('[yandex-competitor] Stats API error:', err);
        }
      }

      // Determine platform limitation — stats_skus returning all zeros means no real data
      const hasRealCompetitorData = recsAvailable || 
        [...statsMap.values()].some((s: any) => (s.priceCompetition?.averagePrice || 0) > 0);
      const platformLimited = !hasRealCompetitorData;
      const dataSource = recsAvailable ? 'recommendations' : (statsMap.size > 0 ? 'stats_skus' : 'prices_only');
      
      if (platformLimited) {
        console.log('[yandex-competitor] Yandex Go Market: competitor pricing not available — platform limitation');
      }

      // Build positions from combined data
      const positions: any[] = [];

      for (const offerId of offerIds) {
        const ourPrice = currentPrices.get(offerId) || 0;
        const rec = recsMap.get(offerId);
        const stats = statsMap.get(offerId);

        let competitivePrice = 0;
        let suggestedPrice = 0;
        let minPriceOnMarket = 0;
        let competitivenessIndex = null;
        let source = 'prices_only';

        if (rec) {
          competitivePrice = rec.competitivePrice || rec.priceRecommendation?.competitivePrice || 0;
          suggestedPrice = rec.suggestedPrice || rec.priceRecommendation?.suggestedPrice || 0;
          minPriceOnMarket = rec.minPriceOnMarket || rec.priceRecommendation?.minPriceOnMarket || 0;
          competitivenessIndex = rec.competitivenessIndex || null;
          source = 'recommendations';
        } else if (stats) {
          const pc = stats.priceCompetition || {};
          competitivePrice = pc.averagePrice || 0;
          minPriceOnMarket = pc.minPrice || 0;
          competitivenessIndex = pc.position ? `${pc.position}/${pc.total}` : null;
          source = 'stats_skus';
        }

        positions.push({
          shopSku: offerId,
          ourPrice,
          competitivePrice,
          suggestedPrice,
          minPriceOnMarket,
          competitivenessIndex,
          position: competitivePrice > 0 && ourPrice > 0
            ? (ourPrice <= competitivePrice ? 1 : (ourPrice <= competitivePrice * 1.1 ? 2 : 3))
            : 0,
          priceDifference: ourPrice > 0 && competitivePrice > 0 ? ourPrice - competitivePrice : 0,
          source,
        });
      }

      // Only store competitor data if we actually have competitive prices (not zero)
      let storedCount = 0;
      if (!platformLimited) {
        const competitorInsightsToStore = positions.filter(p => p.competitivePrice > 0 && p.ourPrice > 0);
        for (const insight of competitorInsightsToStore.slice(0, 20)) {
          try {
            const { data: listing } = await supabase
              .from('marketplace_listings')
              .select('id')
              .eq('store_id', store_id)
              .eq('external_sku', insight.shopSku)
              .single();

            if (!listing) continue;

            const compSku = `yandex-market-${insight.shopSku}`;
            const { data: existing } = await supabase
              .from('marketplace_competitors')
              .select('id')
              .eq('listing_id', listing.id)
              .eq('competitor_sku', compSku)
              .single();

            if (existing) {
              await supabase.from('marketplace_competitor_prices').insert({
                competitor_id: existing.id,
                price: insight.competitivePrice,
                original_price: insight.ourPrice,
              });
              storedCount++;
            } else {
              const { data: newComp } = await supabase
                .from('marketplace_competitors')
                .insert({
                  listing_id: listing.id,
                  store_id,
                  competitor_name: `Yandex Market avg (${insight.shopSku})`,
                  competitor_sku: compSku,
                  competitor_shop_name: 'Yandex Market',
                  is_active: true,
                })
                .select()
                .single();

              if (newComp) {
                await supabase.from('marketplace_competitor_prices').insert({
                  competitor_id: newComp.id,
                  price: insight.competitivePrice,
                  original_price: insight.ourPrice,
                });
                storedCount++;
              }
            }
          } catch (err) {
            console.error('[yandex-competitor] Store error:', err);
          }
        }
      }

      result = {
        store: store.name,
        analyzed: positions.length,
        stored: storedCount,
        data_source: dataSource,
        platform_limitation: platformLimited,
        platform_limitation_note: platformLimited 
          ? 'Yandex Go Market (O\'zbekiston) sellerlariga raqobat narx ma\'lumoti berilmaydi. Bu platform siyosati.' 
          : null,
        positions,
        timestamp: new Date().toISOString(),
      };

    } else if (action === 'analyze_category') {
      if (!businessId && !campaignId) throw new Error('business_id or campaign_id required');

      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('id, title, price, external_sku')
        .eq('store_id', store_id)
        .eq('status', 'active')
        .not('external_sku', 'is', null)
        .limit(50);

      if (!listings?.length) throw new Error('No active listings found');

      // Get prices for all offers
      const offerIds = listings.map(l => l.external_sku?.trim()).filter(Boolean);
      const currentPrices = new Map<string, number>();

      if (businessId) {
        try {
          const pricesResponse = await fetch(
            `${YANDEX_API_BASE}/v2/businesses/${businessId}/offer-prices`,
            {
              method: 'POST',
              headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ offerIds: offerIds.slice(0, 100) }),
            }
          );
          if (pricesResponse.ok) {
            const pricesData = await pricesResponse.json();
            for (const offer of pricesData.result?.offers || pricesData.offers || []) {
              const offerId = offer.offerId || offer.offer?.offerId;
              const price = offer.price?.value || offer.price?.discountBase || 0;
              if (offerId) currentPrices.set(offerId, price);
            }
          }
        } catch (e) { /* ignore */ }
      }

      // Calculate category-level stats from our own prices
      const allPrices = [...currentPrices.values()].filter(p => p > 0);
      const avgPrice = allPrices.length > 0 ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) : 0;

      const categoryAnalysis = listings.map(l => ({
        listing_id: l.id,
        title: l.title,
        our_price: currentPrices.get(l.external_sku?.trim() || '') || l.price,
        category_avg: avgPrice,
        vs_avg: l.price && avgPrice > 0 ? Math.round(((l.price - avgPrice) / avgPrice) * 100) : 0,
      }));

      result = {
        store: store.name,
        category_id,
        analyzed_products: categoryAnalysis.length,
        products: categoryAnalysis,
        summary: {
          avg_price: avgPrice,
          min_price: allPrices.length > 0 ? Math.min(...allPrices) : 0,
          max_price: allPrices.length > 0 ? Math.max(...allPrices) : 0,
        },
      };

    } else if (action === 'ai_competitor_strategy') {
      if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

      const { data: competitors } = await supabase
        .from('marketplace_competitors')
        .select(`*, marketplace_competitor_prices(price, rating, sales_count, captured_at)`)
        .eq('store_id', store_id)
        .order('updated_at', { ascending: false })
        .limit(20);

      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('store_id', store_id)
        .eq('status', 'active')
        .limit(50);

      const competitorSummary = (competitors || []).map(c => {
        const latestPrice = c.marketplace_competitor_prices?.[0];
        return `- ${c.competitor_name}: ${latestPrice?.price || 'N/A'} RUB`;
      }).join('\n');

      const listingSummary = (listings || []).slice(0, 10).map((l: any) => 
        `- ${l.title}: ${l.price} RUB (stock: ${l.stock})`
      ).join('\n');

      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Siz marketplace raqobat strategiyasi bo\'yicha ekspertsiz.' },
            { role: 'user', content: `Yandex Market do'kon:\n\nMAHSULOTLAR:\n${listingSummary || 'Yo\'q'}\n\nRAQOBATCHILAR:\n${competitorSummary || 'Yo\'q'}\n\n1. Narx strategiyasi\n2. 3 ta tavsiya\nO'zbek tilida.` },
          ],
          max_tokens: 800,
        }),
      });

      if (!aiResponse.ok) throw new Error('AI analysis failed');

      const aiData = await aiResponse.json();
      result = {
        store: store.name,
        ai_analysis: aiData.choices?.[0]?.message?.content || '',
        competitors_analyzed: competitors?.length || 0,
        listings_analyzed: listings?.length || 0,
        generated_at: new Date().toISOString(),
      };

    } else if (action === 'track_competitor') {
      const { data: newCompetitor, error: insertError } = await supabase
        .from('marketplace_competitors')
        .insert({
          store_id,
          listing_id: listing_id || null,
          competitor_name,
          competitor_sku,
          competitor_shop_name: competitor_shop,
          competitor_product_url: competitor_url,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw new Error(`Failed to add competitor: ${insertError.message}`);
      result = { added: true, competitor: newCompetitor };

    } else if (action === 'sync_price_history') {
      const { data: competitors } = await supabase
        .from('marketplace_competitors')
        .select('*')
        .eq('store_id', store_id)
        .eq('is_active', true);

      let synced = 0;
      let failed = 0;

      const listingIds = [...new Set((competitors || []).map(c => c.listing_id).filter(Boolean))];
      
      if (listingIds.length > 0) {
        const { data: listings } = await supabase
          .from('marketplace_listings')
          .select('id, external_sku')
          .in('id', listingIds)
          .not('external_sku', 'is', null);

        const skuToListingId = new Map<string, string>();
        for (const l of listings || []) {
          if (l.external_sku) skuToListingId.set(l.external_sku.trim(), l.id);
        }

        // Try offer-prices to get current prices
        if (skuToListingId.size > 0 && businessId) {
          try {
            const pricesResponse = await fetch(
              `${YANDEX_API_BASE}/v2/businesses/${businessId}/offer-prices`,
              {
                method: 'POST',
                headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ offerIds: [...skuToListingId.keys()].slice(0, 100) }),
              }
            );

            if (pricesResponse.ok) {
              const pricesData = await pricesResponse.json();
              for (const offer of pricesData.result?.offers || pricesData.offers || []) {
                const offerId = offer.offerId || offer.offer?.offerId;
                if (!offerId) continue;
                const listingId = skuToListingId.get(offerId);
                if (!listingId) continue;
                
                const price = offer.price?.value || offer.price?.discountBase || 0;
                if (price <= 0) continue;

                const linkedCompetitors = (competitors || []).filter(c => c.listing_id === listingId);
                for (const comp of linkedCompetitors) {
                  const { error: insertErr } = await supabase
                    .from('marketplace_competitor_prices')
                    .insert({ competitor_id: comp.id, price });
                  if (!insertErr) synced++;
                  else failed++;
                }
              }
            }
          } catch (err) {
            console.error('[yandex-competitor] Price sync error:', err);
            failed = competitors?.length || 0;
          }
        }
      }

      result = {
        store: store.name,
        total_competitors: competitors?.length || 0,
        synced,
        failed,
      };
    }

    return new Response(
      JSON.stringify({ success: true, result }),
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
