import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UZUM_SELLER_API = 'https://api-seller.uzum.uz/api/seller-openapi';
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MAX_RETRIES = 2;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 && attempt < retries) {
        await delay(1000 * attempt);
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === retries) throw error;
      await delay(1000 * attempt);
    }
  }
  return fetch(url, options);
}

function safePriceStats(prices: number[]) {
  const validPrices = prices.filter(p => p > 0);
  if (validPrices.length === 0) return { min: 0, max: 0, avg: 0 };
  return {
    min: Math.min(...validPrices),
    max: Math.max(...validPrices),
    avg: Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length),
  };
}

// Get all our shop IDs to filter out own listings from competitor results
async function getOurShopIds(supabase: any): Promise<Set<string>> {
  const { data: stores } = await supabase
    .from('marketplace_stores')
    .select('shop_id')
    .eq('platform', 'uzum')
    .eq('is_active', true);
  return new Set((stores || []).map((s: any) => String(s.shop_id)).filter(Boolean));
}

// Get Seller API analytics data for a store
async function getSellerAnalytics(apiKey: string, shopId: string, page = 0, size = 20): Promise<any[]> {
  try {
    const url = `${UZUM_SELLER_API}/v1/product/analytics?shopId=${shopId}&page=${page}&size=${size}`;
    const response = await fetchWithRetry(url, {
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.log(`[uzum-competitor] Seller analytics API returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return data?.productAnalytics || data?.content || data?.payload?.content || [];
  } catch (err) {
    console.error('[uzum-competitor] Seller analytics error:', err);
    return [];
  }
}

// Cross-reference DB listings to find competitors from OTHER stores
function findDBCompetitors(
  listing: any, 
  allListings: any[], 
  ourShopIds: Set<string>,
  ourStoreIds: Set<string>
): any[] {
  const titleWords = new Set(
    (listing.title || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
  );
  if (titleWords.size === 0) return [];

  return allListings
    .filter(l => 
      l.id !== listing.id && 
      !ourStoreIds.has(l.store_id) // Exclude our own stores
    )
    .map(l => {
      const words = (l.title || '').toLowerCase().split(/\s+/);
      const matchCount = words.filter((w: string) => titleWords.has(w)).length;
      const matchRatio = titleWords.size > 0 ? matchCount / titleWords.size : 0;
      return { ...l, matchScore: matchCount, matchRatio };
    })
    .filter(l => l.matchScore >= 2 && l.matchRatio >= 0.3) // At least 2 words and 30% match
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
}

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
    const { action = 'analyze', listing_id, store_id, search_query, limit = 20 } = body;

    let result: any = null;

    // Get our store IDs to filter out own listings
    const ourShopIds = await getOurShopIds(supabase);
    
    // Get ALL our store_ids (all platforms) to exclude own listings from competitor results
    const { data: ourStores } = await supabase
      .from('marketplace_stores')
      .select('id')
      .eq('is_active', true);
    const ourStoreIds = new Set((ourStores || []).map((s: any) => s.id));

    if (action === 'get_product_analytics' || action === 'search_competitors') {
      if (!store_id) throw new Error('store_id is required');

      const { data: store } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('id', store_id)
        .eq('platform', 'uzum')
        .single();

      if (!store) throw new Error('Uzum store not found');

      const apiKey = Deno.env.get(store.api_key_secret_name);
      
      // Try Seller API analytics first
      let competitors: any[] = [];
      if (apiKey && store.shop_id) {
        const analytics = await getSellerAnalytics(apiKey, String(store.shop_id), 0, limit);
        competitors = analytics.map((p: any) => ({
          productId: p.productId || p.id,
          title: p.title || p.name,
          sellPrice: p.sellPrice || p.price || 0,
          views: p.viewCount || p.views || 0,
          ordersCount: p.ordersCount || p.soldQuantity || 0,
          conversionRate: p.conversionRate || 0,
          source: 'seller_analytics',
        }));
      }

      result = {
        query: search_query || 'analytics',
        total: competitors.length,
        competitors,
        priceStats: safePriceStats(competitors.map((c: any) => c.sellPrice)),
        source: 'own_analytics',
        note: 'Bu bizning o\'z mahsulotlarimiz analitikasi, raqobatchilar emas.',
      };

    } else if (action === 'analyze_listing') {
      if (!listing_id) throw new Error('listing_id is required');

      const { data: listing } = await supabase
        .from('marketplace_listings')
        .select('*, marketplace_stores(name, platform, shop_id, api_key_secret_name)')
        .eq('id', listing_id)
        .single();

      if (!listing) throw new Error('Listing not found');

      // Get all active listings from OTHER stores for cross-reference
      const { data: allListings } = await supabase
        .from('marketplace_listings')
        .select('id, title, price, stock, external_product_id, store_id')
        .eq('status', 'active')
        .not('price', 'is', null)
        .limit(500);

      // Find competitors using DB cross-reference (excluding own stores)
      const competitorData = findDBCompetitors(listing, allListings || [], ourShopIds, ourStoreIds);

      const competitorPrices = competitorData.map(c => c.price || 0).filter(p => p > 0);
      const priceStats = safePriceStats(competitorPrices);

      const analysis = {
        listing_id,
        listing_title: listing.title,
        listing_price: listing.price,
        competitor_count: competitorData.length,
        price_comparison: {
          our_price: listing.price,
          competitor_min: priceStats.min,
          competitor_max: priceStats.max,
          competitor_avg: priceStats.avg,
          position: competitorPrices.filter(p => p < (listing.price || 0)).length + 1,
        },
        competitors: competitorData.slice(0, 10).map(c => ({
          title: c.title,
          price: c.price,
          stock: c.stock,
          productId: c.external_product_id,
          matchScore: c.matchScore,
        })),
        source: 'db_cross_reference',
        note: 'Competitors from other stores in database. Public API not available from edge functions.',
      };

      // Store competitor data
      let storedCount = 0;
      for (const comp of competitorData.slice(0, 5)) {
        try {
          const compSku = String(comp.external_product_id || comp.id || '').substring(0, 100);
          if (!compSku) continue;

          const { data: existing } = await supabase
            .from('marketplace_competitors')
            .select('id')
            .eq('listing_id', listing_id)
            .eq('competitor_sku', compSku)
            .single();

          if (existing) {
            await supabase.from('marketplace_competitor_prices').insert({
              competitor_id: existing.id,
              price: comp.price || 0,
            });
            storedCount++;
          } else {
            const { data: newComp } = await supabase
              .from('marketplace_competitors')
              .insert({
                listing_id,
                store_id: listing.store_id,
                competitor_name: (comp.title || 'Unknown').substring(0, 255),
                competitor_sku: compSku,
                competitor_shop_name: 'Uzum (other store)',
                competitor_product_url: comp.external_product_id
                  ? `https://uzum.uz/product/${comp.external_product_id}` : null,
                is_active: true,
              })
              .select()
              .single();

            if (newComp) {
              await supabase.from('marketplace_competitor_prices').insert({
                competitor_id: newComp.id,
                price: comp.price || 0,
              });
              storedCount++;
            }
          }
        } catch (err) {
          console.error('[uzum-competitor] Store error:', err);
        }
      }

      result = { ...analysis, stored: storedCount };

    } else if (action === 'batch_analyze') {
      if (!store_id) throw new Error('store_id is required');

      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('id, title, price, store_id, external_product_id')
        .eq('store_id', store_id)
        .eq('status', 'active')
        .not('title', 'is', null)
        .not('price', 'is', null)
        .order('price', { ascending: false })
        .limit(limit || 10);

      if (!listings?.length) {
        result = { analyzed: 0, results: [], stored: 0, message: 'No active listings' };
        return new Response(
          JSON.stringify({ success: true, result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get ALL active listings from OTHER stores (not just this store)
      const { data: allListings } = await supabase
        .from('marketplace_listings')
        .select('id, title, price, store_id, external_product_id, stock')
        .eq('status', 'active')
        .not('price', 'is', null)
        .limit(1000);

      const results: any[] = [];
      let totalStored = 0;
      const maxAnalyze = Math.min(listings.length, limit || 10);

      for (let i = 0; i < maxAnalyze; i++) {
        const listing = listings[i];
        const competitors = findDBCompetitors(listing, allListings || [], ourShopIds, ourStoreIds);
        const competitorPrices = competitors.map(c => c.price || 0).filter(p => p > 0);
        const stats = safePriceStats(competitorPrices);

        // Store competitors
        for (const comp of competitors.slice(0, 3)) {
          try {
            const compSku = String(comp.external_product_id || comp.id || '').substring(0, 100);
            if (!compSku) continue;

            const { data: existing } = await supabase
              .from('marketplace_competitors')
              .select('id')
              .eq('listing_id', listing.id)
              .eq('competitor_sku', compSku)
              .single();

            if (existing) {
              await supabase.from('marketplace_competitor_prices').insert({
                competitor_id: existing.id,
                price: comp.price || 0,
              });
              totalStored++;
            } else {
              const { data: newComp } = await supabase
                .from('marketplace_competitors')
                .insert({
                  listing_id: listing.id,
                  store_id: listing.store_id,
                  competitor_name: (comp.title || 'Unknown').substring(0, 255),
                  competitor_sku: compSku,
                  competitor_shop_name: 'Uzum (other store)',
                  competitor_product_url: comp.external_product_id
                    ? `https://uzum.uz/product/${comp.external_product_id}` : null,
                  is_active: true,
                })
                .select()
                .single();

              if (newComp) {
                await supabase.from('marketplace_competitor_prices').insert({
                  competitor_id: newComp.id,
                  price: comp.price || 0,
                });
                totalStored++;
              }
            }
          } catch (err) {
            console.error('[uzum-competitor] batch store error:', err);
          }
        }

        results.push({
          listing_id: listing.id,
          title: listing.title,
          our_price: listing.price,
          competitor_avg: stats.avg,
          competitor_min: stats.min,
          competitors_found: competitors.length,
        });
      }

      result = { analyzed: results.length, results, stored: totalStored };

    } else if (action === 'ai_competitor_strategy') {
      if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');
      if (!store_id) throw new Error('store_id is required');

      const { data: competitors } = await supabase
        .from('marketplace_competitors')
        .select(`*, marketplace_competitor_prices(price, rating, sales_count, captured_at)`)
        .eq('store_id', store_id)
        .order('updated_at', { ascending: false })
        .limit(20);

      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('title, price, stock')
        .eq('store_id', store_id)
        .eq('status', 'active')
        .limit(50);

      const competitorSummary = (competitors || []).map(c => {
        const latestPrice = c.marketplace_competitor_prices?.[0];
        return `- ${c.competitor_name} (${c.competitor_shop_name}): ${latestPrice?.price || 'N/A'} UZS`;
      }).join('\n');

      const listingSummary = (listings || []).slice(0, 10).map((l: any) =>
        `- ${l.title}: ${l.price} UZS (stock: ${l.stock})`
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
            { role: 'system', content: 'Siz Uzum marketplace raqobat strategiyasi bo\'yicha ekspertsiz.' },
            { role: 'user', content: `Uzum Market do'kon tahlili:\n\nMAHSULOTLAR:\n${listingSummary || 'Yo\'q'}\n\nRAQOBATCHILAR:\n${competitorSummary || 'Yo\'q'}\n\n1. Narx strategiyasi\n2. 3 ta tavsiya\nO'zbek tilida.` },
          ],
          max_tokens: 800,
        }),
      });

      if (!aiResponse.ok) throw new Error('AI analysis failed');

      const aiData = await aiResponse.json();
      result = {
        store_id,
        ai_analysis: aiData.choices?.[0]?.message?.content || '',
        competitors_analyzed: competitors?.length || 0,
        listings_analyzed: listings?.length || 0,
        generated_at: new Date().toISOString(),
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
