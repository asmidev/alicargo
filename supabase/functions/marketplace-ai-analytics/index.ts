import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      action = 'full_analysis',
      days = 30,
      store_id,
    } = await req.json();

    let result: any = null;

    // Helper: fetch all rows with batch pagination (bypasses 1000-row limit)
    async function fetchAllRows(
      query: any,
      batchSize = 1000
    ) {
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

    // Fetch orders data
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let ordersQuery = supabase
      .from('marketplace_orders')
      .select(`
        id, 
        total_amount, 
        currency, 
        fulfillment_status, 
        payment_status,
        created_at,
        store_id,
        items,
        marketplace_stores(name, platform)
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (store_id) {
      ordersQuery = ordersQuery.eq('store_id', store_id);
    }

    const orders = await fetchAllRows(ordersQuery);

    // Fetch listings
    let listingsQuery = supabase
      .from('marketplace_listings')
      .select('id, title, price, stock, status, product_rank, store_id, external_sku');
    
    if (store_id) {
      listingsQuery = listingsQuery.eq('store_id', store_id);
    }

    const listings = await fetchAllRows(listingsQuery);

    // Calculate analytics
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const totalOrders = orders?.length || 0;
    const completedOrders = orders?.filter(o => 
      o.fulfillment_status === 'delivered' || o.fulfillment_status === 'COMPLETED'
    ).length || 0;
    const cancelledOrders = orders?.filter(o => 
      o.fulfillment_status === 'cancelled' || o.fulfillment_status === 'CANCELED'
    ).length || 0;

    // Revenue by day
    const revenueByDay: Record<string, number> = {};
    const ordersByDay: Record<string, number> = {};
    
    orders?.forEach(order => {
      const day = order.created_at.split('T')[0];
      revenueByDay[day] = (revenueByDay[day] || 0) + (order.total_amount || 0);
      ordersByDay[day] = (ordersByDay[day] || 0) + 1;
    });

    // Store breakdown
    const storeStats: Record<string, { revenue: number; orders: number; name: string }> = {};
    orders?.forEach(order => {
      const storeId = order.store_id;
      const storeName = (order.marketplace_stores as any)?.name || 'Unknown';
      if (!storeStats[storeId]) {
        storeStats[storeId] = { revenue: 0, orders: 0, name: storeName };
      }
      storeStats[storeId].revenue += order.total_amount || 0;
      storeStats[storeId].orders += 1;
    });

    // Product rank distribution
    const rankDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, N: 0 };
    listings?.forEach(l => {
      const rank = l.product_rank || 'N';
      rankDist[rank] = (rankDist[rank] || 0) + 1;
    });

    // Stock alerts
    const lowStockProducts = listings?.filter(l => l.stock > 0 && l.stock < 5) || [];
    const outOfStockProducts = listings?.filter(l => l.stock === 0 && l.status === 'active') || [];

    // Top performing products (A-rank)
    const topProducts = listings?.filter(l => l.product_rank === 'A').slice(0, 10) || [];
    
    // Worst performing (D-rank or out of stock)
    const worstProducts = listings?.filter(l => 
      l.product_rank === 'D' || (l.stock === 0 && l.status === 'active')
    ).slice(0, 10) || [];

    // Trend data for charts
    const trendData = Object.entries(revenueByDay)
      .map(([date, revenue]) => ({
        date,
        revenue,
        orders: ordersByDay[date] || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    // Calculate growth with multiple timeframes
    const midPoint = Math.floor(trendData.length / 2);
    const firstHalfRevenue = trendData.slice(0, midPoint).reduce((sum, d) => sum + d.revenue, 0);
    const secondHalfRevenue = trendData.slice(midPoint).reduce((sum, d) => sum + d.revenue, 0);
    const revenueGrowth = firstHalfRevenue > 0 
      ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue * 100).toFixed(1)
      : '0';

    // ========== ADVANCED FORECASTING ENGINE ==========
    
    const dailyRevenues = trendData.map(d => d.revenue);
    const dailyOrders = trendData.map(d => d.orders);
    
    // 1. Exponential Weighted Moving Average (EWMA) - more weight on recent data
    const ewmaAlpha = 0.3; // smoothing factor
    let ewmaRevenue = dailyRevenues[0] || 0;
    dailyRevenues.forEach((rev, i) => {
      if (i > 0) ewmaRevenue = ewmaAlpha * rev + (1 - ewmaAlpha) * ewmaRevenue;
    });
    
    // 2. Linear Regression with R² for trend strength
    let trendStrength = 0;
    let rSquared = 0;
    let slope = 0;
    let intercept = 0;
    
    if (dailyRevenues.length > 2) {
      const n = dailyRevenues.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = dailyRevenues.reduce((a, b) => a + b, 0);
      const sumXY = dailyRevenues.reduce((sum, val, i) => sum + val * i, 0);
      const sumX2 = dailyRevenues.reduce((sum, _, i) => sum + i * i, 0);
      const sumY2 = dailyRevenues.reduce((sum, val) => sum + val * val, 0);
      
      const denominator = n * sumX2 - sumX * sumX;
      if (denominator !== 0) {
        slope = (n * sumXY - sumX * sumY) / denominator;
        intercept = (sumY - slope * sumX) / n;
        
        // Calculate R² (coefficient of determination)
        const meanY = sumY / n;
        const ssTotal = dailyRevenues.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
        const ssRes = dailyRevenues.reduce((sum, val, i) => {
          const predicted = intercept + slope * i;
          return sum + Math.pow(val - predicted, 2);
        }, 0);
        rSquared = ssTotal > 0 ? 1 - (ssRes / ssTotal) : 0;
      }
      trendStrength = slope;
    }
    
    // 3. Volatility with Coefficient of Variation
    const avgDailyRevenue = dailyRevenues.length > 0 
      ? dailyRevenues.reduce((a, b) => a + b, 0) / dailyRevenues.length 
      : 0;
    
    const variance = dailyRevenues.length > 0
      ? dailyRevenues.reduce((sum, val) => sum + Math.pow(val - avgDailyRevenue, 2), 0) / dailyRevenues.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const volatility = avgDailyRevenue > 0 ? stdDev / avgDailyRevenue : 0;
    
    // 4. Weekday pattern analysis for seasonality
    const weekdayTotals: Record<number, { sum: number; count: number }> = {};
    trendData.forEach(d => {
      const dayOfWeek = new Date(d.date).getDay();
      if (!weekdayTotals[dayOfWeek]) weekdayTotals[dayOfWeek] = { sum: 0, count: 0 };
      weekdayTotals[dayOfWeek].sum += d.revenue;
      weekdayTotals[dayOfWeek].count += 1;
    });
    
    const weekdayFactors: Record<number, number> = {};
    Object.entries(weekdayTotals).forEach(([day, data]) => {
      const dayAvg = data.count > 0 ? data.sum / data.count : avgDailyRevenue;
      weekdayFactors[Number(day)] = avgDailyRevenue > 0 ? dayAvg / avgDailyRevenue : 1;
    });
    
    // 5. Monte Carlo Simulation for confidence intervals
    const monteCarloIterations = 1000;
    const simulate7Day = (): number => {
      let total = 0;
      for (let day = 0; day < 7; day++) {
        const baseValue = intercept + slope * (dailyRevenues.length + day);
        const noise = (Math.random() - 0.5) * 2 * stdDev;
        const weekdayFactor = weekdayFactors[(new Date().getDay() + day) % 7] || 1;
        total += Math.max(0, baseValue * weekdayFactor + noise);
      }
      return total;
    };
    
    const simulate30Day = (): number => {
      let total = 0;
      for (let day = 0; day < 30; day++) {
        const baseValue = intercept + slope * (dailyRevenues.length + day);
        const noise = (Math.random() - 0.5) * 2 * stdDev;
        const weekdayFactor = weekdayFactors[(new Date().getDay() + day) % 7] || 1;
        total += Math.max(0, baseValue * weekdayFactor + noise);
      }
      return total;
    };
    
    const simulations7: number[] = [];
    const simulations30: number[] = [];
    for (let i = 0; i < monteCarloIterations; i++) {
      simulations7.push(simulate7Day());
      simulations30.push(simulate30Day());
    }
    
    simulations7.sort((a, b) => a - b);
    simulations30.sort((a, b) => a - b);
    
    const prediction7 = {
      median: simulations7[Math.floor(monteCarloIterations * 0.5)],
      p10: simulations7[Math.floor(monteCarloIterations * 0.1)],
      p90: simulations7[Math.floor(monteCarloIterations * 0.9)],
      mean: simulations7.reduce((a, b) => a + b, 0) / monteCarloIterations,
    };
    
    const prediction30 = {
      median: simulations30[Math.floor(monteCarloIterations * 0.5)],
      p10: simulations30[Math.floor(monteCarloIterations * 0.1)],
      p90: simulations30[Math.floor(monteCarloIterations * 0.9)],
      mean: simulations30.reduce((a, b) => a + b, 0) / monteCarloIterations,
    };
    
    // 6. Multi-factor Confidence Scoring
    const dataPoints = trendData.length;
    const dataQualityScore = Math.min(dataPoints / 14, 1); // 14+ days = 100%
    const volatilityPenalty = Math.max(0, 1 - volatility * 0.7); // High volatility reduces confidence
    const trendFitScore = Math.max(0, rSquared); // R² shows how well trend fits
    const orderVolumeScore = Math.min(totalOrders / 50, 1); // 50+ orders = high confidence
    const consistencyScore = Math.max(0, 1 - (stdDev / Math.max(avgDailyRevenue, 1)) * 0.5);

    // Generate AI insights if API key available
    let aiInsights: string[] = [];
    
    if (lovableApiKey && totalOrders > 0) {
      try {
        const prompt = `Siz marketplace tahlil ekspertisiz. Quyidagi ma'lumotlar asosida 3-4 ta qisqa tavsiya bering (har biri 1 qator):

STATISTIKA (oxirgi ${days} kun):
- Jami daromad: ${totalRevenue.toLocaleString()} UZS
- Buyurtmalar: ${totalOrders} ta (${completedOrders} yakunlangan, ${cancelledOrders} bekor qilingan)
- Konversiya: ${totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0}%
- Daromad o'sishi: ${revenueGrowth}%

MAHSULOTLAR:
- A-rank: ${rankDist.A}, B-rank: ${rankDist.B}, C-rank: ${rankDist.C}, D-rank: ${rankDist.D}
- Kam zaxira: ${lowStockProducts.length} ta
- Tugagan: ${outOfStockProducts.length} ta

Javobni bullet points shaklida bering, har bir tavsiya yangi qatordan boshlansin.`;

        const aiResponse = await fetch(AI_GATEWAY_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: 'Siz marketplace biznes maslahatchisisiz. Javoblaringiz qisqa va amaliy bo\'lsin. O\'zbek tilida javob bering.' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 300,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          aiInsights = content
            .split('\n')
            .filter((line: string) => line.trim().length > 0)
            .map((line: string) => line.replace(/^[-•*]\s*/, '').trim())
            .slice(0, 5);
        }
      } catch (aiError) {
        console.error('AI insights error:', aiError);
      }
    }

    // ========== GENERATE ADVANCED FORECASTS ==========
    
    const avgDailyOrdersCalc = totalOrders / Math.max(days, 1);
    const growthFactor = 1 + parseFloat(revenueGrowth) / 100;

    // Weighted confidence calculation (multi-factor)
    const confidenceWeights = {
      dataQuality: 0.25,
      volatility: 0.25,
      trendFit: 0.20,
      orderVolume: 0.15,
      consistency: 0.15,
    };
    
    const rawConfidence7 = 
      dataQualityScore * confidenceWeights.dataQuality +
      volatilityPenalty * confidenceWeights.volatility +
      trendFitScore * confidenceWeights.trendFit +
      orderVolumeScore * confidenceWeights.orderVolume +
      consistencyScore * confidenceWeights.consistency;
    
    const rawConfidence30 = rawConfidence7 * 0.80; // Long-term predictions less certain
    
    // Use Monte Carlo results for predictions (more statistically robust)
    const forecasts = {
      next_7_days: {
        predicted_revenue: Math.round(prediction7.median),
        predicted_orders: Math.round(avgDailyOrdersCalc * 7 * growthFactor),
        confidence: Math.max(0.35, Math.min(0.95, rawConfidence7)),
        range_low: Math.round(prediction7.p10),
        range_high: Math.round(prediction7.p90),
        ewma_prediction: Math.round(ewmaRevenue * 7),
      },
      next_30_days: {
        predicted_revenue: Math.round(prediction30.median),
        predicted_orders: Math.round(avgDailyOrdersCalc * 30 * growthFactor),
        confidence: Math.max(0.25, Math.min(0.85, rawConfidence30)),
        range_low: Math.round(prediction30.p10),
        range_high: Math.round(prediction30.p90),
        ewma_prediction: Math.round(ewmaRevenue * 30),
      },
    };

    // Store daily analytics
    const today = new Date().toISOString().split('T')[0];
    for (const [storeId, stats] of Object.entries(storeStats)) {
      await supabase
        .from('marketplace_sales_analytics')
        .upsert({
          store_id: storeId,
          date: today,
          orders_count: stats.orders,
          revenue: stats.revenue,
          units_sold: stats.orders, // Approximate
        }, { onConflict: 'store_id,date' });
    }

    // Store forecasts with extended metadata
    for (const [period, forecastData] of Object.entries(forecasts)) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + (period === 'next_7_days' ? 7 : 30));
      const forecastDateStr = forecastDate.toISOString().split('T')[0];
      
      const forecastMeta = {
        range_low: forecastData.range_low,
        range_high: forecastData.range_high,
        ewma_prediction: forecastData.ewma_prediction,
        trend_slope: slope,
        r_squared: rSquared,
        volatility: volatility,
        data_points: dataPoints,
        weekday_factors: weekdayFactors,
        confidence_breakdown: {
          data_quality: Math.round(dataQualityScore * 100),
          volatility: Math.round(volatilityPenalty * 100),
          trend_fit: Math.round(trendFitScore * 100),
          order_volume: Math.round(orderVolumeScore * 100),
          consistency: Math.round(consistencyScore * 100),
        },
      };
      
      await supabase
        .from('marketplace_forecasts')
        .upsert({
          forecast_type: `revenue_${period}`,
          forecast_date: forecastDateStr,
          predicted_value: forecastData.predicted_revenue,
          confidence: forecastData.confidence,
          factors: forecastMeta,
          ai_insights: `${period === 'next_7_days' ? '7' : '30'} kunlik prognoz: ${new Intl.NumberFormat('uz-UZ').format(forecastData.predicted_revenue)} UZS (${Math.round(forecastData.confidence * 100)}% ishonch). Oraliq: ${new Intl.NumberFormat('uz-UZ').format(forecastData.range_low)} - ${new Intl.NumberFormat('uz-UZ').format(forecastData.range_high)} UZS`,
          generated_at: new Date().toISOString(),
        }, { 
          onConflict: 'forecast_type,forecast_date',
          ignoreDuplicates: false 
        });
    }

    result = {
      period: `Oxirgi ${days} kun`,
      summary: {
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        completed_orders: completedOrders,
        cancelled_orders: cancelledOrders,
        conversion_rate: totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : '0',
        avg_order_value: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        revenue_growth: revenueGrowth,
      },
      products: {
        total_listings: listings?.length || 0,
        active_listings: listings?.filter(l => l.status === 'active').length || 0,
        rank_distribution: rankDist,
        low_stock_count: lowStockProducts.length,
        out_of_stock_count: outOfStockProducts.length,
        top_products: topProducts.map(p => ({ id: p.id, title: p.title, rank: p.product_rank })),
        worst_products: worstProducts.map(p => ({ id: p.id, title: p.title, rank: p.product_rank, stock: p.stock })),
      },
      stores: Object.entries(storeStats).map(([id, stats]) => ({
        id,
        name: stats.name,
        revenue: stats.revenue,
        orders: stats.orders,
        share: totalRevenue > 0 ? ((stats.revenue / totalRevenue) * 100).toFixed(1) : '0',
      })),
      trends: trendData,
      forecasts,
      ai_insights: aiInsights,
      generated_at: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
