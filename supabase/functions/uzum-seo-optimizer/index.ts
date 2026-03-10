import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { store_id, listing_id } = await req.json();

    if (!store_id) {
      return new Response(
        JSON.stringify({ error: "store_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get store details
    const { data: store, error: storeError } = await supabase
      .from("marketplace_stores")
      .select("*")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      return new Response(
        JSON.stringify({ error: "Store not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch listings to analyze - use correct column name 'status' instead of 'is_active'
    let listingsQuery = supabase
      .from("marketplace_listings")
      .select("*")
      .eq("store_id", store_id)
      .eq("status", "active");

    if (listing_id) {
      listingsQuery = listingsQuery.eq("id", listing_id);
    } else {
      listingsQuery = listingsQuery.limit(20);
    }

    const { data: listings, error: listingsError } = await listingsQuery;

    if (listingsError) {
      throw new Error(`Failed to fetch listings: ${listingsError.message}`);
    }

    if (!listings || listings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No listings found to optimize",
          results: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const listing of listings) {
      // Calculate SEO score based on various factors
      const seoFactors = {
        title_length: 0,
        title_keywords: 0,
        description_length: 0,
        description_quality: 0,
        images_count: 0,
        price_competitiveness: 0,
        stock_availability: 0,
      };

      // Title analysis
      const title = listing.title || "";
      if (title.length >= 30 && title.length <= 80) {
        seoFactors.title_length = 20;
      } else if (title.length >= 20) {
        seoFactors.title_length = 10;
      }

      // Check for common keywords in title
      const uzKeywords = ["yangi", "original", "sifatli", "arzon", "chegirma", "aksiya"];
      const keywordsInTitle = uzKeywords.filter(kw => title.toLowerCase().includes(kw)).length;
      seoFactors.title_keywords = Math.min(keywordsInTitle * 5, 15);

      // Description analysis - description may not exist in all listings
      const description = listing.metadata?.description || "";
      if (description.length >= 200) {
        seoFactors.description_length = 20;
      } else if (description.length >= 100) {
        seoFactors.description_length = 10;
      }

      // Description quality (has bullet points, features, etc.)
      const hasBulletPoints = description.includes("•") || description.includes("-") || description.includes("*");
      const hasNumbers = /\d/.test(description);
      seoFactors.description_quality = (hasBulletPoints ? 10 : 0) + (hasNumbers ? 5 : 0);

      // Images - use metadata.images if available
      const images = listing.metadata?.images;
      const imageCount = images ? (Array.isArray(images) ? images.length : 1) : 0;
      seoFactors.images_count = Math.min(imageCount * 5, 15);

      // Stock - use correct column name 'stock' instead of 'stock_quantity'
      if ((listing.stock || 0) > 10) {
        seoFactors.stock_availability = 10;
      } else if ((listing.stock || 0) > 0) {
        seoFactors.stock_availability = 5;
      }

      const totalScore = Object.values(seoFactors).reduce((a, b) => a + b, 0);
      const maxScore = 100;
      const scorePercent = Math.round((totalScore / maxScore) * 100);

      // Generate improvement suggestions
      const suggestions = [];
      
      if (seoFactors.title_length < 20) {
        suggestions.push({
          type: "title",
          priority: "high",
          current: title,
          suggestion: "Sarlavhani 30-80 belgi orasida saqlang va asosiy kalit so'zlarni qo'shing",
        });
      }

      if (seoFactors.description_length < 20) {
        suggestions.push({
          type: "description",
          priority: "high",
          suggestion: "Tavsifni kamida 200 belgigacha kengaytiring",
        });
      }

      if (seoFactors.images_count < 15) {
        suggestions.push({
          type: "images",
          priority: "medium",
          current_count: imageCount,
          suggestion: "Kamida 3-5 ta sifatli rasm qo'shing",
        });
      }

      if (!hasBulletPoints) {
        suggestions.push({
          type: "format",
          priority: "low",
          suggestion: "Tavsifda ro'yxat (bullet points) ishlatib, xususiyatlarni ajratib ko'rsating",
        });
      }

      // Generate AI-optimized content if API key available
      let optimizedContent = null;
      if (lovableApiKey && (seoFactors.title_length < 15 || seoFactors.description_length < 15)) {
        try {
          const aiPrompt = `Siz Uzum Market uchun SEO mutaxassisisiz.

Joriy listing:
Sarlavha: ${title}
Tavsif: ${description || "Yo'q"}
Kategoriya: ${listing.category || "Noma'lum"}

Quyidagilarni yarating:
1. SEO-optimallashtirilgan yangi sarlavha (50-70 belgi, o'zbek tilida, kalit so'zlar bilan)
2. To'liq tavsif (200+ belgi, o'zbek tilida, xususiyatlar ro'yxati bilan)
3. 5 ta tavsiya etiladigan kalit so'zlar

JSON formatida javob bering:
{
  "optimized_title": "...",
  "optimized_description": "...",
  "keywords": ["...", "...", "...", "...", "..."]
}`;

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [{ role: "user", content: aiPrompt }],
              max_tokens: 800,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content;
            
            // Try to parse JSON from response
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                optimizedContent = JSON.parse(jsonMatch[0]);
              }
            } catch {
              // If parsing fails, use raw content
              optimizedContent = { raw: content };
            }
          }
        } catch (aiError) {
          console.error("AI optimization error:", aiError);
        }
      }

      results.push({
        listing_id: listing.id,
        external_product_id: listing.external_product_id,
        title: listing.title,
        current_score: scorePercent,
        score_breakdown: seoFactors,
        suggestions,
        optimized_content: optimizedContent,
        grade: scorePercent >= 80 ? "A" : scorePercent >= 60 ? "B" : scorePercent >= 40 ? "C" : "D",
      });
    }

    // Calculate average score
    const avgScore = results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + r.current_score, 0) / results.length)
      : 0;

    // Save analysis to database
    await supabase
      .from("ali_ai_insights")
      .insert({
        user_id: null,
        insight_type: "uzum_seo_analysis",
        category: "marketplace",
        title: `Uzum SEO Tahlil: ${store.name}`,
        description: `${listings.length} ta listing tahlil qilindi. O'rtacha ball: ${avgScore}%`,
        severity: avgScore < 50 ? "warning" : "info",
        data: {
          store_id,
          store_name: store.name,
          average_score: avgScore,
          listings_analyzed: listings.length,
          grade_distribution: {
            A: results.filter(r => r.grade === "A").length,
            B: results.filter(r => r.grade === "B").length,
            C: results.filter(r => r.grade === "C").length,
            D: results.filter(r => r.grade === "D").length,
          },
        },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    return new Response(
      JSON.stringify({
        success: true,
        store_name: store.name,
        summary: {
          listings_analyzed: listings.length,
          average_score: avgScore,
          grade_distribution: {
            A: results.filter(r => r.grade === "A").length,
            B: results.filter(r => r.grade === "B").length,
            C: results.filter(r => r.grade === "C").length,
            D: results.filter(r => r.grade === "D").length,
          },
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Uzum SEO optimizer error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
