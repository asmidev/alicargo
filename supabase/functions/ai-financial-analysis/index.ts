import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const CACHE_VERSION = 'v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisType, forceRefresh, startDate, endDate } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache
    const cacheKey = `${CACHE_VERSION}_${analysisType}_${startDate || 'all'}_${endDate || new Date().toISOString().split('T')[0]}`;
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('ai_analysis_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cached) {
        return new Response(
          JSON.stringify({ success: true, ...cached.result, fromCache: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Fetch real data from marketplace tables ──

    // 1. Exchange rate
    const { data: rateRow } = await supabase
      .from('exchange_rates_history')
      .select('rates')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();
    const uzsRate = (rateRow?.rates as any)?.UZS ?? 12800;

    // 2. All data in parallel (with optional date filtering)
    let financeQuery = supabase.from('marketplace_finance_summary')
      .select('store_id, gross_revenue, commission_total, delivery_fees, net_revenue, orders_count, delivered_count, cancelled_count, period_date, currency')
      .eq('period_type', 'daily');
    if (startDate) financeQuery = financeQuery.gte('period_date', startDate);
    if (endDate) financeQuery = financeQuery.lte('period_date', endDate);

    let txQuery = supabase.from('finance_transactions')
      .select('transaction_type, amount, amount_usd, currency, category, created_at, reference_type')
      .or('reference_type.is.null,reference_type.neq.marketplace_order');
    if (startDate) txQuery = txQuery.gte('created_at', startDate);
    if (endDate) txQuery = txQuery.lte('created_at', endDate + 'T23:59:59');

    const [financeSummary, stores, manualTransactions, variants] = await Promise.all([
      fetchAllRows(financeQuery),
      supabase.from('marketplace_stores').select('id, name, platform').then(r => r.data || []),
      fetchAllRows(txQuery),
      supabase.from('product_variants')
        .select('sku, cost_price, stock_quantity, product_id')
        .then(r => r.data || []),
    ]);

    // ── Calculate metrics ──

    const storeMap = Object.fromEntries(stores.map((s: any) => [s.id, s]));

    // Per-store aggregation
    const storeMetricsRaw: Record<string, {
      name: string; platform: string;
      grossRevenue: number; commission: number; deliveryFees: number; netRevenue: number;
      orders: number; delivered: number; cancelled: number;
    }> = {};

    for (const row of financeSummary) {
      const store = storeMap[row.store_id];
      if (!storeMetricsRaw[row.store_id]) {
        storeMetricsRaw[row.store_id] = {
          name: store?.name || 'Nomalum',
          platform: store?.platform || 'unknown',
          grossRevenue: 0, commission: 0, deliveryFees: 0, netRevenue: 0,
          orders: 0, delivered: 0, cancelled: 0,
        };
      }
      const sm = storeMetricsRaw[row.store_id];
      sm.grossRevenue += row.gross_revenue || 0;
      sm.commission += row.commission_total || 0;
      sm.deliveryFees += row.delivery_fees || 0;
      sm.netRevenue += row.net_revenue || 0;
      sm.orders += row.orders_count || 0;
      sm.delivered += row.delivered_count || 0;
      sm.cancelled += row.cancelled_count || 0;
    }

    // Build storeMetrics with USD equivalents and commission rate
    const storeMetrics: Record<string, any> = {};
    for (const [id, sm] of Object.entries(storeMetricsRaw)) {
      storeMetrics[sm.name] = {
        ...sm,
        grossRevenueUSD: sm.grossRevenue / uzsRate,
        netRevenueUSD: sm.netRevenue / uzsRate,
        commissionUSD: sm.commission / uzsRate,
        commissionRate: sm.grossRevenue > 0 ? (sm.commission / sm.grossRevenue * 100) : 0,
        deliveryRate: sm.orders > 0 ? (sm.delivered / sm.orders * 100) : 0,
        cancellationRate: sm.orders > 0 ? (sm.cancelled / sm.orders * 100) : 0,
      };
    }

    const totalGrossRevenue = Object.values(storeMetricsRaw).reduce((s, m) => s + m.grossRevenue, 0);
    const totalCommission = Object.values(storeMetricsRaw).reduce((s, m) => s + m.commission, 0);
    const totalDeliveryFees = Object.values(storeMetricsRaw).reduce((s, m) => s + m.deliveryFees, 0);
    const totalNetRevenue = Object.values(storeMetricsRaw).reduce((s, m) => s + m.netRevenue, 0);
    const totalOrders = Object.values(storeMetricsRaw).reduce((s, m) => s + m.orders, 0);
    const totalDelivered = Object.values(storeMetricsRaw).reduce((s, m) => s + m.delivered, 0);
    const totalCancelled = Object.values(storeMetricsRaw).reduce((s, m) => s + m.cancelled, 0);
    const deliveryRate = totalOrders > 0 ? (totalDelivered / totalOrders * 100) : 0;
    const cancellationRate = totalOrders > 0 ? (totalCancelled / totalOrders * 100) : 0;

    // Inventory value from product_variants
    const inventoryValueUZS = variants.reduce((s: number, v: any) =>
      s + (v.cost_price || 0) * (v.stock_quantity || 0), 0);

    // Manual expenses
    const manualExpenses = manualTransactions.filter((t: any) => t.transaction_type === 'expense');
    const manualIncome = manualTransactions.filter((t: any) => t.transaction_type === 'income');
    const totalManualExpenseUSD = manualExpenses.reduce((s: number, t: any) => s + (t.amount_usd || 0), 0);
    const totalManualIncomeUSD = manualIncome.reduce((s: number, t: any) => s + (t.amount_usd || 0), 0);

    // Expense by category
    const expenseByCategory: Record<string, number> = {};
    manualExpenses.forEach((t: any) => {
      const cat = t.category || 'Boshqa';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (t.amount_usd || 0);
    });

    // Monthly trend from finance summary
    const monthlyData: Record<string, { grossRevenue: number; netRevenue: number; commission: number; orders: number; delivered: number }> = {};
    for (const row of financeSummary) {
      const month = (row.period_date as string).substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { grossRevenue: 0, netRevenue: 0, commission: 0, orders: 0, delivered: 0 };
      }
      monthlyData[month].grossRevenue += row.gross_revenue || 0;
      monthlyData[month].netRevenue += row.net_revenue || 0;
      monthlyData[month].commission += row.commission_total || 0;
      monthlyData[month].orders += row.orders_count || 0;
      monthlyData[month].delivered += row.delivered_count || 0;
    }

    // Platform breakdown
    const platformMetrics: Record<string, { grossRevenue: number; netRevenue: number; commission: number; stores: number; storeIds: Set<string> }> = {};
    for (const [id, sm] of Object.entries(storeMetricsRaw)) {
      if (!platformMetrics[sm.platform]) {
        platformMetrics[sm.platform] = { grossRevenue: 0, netRevenue: 0, commission: 0, stores: 0, storeIds: new Set() };
      }
      platformMetrics[sm.platform].grossRevenue += sm.grossRevenue;
      platformMetrics[sm.platform].netRevenue += sm.netRevenue;
      platformMetrics[sm.platform].commission += sm.commission;
      platformMetrics[sm.platform].storeIds.add(id);
      platformMetrics[sm.platform].stores = platformMetrics[sm.platform].storeIds.size;
    }

    // USD equivalents
    const grossRevenueUSD = totalGrossRevenue / uzsRate;
    const netRevenueUSD = totalNetRevenue / uzsRate;
    const commissionUSD = totalCommission / uzsRate;
    const inventoryValueUSD = inventoryValueUZS / uzsRate;

    // Commission rate
    const avgCommissionRate = totalGrossRevenue > 0 ? (totalCommission / totalGrossRevenue * 100) : 0;

    // ── Build prompts ──

    const baseFinanceData = `Moliyaviy ma'lumotlar (marketplace_finance_summary asosida):
- Jami yalpi daromad: ${totalGrossRevenue.toLocaleString()} UZS ($${grossRevenueUSD.toFixed(0)} USD)
- Jami komissiya: ${totalCommission.toLocaleString()} UZS ($${commissionUSD.toFixed(0)} USD) (${avgCommissionRate.toFixed(1)}%)
- Jami yetkazib berish to'lovi: ${totalDeliveryFees.toLocaleString()} UZS
- Jami sof daromad: ${totalNetRevenue.toLocaleString()} UZS ($${netRevenueUSD.toFixed(0)} USD)
- Jami buyurtmalar: ${totalOrders} ta, Yetkazilgan: ${totalDelivered} ta
- Inventar qiymati: ${inventoryValueUZS.toLocaleString()} UZS ($${inventoryValueUSD.toFixed(0)} USD)
- Qo'shimcha xarajatlar (qo'lda kiritilgan): $${totalManualExpenseUSD.toFixed(0)} USD
- Valyuta kursi: 1 USD = ${uzsRate} UZS

Do'konlar bo'yicha:
${Object.entries(storeMetricsRaw).map(([, sm]) =>
  `- ${sm.name} (${sm.platform}): Daromad ${sm.grossRevenue.toLocaleString()} UZS, Komissiya ${sm.commission.toLocaleString()} UZS (${sm.grossRevenue > 0 ? (sm.commission / sm.grossRevenue * 100).toFixed(1) : 0}%), Buyurtmalar ${sm.orders}, Yetkazilgan ${sm.delivered}`
).join('\n')}

Platforma bo'yicha:
${Object.entries(platformMetrics).map(([p, m]) =>
  `- ${p}: Daromad ${m.grossRevenue.toLocaleString()} UZS, Sof ${m.netRevenue.toLocaleString()} UZS, ${m.stores} ta do'kon`
).join('\n')}`;

    let systemPrompt = '';
    let userPrompt = '';

    if (analysisType === 'profit') {
      systemPrompt = `You are a financial analyst specializing in e-commerce marketplace profitability. Analyze the provided data and identify:
1. Most profitable stores and platforms
2. Commission rate efficiency across stores
3. Revenue vs expense balance
4. Actionable recommendations to improve profitability
Respond in Uzbek language.`;

      userPrompt = `${baseFinanceData}

Xarajatlar kategoriyasi bo'yicha:
${Object.entries(expenseByCategory).map(([cat, amt]) => `- ${cat}: $${amt.toFixed(0)} USD`).join('\n')}

Iltimos, batafsil foyda tahlilini bering va tavsiyalar qiling.`;

    } else if (analysisType === 'cost_optimization') {
      systemPrompt = `You are a cost optimization expert for e-commerce marketplace businesses. Analyze expenses and identify:
1. Areas where costs can be reduced (commissions, delivery fees)
2. Which stores have the highest commission rates
3. Operational expense optimization
4. Platform comparison for cost efficiency
Respond in Uzbek language.`;

      userPrompt = `${baseFinanceData}

Xarajatlar kategoriyasi bo'yicha:
${Object.entries(expenseByCategory).map(([cat, amt]) => `- ${cat}: $${amt.toFixed(0)} USD`).join('\n')}

Iltimos, xarajatlarni optimallashtirish bo'yicha tavsiyalar bering.`;

    } else if (analysisType === 'pricing') {
      systemPrompt = `You are a pricing strategy expert for marketplace sellers. Analyze sales data and suggest:
1. Which stores/platforms yield better margins after commissions
2. Commission impact on profitability per store
3. Optimal platform allocation strategy
4. Inventory turnover efficiency
Respond in Uzbek language.`;

      userPrompt = `${baseFinanceData}

Inventar: ${variants.length} ta variant, Jami zaxira qiymati: ${inventoryValueUZS.toLocaleString()} UZS

Iltimos, narxlash va platforma strategiyasi bo'yicha tavsiyalar bering.`;

    } else if (analysisType === 'trend') {
      systemPrompt = `You are a financial forecasting expert. Based on historical marketplace data:
1. Identify revenue and order trends
2. Predict next month's performance
3. Highlight seasonal patterns
4. Warn about potential risks (declining stores, rising commissions)
Respond in Uzbek language.`;

      const sortedMonths = Object.entries(monthlyData).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6);
      userPrompt = `${baseFinanceData}

Oylik trend:
${sortedMonths.map(([month, d]) =>
  `- ${month}: Daromad ${d.grossRevenue.toLocaleString()} UZS, Sof ${d.netRevenue.toLocaleString()} UZS, Komissiya ${d.commission.toLocaleString()} UZS, Buyurtmalar ${d.orders}, Yetkazilgan ${d.delivered}`
).join('\n')}

Iltimos, trend tahlili va keyingi oy bashoratini bering.`;
    }

    // ── Call AI ──

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'provide_financial_analysis',
            description: 'Provide structured financial analysis',
            parameters: {
              type: 'object',
              properties: {
                summary: { type: 'string', description: 'Executive summary in Uzbek (2-3 sentences)' },
                insights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      impact: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] }
                    }
                  }
                },
                recommendations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      action: { type: 'string' },
                      expectedImpact: { type: 'string' },
                      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }
                    }
                  }
                },
                metrics: {
                  type: 'object',
                  properties: {
                    healthScore: { type: 'number', description: 'Overall financial health 0-100' },
                    riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
                    trend: { type: 'string', enum: ['improving', 'stable', 'declining'] }
                  }
                }
              },
              required: ['summary', 'insights', 'recommendations', 'metrics']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'provide_financial_analysis' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let analysis = null;
    if (toolCall?.function?.arguments) {
      analysis = JSON.parse(toolCall.function.arguments);
    }

    const result = {
      analysisType,
      analysis,
      rawMetrics: {
        totalGrossRevenue,
        totalCommission,
        totalDeliveryFees,
        totalNetRevenue,
        totalOrders,
        totalDelivered,
        totalCancelled,
        deliveryRate,
        cancellationRate,
        grossRevenueUSD,
        netRevenueUSD,
        commissionUSD,
        avgCommissionRate,
        inventoryValueUZS,
        inventoryValueUSD,
        totalManualExpenseUSD,
        totalManualIncomeUSD,
        uzsRate,
        storeMetrics,
        platformMetrics: Object.fromEntries(
          Object.entries(platformMetrics).map(([k, v]) => [k, { grossRevenue: v.grossRevenue, netRevenue: v.netRevenue, commission: v.commission, stores: v.stores }])
        ),
        monthlyData,
        expenseByCategory,
      },
      generatedAt: new Date().toISOString(),
    };

    // Cache for 4 hours
    await supabase.from('ai_analysis_cache').upsert({
      cache_key: cacheKey,
      analysis_type: analysisType,
      result,
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'cache_key' });

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in ai-financial-analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
