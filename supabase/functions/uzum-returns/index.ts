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

    const { store_id, days = 30 } = await req.json();

    if (!store_id) {
      return new Response(
        JSON.stringify({ error: "store_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Fetch orders using ordered_at (universal field)
    const { data: orders } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("store_id", store_id)
      .gte("ordered_at", startDate);

    // Fetch marketplace_returns resolution stats
    const { data: returnsData } = await supabase
      .from("marketplace_returns")
      .select("resolution, resolved_at, created_at")
      .eq("store_id", store_id);

    const resolutionStats = buildResolutionStats(returnsData || []);

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          store_name: store.name,
          platform: store.platform,
          message: "No orders found in the specified period",
          metrics: {
            total_orders: 0, returned_orders: 0, cancelled_orders: 0,
            return_rate: 0, cancel_rate: 0, success_rate: 0,
            returned_value: 0, cancelled_value: 0, lost_revenue: 0,
          },
          resolution_stats: resolutionStats,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { metrics, problematicProducts, weekdayAnalysis } = analyzeOrders(orders, store.platform);

    // Persist returned/cancelled orders into marketplace_returns
    const returnedOrders = orders.filter(o =>
      o.fulfillment_status === 'returned' || o.status === 'RETURNED'
    );
    if (returnedOrders.length > 0) {
      const returnRows = returnedOrders.flatMap(order => {
        const items = (order.items as any[]) || [];
        if (items.length === 0) {
          return [{
            store_id,
            platform: store.platform || 'uzum',
            external_order_id: order.external_order_id || order.id,
            product_title: 'Unknown product',
            quantity: 1,
            amount: Number(order.total_amount) || 0,
            currency: order.currency || 'UZS',
            return_reason: order.fulfillment_status || order.status || 'returned',
            return_date: order.ordered_at || order.created_at || new Date().toISOString(),
            resolution: 'pending',
          }];
        }
        return items.map(item => ({
          store_id,
          platform: store.platform || 'uzum',
          external_order_id: order.external_order_id || order.id,
          product_title: item.name || item.title || item.offerName || item.skuTitle || 'Unknown',
          sku_title: item.sku || item.offerId || null,
          quantity: item.quantity || item.count || 1,
          amount: (Number(item.price) || Number(item.amount) || 0) * (item.quantity || item.count || 1),
          currency: order.currency || 'UZS',
          return_reason: order.fulfillment_status || order.status || 'returned',
          return_date: order.ordered_at || order.created_at || new Date().toISOString(),
          resolution: 'pending',
        }));
      });

      for (let i = 0; i < returnRows.length; i += 100) {
        const chunk = returnRows.slice(i, i + 100);
        const { error: insertErr } = await supabase.from('marketplace_returns').insert(chunk);
        if (insertErr) console.error('[uzum-returns] Insert error:', insertErr.message);
      }
      console.log(`[uzum-returns] Persisted ${returnRows.length} return items to marketplace_returns`);
    }

    // Generate AI insights
    let aiInsights = null;
    if (lovableApiKey && orders.length > 5) {
      aiInsights = await generateAIInsights(lovableApiKey, store, days, metrics, problematicProducts, resolutionStats);
    }

    // Save insight
    await supabase.from("ali_ai_insights").insert({
      user_id: null,
      insight_type: "marketplace_returns_analysis",
      category: "marketplace",
      title: `Qaytarishlar: ${store.name} (${store.platform})`,
      description: `${metrics.returned_orders + metrics.cancelled_orders} ta muammoli buyurtma (${(metrics.return_rate + metrics.cancel_rate).toFixed(1)}%)`,
      severity: metrics.return_rate + metrics.cancel_rate > 15 ? "error" : metrics.return_rate + metrics.cancel_rate > 5 ? "warning" : "info",
      data: { store_id, store_name: store.name, platform: store.platform, period_days: days, metrics, problematic_products: problematicProducts },
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        store_name: store.name,
        platform: store.platform,
        period: { days, start_date: startDate.split("T")[0], end_date: new Date().toISOString().split("T")[0] },
        metrics,
        problematic_products: problematicProducts,
        weekday_analysis: weekdayAnalysis,
        resolution_stats: resolutionStats,
        ai_insights: aiInsights,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Returns analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function analyzeOrders(orders: any[], platform: string) {
  const totalOrders = orders.length;
  const statusField = "fulfillment_status";

  const delivered = orders.filter(o => ["delivered", "completed"].includes(o[statusField] || ""));
  const returned = orders.filter(o => (o[statusField] === "returned") || (o.status === "RETURNED"));
  const cancelled = orders.filter(o => (o[statusField] === "cancelled") || (o.status === "CANCELLED"));
  const pending = orders.filter(o =>
    !["delivered", "completed", "returned", "cancelled"].includes(o[statusField] || "") &&
    !["RETURNED", "CANCELLED"].includes(o.status || "")
  );

  const returnRate = totalOrders > 0 ? (returned.length / totalOrders * 100) : 0;
  const cancelRate = totalOrders > 0 ? (cancelled.length / totalOrders * 100) : 0;
  const successRate = totalOrders > 0 ? (delivered.length / totalOrders * 100) : 0;

  const returnedValue = returned.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const cancelledValue = cancelled.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);

  // Analyze by product
  const productMap: Record<string, any> = {};
  orders.forEach(order => {
    const items = (order.items as any[]) || [];
    const isReturned = order[statusField] === "returned" || order.status === "RETURNED";
    const isCancelled = order[statusField] === "cancelled" || order.status === "CANCELLED";

    items.forEach(item => {
      const pid = item.product_id || item.sku || item.offerId || "unknown";
      const pname = item.name || item.title || item.offerName || item.skuTitle || pid;
      if (!productMap[pid]) {
        productMap[pid] = { product_id: pid, product_name: pname, total_ordered: 0, returned: 0, cancelled: 0, return_rate: 0, lost_value: 0 };
      }
      const qty = item.quantity || item.count || 1;
      const val = (Number(item.price) || Number(item.amount) || 0) * qty;
      productMap[pid].total_ordered += qty;
      if (isReturned) { productMap[pid].returned += qty; productMap[pid].lost_value += val; }
      if (isCancelled) { productMap[pid].cancelled += qty; productMap[pid].lost_value += val; }
    });
  });

  Object.values(productMap).forEach((p: any) => {
    p.return_rate = p.total_ordered > 0 ? ((p.returned + p.cancelled) / p.total_ordered * 100) : 0;
  });

  const problematicProducts = Object.values(productMap)
    .filter((p: any) => p.return_rate > 10 || p.returned > 2 || p.cancelled > 2)
    .sort((a: any, b: any) => b.return_rate - a.return_rate)
    .slice(0, 10);

  // Weekly analysis
  const dayStats: Record<number, { orders: number; returns: number; cancels: number }> = {};
  for (let i = 0; i < 7; i++) dayStats[i] = { orders: 0, returns: 0, cancels: 0 };

  orders.forEach(order => {
    const d = new Date(order.ordered_at || order.order_date).getDay();
    dayStats[d].orders++;
    if (order[statusField] === "returned" || order.status === "RETURNED") dayStats[d].returns++;
    if (order[statusField] === "cancelled" || order.status === "CANCELLED") dayStats[d].cancels++;
  });

  const dayNames = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const weekdayAnalysis = Object.entries(dayStats).map(([day, stats]) => ({
    day: dayNames[parseInt(day)],
    orders: stats.orders,
    returns: stats.returns,
    cancels: stats.cancels,
    issue_rate: stats.orders > 0 ? ((stats.returns + stats.cancels) / stats.orders * 100).toFixed(1) : "0.0",
  }));

  return {
    metrics: {
      total_orders: totalOrders,
      delivered_orders: delivered.length,
      returned_orders: returned.length,
      cancelled_orders: cancelled.length,
      pending_orders: pending.length,
      return_rate: Math.round(returnRate * 10) / 10,
      cancel_rate: Math.round(cancelRate * 10) / 10,
      success_rate: Math.round(successRate * 10) / 10,
      returned_value: returnedValue,
      cancelled_value: cancelledValue,
      lost_revenue: returnedValue + cancelledValue,
    },
    problematicProducts,
    weekdayAnalysis,
  };
}

function buildResolutionStats(returns: any[]) {
  const total = returns.length;
  const resend = returns.filter(r => r.resolution === "resend").length;
  const rejected = returns.filter(r => r.resolution === "rejected").length;
  const sellLocal = returns.filter(r => r.resolution === "sell_local").length;
  const pending = returns.filter(r => r.resolution === "pending").length;

  const resolved = returns.filter(r => r.resolved_at && r.created_at);
  let avgResolutionHours = 0;
  if (resolved.length > 0) {
    const totalHours = resolved.reduce((sum, r) => {
      return sum + (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 3600000;
    }, 0);
    avgResolutionHours = Math.round(totalHours / resolved.length);
  }

  return { total, resend, rejected, sell_local: sellLocal, pending, resolved: total - pending, avg_resolution_hours: avgResolutionHours };
}

async function generateAIInsights(apiKey: string, store: any, days: number, metrics: any, problematicProducts: any[], resolutionStats: any) {
  try {
    const prompt = `Siz ${store.platform === 'yandex' ? 'Yandex Market' : 'Uzum Market'} uchun qaytarilgan buyurtmalar tahlilchisiz.

Do'kon: ${store.name} (${store.platform})
Tahlil davri: Oxirgi ${days} kun

Statistika:
- Jami buyurtmalar: ${metrics.total_orders}
- Muvaffaqiyatli: ${metrics.delivered_orders} (${metrics.success_rate}%)
- Qaytarilgan: ${metrics.returned_orders} (${metrics.return_rate}%)
- Bekor qilingan: ${metrics.cancelled_orders} (${metrics.cancel_rate}%)
- Yo'qotilgan daromad: ${metrics.lost_revenue.toLocaleString()} UZS

Qaytarish hal qilish statistikasi:
- Jami qaytarishlar: ${resolutionStats.total}
- Qayta jo'natilgan: ${resolutionStats.resend}
- Rad etilgan: ${resolutionStats.rejected}
- Do'konda sotilgan: ${resolutionStats.sell_local}
- Kutilayotgan: ${resolutionStats.pending}
- O'rtacha hal qilish vaqti: ${resolutionStats.avg_resolution_hours} soat

Muammoli mahsulotlar:
${problematicProducts.map((p: any) => `- ${p.product_name}: ${p.return_rate.toFixed(1)}% qaytarish, ${p.lost_value.toLocaleString()} UZS`).join("\n")}

Quyidagilarni tavsiya qiling:
1. ⚠️ Asosiy muammolar va sabablar
2. 📦 Muammoli mahsulotlar uchun aniq harakatlar
3. 💰 Yo'qotishni kamaytirish strategiyasi
4. 📊 Qaytarish hal qilish samaradorligi haqida tavsiyalar

O'zbek tilida, qisqa va aniq javob bering. Markdown formatda yozing.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || null;
    }
    if (resp.status === 429) return "⚠️ AI tizimi hozir band. Keyinroq urinib ko'ring.";
    if (resp.status === 402) return "⚠️ AI kreditlar tugagan. Iltimos, kredit qo'shing.";
    return null;
  } catch (e) {
    console.error("AI insights error:", e);
    return null;
  }
}
