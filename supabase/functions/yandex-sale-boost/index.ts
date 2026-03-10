import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

interface SaleBoostRecommendation {
  type: 'price' | 'stock' | 'content' | 'promotion' | 'timing';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expected_impact: string;
  action_items: string[];
}

// Helper: fetch all rows with batch pagination (bypasses 1000-row limit)
async function fetchAllRows(query: any, batchSize = 1000) {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { 
      action = 'analyze',
      store_id,
      listing_id,
      days = 30,
    } = await req.json();

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

    const campaignId = store.campaign_id || store.fbs_campaign_id || store.fby_campaign_id;

    if (action === 'analyze_store') {
      // Comprehensive store analysis for sale boost opportunities
      console.log(`Analyzing store ${store.name} for sale boost opportunities`);

      // Fetch orders for the period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const orders = await fetchAllRows(
        supabase.from('marketplace_orders').select('*').eq('store_id', store_id).gte('created_at', startDate.toISOString()).order('created_at', { ascending: false })
      );

      // Fetch listings
      const listings = await fetchAllRows(
        supabase.from('marketplace_listings').select('*').eq('store_id', store_id)
      );

      // Calculate metrics
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      const activeListings = listings?.filter(l => l.status === 'active').length || 0;
      const lowStockListings = listings?.filter(l => l.stock > 0 && l.stock < 5).length || 0;
      const outOfStockListings = listings?.filter(l => l.stock === 0).length || 0;
      
      // Product rank distribution
      const rankA = listings?.filter(l => l.product_rank === 'A').length || 0;
      const rankB = listings?.filter(l => l.product_rank === 'B').length || 0;
      const rankC = listings?.filter(l => l.product_rank === 'C').length || 0;
      const rankD = listings?.filter(l => l.product_rank === 'D').length || 0;

      // Fetch returns data
      const returns = await fetchAllRows(
        supabase.from('marketplace_orders').select('id').eq('store_id', store_id).in('fulfillment_status', ['RETURN', 'UNREDEEMED']).gte('created_at', startDate.toISOString())
      );

      const returnRate = totalOrders > 0 ? ((returns?.length || 0) / totalOrders * 100) : 0;

      // Build AI analysis prompt
      const prompt = `Siz Yandex Market sotuv optimallashtirish ekspertisiz. Quyidagi do'kon ma'lumotlarini tahlil qiling va sotuvni oshirish bo'yicha aniq tavsiyalar bering:

DO'KON: ${store.name}
DAVR: Oxirgi ${days} kun

STATISTIKA:
- Jami buyurtmalar: ${totalOrders}
- Jami daromad: ${totalRevenue.toLocaleString()} RUB
- O'rtacha buyurtma qiymati: ${avgOrderValue.toFixed(0)} RUB
- Qaytarilish darajasi: ${returnRate.toFixed(1)}%

MAHSULOTLAR:
- Faol e'lonlar: ${activeListings}
- Kam zaxira (< 5): ${lowStockListings}
- Tugagan: ${outOfStockListings}

MAHSULOT RANKLARI:
- A-rank (eng yaxshi): ${rankA}
- B-rank: ${rankB}
- C-rank: ${rankC}
- D-rank (yomonlashgan): ${rankD}

Quyidagi formatda 5 ta aniq tavsiya bering:

1. [MUHIMLIK: Yuqori/O'rta/Past]
TUR: [narx/zaxira/kontent/aksiya/vaqt]
SARLAVHA: [qisqa sarlavha]
TAVSIF: [batafsil tushuntirish]
KUTILGAN_NATIJA: [kutilgan foyda yoki o'sish]
HARAKATLAR: [amalga oshirish qadamlari]

O'zbek tilida javob bering.`;

      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Siz e-commerce sotuv optimallashtirish mutaxassisisiz. Amaliy va aniq tavsiyalar bering.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1500,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error('AI analysis failed');
      }

      const aiData = await aiResponse.json();
      const aiAnalysis = aiData.choices?.[0]?.message?.content || '';

      // Parse AI recommendations (simplified parsing)
      const recommendations: SaleBoostRecommendation[] = [];
      
      // Add data-driven recommendations
      if (lowStockListings > 0) {
        recommendations.push({
          type: 'stock',
          priority: 'high',
          title: 'Kam zaxira mahsulotlarni to\'ldirish',
          description: `${lowStockListings} ta mahsulotda zaxira 5 tadan kam. Sotuvni yo'qotmaslik uchun zaxirani to'ldiring.`,
          expected_impact: `+${Math.round(lowStockListings * 10)}% sotuv imkoniyati`,
          action_items: ['Kam zaxira mahsulotlar ro\'yxatini ko\'rish', 'Ta\'minotchi bilan bog\'lanish', 'Buyurtma berish'],
        });
      }

      if (outOfStockListings > 3) {
        recommendations.push({
          type: 'stock',
          priority: 'high',
          title: 'Tugagan mahsulotlarni qayta faollashtirish',
          description: `${outOfStockListings} ta mahsulot zaxirasiz. Bu reyting va ko'rinishga salbiy ta'sir qiladi.`,
          expected_impact: 'Reyting yaxshilanishi + potensial sotuvlar',
          action_items: ['Tugagan mahsulotlar ro\'yxati', 'Zaxira to\'ldirish', 'E\'lonlarni qayta faollashtirish'],
        });
      }

      if (rankD > rankA) {
        recommendations.push({
          type: 'content',
          priority: 'medium',
          title: 'D-rank mahsulotlarni yaxshilash',
          description: `${rankD} ta D-rank mahsulot bor. Kontent va narxni optimallashtirishingiz kerak.`,
          expected_impact: 'Reyting yaxshilanishi, ko\'rinish oshishi',
          action_items: ['D-rank mahsulotlarni tahlil qilish', 'Rasmlarni yaxshilash', 'Tavsiflarni yangilash', 'Narxlarni tekshirish'],
        });
      }

      if (avgOrderValue < 2000) {
        recommendations.push({
          type: 'promotion',
          priority: 'medium',
          title: 'O\'rtacha buyurtma qiymatini oshirish',
          description: `O'rtacha buyurtma ${avgOrderValue.toFixed(0)} RUB. Cross-sell va upsell imkoniyatlarini qo'llang.`,
          expected_impact: '+15-25% o\'rtacha buyurtma qiymati',
          action_items: ['Bundl takliflar yaratish', 'Chegirmali to\'plamlar', 'Minimal buyurtma uchun chegirma'],
        });
      }

      if (returnRate > 5) {
        recommendations.push({
          type: 'content',
          priority: 'high',
          title: 'Qaytarilish darajasini kamaytirish',
          description: `Qaytarilish darajasi ${returnRate.toFixed(1)}% - bu yuqori. Sabablari tahlil qilinishi kerak.`,
          expected_impact: 'Xarajatlar kamayishi, reyting yaxshilanishi',
          action_items: ['Qaytarilish sabablarini tahlil qilish', 'Mahsulot tavsiflarini aniqlashtirish', 'O\'lcham va xususiyatlarni to\'g\'ri ko\'rsatish'],
        });
      }

      result = {
        store: store.name,
        period: `${days} kun`,
        metrics: {
          total_orders: totalOrders,
          total_revenue: totalRevenue,
          avg_order_value: avgOrderValue,
          return_rate: returnRate,
          active_listings: activeListings,
          low_stock: lowStockListings,
          out_of_stock: outOfStockListings,
          rank_distribution: { A: rankA, B: rankB, C: rankC, D: rankD },
        },
        ai_analysis: aiAnalysis,
        recommendations,
        generated_at: new Date().toISOString(),
      };

    } else if (action === 'analyze_product') {
      // Single product sale boost analysis
      if (!listing_id) throw new Error('listing_id is required');

      const { data: listing } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('id', listing_id)
        .single();

      if (!listing) throw new Error('Listing not found');

      // Get product performance from Yandex
      const statsResponse = await fetch(
        `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/stats/skus`,
        {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shopSkus: [listing.external_sku],
            limit: 1,
          }),
        }
      );

      let skuStats = null;
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        skuStats = statsData.result?.shopSkus?.[0];
      }

      // Fetch order history for this product
      const productOrders = await fetchAllRows(
        supabase.from('marketplace_orders').select('*').eq('store_id', store_id).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      );

      // Filter orders containing this product
      const relevantOrders = productOrders?.filter(o => 
        o.items?.some((item: any) => item.shopSku === listing.external_sku)
      ) || [];

      const prompt = `Mahsulot sotuvini oshirish tahlili:

MAHSULOT: ${listing.title}
NARX: ${listing.price} RUB
ZAXIRA: ${listing.stock}
RANK: ${listing.product_rank || 'Noma\'lum'}
RAQOBATCHILAR SONI: ${skuStats?.priceCompetition?.total || 'Noma\'lum'}
NARX POZITSIYASI: ${skuStats?.priceCompetition?.position || 'Noma\'lum'}
OXIRGI 30 KUN SOTUVLAR: ${relevantOrders.length}

Bu mahsulot uchun 3 ta aniq tavsiya bering:
1. Narx optimizatsiyasi
2. Kontent yaxshilash
3. Aksiya/promosyon g'oyasi

Har bir tavsiya uchun kutilgan natijani ham yozing.`;

      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Siz mahsulot sotuvini oshirish bo\'yicha ekspertsiz.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 600,
        }),
      });

      const aiData = await aiResponse.json();
      const analysis = aiData.choices?.[0]?.message?.content || '';

      result = {
        listing: {
          id: listing.id,
          title: listing.title,
          price: listing.price,
          stock: listing.stock,
          rank: listing.product_rank,
        },
        yandex_stats: skuStats ? {
          price_position: skuStats.priceCompetition?.position,
          competitors: skuStats.priceCompetition?.total,
          min_competitor_price: skuStats.priceCompetition?.minPrice,
          avg_competitor_price: skuStats.priceCompetition?.averagePrice,
        } : null,
        orders_30d: relevantOrders.length,
        ai_recommendations: analysis,
        generated_at: new Date().toISOString(),
      };

    } else if (action === 'get_quick_wins') {
      // Get quick win opportunities
      const listings = await fetchAllRows(
        supabase.from('marketplace_listings').select('*').eq('store_id', store_id).eq('status', 'active').order('stock', { ascending: true })
      );

      const quickWins = [];

      // Find products with stock issues
      const stockAlerts = listings?.filter(l => l.stock > 0 && l.stock < 5) || [];
      if (stockAlerts.length > 0) {
        quickWins.push({
          type: 'stock_alert',
          priority: 'high',
          count: stockAlerts.length,
          title: 'Kam zaxira mahsulotlar',
          products: stockAlerts.slice(0, 5).map(l => ({ id: l.id, title: l.title, stock: l.stock })),
        });
      }

      // Find D-rank products
      const lowRankProducts = listings?.filter(l => l.product_rank === 'D') || [];
      if (lowRankProducts.length > 0) {
        quickWins.push({
          type: 'rank_improvement',
          priority: 'medium',
          count: lowRankProducts.length,
          title: 'Yaxshilash kerak bo\'lgan mahsulotlar',
          products: lowRankProducts.slice(0, 5).map(l => ({ id: l.id, title: l.title, rank: l.product_rank })),
        });
      }

      // Find high-stock products not selling
      const recentOrders = await fetchAllRows(
        supabase.from('marketplace_orders').select('items').eq('store_id', store_id).gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      );

      const soldSkus = new Set(
        recentOrders?.flatMap(o => o.items?.map((i: any) => i.shopSku) || []) || []
      );

      const notSelling = listings?.filter(l => 
        l.stock > 10 && !soldSkus.has(l.external_sku)
      ) || [];

      if (notSelling.length > 0) {
        quickWins.push({
          type: 'not_selling',
          priority: 'high',
          count: notSelling.length,
          title: '2 hafta ichida sotilmagan mahsulotlar',
          products: notSelling.slice(0, 5).map(l => ({ id: l.id, title: l.title, stock: l.stock, price: l.price })),
        });
      }

      result = {
        store: store.name,
        quick_wins: quickWins,
        total_opportunities: quickWins.reduce((sum, w) => sum + w.count, 0),
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
