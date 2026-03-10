import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Batch pagination helper to bypass 1000-row limit
async function fetchAllRows(queryFn: (from: number, to: number) => any, batchSize = 1000) {
  let allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFn(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return allRows;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch live exchange rates from DB
    const { data: rateData } = await supabase
      .from("exchange_rates_history")
      .select("rates")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .single();
    
    const rates = rateData?.rates as Record<string, number> | undefined;
    const USD_RATE = rates?.UZS || 12800;
    const cnyPerUsd = rates?.CNY || 7.25;
    const CNY_RATE = USD_RATE / cnyPerUsd;

    const { year, month } = await req.json();

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month !== undefined ? month : new Date().getMonth();

    const periodStart = new Date(targetYear, targetMonth, 1);
    const periodEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    const periodStartISO = periodStart.toISOString();
    const periodEndISO = periodEnd.toISOString();
    const periodStartDate = periodStart.toISOString().split("T")[0];
    const periodEndDate = periodEnd.toISOString().split("T")[0];

    console.log(`Calculating: ${periodStartISO} to ${periodEndISO}`);

    // 1. Fetch NON-marketplace finance_transactions (exclude marketplace_order references)
    const transactions = await fetchAllRows((from, to) =>
      supabase
        .from("finance_transactions")
        .select("transaction_type, amount, amount_usd, currency, category, marketplace_commission, marketplace_delivery_fee, reference_type")
        .gte("created_at", periodStartISO)
        .lte("created_at", periodEndISO)
        .range(from, to)
    );

    console.log(`Total transactions fetched: ${transactions.length}`);

    // 2. Fetch marketplace revenue from marketplace_finance_summary (source of truth for marketplace)
    const { data: mfSummary, error: mfError } = await supabase
      .from("marketplace_finance_summary")
      .select("gross_revenue, net_revenue, commission_total, delivery_fees, currency")
      .gte("period_date", periodStartDate)
      .lte("period_date", periodEndDate)
      .eq("period_type", "daily");
    if (mfError) throw mfError;

    // Marketplace totals from summary (in UZS)
    const mpGrossUZS = (mfSummary || []).reduce((s: number, r: any) => s + (Number(r.gross_revenue) || 0), 0);
    const mpCommissionUZS = (mfSummary || []).reduce((s: number, r: any) => s + (Number(r.commission_total) || 0), 0);
    const mpDeliveryFeesUZS = (mfSummary || []).reduce((s: number, r: any) => s + (Number(r.delivery_fees) || 0), 0);
    const mpNetUZS = mpGrossUZS - mpCommissionUZS - mpDeliveryFeesUZS;

    // Convert marketplace totals to USD
    const marketplaceRevenueUSD = mpGrossUZS / USD_RATE;
    const marketplaceCommissionsUSD = mpCommissionUZS / USD_RATE;
    const marketplaceDeliveryFeesUSD = mpDeliveryFeesUZS / USD_RATE;
    const marketplaceNetUSD = mpNetUZS / USD_RATE;

    // 3. Get current inventory value from product_variants
    const { data: variants, error: varError } = await supabase
      .from("product_variants")
      .select("stock_quantity, cost_price, cost_price_currency")
      .gt("stock_quantity", 0);
    if (varError) throw varError;

    // 4. Get accounts receivable & payable
    const [recResult, payResult] = await Promise.all([
      supabase.from("accounts_receivable").select("amount_usd").in("status", ["pending", "partial", "overdue"]),
      supabase.from("accounts_payable").select("amount_usd").in("status", ["pending", "partial", "overdue"]),
    ]);
    if (recResult.error) throw recResult.error;
    if (payResult.error) throw payResult.error;

    // === Separate marketplace vs non-marketplace transactions ===
    const nonMpIncome = transactions.filter((t: any) => 
      t.transaction_type === "income" && t.reference_type !== "marketplace_order"
    );
    const expenses = transactions.filter((t: any) => t.transaction_type === "expense");

    // Non-marketplace income
    const directSalesRevenue = nonMpIncome
      .filter((t: any) => t.category?.toLowerCase().includes("to'g'ridan-to'g'ri sotuv"))
      .reduce((sum: number, t: any) => sum + (t.amount_usd || 0), 0);

    const otherIncome = nonMpIncome
      .filter((t: any) => !t.category?.toLowerCase().includes("to'g'ridan-to'g'ri sotuv"))
      .reduce((sum: number, t: any) => sum + (t.amount_usd || 0), 0);

    // Total income = marketplace net (from summary) + non-marketplace income
    const totalIncome = marketplaceNetUSD + directSalesRevenue + otherIncome;

    // Total expenses
    const totalExpenses = expenses.reduce((sum: number, t: any) => sum + (t.amount_usd || 0), 0);

    // COGS breakdown
    const buyingCost = expenses
      .filter((t: any) => t.category?.includes("Mahsulot sotib"))
      .reduce((sum: number, t: any) => sum + (t.amount_usd || 0), 0);

    const domesticShippingCost = expenses
      .filter((t: any) => t.category?.includes("Xitoy ichki"))
      .reduce((sum: number, t: any) => sum + (t.amount_usd || 0), 0);

    const internationalShippingCostCOGS = expenses
      .filter((t: any) => t.category?.includes("Yuk tashish"))
      .reduce((sum: number, t: any) => sum + (t.amount_usd || 0), 0);

    const cogs = buyingCost + domesticShippingCost + internationalShippingCostCOGS;

    const grossProfit = totalIncome - cogs;
    const netProfit = totalIncome - totalExpenses - marketplaceDeliveryFeesUSD;

    const shippingExpenses = 0;
    const nonCogsExpenses = totalExpenses - cogs;

    const payrollExpenses = expenses
      .filter((t: any) => t.category?.includes("Ish haqi"))
      .reduce((sum: number, t: any) => sum + (t.amount_usd || 0), 0);

    const rentExpenses = expenses
      .filter((t: any) => t.category?.includes("Ijara"))
      .reduce((sum: number, t: any) => sum + (t.amount_usd || 0), 0);

    const marketingExpenses = expenses
      .filter((t: any) => t.category?.includes("Marketing") || t.category?.includes("Reklama"))
      .reduce((sum: number, t: any) => sum + (t.amount_usd || 0), 0);

    const otherExpenses = Math.max(0, nonCogsExpenses - payrollExpenses - rentExpenses - marketingExpenses);

    // Inventory value from product_variants (USD equivalent)
    const closingInventoryValue = (variants || []).reduce((sum: number, v: any) => {
      const cost = Number(v.cost_price) || 0;
      const qty = Number(v.stock_quantity) || 0;
      const cur = v.cost_price_currency || 'UZS';
      if (cur === 'USD') return sum + cost * qty;
      if (cur === 'CNY') return sum + (cost * CNY_RATE / USD_RATE) * qty;
      return sum + (cost / USD_RATE) * qty; // UZS
    }, 0);

    const accountsReceivableTotal = (recResult.data || []).reduce((sum: number, r: any) => sum + (r.amount_usd || 0), 0);
    const accountsPayableTotal = (payResult.data || []).reduce((sum: number, p: any) => sum + (p.amount_usd || 0), 0);

    const cashInflow = totalIncome;
    const cashOutflow = totalExpenses;
    const netCashFlow = cashInflow - cashOutflow;

    const periodData = {
      period_type: "monthly",
      period_start: periodStart.toISOString().split("T")[0],
      period_end: periodEnd.toISOString().split("T")[0],
      revenue: totalIncome,
      cost_of_goods_sold: cogs,
      gross_profit: grossProfit,
      operating_expenses: nonCogsExpenses + marketplaceDeliveryFeesUSD,
      net_profit: netProfit,
      direct_sales_revenue: directSalesRevenue,
      marketplace_revenue: marketplaceRevenueUSD,
      other_income: otherIncome,
      shipping_expenses: shippingExpenses,
      payroll_expenses: payrollExpenses,
      rent_expenses: rentExpenses,
      marketing_expenses: marketingExpenses,
      other_expenses: otherExpenses,
      buying_cost: buyingCost,
      domestic_shipping_cost: domesticShippingCost,
      opening_inventory_value: 0,
      closing_inventory_value: closingInventoryValue,
      inventory_start_value: 0,
      inventory_end_value: closingInventoryValue,
      accounts_receivable_total: accountsReceivableTotal,
      accounts_payable_total: accountsPayableTotal,
      cash_inflow: cashInflow,
      cash_outflow: cashOutflow,
      net_cash_flow: netCashFlow,
      currency: "USD",
      calculated_at: new Date().toISOString(),
    };

    console.log("Period data:", JSON.stringify({
      revenue: totalIncome,
      marketplaceRevenueUSD,
      directSalesRevenue,
      otherIncome,
      cogs,
      grossProfit,
      totalExpenses,
      netProfit,
      transactionCount: transactions.length,
      mpSummaryRecords: (mfSummary || []).length,
    }));

    // Upsert financial period
    const { data: upsertResult, error: upsertError } = await supabase
      .from("financial_periods")
      .upsert(periodData, { onConflict: "period_type,period_start,period_end" })
      .select()
      .single();

    if (upsertError) {
      const { data: insertResult, error: insertError } = await supabase
        .from("financial_periods")
        .insert(periodData)
        .select()
        .single();
      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({ success: true, period: insertResult, metrics: periodData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, period: upsertResult, metrics: periodData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Financial period calculation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
