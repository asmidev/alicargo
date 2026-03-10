import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Role-specific digest configurations
const ROLE_DIGEST_CONFIG: Record<string, { title: string; sections: string[] }> = {
  rahbar: {
    title: "Kunlik Biznes Hisobot",
    sections: ["overview", "finance", "shipments", "tasks", "alerts"],
  },
  bosh_admin: {
    title: "Kunlik Admin Hisobot",
    sections: ["overview", "finance", "shipments", "tasks", "inventory", "alerts"],
  },
  moliya_xodimi: {
    title: "Kunlik Moliya Hisobot",
    sections: ["finance", "claims"],
  },
  xitoy_manager: {
    title: "Kunlik Xitoy Ombor Hisobot",
    sections: ["boxes_china", "shipments", "tasks", "inventory"],
  },
  uz_manager: {
    title: "Kunlik O'zbekiston Ombor Hisobot",
    sections: ["boxes_uz", "shipments", "tasks", "inventory", "claims"],
  },
  investor: {
    title: "Haftalik Investor Hisobot",
    sections: ["finance_summary", "trends"],
  },
};

// Generate overview section
async function generateOverview(supabase: any): Promise<string> {
  const [productsRes, boxesRes, shipmentsRes, tasksRes] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("boxes").select("id", { count: "exact", head: true }),
    supabase.from("shipments").select("id", { count: "exact", head: true }).in("status", ["pending", "in_transit"]),
    supabase.from("tasks").select("id", { count: "exact", head: true }).not("status", "in", '("done","cancelled")'),
  ]);

  return `📊 **UMUMIY KO'RSATKICHLAR**
- Mahsulotlar: ${productsRes.count || 0} ta
- Qutilar: ${boxesRes.count || 0} ta  
- Faol jo'natmalar: ${shipmentsRes.count || 0} ta
- Ochiq vazifalar: ${tasksRes.count || 0} ta`;
}

// Generate finance section
async function generateFinanceSection(supabase: any): Promise<string> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: transactions } = await supabase
    .from("finance_transactions")
    .select("amount, transaction_type")
    .gte("created_at", sevenDaysAgo);

  if (!transactions || transactions.length === 0) {
    return "💰 **MOLIYA**\nBu hafta tranzaksiya yo'q.";
  }

  const income = transactions
    .filter((t: any) => t.transaction_type === "income")
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const expenses = transactions
    .filter((t: any) => t.transaction_type === "expense")
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const profit = income - expenses;
  const margin = income > 0 ? ((profit / income) * 100).toFixed(1) : "0";

  return `💰 **MOLIYA (7 kun)**
- Daromad: $${income.toFixed(2)}
- Xarajat: $${expenses.toFixed(2)}
- Sof foyda: $${profit.toFixed(2)} (${margin}%)
- Tranzaksiyalar: ${transactions.length} ta`;
}

// Generate shipments section
async function generateShipmentsSection(supabase: any): Promise<string> {
  const { data: shipments } = await supabase
    .from("shipments")
    .select("shipment_number, status, estimated_arrival, carrier")
    .in("status", ["pending", "in_transit"])
    .order("estimated_arrival", { ascending: true })
    .limit(5);

  if (!shipments || shipments.length === 0) {
    return "🚚 **JO'NATMALAR**\nFaol jo'natma yo'q.";
  }

  let content = "🚚 **FAOL JO'NATMALAR**\n";
  for (const s of shipments) {
    const eta = s.estimated_arrival ? new Date(s.estimated_arrival).toLocaleDateString("uz-UZ") : "Noma'lum";
    content += `- ${s.shipment_number}: ${s.status} (ETA: ${eta})\n`;
  }
  
  return content;
}

// Generate tasks section
async function generateTasksSection(supabase: any, userId?: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  
  let query = supabase
    .from("tasks")
    .select("title, status, priority, due_date")
    .not("status", "in", '("done","cancelled")')
    .order("due_date", { ascending: true })
    .limit(10);

  if (userId) {
    query = query.or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
  }

  const { data: tasks } = await query;

  if (!tasks || tasks.length === 0) {
    return "📋 **VAZIFALAR**\nOchiq vazifa yo'q.";
  }

  const overdue = tasks.filter((t: any) => t.due_date && t.due_date < today);
  const dueToday = tasks.filter((t: any) => t.due_date?.startsWith(today));
  const urgent = tasks.filter((t: any) => t.priority === "urgent");

  let content = "📋 **VAZIFALAR**\n";
  content += `- Jami ochiq: ${tasks.length} ta\n`;
  if (overdue.length > 0) content += `- ⚠️ Muddati o'tgan: ${overdue.length} ta\n`;
  if (dueToday.length > 0) content += `- 📅 Bugun: ${dueToday.length} ta\n`;
  if (urgent.length > 0) content += `- 🔴 Shoshilinch: ${urgent.length} ta\n`;

  return content;
}

// Generate inventory section
async function generateInventorySection(supabase: any, location?: string): Promise<string> {
  let query = supabase
    .from("product_items")
    .select("status, location", { count: "exact" });

  if (location) {
    query = query.eq("location", location);
  }

  const { count } = await query;

  const { data: alerts } = await supabase
    .from("stock_alerts")
    .select("id")
    .eq("is_resolved", false);

  return `🏪 **INVENTAR**
- Jami elementlar: ${count || 0} ta
- Faol ogohlantirishlar: ${alerts?.length || 0} ta`;
}

// Generate boxes section for China
async function generateBoxesChinaSection(supabase: any): Promise<string> {
  const { data: boxes } = await supabase
    .from("boxes")
    .select("status", { count: "exact" })
    .eq("location", "china");

  const statusCounts: Record<string, number> = {};
  boxes?.forEach((b: any) => {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  });

  let content = "📦 **XITOY QUTILAR**\n";
  content += `- Jami: ${boxes?.length || 0} ta\n`;
  for (const [status, count] of Object.entries(statusCounts)) {
    content += `- ${status}: ${count} ta\n`;
  }
  
  return content;
}

// Generate boxes section for Uzbekistan
async function generateBoxesUzSection(supabase: any): Promise<string> {
  const { data: boxes } = await supabase
    .from("boxes")
    .select("status")
    .or("location.eq.uzbekistan,location.eq.transit");

  const statusCounts: Record<string, number> = {};
  boxes?.forEach((b: any) => {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  });

  let content = "📦 **O'ZBEKISTON QUTILAR**\n";
  content += `- Jami: ${boxes?.length || 0} ta\n`;
  for (const [status, count] of Object.entries(statusCounts)) {
    content += `- ${status}: ${count} ta\n`;
  }
  
  return content;
}

// Generate claims section
async function generateClaimsSection(supabase: any): Promise<string> {
  const { data: claims } = await supabase
    .from("defect_claims")
    .select("status, claim_amount")
    .eq("status", "pending");

  if (!claims || claims.length === 0) {
    return "⚠️ **DA'VOLAR**\nKutilayotgan da'vo yo'q.";
  }

  const totalAmount = claims.reduce((sum: number, c: any) => sum + (Number(c.claim_amount) || 0), 0);

  return `⚠️ **DA'VOLAR**
- Kutilayotgan: ${claims.length} ta
- Umumiy summa: $${totalAmount.toFixed(2)}`;
}

// Generate alerts section from insights
async function generateAlertsSection(supabase: any): Promise<string> {
  const { data: insights } = await supabase
    .from("ali_ai_insights")
    .select("title, severity, category")
    .eq("is_dismissed", false)
    .in("severity", ["warning", "critical"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (!insights || insights.length === 0) {
    return "🔔 **OGOHLANTIRISHLAR**\nMuhim ogohlantirish yo'q.";
  }

  let content = "🔔 **OGOHLANTIRISHLAR**\n";
  for (const i of insights) {
    const icon = i.severity === "critical" ? "🔴" : "🟡";
    content += `${icon} ${i.title}\n`;
  }
  
  return content;
}

// Generate digest for a specific user
async function generateDigest(
  supabase: any,
  userId: string,
  role: string
): Promise<{ content: string; metrics: Record<string, any> }> {
  const config = ROLE_DIGEST_CONFIG[role] || ROLE_DIGEST_CONFIG.support;
  const sections: string[] = [];
  const metrics: Record<string, any> = {};

  const now = new Date();
  const dateStr = now.toLocaleDateString("uz-UZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  sections.push(`# ${config.title}`);
  sections.push(`📅 ${dateStr}\n`);

  for (const section of config.sections) {
    switch (section) {
      case "overview":
        sections.push(await generateOverview(supabase));
        break;
      case "finance":
        sections.push(await generateFinanceSection(supabase));
        break;
      case "finance_summary":
        sections.push(await generateFinanceSection(supabase));
        break;
      case "shipments":
        sections.push(await generateShipmentsSection(supabase));
        break;
      case "tasks":
        sections.push(await generateTasksSection(supabase, userId));
        break;
      case "inventory":
        sections.push(await generateInventorySection(supabase));
        break;
      case "boxes_china":
        sections.push(await generateBoxesChinaSection(supabase));
        break;
      case "boxes_uz":
        sections.push(await generateBoxesUzSection(supabase));
        break;
      case "claims":
        sections.push(await generateClaimsSection(supabase));
        break;
      case "alerts":
        sections.push(await generateAlertsSection(supabase));
        break;
    }
    sections.push(""); // Empty line between sections
  }

  sections.push("\n---\n_Ali AI tomonidan avtomatik yaratildi_");

  return {
    content: sections.join("\n"),
    metrics,
  };
}

// Send digest via Telegram
async function sendDigestViaTelegram(
  supabase: any,
  userId: string,
  content: string
): Promise<boolean> {
  try {
    // Check if user has Telegram linked and notifications enabled
    const { data: telegramUser } = await supabase
      .from("telegram_users")
      .select("telegram_chat_id, is_verified, notify_daily_summary")
      .eq("user_id", userId)
      .single();

    if (!telegramUser?.is_verified || !telegramUser?.notify_daily_summary) {
      return false;
    }

    // Send via Telegram bot
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) return false;

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramUser.telegram_chat_id,
          text: content.replace(/\*\*/g, "*"), // Convert markdown
          parse_mode: "Markdown",
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Error sending Telegram digest:", error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, role, sendTelegram } = await req.json().catch(() => ({}));

    // If specific user requested
    if (userId && role) {
      console.log(`Generating digest for user ${userId} with role ${role}`);
      
      const { content, metrics } = await generateDigest(supabase, userId, role);
      
      // Save digest
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("ali_ai_digests").upsert({
        user_id: userId,
        digest_type: "daily",
        digest_date: today,
        content,
        metrics,
        sent_via: sendTelegram ? ["app", "telegram"] : ["app"],
      });

      // Send via Telegram if requested
      let telegramSent = false;
      if (sendTelegram) {
        telegramSent = await sendDigestViaTelegram(supabase, userId, content);
      }

      return new Response(
        JSON.stringify({
          success: true,
          content,
          metrics,
          telegram_sent: telegramSent,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate digests for all users with roles
    console.log("Generating digests for all users...");
    
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (!userRoles || userRoles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No users found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let successCount = 0;
    let telegramCount = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const { user_id, role } of userRoles) {
      try {
        const { content, metrics } = await generateDigest(supabase, user_id, role);
        
        await supabase.from("ali_ai_digests").upsert({
          user_id,
          digest_type: "daily",
          digest_date: today,
          content,
          metrics,
          sent_via: ["app"],
        });

        const sent = await sendDigestViaTelegram(supabase, user_id, content);
        if (sent) telegramCount++;
        
        successCount++;
      } catch (err) {
        console.error(`Error generating digest for user ${user_id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_users: userRoles.length,
        digests_created: successCount,
        telegram_sent: telegramCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Digest error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
