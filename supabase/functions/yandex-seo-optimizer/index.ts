import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

interface SEOScore {
  overall: number;
  title: number;
  description: number;
  images: number;
  keywords: number;
  attributes: number;
}

interface SEORecommendation {
  field: string;
  current: string;
  suggested: string;
  impact: 'high' | 'medium' | 'low';
  reason: string;
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
      title,
      description,
      category,
    } = await req.json();

    let result: any = null;

    if (action === 'analyze_listing') {
      // Analyze a single listing for SEO optimization
      if (!listing_id) throw new Error('listing_id is required');

      const { data: listing, error } = await supabase
        .from('marketplace_listings')
        .select('*, marketplace_stores(name, platform)')
        .eq('id', listing_id)
        .single();

      if (error || !listing) throw new Error('Listing not found');

      // Build SEO analysis prompt for Yandex Market
      const prompt = `Siz Yandex Market SEO optimizatsiya ekspertisiz. Quyidagi mahsulot e'lonini tahlil qiling va yaxshilash uchun tavsiyalar bering:

MAHSULOT E'LONI:
Sarlavha: ${listing.title || 'Kiritilmagan'}
Tavsif: ${listing.description || 'Kiritilmagan'}
Kategoriya: ${listing.category || 'Noma\'lum'}
Narx: ${listing.price || 0} RUB
SKU: ${listing.external_sku || 'Noma\'lum'}

Yandex Market uchun SEO tahlilini quyidagi formatda bering:

1. SARLAVHA_BALL: [0-100] - hozirgi sarlavha sifati
   SARLAVHA_TAVSIYA: [yangi yaxshilangan sarlavha ruscha]
   SARLAVHA_SABAB: [nima uchun bunday o'zgartirish]

2. TAVSIF_BALL: [0-100] - hozirgi tavsif sifati
   TAVSIF_TAVSIYA: [qisqa yaxshilangan tavsif ruscha, max 500 belgi]
   TAVSIF_SABAB: [nima uchun bunday o'zgartirish]

3. KALIT_SOZLAR: [5-10 ta asosiy kalit so'zlar vergul bilan ajratilgan, ruscha]

4. YANDEX_XUSUSIYATLARI: [Yandex Market uchun muhim atributlar ro'yxati]

5. UMUMIY_BALL: [0-100]

6. TEZKOR_YAXSHILASH: [3 ta eng muhim tez bajariladigan vazifalar]

Javoblar ruscha va o'zbekcha aralash bo'lishi mumkin.`;

      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Siz Yandex Market SEO va kontent optimizatsiya mutaxassisisiz. Rus tilidagi e-commerce platformalari uchun eng yaxshi amaliyotlarni bilasiz.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1200,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error('AI analysis failed');
      }

      const aiData = await aiResponse.json();
      const analysis = aiData.choices?.[0]?.message?.content || '';

      // Parse scores from AI response
      const titleScoreMatch = analysis.match(/SARLAVHA_BALL:\s*(\d+)/);
      const descScoreMatch = analysis.match(/TAVSIF_BALL:\s*(\d+)/);
      const overallScoreMatch = analysis.match(/UMUMIY_BALL:\s*(\d+)/);

      const seoScore: SEOScore = {
        overall: overallScoreMatch ? parseInt(overallScoreMatch[1]) : 50,
        title: titleScoreMatch ? parseInt(titleScoreMatch[1]) : 50,
        description: descScoreMatch ? parseInt(descScoreMatch[1]) : 50,
        images: listing.images?.length > 3 ? 80 : listing.images?.length > 0 ? 50 : 20,
        keywords: 60,
        attributes: 50,
      };

      result = {
        listing: {
          id: listing.id,
          title: listing.title,
          price: listing.price,
          store: listing.marketplace_stores?.name,
        },
        seo_score: seoScore,
        ai_analysis: analysis,
        generated_at: new Date().toISOString(),
      };

    } else if (action === 'generate_content') {
      // Generate optimized content for a new or existing listing
      const prompt = `Yandex Market uchun mahsulot kontenti yarating:

Mahsulot: ${title || 'Yangi mahsulot'}
Kategoriya: ${category || 'Umumiy'}
Qo'shimcha ma'lumot: ${description || 'Yo\'q'}

Quyidagi kontentni ruscha yarating:

1. SARLAVHA: [SEO optimallashtirilgan sarlavha, 50-80 belgi]
2. QISQA_TAVSIF: [150-200 belgi, asosiy xususiyatlar]
3. BATAFSIL_TAVSIF: [300-500 belgi, to'liq tavsif]
4. BULLET_POINTS: [5 ta asosiy xususiyat, har biri alohida qatorda]
5. KALIT_SOZLAR: [10 ta SEO kalit so'zlar]
6. TEGLER: [5 ta mahsulot tegi]`;

      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Siz Yandex Market uchun professional kopyrayter siz. SEO optimallashtirilgan, sotuvga yo\'naltirilgan kontent yaratasiz.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
        }),
      });

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';

      result = {
        generated_content: content,
        input: { title, category, description },
        generated_at: new Date().toISOString(),
      };

    } else if (action === 'bulk_analyze') {
      // Analyze multiple listings for SEO scores
      if (!store_id) throw new Error('store_id is required');

      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('id, title, description, price, stock, product_rank, images')
        .eq('store_id', store_id)
        .eq('status', 'active')
        .limit(50);

      const analyzed = [];

      for (const listing of listings || []) {
        // Quick SEO score calculation
        let score = 0;
        
        // Title score (30%)
        const titleLength = listing.title?.length || 0;
        if (titleLength >= 40 && titleLength <= 80) score += 30;
        else if (titleLength >= 20) score += 15;
        else score += 5;

        // Description score (30%)
        const descLength = listing.description?.length || 0;
        if (descLength >= 200) score += 30;
        else if (descLength >= 50) score += 15;
        else if (descLength > 0) score += 5;

        // Images score (20%)
        const imageCount = listing.images?.length || 0;
        if (imageCount >= 5) score += 20;
        else if (imageCount >= 3) score += 15;
        else if (imageCount >= 1) score += 10;

        // Stock availability (10%)
        if (listing.stock > 0) score += 10;

        // Rank bonus (10%)
        if (listing.product_rank === 'A') score += 10;
        else if (listing.product_rank === 'B') score += 7;
        else if (listing.product_rank === 'C') score += 4;

        analyzed.push({
          id: listing.id,
          title: listing.title?.substring(0, 50),
          seo_score: score,
          issues: [
            titleLength < 40 ? 'Sarlavha juda qisqa' : null,
            descLength < 100 ? 'Tavsif yetarli emas' : null,
            imageCount < 3 ? 'Rasmlar kam' : null,
          ].filter(Boolean),
        });
      }

      // Sort by score
      analyzed.sort((a, b) => a.seo_score - b.seo_score);

      result = {
        store_id,
        total_analyzed: analyzed.length,
        avg_score: analyzed.reduce((sum, a) => sum + a.seo_score, 0) / analyzed.length || 0,
        needs_improvement: analyzed.filter(a => a.seo_score < 50).length,
        good_listings: analyzed.filter(a => a.seo_score >= 70).length,
        listings: analyzed,
        generated_at: new Date().toISOString(),
      };

    } else if (action === 'keyword_research') {
      // AI-powered keyword research for a category/product type
      const prompt = `Yandex Market uchun kalit so'zlar tadqiqoti:

Kategoriya/Mahsulot turi: ${category || title || 'Umumiy tovarlar'}

Quyidagilarni taqdim eting:

1. ASOSIY_KALIT_SOZLAR: [10 ta eng ommabop qidiruv so'zlari, ruscha]
2. UZUN_KALIT_SOZLAR: [5 ta long-tail so'zlar, ruscha]
3. MAVSUM_KALIT_SOZLAR: [3 ta mavsum bilan bog'liq so'zlar]
4. RAQOBAT_DARAJASI: [Past/O'rta/Yuqori] - bu kategoriya uchun raqobat
5. TRENDLAR: [hozirgi trendlar va tavsiyalar]

Javoblarni ruscha bering.`;

      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Siz Yandex Market SEO va kalit so\'zlar tadqiqoti bo\'yicha ekspertsiz.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 800,
        }),
      });

      const aiData = await aiResponse.json();
      const research = aiData.choices?.[0]?.message?.content || '';

      result = {
        query: category || title,
        keyword_research: research,
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
