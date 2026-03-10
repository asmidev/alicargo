import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UZUM_API_BASE = "https://api-seller.uzum.uz/api/seller-openapi";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { store_id } = await req.json();

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

    // Get API key from secrets
    const apiKey = Deno.env.get(store.api_key_secret_name);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `API key not found: ${store.api_key_secret_name}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Fetch store orders for performance analysis (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const orders = await fetchAllRows(
      supabase.from("marketplace_orders").select("*").eq("store_id", store_id).gte("ordered_at", thirtyDaysAgo)
    );

    // Fetch store listings
    const listings = await fetchAllRows(
      supabase.from("marketplace_listings").select("*").eq("store_id", store_id).eq("status", "active")
    );

    // Calculate performance metrics
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Group by product to find best/worst performers
    const productPerformance: Record<string, { revenue: number; orders: number; returns: number }> = {};
    
    orders.forEach(order => {
      const items = order.items as any[] || [];
      items.forEach(item => {
        const productId = item.product_id || item.sku || "unknown";
        if (!productPerformance[productId]) {
          productPerformance[productId] = { revenue: 0, orders: 0, returns: 0 };
        }
        productPerformance[productId].revenue += Number(item.price) * (item.quantity || 1);
        productPerformance[productId].orders += 1;
        if (order.fulfillment_status === "cancelled" || order.fulfillment_status === "returned") {
          productPerformance[productId].returns += 1;
        }
      });
    });

    // Sort products by revenue
    const sortedProducts = Object.entries(productPerformance)
      .sort((a, b) => b[1].revenue - a[1].revenue);

    const topProducts = sortedProducts.slice(0, 5);
    const bottomProducts = sortedProducts.slice(-5).reverse();

    // Find low stock items
    const lowStockItems = listings.filter(l => (l.stock || 0) < 10);

    // Calculate conversion metrics
    const completedOrders = orders.filter(o => 
      o.fulfillment_status === "delivered" || o.fulfillment_status === "completed"
    ).length;
    const conversionRate = totalOrders > 0 ? (completedOrders / totalOrders * 100) : 0;

    // Generate AI-powered insights
    let aiInsights = null;
    if (lovableApiKey) {
      try {
        const aiPrompt = `Siz Uzum Market sotuvchi uchun savdo bo'yicha maslahatchi AI siz.

Do'kon: ${store.name}
Oxirgi 30 kun statistikasi:
- Jami daromad: ${totalRevenue.toLocaleString()} UZS
- Buyurtmalar soni: ${totalOrders}
- O'rtacha buyurtma qiymati: ${avgOrderValue.toLocaleString()} UZS
- Konversiya: ${conversionRate.toFixed(1)}%
- Faol mahsulotlar: ${listings.length}
- Kam qolgan mahsulotlar: ${lowStockItems.length}

Eng yaxshi mahsulotlar (daromad bo'yicha):
${topProducts.map(([id, data], i) => `${i + 1}. ${id}: ${data.revenue.toLocaleString()} UZS, ${data.orders} buyurtma`).join("\n")}

Eng yomon mahsulotlar:
${bottomProducts.map(([id, data], i) => `${i + 1}. ${id}: ${data.revenue.toLocaleString()} UZS, ${data.orders} buyurtma`).join("\n")}

Quyidagilarni tavsiya qiling:
1. 🚀 Tez natija beruvchi 3 ta tavsiya (Quick Wins)
2. 📈 O'sish strategiyasi (qaysi mahsulotlarga e'tibor qaratish)
3. ⚠️ Xavflar va ogohlantirish (kam qolgan stock, past sotuvlar)
4. 💰 Narx optimizatsiyasi tavsiyalari

O'zbek tilida, qisqa va aniq javob bering.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: aiPrompt }],
            max_tokens: 1500,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiInsights = aiData.choices?.[0]?.message?.content;
        }
      } catch (aiError) {
        console.error("AI insights error:", aiError);
      }
    }

    // Generate quick wins based on data
    const quickWins = [];

    // Quick win: Low stock alert
    if (lowStockItems.length > 0) {
      quickWins.push({
        type: "stock",
        priority: "high",
        title: "Stock to'ldiring",
        description: `${lowStockItems.length} ta mahsulotda stock kam qolgan`,
        items: lowStockItems.slice(0, 5).map(l => ({
          title: l.title,
          stock: l.stock,
        })),
      });
    }

    // Quick win: Focus on top performers
    if (topProducts.length > 0) {
      quickWins.push({
        type: "promotion",
        priority: "medium",
        title: "Eng yaxshi mahsulotlarni reklama qiling",
        description: "Bu mahsulotlar eng ko'p daromad keltirmoqda",
        items: topProducts.slice(0, 3).map(([id, data]) => ({
          product_id: id,
          revenue: data.revenue,
          orders: data.orders,
        })),
      });
    }

    // Quick win: Review underperformers
    if (bottomProducts.length > 0 && bottomProducts[0][1].orders < 5) {
      quickWins.push({
        type: "review",
        priority: "low",
        title: "Past sotuvli mahsulotlarni ko'rib chiqing",
        description: "Bu mahsulotlar narx yoki tavsif optimizatsiyasiga muhtoj",
        items: bottomProducts.slice(0, 3).map(([id, data]) => ({
          product_id: id,
          revenue: data.revenue,
          orders: data.orders,
        })),
      });
    }

    // Save insights to database
    await supabase
      .from("ali_ai_insights")
      .insert({
        user_id: null,
        insight_type: "uzum_sale_boost",
        category: "marketplace",
        title: `Uzum Sale Boost: ${store.name}`,
        description: aiInsights || "Savdo tahlili tayyor",
        severity: lowStockItems.length > 5 ? "warning" : "info",
        data: {
          store_id,
          store_name: store.name,
          metrics: {
            total_revenue: totalRevenue,
            total_orders: totalOrders,
            avg_order_value: avgOrderValue,
            conversion_rate: conversionRate,
          active_listings: listings.length,
            low_stock_count: lowStockItems.length,
          },
          top_products: topProducts,
          bottom_products: bottomProducts,
          quick_wins: quickWins,
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    return new Response(
      JSON.stringify({
        success: true,
        store_name: store.name,
        metrics: {
          total_revenue: totalRevenue,
          total_orders: totalOrders,
          avg_order_value: avgOrderValue,
          conversion_rate: conversionRate,
          active_listings: listings.length,
          low_stock_count: lowStockItems.length,
        },
        top_products: topProducts.slice(0, 5),
        bottom_products: bottomProducts.slice(0, 5),
        quick_wins: quickWins,
        ai_insights: aiInsights,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Uzum sale boost error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
