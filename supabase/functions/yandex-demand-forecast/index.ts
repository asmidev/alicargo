import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

interface DemandForecast {
  period: string;
  predicted_orders: number;
  predicted_revenue: number;
  confidence: number;
  factors: string[];
}

interface StockRecommendation {
  sku: string;
  title: string;
  current_stock: number;
  predicted_demand_7d: number;
  predicted_demand_30d: number;
  recommended_reorder: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
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
      action = 'forecast',
      store_id,
      listing_id,
      days = 30,
    } = await req.json();

    let result: any = null;

    if (action === 'store_forecast') {
      // Generate demand forecast for entire store
      if (!store_id) throw new Error('store_id is required');

      const { data: store } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('id', store_id)
        .single();

      if (!store) throw new Error('Store not found');

      // Fetch historical orders
      const historyDays = 60;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - historyDays);

      const orders = await fetchAllRows(
        supabase.from('marketplace_orders').select('*').eq('store_id', store_id).gte('created_at', startDate.toISOString()).order('created_at', { ascending: true })
      );

      // Calculate daily metrics
      const dailyMetrics: Record<string, { orders: number; revenue: number }> = {};
      
      for (const order of orders || []) {
        const day = order.created_at.split('T')[0];
        if (!dailyMetrics[day]) {
          dailyMetrics[day] = { orders: 0, revenue: 0 };
        }
        dailyMetrics[day].orders += 1;
        dailyMetrics[day].revenue += order.total_amount || 0;
      }

      const sortedDays = Object.entries(dailyMetrics).sort((a, b) => a[0].localeCompare(b[0]));
      const avgDailyOrders = sortedDays.reduce((sum, [, m]) => sum + m.orders, 0) / sortedDays.length || 0;
      const avgDailyRevenue = sortedDays.reduce((sum, [, m]) => sum + m.revenue, 0) / sortedDays.length || 0;

      // Calculate trend
      const midPoint = Math.floor(sortedDays.length / 2);
      const firstHalfAvg = sortedDays.slice(0, midPoint).reduce((sum, [, m]) => sum + m.orders, 0) / midPoint || 0;
      const secondHalfAvg = sortedDays.slice(midPoint).reduce((sum, [, m]) => sum + m.orders, 0) / (sortedDays.length - midPoint) || 0;
      const trendMultiplier = firstHalfAvg > 0 ? secondHalfAvg / firstHalfAvg : 1;

      // Generate forecasts
      const forecasts: DemandForecast[] = [];

      // 7-day forecast
      const predicted7dOrders = Math.round(avgDailyOrders * 7 * trendMultiplier);
      const predicted7dRevenue = Math.round(avgDailyRevenue * 7 * trendMultiplier);
      forecasts.push({
        period: '7_days',
        predicted_orders: predicted7dOrders,
        predicted_revenue: predicted7dRevenue,
        confidence: 0.85,
        factors: ['Trend analysis', 'Historical average'],
      });

      // 30-day forecast
      const predicted30dOrders = Math.round(avgDailyOrders * 30 * trendMultiplier);
      const predicted30dRevenue = Math.round(avgDailyRevenue * 30 * trendMultiplier);
      forecasts.push({
        period: '30_days',
        predicted_orders: predicted30dOrders,
        predicted_revenue: predicted30dRevenue,
        confidence: 0.7,
        factors: ['Trend analysis', 'Historical average', 'Seasonal adjustment'],
      });

      // Use AI for insights if available
      let aiInsights = '';
      if (lovableApiKey) {
        const prompt = `Yandex Market do'koni uchun talab prognozi:

DO'KON: ${store.name}
TAHLIL DAVRI: Oxirgi ${historyDays} kun

STATISTIKA:
- Jami buyurtmalar: ${orders?.length || 0}
- O'rtacha kunlik buyurtmalar: ${avgDailyOrders.toFixed(1)}
- O'rtacha kunlik daromad: ${avgDailyRevenue.toFixed(0)} RUB
- Trend ko'rsatkichi: ${((trendMultiplier - 1) * 100).toFixed(1)}% ${trendMultiplier > 1 ? 'o\'sish' : 'pasayish'}

PROGNOZ:
- Keyingi 7 kun: ${predicted7dOrders} buyurtma, ${predicted7dRevenue.toLocaleString()} RUB
- Keyingi 30 kun: ${predicted30dOrders} buyurtma, ${predicted30dRevenue.toLocaleString()} RUB

Quyidagilarni taqdim eting:
1. BOZOR_TAHLILI: Rossiya bozori uchun mavsum va trend tahlili
2. XAVFLAR: Potentsial xavflar va muammolar
3. IMKONIYATLAR: O'sish imkoniyatlari
4. TAVSIYALAR: 3 ta strategik tavsiya

O'zbek tilida qisqa javob bering.`;

        try {
          const aiResponse = await fetch(AI_GATEWAY_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'system', content: 'Siz e-commerce talab prognozi va bozor tahlili ekspertisiz.' },
                { role: 'user', content: prompt },
              ],
              max_tokens: 800,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiInsights = aiData.choices?.[0]?.message?.content || '';
          }
        } catch (aiErr) {
          console.error('AI insights error:', aiErr);
        }
      }

      // Store forecasts in database
      for (const forecast of forecasts) {
        const forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + (forecast.period === '7_days' ? 7 : 30));

        await supabase
          .from('marketplace_forecasts')
          .upsert({
            store_id,
            forecast_type: 'demand',
            forecast_date: forecastDate.toISOString().split('T')[0],
            predicted_value: forecast.predicted_orders,
            confidence: forecast.confidence,
            factors: { trend_multiplier: trendMultiplier, period: forecast.period },
            ai_insights: `${forecast.period}: ${forecast.predicted_orders} orders`,
          }, { onConflict: 'store_id,forecast_type,forecast_date' });
      }

      result = {
        store: store.name,
        analysis_period: `${historyDays} days`,
        historical_metrics: {
          total_orders: orders?.length || 0,
          avg_daily_orders: avgDailyOrders,
          avg_daily_revenue: avgDailyRevenue,
          trend: trendMultiplier > 1 ? 'growing' : 'declining',
          trend_percentage: ((trendMultiplier - 1) * 100).toFixed(1),
        },
        forecasts,
        ai_insights: aiInsights,
        generated_at: new Date().toISOString(),
      };

    } else if (action === 'stock_recommendations') {
      // Generate stock reorder recommendations
      if (!store_id) throw new Error('store_id is required');

      const listings = await fetchAllRows(
        supabase.from('marketplace_listings').select('*').eq('store_id', store_id).eq('status', 'active')
      );

      // Fetch recent order items to calculate sales velocity
      const recentOrders = await fetchAllRows(
        supabase.from('marketplace_orders').select('items, created_at').eq('store_id', store_id).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      );

      // Calculate sales per SKU
      const skuSales: Record<string, number> = {};
      for (const order of recentOrders || []) {
        for (const item of order.items || []) {
          const sku = item.shopSku || item.sku;
          if (sku) {
            skuSales[sku] = (skuSales[sku] || 0) + (item.count || item.quantity || 1);
          }
        }
      }

      const recommendations: StockRecommendation[] = [];

      for (const listing of listings || []) {
        const sku = listing.external_sku;
        const salesLast30d = skuSales[sku] || 0;
        const dailySalesRate = salesLast30d / 30;
        const predicted7d = Math.ceil(dailySalesRate * 7);
        const predicted30d = Math.ceil(dailySalesRate * 30);
        
        const currentStock = listing.stock || 0;
        const daysOfStock = dailySalesRate > 0 ? currentStock / dailySalesRate : 999;

        let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
        let reason = '';
        let recommendedReorder = 0;

        if (currentStock === 0 && salesLast30d > 0) {
          urgency = 'critical';
          reason = 'Zaxira tugagan, sotuvlar yo\'qotilmoqda';
          recommendedReorder = predicted30d + Math.ceil(predicted30d * 0.2); // +20% buffer
        } else if (daysOfStock < 7 && salesLast30d > 0) {
          urgency = 'high';
          reason = `Faqat ${Math.round(daysOfStock)} kunlik zaxira qoldi`;
          recommendedReorder = predicted30d - currentStock + Math.ceil(predicted30d * 0.2);
        } else if (daysOfStock < 14 && salesLast30d > 0) {
          urgency = 'medium';
          reason = `${Math.round(daysOfStock)} kunlik zaxira`;
          recommendedReorder = predicted30d - currentStock;
        } else if (salesLast30d > 0) {
          urgency = 'low';
          reason = 'Zaxira yetarli';
        }

        if (urgency !== 'low' || (salesLast30d > 0 && currentStock < predicted30d)) {
          recommendations.push({
            sku,
            title: listing.title?.substring(0, 50) || sku,
            current_stock: currentStock,
            predicted_demand_7d: predicted7d,
            predicted_demand_30d: predicted30d,
            recommended_reorder: Math.max(0, recommendedReorder),
            urgency,
            reason,
          });
        }
      }

      // Sort by urgency
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

      result = {
        store_id,
        total_listings: listings?.length || 0,
        recommendations_count: recommendations.length,
        critical_count: recommendations.filter(r => r.urgency === 'critical').length,
        high_count: recommendations.filter(r => r.urgency === 'high').length,
        recommendations: recommendations.slice(0, 30),
        generated_at: new Date().toISOString(),
      };

    } else if (action === 'product_forecast') {
      // Forecast demand for a specific product
      if (!listing_id) throw new Error('listing_id is required');

      const { data: listing } = await supabase
        .from('marketplace_listings')
        .select('*, marketplace_stores(name)')
        .eq('id', listing_id)
        .single();

      if (!listing) throw new Error('Listing not found');

      // Get order history for this product
      const orders = await fetchAllRows(
        supabase.from('marketplace_orders').select('items, created_at, total_amount').eq('store_id', listing.store_id).gte('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      );

      // Filter orders containing this SKU
      let totalQuantitySold = 0;
      let totalRevenue = 0;
      const dailySales: Record<string, number> = {};

      for (const order of orders || []) {
        const item = order.items?.find((i: any) => 
          i.shopSku === listing.external_sku || i.sku === listing.external_sku
        );
        if (item) {
          const qty = item.count || item.quantity || 1;
          totalQuantitySold += qty;
          totalRevenue += (item.price || 0) * qty;
          
          const day = order.created_at.split('T')[0];
          dailySales[day] = (dailySales[day] || 0) + qty;
        }
      }

      const activeDays = Object.keys(dailySales).length || 1;
      const avgDailySales = totalQuantitySold / activeDays;

      // Calculate trend
      const sortedDays = Object.entries(dailySales).sort((a, b) => a[0].localeCompare(b[0]));
      const midPoint = Math.floor(sortedDays.length / 2);
      const firstHalfAvg = sortedDays.slice(0, midPoint).reduce((sum, [, qty]) => sum + qty, 0) / midPoint || 0;
      const secondHalfAvg = sortedDays.slice(midPoint).reduce((sum, [, qty]) => sum + qty, 0) / (sortedDays.length - midPoint) || 0;
      const trendMultiplier = firstHalfAvg > 0 ? secondHalfAvg / firstHalfAvg : 1;

      // Forecasts
      const predicted7d = Math.round(avgDailySales * 7 * trendMultiplier);
      const predicted30d = Math.round(avgDailySales * 30 * trendMultiplier);
      const daysOfStock = avgDailySales > 0 ? (listing.stock || 0) / avgDailySales : 999;

      // AI insights
      let aiInsight = '';
      if (lovableApiKey && totalQuantitySold > 0) {
        try {
          const aiResponse = await fetch(AI_GATEWAY_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'system', content: 'Siz mahsulot talab prognozi ekspertisiz.' },
                { role: 'user', content: `Mahsulot: ${listing.title}
Sotuvlar (60 kun): ${totalQuantitySold} dona
O'rtacha kunlik: ${avgDailySales.toFixed(1)}
Trend: ${((trendMultiplier - 1) * 100).toFixed(1)}%
Zaxira: ${listing.stock} dona (${Math.round(daysOfStock)} kunlik)

Qisqa tavsiya bering: zaxirani qachon to'ldirish kerak va qancha miqdorda?` },
              ],
              max_tokens: 200,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiInsight = aiData.choices?.[0]?.message?.content || '';
          }
        } catch (e) {
          console.error('AI error:', e);
        }
      }

      result = {
        listing: {
          id: listing.id,
          title: listing.title,
          sku: listing.external_sku,
          price: listing.price,
          current_stock: listing.stock,
        },
        sales_analysis: {
          total_sold_60d: totalQuantitySold,
          total_revenue_60d: totalRevenue,
          avg_daily_sales: avgDailySales,
          trend_direction: trendMultiplier > 1.05 ? 'growing' : trendMultiplier < 0.95 ? 'declining' : 'stable',
          trend_percentage: ((trendMultiplier - 1) * 100).toFixed(1),
        },
        forecast: {
          predicted_7d: predicted7d,
          predicted_30d: predicted30d,
          days_of_stock: Math.round(daysOfStock),
          stock_status: daysOfStock < 7 ? 'critical' : daysOfStock < 14 ? 'low' : daysOfStock < 30 ? 'medium' : 'good',
        },
        recommended_reorder: predicted30d > (listing.stock || 0) ? predicted30d - (listing.stock || 0) + Math.ceil(predicted30d * 0.2) : 0,
        ai_insight: aiInsight,
        generated_at: new Date().toISOString(),
      };
    }

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
