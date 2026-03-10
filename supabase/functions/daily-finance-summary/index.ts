import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let targetDate: string;
    let sendTelegram = true;

    try {
      const body = await req.json();
      targetDate = body.date || getYesterday();
      sendTelegram = body.send_telegram !== false;
    } catch {
      targetDate = getYesterday();
    }

    console.log(`Generating finance summary for ${targetDate}`);

    // Call RPC function — bypasses 1000-row limit
    const { data: metrics, error: rpcError } = await supabase.rpc(
      "get_daily_finance_summary",
      { p_date: targetDate }
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      throw new Error(`RPC failed: ${rpcError.message}`);
    }

    // Marketplace stores comes as part of metrics
    const storesList = metrics.marketplace_stores || [];

    // Build readable summary text
    const summary = buildSummaryText(metrics);

    // Get first admin user for saving
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["rahbar", "bosh_admin"])
      .limit(1);

    const userId = adminRoles?.[0]?.user_id;

    if (userId) {
      // UPSERT — prevents duplicate digest entries per date
      const { error: upsertError } = await supabase
        .from("ali_ai_digests")
        .upsert(
          {
            user_id: userId,
            digest_type: "finance_daily",
            digest_date: targetDate,
            content: summary,
            metrics: metrics as any,
            sent_via: sendTelegram ? ["telegram"] : ["app"],
          },
          { onConflict: "user_id,digest_type,digest_date" }
        );

      if (upsertError) {
        console.error("Upsert error:", upsertError);
      }
    }

    // Send via Telegram
    if (sendTelegram) {
      await sendTelegramSummary(supabase, summary);
    }

    return new Response(JSON.stringify({ success: true, summary, metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Finance summary error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getYesterday(): string {
  const now = new Date();
  // Edge functions run in UTC; add 5h for Tashkent
  const tashkentMs = now.getTime() + 5 * 60 * 60 * 1000;
  const tashkent = new Date(tashkentMs);
  tashkent.setDate(tashkent.getDate() - 1);
  return tashkent.toISOString().split("T")[0];
}

function formatUSD(n: number): string {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUZS(n: number): string {
  return `${Math.round(Number(n)).toLocaleString("uz-UZ")} so'm`;
}

function buildSummaryText(m: any): string {
  const lines: string[] = [];
  const profitEmoji = m.net_profit_usd >= 0 ? "📈" : "📉";

  lines.push(`📊 *Kunlik Moliyaviy Xulosa*`);
  lines.push(`📅 Sana: ${m.date}`);
  lines.push(``);

  lines.push(`💰 *Kechagi natijalar:*`);
  lines.push(`  ├ Daromad: ${formatUSD(m.income_usd)} (${formatUZS(m.income_uzs)})`);
  lines.push(`  ├ Xarajat: ${formatUSD(m.expense_usd)} (${formatUZS(m.expense_uzs)})`);
  lines.push(`  └ ${profitEmoji} Sof foyda: ${formatUSD(m.net_profit_usd)} (${formatUZS(m.net_profit_uzs)})`);
  lines.push(``);

  if (m.marketplace_income_usd > 0 || m.direct_sale_income_usd > 0) {
    lines.push(`🛒 *Daromad taqsimoti:*`);
    if (m.marketplace_income_usd > 0)
      lines.push(`  ├ Marketplace: ${formatUSD(m.marketplace_income_usd)}`);
    if (m.direct_sale_income_usd > 0)
      lines.push(`  └ To'g'ridan-to'g'ri: ${formatUSD(m.direct_sale_income_usd)}`);
    lines.push(``);
  }

  const stores = m.marketplace_stores || [];
  if (stores.length > 0) {
    lines.push(`🏪 *Do'konlar bo'yicha:*`);
    for (const store of stores) {
      const platform = store.platform === "uzum" ? "🟣" : "🔴";
      lines.push(
        `  ${platform} ${store.name}: ${store.delivered} ta yetkazildi, ${store.currency === "UZS" ? formatUZS(store.net_revenue) : store.net_revenue}`
      );
    }
    lines.push(``);
  }

  lines.push(`🏭 *Ombor va logistika:*`);
  lines.push(`  ├ Toshkent ombori: ${formatUZS(m.warehouse_value_uzs)}`);
  lines.push(`  ├ Yo'ldagi qutilar: ${m.boxes_in_transit} ta`);
  lines.push(`  └ Kecha kelgan: ${m.boxes_arrived_yesterday} ta`);
  lines.push(``);

  if (m.receivable_usd > 0 || m.payable_usd > 0) {
    lines.push(`💳 *Qarz holati:*`);
    if (m.receivable_usd > 0)
      lines.push(`  ├ Debitorlik: ${formatUSD(m.receivable_usd)}`);
    if (m.payable_usd > 0)
      lines.push(`  └ Kreditorlik: ${formatUSD(m.payable_usd)}`);
    lines.push(``);
  }

  const alerts: string[] = [];
  if (m.low_stock_alerts > 0) alerts.push(`⚠️ Kam stock: ${m.low_stock_alerts}`);
  if (m.overdue_tasks > 0) alerts.push(`⏰ Muddati o'tgan: ${m.overdue_tasks}`);
  if (m.open_claims > 0) alerts.push(`📋 Ochiq da'vo: ${m.open_claims}`);

  if (alerts.length > 0) {
    lines.push(`🚨 *Ogohlantirishlar:*`);
    alerts.forEach((a) => lines.push(`  • ${a}`));
  }

  return lines.join("\n");
}

// Telegram: chunk long messages to stay under 4096 char limit
function chunkMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt <= 0) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

async function sendTelegramSummary(supabase: any, summary: string) {
  try {
    const { data: telegramUsers } = await supabase
      .from("telegram_users")
      .select("telegram_chat_id, user_id")
      .eq("is_verified", true)
      .eq("notify_daily_summary", true);

    if (!telegramUsers || telegramUsers.length === 0) {
      console.log("No telegram users to notify");
      return;
    }

    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["rahbar", "bosh_admin"]);

    const adminUserIds = new Set(
      (adminRoles || []).map((r: any) => r.user_id)
    );

    const eligibleUsers = telegramUsers.filter((u: any) =>
      adminUserIds.has(u.user_id)
    );

    if (eligibleUsers.length === 0) {
      console.log("No admin telegram users to notify");
      return;
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN not set");
      return;
    }

    const chunks = chunkMessage(summary);

    for (const user of eligibleUsers) {
      try {
        for (const chunk of chunks) {
          await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: user.telegram_chat_id,
                text: chunk,
                parse_mode: "Markdown",
              }),
            }
          );
        }
        console.log(`Sent to chat_id: ${user.telegram_chat_id}`);
      } catch (e) {
        console.error(`Failed to send to ${user.telegram_chat_id}:`, e);
      }
    }
  } catch (e) {
    console.error("Telegram send error:", e);
  }
}
