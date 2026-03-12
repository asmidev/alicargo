import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

function generateMockAnalysis(metrics: any, type: string) {
  return {
    summary: "AI tahlil xizmati (OpenAI API Key topilmadi ushbu muhitda). Shunga qaramay, ma'lumotlaringiz asosida yuzaki tahlil ishlab chiqildi. To'liq va chuqur AI tahlili uchun Supabase ustlamasiga OPENAI_API_KEY ni kiriting.",
    insights: [
      {
        title: "Daromad holati",
        description: `Joriy davr uchun umumiy daromad taxminan $${(Math.round(metrics.grossRevenueUSD) || 0).toLocaleString()} ni tashkil etmoqda.`,
        impact: "positive",
        priority: "low"
      },
      {
        title: "Xarajatlar",
        description: `Vositachilik va bekor qilish xarajatlariga e'tibor qarating, ular yalpi tushumning ma'lum qismini yemoqda.`,
        impact: "negative",
        priority: "medium"
      }
    ],
    recommendations: [
      {
        action: "Qaytarish (vozvrat) sabablarini o'rganish",
        expectedImpact: "Sotuv daromadi va reytingni 15% gacha oshirish",
        difficulty: "medium"
      },
      {
        action: "Foyda marjasini qayta hisoblash",
        expectedImpact: "Eng ko'p sotilayotgan 10 ta tovardan keladigan foydani maksimallashtirish",
        difficulty: "easy"
      }
    ],
    metrics: {
      healthScore: 78,
      riskLevel: "medium",
      trend: "stable"
    }
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { analysisType, startDate, endDate, forceRefresh } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Bazaviy raqamlarni olish (Misol sifatida buyurtmalar va tranzaksiyalar olinadi)
    let orderQuery = supabase.from("marketplace_orders").select("total_price, commission_amount, status, platform, store_name, created_at");
    
    if (startDate) orderQuery = orderQuery.gte("created_at", startDate);
    if (endDate) orderQuery = orderQuery.lte("created_at", endDate);

    const { data: orders } = await orderQuery;

    // Eng oddiy metrikalarni hisoblash
    const rawMetrics: any = {
      totalGrossRevenue: 0,
      totalCommission: 0,
      totalNetRevenue: 0,
      totalOrders: 0,
      totalDelivered: 0,
      totalCancelled: 0,
      deliveryRate: 0,
      cancellationRate: 0,
      grossRevenueUSD: 0,
      netRevenueUSD: 0,
      commissionUSD: 0,
      avgCommissionRate: 0,
      uzsRate: 12800,
      storeMetrics: {},
      platformMetrics: {},
      monthlyData: {},
      expenseByCategory: {
        "Komissiya (Marketplace)": 0,
        "Logistika": 0,
      }
    };

    if (orders) {
      rawMetrics.totalOrders = orders.length;
      
      orders.forEach(o => {
        const rev = Number(o.total_price) || 0;
        const comm = Number(o.commission_amount) || 0;
        const net = rev - comm;

        rawMetrics.totalGrossRevenue += rev;
        rawMetrics.totalCommission += comm;
        rawMetrics.totalNetRevenue += net;

        rawMetrics.expenseByCategory["Komissiya (Marketplace)"] += comm;

        if (o.status === "DELIVERED" || String(o.status).toLowerCase().includes("yetkaz")) {
          rawMetrics.totalDelivered++;
        } else if (o.status === "RETURNED" || String(o.status).toLowerCase().includes("bekor")) {
          rawMetrics.totalCancelled++;
        }

        // Store Aggregation
        const storeName = o.store_name || "Noma'lum";
        if (!rawMetrics.storeMetrics[storeName]) {
          rawMetrics.storeMetrics[storeName] = { name: storeName, platform: o.platform, grossRevenueUSD: 0, netRevenueUSD: 0, commissionUSD: 0, orders: 0 };
        }
        rawMetrics.storeMetrics[storeName].grossRevenueUSD += (rev / rawMetrics.uzsRate);
        rawMetrics.storeMetrics[storeName].netRevenueUSD += (net / rawMetrics.uzsRate);
        rawMetrics.storeMetrics[storeName].commissionUSD += (comm / rawMetrics.uzsRate);
        rawMetrics.storeMetrics[storeName].orders++;

        // Platform Aggregation
        const plat = o.platform || "uzum";
        if (!rawMetrics.platformMetrics[plat]) {
          rawMetrics.platformMetrics[plat] = { grossRevenue: 0, netRevenue: 0, commission: 0, stores: new Set() };
        }
        rawMetrics.platformMetrics[plat].grossRevenue += rev;
        rawMetrics.platformMetrics[plat].netRevenue += net;
        rawMetrics.platformMetrics[plat].commission += comm;
        rawMetrics.platformMetrics[plat].stores.add(storeName);

        // Monthly Aggregation
        if (o.created_at) {
          const m = o.created_at.substring(0, 7); // YYYY-MM
          if (!rawMetrics.monthlyData[m]) {
            rawMetrics.monthlyData[m] = { grossRevenue: 0, netRevenue: 0, commission: 0, orders: 0, delivered: 0 };
          }
          rawMetrics.monthlyData[m].grossRevenue += rev;
          rawMetrics.monthlyData[m].netRevenue += net;
          rawMetrics.monthlyData[m].commission += comm;
          rawMetrics.monthlyData[m].orders++;
        }
      });
      
      rawMetrics.grossRevenueUSD = rawMetrics.totalGrossRevenue / rawMetrics.uzsRate;
      rawMetrics.netRevenueUSD = rawMetrics.totalNetRevenue / rawMetrics.uzsRate;
      rawMetrics.commissionUSD = rawMetrics.totalCommission / rawMetrics.uzsRate;
      rawMetrics.avgCommissionRate = rawMetrics.totalGrossRevenue > 0 ? (rawMetrics.totalCommission / rawMetrics.totalGrossRevenue) * 100 : 0;
      rawMetrics.deliveryRate = rawMetrics.totalOrders > 0 ? (rawMetrics.totalDelivered / rawMetrics.totalOrders) * 100 : 0;
      rawMetrics.cancellationRate = rawMetrics.totalOrders > 0 ? (rawMetrics.totalCancelled / rawMetrics.totalOrders) * 100 : 0;
      
      Object.keys(rawMetrics.platformMetrics).forEach(k => {
        rawMetrics.platformMetrics[k].stores = rawMetrics.platformMetrics[k].stores.size;
      });
    }

    // OpenAI Tahlil chaqiruvi
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    let analysis;

    if (apiKey && apiKey.length > 10) {
      // Prompt tuzish
      const systemPrompt = `Siz ecommerce va bozorlarni (Uzum Market, Yandex Market) tahlil qiluvchi professional moliyaviy AI uzb tilida yordamchisiz. Quyidagi metrikalar o'rganib chiqib JSON formatida qaytaring: { "summary": "...", "insights": [{ "title": "...", "description": "...", "impact": "positive|negative|neutral", "priority": "high|medium|low" }], "recommendations": [{ "action": "...", "expectedImpact": "...", "difficulty": "easy|medium|hard" }], "metrics": { "healthScore": 0-100, "riskLevel": "low|medium|high", "trend": "improving|stable|declining" } }.`;
      const userPrompt = `Iltimos quyidagi platforma va do'konlarning savdo natijalarini tahlil qiling:
      Jami Dastlabki Daromad: $${Math.round(rawMetrics.grossRevenueUSD)}
      Sof Daromad: $${Math.round(rawMetrics.netRevenueUSD)}
      Komissiya: $${Math.round(rawMetrics.commissionUSD)} (${rawMetrics.avgCommissionRate.toFixed(1)}%)
      Jami Buyurtmalar: ${rawMetrics.totalOrders} ta
      Yetkazildi: ${rawMetrics.deliveryRate.toFixed(1)}%
      Qaytgan (Brak/Otkaz): ${rawMetrics.cancellationRate.toFixed(1)}%
      Platformalar bo'yicha daromad: ${JSON.stringify(rawMetrics.platformMetrics)}
      `;

      try {
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.7
          })
        });

        const jsn = await aiResponse.json();
        if (jsn.choices && jsn.choices[0].message.content) {
          analysis = JSON.parse(jsn.choices[0].message.content);
        } else {
          analysis = generateMockAnalysis(rawMetrics, analysisType);
        }
      } catch (e) {
        console.error("OpenAI xatosi:", e);
        analysis = generateMockAnalysis(rawMetrics, analysisType);
      }
    } else {
      analysis = generateMockAnalysis(rawMetrics, analysisType);
    }

    const output = {
      analysisType,
      analysis,
      rawMetrics,
      generatedAt: new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })
    };

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Analysis Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
