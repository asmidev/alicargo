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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, sendTelegram } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's telegram chat id if needed
    let telegramChatId: string | null = null;
    if (sendTelegram) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", userId)
        .single();
      telegramChatId = profile?.telegram_chat_id;
    }

    // Fetch marketplace data for digest
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get stores
    const { data: stores } = await supabase
      .from("marketplace_stores")
      .select("id, store_name, platform, is_active");

    // Get yesterday's orders
    const { data: yesterdayOrders } = await supabase
      .from("marketplace_orders")
      .select("id, total_amount, status, store_id")
      .gte("order_date", `${yesterdayStr}T00:00:00`)
      .lt("order_date", `${yesterdayStr}T23:59:59`);

    // Get daily analytics
    const { data: analytics } = await supabase
      .from("marketplace_sales_analytics")
      .select("*")
      .eq("date", yesterdayStr);

    // Get pending price suggestions
    const { data: priceSuggestions } = await supabase
      .from("marketplace_price_suggestions")
      .select("id, current_price, recommended_price, expected_sales_change, confidence")
      .eq("status", "pending")
      .order("confidence", { ascending: false })
      .limit(5);

    // Get low stock listings
    const { data: lowStockListings } = await supabase
      .from("marketplace_listings")
      .select("title, stock_quantity, store_id")
      .lt("stock_quantity", 5)
      .eq("is_active", true)
      .limit(10);

    // Get competitor price changes (last 24h)
    const { data: competitorChanges } = await supabase
      .from("marketplace_competitor_prices")
      .select("price, competitor_id")
      .gte("captured_at", yesterday.toISOString())
      .limit(20);

    // Calculate metrics
    const totalOrders = yesterdayOrders?.length || 0;
    const totalRevenue = yesterdayOrders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
    const completedOrders = yesterdayOrders?.filter(o => o.status === "delivered" || o.status === "completed").length || 0;
    const cancelledOrders = yesterdayOrders?.filter(o => o.status === "cancelled").length || 0;

    // Platform breakdown
    const platformStats: Record<string, { orders: number; revenue: number }> = {};
    yesterdayOrders?.forEach(order => {
      const store = stores?.find(s => s.id === order.store_id);
      if (store) {
        if (!platformStats[store.platform]) {
          platformStats[store.platform] = { orders: 0, revenue: 0 };
        }
        platformStats[store.platform].orders++;
        platformStats[store.platform].revenue += Number(order.total_amount) || 0;
      }
    });

    // Generate digest content
    const digestDate = new Date().toLocaleDateString("uz-UZ", { 
      weekday: "long", 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });

    let content = `# 🛒 Marketplace Kunlik Hisobot\n`;
    content += `📅 ${digestDate}\n\n`;

    content += `## 📊 Kechagi natijalar\n`;
    content += `- **Buyurtmalar:** ${totalOrders} ta\n`;
    content += `- **Daromad:** ${totalRevenue.toLocaleString()} UZS\n`;
    content += `- **Yetkazilgan:** ${completedOrders} ta\n`;
    content += `- **Bekor qilingan:** ${cancelledOrders} ta\n\n`;

    if (Object.keys(platformStats).length > 0) {
      content += `## 🏪 Platformalar bo'yicha\n`;
      Object.entries(platformStats).forEach(([platform, stats]) => {
        content += `- **${platform.toUpperCase()}:** ${stats.orders} buyurtma, ${stats.revenue.toLocaleString()} UZS\n`;
      });
      content += "\n";
    }

    // AI Suggestions
    if (priceSuggestions && priceSuggestions.length > 0) {
      content += `## 🤖 AI Narx Tavsiyalari\n`;
      content += `${priceSuggestions.length} ta narx o'zgartirish tavsiyasi kutilmoqda:\n`;
      priceSuggestions.forEach((s, idx) => {
        content += `${idx + 1}. ${s.current_price?.toLocaleString()} → ${s.recommended_price?.toLocaleString()} UZS (${s.expected_sales_change})\n`;
      });
      content += "\n";
    }

    // Low Stock Alerts
    if (lowStockListings && lowStockListings.length > 0) {
      content += `## ⚠️ Kam Stock Ogohlantirish\n`;
      content += `${lowStockListings.length} ta mahsulotda stock kam:\n`;
      lowStockListings.slice(0, 5).forEach((l, idx) => {
        content += `${idx + 1}. ${l.title?.substring(0, 40)}... (${l.stock_quantity} dona)\n`;
      });
      content += "\n";
    }

    // Competitor activity
    if (competitorChanges && competitorChanges.length > 0) {
      content += `## 👀 Raqobatchilar\n`;
      content += `Kecha ${competitorChanges.length} ta raqobatchi narxi kuzatildi.\n\n`;
    }

    content += `## ✅ Bugun nima qilish kerak?\n`;
    if (priceSuggestions && priceSuggestions.length > 0) {
      content += `1. AI narx tavsiyalarini ko'rib chiqing\n`;
    }
    if (lowStockListings && lowStockListings.length > 0) {
      content += `2. Kam qolgan mahsulotlar stockini to'ldiring\n`;
    }
    content += `3. Marketplace Tahlil sahifasida batafsil tahlilni ko'ring\n`;

    // Save digest to database
    const { data: digest, error: digestError } = await supabase
      .from("ali_ai_digests")
      .upsert({
        user_id: userId,
        digest_type: "marketplace_daily",
        digest_date: new Date().toISOString().split("T")[0],
        content,
        metrics: {
          total_orders: totalOrders,
          total_revenue: totalRevenue,
          completed_orders: completedOrders,
          cancelled_orders: cancelledOrders,
          platform_stats: platformStats,
          low_stock_count: lowStockListings?.length || 0,
          pending_suggestions: priceSuggestions?.length || 0,
        },
        sent_via: sendTelegram && telegramChatId ? ["app", "telegram"] : ["app"],
      }, {
        onConflict: "user_id,digest_date,digest_type",
      })
      .select()
      .single();

    if (digestError) {
      console.error("Error saving digest:", digestError);
    }

    // Send to Telegram if requested
    let telegramSent = false;
    if (sendTelegram && telegramChatId) {
      try {
        const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
        if (telegramBotToken) {
          // Convert markdown to Telegram format
          const telegramText = content
            .replace(/^# /gm, "📊 *")
            .replace(/^## /gm, "\n*")
            .replace(/\*\*/g, "*")
            .replace(/\n\n/g, "\n");

          await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: telegramText.substring(0, 4000),
              parse_mode: "Markdown",
            }),
          });
          telegramSent = true;
        }
      } catch (telegramError) {
        console.error("Telegram send error:", telegramError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        digest_id: digest?.id,
        content,
        telegram_sent: telegramSent,
        metrics: {
          total_orders: totalOrders,
          total_revenue: totalRevenue,
          low_stock_count: lowStockListings?.length || 0,
          pending_suggestions: priceSuggestions?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Marketplace digest error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
