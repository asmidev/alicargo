import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { 
      action = 'optimize',
      listing_id,
      listing_ids,
      strategy = 'balanced' // 'profit', 'volume', 'balanced'
    } = await req.json();

    let result: any = null;

    if (action === 'optimize_single') {
      if (!listing_id) {
        throw new Error('listing_id is required');
      }

      // Fetch listing with competitor data
      const { data: listing, error: listingError } = await supabase
        .from('marketplace_listings')
        .select(`
          *,
          marketplace_stores(name, platform),
          marketplace_competitors(
            id,
            competitor_name,
            competitor_shop_name,
            marketplace_competitor_prices(
              price,
              original_price,
              rating,
              sales_count,
              captured_at
            )
          )
        `)
        .eq('id', listing_id)
        .single();

      if (listingError || !listing) {
        throw new Error(`Listing not found: ${listingError?.message}`);
      }

      // Get recent competitor prices
      const competitorPrices: number[] = [];
      const competitorData: any[] = [];
      
      (listing.marketplace_competitors || []).forEach((comp: any) => {
        const latestPrice = comp.marketplace_competitor_prices?.[0];
        if (latestPrice?.price) {
          competitorPrices.push(latestPrice.price);
          competitorData.push({
            name: comp.competitor_name,
            shop: comp.competitor_shop_name,
            price: latestPrice.price,
            rating: latestPrice.rating,
            sales: latestPrice.sales_count,
          });
        }
      });

      // Calculate price statistics
      const currentPrice = listing.price || 0;
      const costPrice = listing.cost_price || currentPrice * 0.6; // Estimate if not set
      const commissionRate = listing.commission_rate || 0.15;
      
      const avgCompetitorPrice = competitorPrices.length > 0 
        ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length 
        : currentPrice;
      const minCompetitorPrice = competitorPrices.length > 0 
        ? Math.min(...competitorPrices) 
        : currentPrice;
      const maxCompetitorPrice = competitorPrices.length > 0 
        ? Math.max(...competitorPrices) 
        : currentPrice;

      // Build AI prompt for price optimization
      const prompt = `Siz marketplace narx optimizatsiya ekspertisiz. Quyidagi ma'lumotlar asosida optimal narxni tavsiya qiling.

MAHSULOT:
- Nomi: ${listing.title}
- Joriy narx: ${currentPrice} UZS
- Taxminiy tannarx: ${costPrice} UZS
- Komissiya: ${(commissionRate * 100).toFixed(0)}%
- Mahsulot ranki: ${listing.product_rank || 'N/A'}
- Joriy zaxira: ${listing.stock}

RAQOBATCHILAR (${competitorData.length} ta):
${competitorData.map((c, i) => `${i + 1}. ${c.name} - ${c.price} UZS (reyting: ${c.rating || 'N/A'}, sotuvlar: ${c.sales || 'N/A'})`).join('\n')}

STATISTIKA:
- Raqobatchilar o'rtacha narxi: ${avgCompetitorPrice.toFixed(0)} UZS
- Minimal narx: ${minCompetitorPrice.toFixed(0)} UZS
- Maksimal narx: ${maxCompetitorPrice.toFixed(0)} UZS

STRATEGIYA: ${strategy === 'profit' ? 'Maksimal foyda' : strategy === 'volume' ? 'Maksimal sotuv hajmi' : 'Muvozanatli'}

Quyidagi formatda javob bering:
1. TAVSIYA_NARX: [narx] UZS
2. KUTILGAN_SOTUV_OSISHI: [foiz]%
3. KUTILGAN_FOYDA_OSISHI: [foiz]%
4. ISHONCH_DARAJASI: [0-100]%
5. SABAB: [qisqa tushuntirish o'zbek tilida]`;

      // Call AI for optimization
      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Siz marketplace narx optimizatsiya AI yordamchisisiz. Javoblaringiz aniq va qisqa bo\'lsin.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 500,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI error:', errorText);
        
        // Fallback to rule-based optimization
        let recommendedPrice = currentPrice;
        let reasoning = '';
        
        if (currentPrice > avgCompetitorPrice * 1.2) {
          recommendedPrice = Math.round(avgCompetitorPrice * 1.05);
          reasoning = 'Narx raqobatchilarga nisbatan yuqori. Pasaytirish tavsiya etiladi.';
        } else if (currentPrice < avgCompetitorPrice * 0.8) {
          recommendedPrice = Math.round(avgCompetitorPrice * 0.95);
          reasoning = 'Narx juda past. Biroz oshirish mumkin.';
        } else {
          recommendedPrice = Math.round(avgCompetitorPrice);
          reasoning = 'Narx raqobatbardosh. Kichik optimizatsiya tavsiya etiladi.';
        }

        result = {
          listing_id,
          current_price: currentPrice,
          recommended_price: recommendedPrice,
          competitor_avg_price: avgCompetitorPrice,
          competitor_min_price: minCompetitorPrice,
          expected_sales_change: recommendedPrice < currentPrice ? '+15%' : '+5%',
          expected_profit_change: '+8%',
          confidence: 0.65,
          reasoning,
          strategy,
          method: 'rule-based',
        };
      } else {
        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content || '';
        
        // Parse AI response
        const priceMatch = aiContent.match(/TAVSIYA_NARX:\s*([\d,]+)/);
        const salesMatch = aiContent.match(/KUTILGAN_SOTUV_OSISHI:\s*([+-]?\d+)/);
        const profitMatch = aiContent.match(/KUTILGAN_FOYDA_OSISHI:\s*([+-]?\d+)/);
        const confidenceMatch = aiContent.match(/ISHONCH_DARAJASI:\s*(\d+)/);
        const reasonMatch = aiContent.match(/SABAB:\s*(.+?)(?:\n|$)/);

        const recommendedPrice = priceMatch 
          ? parseInt(priceMatch[1].replace(/,/g, '')) 
          : Math.round(avgCompetitorPrice);

        result = {
          listing_id,
          current_price: currentPrice,
          recommended_price: recommendedPrice,
          competitor_avg_price: avgCompetitorPrice,
          competitor_min_price: minCompetitorPrice,
          expected_sales_change: salesMatch ? `${salesMatch[1]}%` : '+10%',
          expected_profit_change: profitMatch ? `${profitMatch[1]}%` : '+5%',
          confidence: confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.75,
          reasoning: reasonMatch ? reasonMatch[1].trim() : 'AI tahlili asosida',
          strategy,
          method: 'ai-powered',
        };
      }

      // Store price suggestion
      await supabase
        .from('marketplace_price_suggestions')
        .upsert({
          listing_id,
          store_id: listing.store_id,
          current_price: currentPrice,
          recommended_price: result.recommended_price,
          competitor_avg_price: avgCompetitorPrice,
          competitor_min_price: minCompetitorPrice,
          expected_sales_change: result.expected_sales_change,
          expected_profit_change: result.expected_profit_change,
          confidence: result.confidence,
          reasoning: result.reasoning,
          status: 'pending',
        }, { onConflict: 'listing_id' });

    } else if (action === 'bulk_optimize') {
      // Optimize multiple listings
      const idsToOptimize = listing_ids || [];
      
      let query = supabase
        .from('marketplace_listings')
        .select('id, title, price, stock, product_rank, store_id')
        .eq('status', 'active')
        .gt('stock', 0);
      
      if (idsToOptimize.length > 0) {
        query = query.in('id', idsToOptimize);
      }
      
      const { data: listings, error } = await query.limit(20);

      if (error) throw new Error(`Failed to fetch listings: ${error.message}`);

      const suggestions = [];
      
      for (const listing of listings || []) {
        // Simple rule-based optimization for bulk
        const currentPrice = listing.price || 0;
        
        // Fetch competitor avg for this listing
        const { data: competitors } = await supabase
          .from('marketplace_competitors')
          .select('marketplace_competitor_prices(price)')
          .eq('listing_id', listing.id)
          .limit(5);

        const competitorPrices = competitors?.flatMap((c: any) => 
          c.marketplace_competitor_prices?.map((p: any) => p.price) || []
        ) || [];

        const avgPrice = competitorPrices.length > 0
          ? competitorPrices.reduce((a: number, b: number) => a + b, 0) / competitorPrices.length
          : currentPrice;

        let recommendedPrice = currentPrice;
        let reason = 'Narx mos';

        if (currentPrice > avgPrice * 1.15) {
          recommendedPrice = Math.round(avgPrice * 1.05);
          reason = 'Raqobatchilarga nisbatan yuqori';
        } else if (currentPrice < avgPrice * 0.85) {
          recommendedPrice = Math.round(avgPrice * 0.95);
          reason = 'Narxni oshirish mumkin';
        }

        if (recommendedPrice !== currentPrice) {
          suggestions.push({
            listing_id: listing.id,
            title: listing.title,
            current_price: currentPrice,
            recommended_price: recommendedPrice,
            change_percent: ((recommendedPrice - currentPrice) / currentPrice * 100).toFixed(1),
            reason,
          });

          // Store suggestion
          await supabase
            .from('marketplace_price_suggestions')
            .upsert({
              listing_id: listing.id,
              store_id: listing.store_id,
              current_price: currentPrice,
              recommended_price: recommendedPrice,
              competitor_avg_price: avgPrice,
              reasoning: reason,
              status: 'pending',
              confidence: 0.7,
            }, { onConflict: 'listing_id' });
        }
      }

      result = {
        analyzed: listings?.length || 0,
        suggestions_created: suggestions.length,
        suggestions,
      };

    } else if (action === 'apply_suggestion') {
      // Apply a price suggestion (just marks it as applied, actual update is via Uzum API)
      if (!listing_id) {
        throw new Error('listing_id is required');
      }

      const { data: suggestion, error } = await supabase
        .from('marketplace_price_suggestions')
        .update({ 
          status: 'applied',
          applied_at: new Date().toISOString(),
        })
        .eq('listing_id', listing_id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) throw new Error(`Failed to apply suggestion: ${error.message}`);

      result = { applied: true, suggestion };
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
