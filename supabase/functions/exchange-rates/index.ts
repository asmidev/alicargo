import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse exchange rate from Ipak Yo'li Bank HTML
// Supports multi-line HTML structure with data-test="currency-name", "currency-buy", "currency-sell"
function parseIpakYoliRates(html: string): Record<string, { buy: number; sell: number }> {
  const rates: Record<string, { buy: number; sell: number }> = {};

  // Strategy 1: Match <td data-test="currency-name">...<span...>$</span> USD name...</td>
  // followed by <td data-test="currency-buy">12 090</td> <td data-test="currency-sell">12 200</td>
  // Using 's' flag for multiline (dotAll)
  const rowRegex = /<td[^>]*data-test="currency-name"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>\s*([^<]+?)\s*<\/td>\s*<td[^>]*data-test="currency-buy"[^>]*>([\d\s]+)<\/td>\s*<td[^>]*data-test="currency-sell"[^>]*>([\d\s]+)<\/td>/g;

  let match;
  let found = false;
  while ((match = rowRegex.exec(html)) !== null) {
    found = true;
    const symbol = match[1].trim();
    const name = match[2].trim();
    const buy = parseInt(match[3].replace(/\s/g, ''), 10);
    const sell = parseInt(match[4].replace(/\s/g, ''), 10);

    console.log(`Parsed (strategy 1): symbol="${symbol}" name="${name}" buy=${buy} sell=${sell}`);

    if (symbol === '$' || name.toLowerCase().includes('dollar') || name.toLowerCase().includes('usd')) {
      rates.USD = { buy, sell };
    } else if (symbol === '€' || name.toLowerCase().includes('euro')) {
      rates.EUR = { buy, sell };
    } else if (symbol === '₽' || name.toLowerCase().includes('rubl')) {
      rates.RUB = { buy, sell };
    } else if (name.toLowerCase().includes('yuan') || name.toLowerCase().includes('xitoy') || symbol === '¥') {
      rates.CNY = { buy, sell };
    }
  }

  // Strategy 2: Fallback — look for buy/sell pairs near currency names without data-test attributes
  if (!found) {
    console.log('Strategy 1 found no matches, trying strategy 2...');
    // Try to find USD rate from any table row containing "dollar" or "$"
    const usdRegex = /(?:dollar|AQSh|USD|usd)[\s\S]{0,200}?([\d\s]{5,8})<[\s\S]{0,50}?>([\d\s]{5,8})</gi;
    const usdMatch = usdRegex.exec(html);
    if (usdMatch) {
      const buy = parseInt(usdMatch[1].replace(/\s/g, ''), 10);
      const sell = parseInt(usdMatch[2].replace(/\s/g, ''), 10);
      if (buy > 1000 && sell > 1000) {
        rates.USD = { buy, sell };
        console.log(`Parsed (strategy 2): USD buy=${buy} sell=${sell}`);
      }
    }
  }

  return rates;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('force') === 'true';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for manual rate first — manual rate overrides everything
    const { data: manualRate } = await supabase
      .from('exchange_rates_history')
      .select('*')
      .eq('is_manual', true)
      .eq('source', 'manual')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (manualRate) {
      console.log('Using manual exchange rate');
      const rates = manualRate.rates as Record<string, number>;
      return new Response(JSON.stringify({
        USD: 1,
        CNY: rates.CNY || 7.25,
        UZS: rates.UZS || 12700,
        UZS_BUY: rates.UZS_BUY || rates.UZS || 12700,
        UZS_SELL: rates.UZS_SELL || rates.UZS || 12700,
        lastUpdated: manualRate.fetched_at,
        source: 'manual',
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for cached rates (less than 1 hour old) — skip if force=true
    if (!forceRefresh) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentRates } = await supabase
      .from('exchange_rates_history')
      .select('*')
      .eq('is_manual', false)
      .gte('fetched_at', oneHourAgo)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (recentRates) {
      console.log('Using cached exchange rates from database');
      const rates = recentRates.rates as Record<string, number>;
      return new Response(JSON.stringify({
        USD: 1,
        CNY: rates.CNY || 7.25,
        UZS: rates.UZS || 12700,
        UZS_BUY: rates.UZS_BUY || rates.UZS || 12700,
        UZS_SELL: rates.UZS_SELL || rates.UZS || 12700,
        lastUpdated: recentRates.fetched_at,
        source: recentRates.source || 'ipak_yoli',
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    } // end forceRefresh check

    // Fetch rates: CBU official (USD + CNY kunlik kurslar)
    console.log('Fetching exchange rates from CBU (USD + CNY)...');
    
    const [cbuUsdResponse, cbuCnyResponse] = await Promise.all([
      fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/'),
      fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/CNY/'),
    ]);

    let uzsRate = 12700;
    let uzsBuy = 12700;
    let uzsSell = 12700;
    let cnyToUzs = 1750;
    let sourceUsed = 'cbu';

    // Parse CBU JSON for USD rate (rasmiy kurs)
    if (cbuUsdResponse.ok) {
      const cbuData = await cbuUsdResponse.json();
      if (Array.isArray(cbuData) && cbuData.length > 0 && cbuData[0].Rate) {
        const cbuUsdRate = parseFloat(cbuData[0].Rate);
        uzsRate = cbuUsdRate;
        uzsBuy = cbuUsdRate;
        uzsSell = cbuUsdRate;
        console.log(`CBU USD rate: 1 USD = ${cbuUsdRate} UZS`);
      }
    }

    // Parse CBU JSON for CNY rate (rasmiy yuan kursi)
    if (cbuCnyResponse.ok) {
      const cbuData = await cbuCnyResponse.json();
      if (Array.isArray(cbuData) && cbuData.length > 0 && cbuData[0].Rate) {
        cnyToUzs = parseFloat(cbuData[0].Rate);
        console.log(`CBU CNY rate: 1 CNY = ${cnyToUzs} UZS`);
      }
    }

    // Calculate CNY per USD for storage
    const cnyPerUsd = uzsRate / cnyToUzs;

    // Store rates in history
    const { error: insertError } = await supabase
      .from('exchange_rates_history')
      .insert({
        base_currency: 'USD',
        rates: { 
          CNY: parseFloat(cnyPerUsd.toFixed(4)), 
          UZS: uzsRate,
          UZS_BUY: uzsBuy,
          UZS_SELL: uzsSell,
          CNY_TO_UZS: cnyToUzs,
        },
        fetched_at: new Date().toISOString(),
        source: sourceUsed,
        is_manual: false,
      });

    if (insertError) {
      console.error('Failed to store exchange rates:', insertError);
    }

    const result = {
      USD: 1,
      CNY: parseFloat(cnyPerUsd.toFixed(4)),
      UZS: uzsRate,
      UZS_BUY: uzsBuy,
      UZS_SELL: uzsSell,
      lastUpdated: new Date().toISOString(),
      source: sourceUsed,
      cached: false,
    };

    console.log('Exchange rates fetched:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching exchange rates:', errorMessage);

    // Fallback: try DB
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: fallbackRates } = await supabase
        .from('exchange_rates_history')
        .select('*')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single();

      if (fallbackRates) {
        const rates = fallbackRates.rates as Record<string, number>;
        return new Response(JSON.stringify({
          USD: 1,
          CNY: rates.CNY || 7.25,
          UZS: rates.UZS || 12700,
          lastUpdated: fallbackRates.fetched_at,
          source: fallbackRates.source || 'fallback',
          error: errorMessage,
          fallback: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (dbError) {
      console.error('Failed to get fallback rates:', dbError);
    }

    return new Response(JSON.stringify({
      USD: 1,
      CNY: 7.25,
      UZS: 12700,
      lastUpdated: null,
      source: 'hardcoded',
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
