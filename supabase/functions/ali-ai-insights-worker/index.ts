import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InsightData {
  user_id?: string;
  insight_type: "alert" | "trend" | "prediction" | "suggestion";
  severity: "info" | "warning" | "critical";
  category: string;
  title: string;
  description: string;
  data?: Record<string, any>;
  action_url?: string;
  action_label?: string;
  expires_at?: string;
}

// Analyze shipments for delays and issues
async function analyzeShipments(supabase: any): Promise<InsightData[]> {
  const insights: InsightData[] = [];
  
  const { data: shipments } = await supabase
    .from("shipments")
    .select("*, shipment_boxes(box_id)")
    .in("status", ["pending", "in_transit"]);
  
  if (!shipments) return insights;
  
  const now = new Date();
  
  for (const shipment of shipments) {
    // Check for delayed shipments
    if (shipment.estimated_arrival) {
      const eta = new Date(shipment.estimated_arrival);
      const daysLate = Math.floor((now.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLate > 0 && shipment.status === "in_transit") {
        insights.push({
          insight_type: "alert",
          severity: daysLate > 3 ? "critical" : "warning",
          category: "shipments",
          title: `Jo'natma ${shipment.shipment_number} kechikmoqda`,
          description: `Bu jo'natma ${daysLate} kun kechikdi. Kutilgan sana: ${eta.toLocaleDateString("uz-UZ")}. Tashuvchi bilan bog'laning.`,
          data: {
            shipment_id: shipment.id,
            shipment_number: shipment.shipment_number,
            days_late: daysLate,
            eta: shipment.estimated_arrival,
            carrier: shipment.carrier,
            box_count: shipment.shipment_boxes?.length || 0,
          },
          action_url: `/crm/shipments/${shipment.id}`,
          action_label: "Jo'natmani ko'rish",
          expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
      
      // Arriving soon notification
      const daysUntilArrival = Math.floor((eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilArrival >= 0 && daysUntilArrival <= 2 && shipment.status === "in_transit") {
        insights.push({
          insight_type: "prediction",
          severity: "info",
          category: "shipments",
          title: `Jo'natma ${shipment.shipment_number} tez orada yetib keladi`,
          description: `Bu jo'natma ${daysUntilArrival === 0 ? "bugun" : daysUntilArrival + " kunda"} yetib keladi. ${shipment.shipment_boxes?.length || 0} ta quti. Qabul qilishga tayyorlaning.`,
          data: {
            shipment_id: shipment.id,
            shipment_number: shipment.shipment_number,
            days_until: daysUntilArrival,
            eta: shipment.estimated_arrival,
            box_count: shipment.shipment_boxes?.length || 0,
          },
          action_url: `/crm/shipments/${shipment.id}`,
          action_label: "Tayyorlanish",
          expires_at: eta.toISOString(),
        });
      }
    }
  }
  
  return insights;
}

// Analyze stock levels for low stock alerts
async function analyzeInventory(supabase: any): Promise<InsightData[]> {
  const insights: InsightData[] = [];
  
  // Get products with stock counts
  const { data: products } = await supabase
    .from("products")
    .select("id, name, category, quantity")
    .gt("quantity", 0);
  
  const { data: productItems } = await supabase
    .from("product_items")
    .select("product_id, status")
    .in("status", ["pending", "in_box", "arrived"]);
  
  if (!products) return insights;
  
  // Count items per product
  const itemCounts: Record<string, number> = {};
  productItems?.forEach((item: any) => {
    itemCounts[item.product_id] = (itemCounts[item.product_id] || 0) + 1;
  });
  
  // Find low stock products
  const lowStockProducts = products.filter((p: any) => {
    const actualStock = itemCounts[p.id] || 0;
    return actualStock <= 5 && actualStock > 0;
  });
  
  const outOfStockProducts = products.filter((p: any) => {
    const actualStock = itemCounts[p.id] || 0;
    return actualStock === 0;
  });
  
  if (lowStockProducts.length > 0) {
    insights.push({
      insight_type: "alert",
      severity: "warning",
      category: "inventory",
      title: `${lowStockProducts.length} ta mahsulot kam qoldi`,
      description: `Kam qolgan mahsulotlar: ${lowStockProducts.slice(0, 3).map((p: any) => p.name).join(", ")}${lowStockProducts.length > 3 ? ` va ${lowStockProducts.length - 3} ta boshqa` : ""}`,
      data: {
        products: lowStockProducts.slice(0, 10).map((p: any) => ({
          id: p.id,
          name: p.name,
          stock: itemCounts[p.id] || 0,
        })),
        total_count: lowStockProducts.length,
      },
      action_url: "/crm/inventory",
      action_label: "Inventarni ko'rish",
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  if (outOfStockProducts.length > 0) {
    insights.push({
      insight_type: "alert",
      severity: "critical",
      category: "inventory",
      title: `${outOfStockProducts.length} ta mahsulot tugadi`,
      description: `Tugagan mahsulotlar: ${outOfStockProducts.slice(0, 3).map((p: any) => p.name).join(", ")}. Zudlik bilan buyurtma bering!`,
      data: {
        products: outOfStockProducts.slice(0, 10).map((p: any) => ({
          id: p.id,
          name: p.name,
        })),
        total_count: outOfStockProducts.length,
      },
      action_url: "/crm/products",
      action_label: "Mahsulotlarni ko'rish",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  return insights;
}

// Analyze tasks for overdue and urgent items
async function analyzeTasks(supabase: any): Promise<InsightData[]> {
  const insights: InsightData[] = [];
  
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, assigned_to, location")
    .not("status", "in", '("done","cancelled")')
    .order("due_date", { ascending: true });
  
  if (!tasks) return insights;
  
  const overdueTasks = tasks.filter((t: any) => t.due_date && t.due_date < today);
  const urgentTasks = tasks.filter((t: any) => t.priority === "urgent");
  const dueTodayTasks = tasks.filter((t: any) => t.due_date?.startsWith(today));
  
  if (overdueTasks.length > 0) {
    insights.push({
      insight_type: "alert",
      severity: "critical",
      category: "tasks",
      title: `${overdueTasks.length} ta vazifa muddati o'tgan`,
      description: `Shoshilinch: ${overdueTasks.slice(0, 2).map((t: any) => t.title).join(", ")}. Darhol bajaring!`,
      data: {
        tasks: overdueTasks.slice(0, 5).map((t: any) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          priority: t.priority,
        })),
        total_count: overdueTasks.length,
      },
      action_url: "/crm/tasks",
      action_label: "Vazifalarni ko'rish",
      expires_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  if (dueTodayTasks.length > 0) {
    insights.push({
      insight_type: "suggestion",
      severity: "info",
      category: "tasks",
      title: `Bugun ${dueTodayTasks.length} ta vazifa`,
      description: `Bugungi vazifalar: ${dueTodayTasks.slice(0, 3).map((t: any) => t.title).join(", ")}`,
      data: {
        tasks: dueTodayTasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
        })),
      },
      action_url: "/crm/tasks",
      action_label: "Boshlash",
      expires_at: new Date(now.setHours(23, 59, 59, 999)).toISOString(),
    });
  }
  
  return insights;
}

// Analyze finance for cash flow issues
async function analyzeFinance(supabase: any): Promise<InsightData[]> {
  const insights: InsightData[] = [];
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: monthTransactions } = await supabase
    .from("finance_transactions")
    .select("amount, transaction_type, created_at")
    .gte("created_at", thirtyDaysAgo);
  
  const { data: weekTransactions } = await supabase
    .from("finance_transactions")
    .select("amount, transaction_type")
    .gte("created_at", sevenDaysAgo);
  
  if (!monthTransactions || !weekTransactions) return insights;
  
  // Calculate monthly totals
  const monthIncome = monthTransactions
    .filter((t: any) => t.transaction_type === "income")
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const monthExpenses = monthTransactions
    .filter((t: any) => t.transaction_type === "expense")
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  
  // Calculate weekly totals
  const weekIncome = weekTransactions
    .filter((t: any) => t.transaction_type === "income")
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const weekExpenses = weekTransactions
    .filter((t: any) => t.transaction_type === "expense")
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  
  const monthProfit = monthIncome - monthExpenses;
  const weekProfit = weekIncome - weekExpenses;
  
  // Negative cash flow alert
  if (weekProfit < 0) {
    insights.push({
      insight_type: "alert",
      severity: Math.abs(weekProfit) > 1000 ? "critical" : "warning",
      category: "finance",
      title: "Haftalik pul oqimi salbiy",
      description: `Bu hafta $${Math.abs(weekProfit).toFixed(2)} zarar ko'rildi. Xarajatlarni tekshiring.`,
      data: {
        week_income: weekIncome,
        week_expenses: weekExpenses,
        week_profit: weekProfit,
        month_profit: monthProfit,
      },
      action_url: "/crm/finance",
      action_label: "Moliyani tahlil qilish",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  // Monthly trend insight
  if (monthTransactions.length >= 10) {
    const profitMargin = monthIncome > 0 ? (monthProfit / monthIncome) * 100 : 0;
    
    insights.push({
      insight_type: "trend",
      severity: profitMargin < 10 ? "warning" : "info",
      category: "finance",
      title: `Oylik foyda foizi: ${profitMargin.toFixed(1)}%`,
      description: `Daromad: $${monthIncome.toFixed(2)}, Xarajat: $${monthExpenses.toFixed(2)}, Sof foyda: $${monthProfit.toFixed(2)}`,
      data: {
        income: monthIncome,
        expenses: monthExpenses,
        profit: monthProfit,
        margin: profitMargin,
        transaction_count: monthTransactions.length,
      },
      action_url: "/crm/finance",
      action_label: "Batafsil ko'rish",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  return insights;
}

// Analyze pending claims
async function analyzeClaims(supabase: any): Promise<InsightData[]> {
  const insights: InsightData[] = [];
  
  const { data: claims } = await supabase
    .from("defect_claims")
    .select("id, claim_number, status, claim_amount, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  
  if (!claims || claims.length === 0) return insights;
  
  const totalAmount = claims.reduce((sum: number, c: any) => sum + (Number(c.claim_amount) || 0), 0);
  const oldestClaim = claims[0];
  const daysSinceOldest = Math.floor(
    (Date.now() - new Date(oldestClaim.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  insights.push({
    insight_type: "alert",
    severity: claims.length > 5 || daysSinceOldest > 7 ? "warning" : "info",
    category: "claims",
    title: `${claims.length} ta kutilayotgan da'vo`,
    description: `Umumiy summa: $${totalAmount.toFixed(2)}. Eng eski da'vo ${daysSinceOldest} kun oldin yaratilgan.`,
    data: {
      pending_count: claims.length,
      total_amount: totalAmount,
      oldest_days: daysSinceOldest,
      claims: claims.slice(0, 5).map((c: any) => ({
        id: c.id,
        number: c.claim_number,
        amount: c.claim_amount,
      })),
    },
    action_url: "/crm/claims",
    action_label: "Da'volarni ko'rish",
    expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  });
  
  return insights;
}

// Main analysis function
async function runAnalysis(supabase: any): Promise<InsightData[]> {
  console.log("Starting proactive analysis...");
  
  const allInsights: InsightData[] = [];
  
  // Run all analyses in parallel
  const [shipmentInsights, inventoryInsights, taskInsights, financeInsights, claimInsights] = await Promise.all([
    analyzeShipments(supabase),
    analyzeInventory(supabase),
    analyzeTasks(supabase),
    analyzeFinance(supabase),
    analyzeClaims(supabase),
  ]);
  
  allInsights.push(...shipmentInsights);
  allInsights.push(...inventoryInsights);
  allInsights.push(...taskInsights);
  allInsights.push(...financeInsights);
  allInsights.push(...claimInsights);
  
  console.log(`Analysis complete. Found ${allInsights.length} insights.`);
  
  return allInsights;
}

// Save insights to database
async function saveInsights(supabase: any, insights: InsightData[]): Promise<number> {
  if (insights.length === 0) return 0;
  
  // Clear old expired insights
  await supabase
    .from("ali_ai_insights")
    .delete()
    .lt("expires_at", new Date().toISOString());
  
  // Check for duplicate insights (same title and category within 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existingInsights } = await supabase
    .from("ali_ai_insights")
    .select("title, category")
    .gte("created_at", oneDayAgo);
  
  const existingKeys = new Set(
    existingInsights?.map((i: any) => `${i.category}:${i.title}`) || []
  );
  
  // Filter out duplicates
  const newInsights = insights.filter(
    (i) => !existingKeys.has(`${i.category}:${i.title}`)
  );
  
  if (newInsights.length === 0) {
    console.log("No new insights to save (all duplicates)");
    return 0;
  }
  
  // Insert new insights
  const { error } = await supabase.from("ali_ai_insights").insert(newInsights);
  
  if (error) {
    console.error("Error saving insights:", error);
    return 0;
  }
  
  console.log(`Saved ${newInsights.length} new insights`);
  return newInsights.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check: verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseUser = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { error: userError } = await supabaseUser.auth.getUser();
      if (userError) {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Ali AI Insights Worker started");

    // Run analysis
    const insights = await runAnalysis(supabase);
    
    // Save insights
    const savedCount = await saveInsights(supabase, insights);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_at: new Date().toISOString(),
        total_insights: insights.length,
        saved_insights: savedCount,
        categories: {
          shipments: insights.filter((i) => i.category === "shipments").length,
          inventory: insights.filter((i) => i.category === "inventory").length,
          tasks: insights.filter((i) => i.category === "tasks").length,
          finance: insights.filter((i) => i.category === "finance").length,
          claims: insights.filter((i) => i.category === "claims").length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Insights Worker error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
