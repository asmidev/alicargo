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
    const { listing_id } = await req.json();
    if (!listing_id) {
      return new Response(JSON.stringify({ error: "listing_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch listing details
    const { data: listing, error: listingErr } = await supabase
      .from("marketplace_listings")
      .select(`
        *,
        marketplace_stores!inner (name, platform)
      `)
      .eq("id", listing_id)
      .maybeSingle();

    console.log("Listing query result:", { listingId: listing_id, found: !!listing, error: listingErr?.message });

    if (listingErr || !listing) {
      return new Response(JSON.stringify({ error: "Listing not found", detail: listingErr?.message || "No data returned" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch orders by SKU + product ID (no fulfillment_type filter — Uzum orders don't reliably distinguish)
    const { data: orders } = await supabase.rpc("get_orders_by_sku", {
      p_store_id: listing.store_id,
      p_sku: listing.external_sku,
      p_product_id: listing.external_product_id || null,
    });

    // Fetch competitors
    const { data: competitors } = await supabase
      .from("marketplace_competitors")
      .select(`
        competitor_name, competitor_shop_name,
        marketplace_competitor_prices (price, rating, review_count, sales_count)
      `)
      .eq("listing_id", listing_id)
      .eq("is_active", true);

    // Fetch price suggestions
    const { data: priceSuggestions } = await supabase
      .from("marketplace_price_suggestions")
      .select("*")
      .eq("listing_id", listing_id)
      .order("created_at", { ascending: false })
      .limit(3);

    // Fetch forecasts
    const { data: forecasts } = await supabase
      .from("marketplace_forecasts")
      .select("*")
      .eq("listing_id", listing_id)
      .order("forecast_date", { ascending: false })
      .limit(10);

    // Fetch sibling listings (same product, different stores) — cap at 20 to avoid mis-linked products
    let siblingsSection = "";
    if (listing.product_id) {
      const { data: siblings } = await supabase
        .from("marketplace_listings")
        .select("id, store_id, external_sku, external_product_id, fulfillment_type, title, price, currency, stock, status, marketplace_stores(name, platform)")
        .eq("product_id", listing.product_id)
        .neq("id", listing_id)
        .in("status", ["active", "inactive"])
        .limit(20);

      if (siblings && siblings.length > 0) {
        const siblingDetails = await Promise.all(
          siblings.map(async (s: any) => {
            const { data: sOrders } = await supabase.rpc("get_orders_by_sku", {
              p_store_id: s.store_id,
              p_sku: s.external_sku,
              p_product_id: s.external_product_id || null,
            });
            const delivered = (sOrders || []).filter((o: any) => o.fulfillment_status === "delivered" || o.status === "delivered");
            const rev = delivered.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
            return `- ${s.marketplace_stores?.name || "?"} (${s.marketplace_stores?.platform || "?"}, ${s.fulfillment_type || "FBS"}): Narx ${s.price || "?"} ${s.currency || ""}, Zaxira ${s.stock}, Buyurtmalar ${(sOrders || []).length}, Daromad ${Math.round(rev)}`;
          })
        );
        siblingsSection = `\n## Boshqa Do'konlardagi Listinglar (${siblings.length} ta)\n${siblingDetails.join("\n")}\n\nTaqqoslash va tavsiyalar:\n- Narx farqi bo'lsa, qaysi do'konda optimalroq?\n- Qaysi do'kon eng ko'p sotmoqda?\n- FBS vs FBU samaradorligini solishtir`;
      }
    }

    // Compute key metrics
    const ordersList = orders || [];
    const delivered = ordersList.filter((o: any) => o.fulfillment_status === "delivered" || o.status === "delivered");
    const cancelled = ordersList.filter((o: any) => o.fulfillment_status === "cancelled" || o.status === "cancelled");
    const totalRevenue = delivered.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
    const deliveryRate = ordersList.length ? (delivered.length / ordersList.length * 100).toFixed(1) : "0";
    const cancelRate = ordersList.length ? (cancelled.length / ordersList.length * 100).toFixed(1) : "0";

    const competitorPrices = (competitors || []).flatMap((c: any) =>
      (c.marketplace_competitor_prices || []).map((p: any) => p.price)
    ).filter((p: number) => p > 0);

    const minCompPrice = competitorPrices.length ? Math.min(...competitorPrices) : null;
    const maxCompPrice = competitorPrices.length ? Math.max(...competitorPrices) : null;
    const avgCompPrice = competitorPrices.length ? competitorPrices.reduce((s: number, p: number) => s + p, 0) / competitorPrices.length : null;

    // Build prompt
    const prompt = `Sen marketplace listing tahlilchisissan. Quyidagi ma'lumotlarni o'rganib, batafsil tahlil va tavsiyalar ber. O'zbek tilida yoz.

## Listing Ma'lumotlari
- Nomi: ${listing.title || "Noma'lum"}
- Platform: ${(listing as any).marketplace_stores?.platform || "noma'lum"}
- Do'kon: ${(listing as any).marketplace_stores?.name || "noma'lum"}
- SKU: ${listing.external_sku}
- Narx: ${listing.price} ${listing.currency}
- Taqqoslash narxi: ${listing.compare_price || "yo'q"}
- Tannarx: ${listing.cost_price || "noma'lum"}
- Zaxira: ${listing.stock} dona
- Holat: ${listing.status}
- Kategoriya: ${listing.category_title || "noma'lum"}
- Komissiya stavkasi: ${listing.commission_rate || 5}%
- Yetkazish turi: ${listing.fulfillment_type || "noma'lum"}

## Buyurtmalar Statistikasi
- Jami buyurtmalar: ${ordersList.length}
- Yetkazilgan: ${delivered.length} (${deliveryRate}%)
- Bekor qilingan: ${cancelled.length} (${cancelRate}%)
- Jami daromad: ${totalRevenue} ${listing.currency}
- O'rtacha buyurtma: ${delivered.length ? Math.round(totalRevenue / delivered.length) : 0} ${listing.currency}

## Raqobatchilar (${competitorPrices.length} ta narx)
${minCompPrice ? `- Min narx: ${Math.round(minCompPrice)}` : "- Ma'lumot yo'q"}
${avgCompPrice ? `- O'rtacha narx: ${Math.round(avgCompPrice)}` : ""}
${maxCompPrice ? `- Max narx: ${Math.round(maxCompPrice)}` : ""}
${(competitors || []).slice(0, 5).map((c: any) => `- ${c.competitor_name}: ${(c.marketplace_competitor_prices || [])[0]?.price || "?"} (⭐${(c.marketplace_competitor_prices || [])[0]?.rating || "?"})`).join("\n")}

## AI Prognozlar
${(forecasts || []).slice(0, 5).map((f: any) => `- ${f.forecast_date}: ${f.predicted_value} (ishonch: ${f.confidence ? (f.confidence * 100).toFixed(0) + "%" : "?"})`).join("\n") || "Prognozlar yo'q"}

## Narx Takliflari
${(priceSuggestions || []).map((s: any) => `- Tavsiya: ${s.suggested_price} (sabab: ${s.reason || "?"}, ishonch: ${s.confidence || "?"})`).join("\n") || "Takliflar yo'q"}
${siblingsSection}

---

Quyidagi bo'limlarni yoz:
1. **📊 Umumiy Baho** - Listing holati haqida qisqacha xulosani
2. **💰 Narx Strategiyasi** - Raqobatchilar bilan solishtirib, narxni optimallashtirish tavsiylari
3. **📦 Zaxira Boshqaruvi** - Stok darajasi va to'ldirish tavsiylari
4. **📈 O'sish Imkoniyatlari** - Sotuvni oshirish uchun aniq qadamlar
5. **⚠️ Xavflar** - E'tibor berish kerak bo'lgan muammolar
${siblingsSection ? "6. **🏪 Do'konlar Taqqoslash** - Boshqa do'konlardagi narx, stok va samaradorlik farqlarini tahlil qil\n7. **🎯 Xulosa va Harakatlar** - 3 ta eng muhim qadamni aniq ko'rsat" : "6. **🎯 Xulosa va Harakatlar** - 3 ta eng muhim qadamni aniq ko'rsat"}`;

    // Call Gemini via Lovable AI gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    let analysisText = "";

    if (LOVABLE_API_KEY) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Sen marketplace listing tahlilchisissan. Faqat o'zbek tilida javob ber. Aniq, amaliy, raqamlarga asoslangan tavsiyalar ber." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        analysisText = aiData.choices?.[0]?.message?.content || "";
      } else if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit - biroz kutib qayta urinib ko'ring" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Kredit yetarli emas" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (GEMINI_API_KEY) {
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
          }),
        }
      );
      if (geminiResp.ok) {
        const gemData = await geminiResp.json();
        analysisText = gemData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    }

    if (!analysisText) {
      analysisText = "AI tahlilni yaratib bo'lmadi. API kalitlarini tekshiring.";
    }

    return new Response(JSON.stringify({ analysis: analysisText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("listing-ai-analysis error:", e);
    return new Response(JSON.stringify({ error: e.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
