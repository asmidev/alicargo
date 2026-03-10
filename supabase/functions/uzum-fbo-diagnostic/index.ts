import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UZUM_API_BASE = 'https://api-seller.uzum.uz/api/seller-openapi';
const FINANCE_STATUSES = ['TO_WITHDRAW', 'PROCESSING', 'CANCELED', 'PARTIALLY_CANCELLED'];
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface TestResult {
  label: string;
  url: string;
  httpStatus: number;
  totalElements: number;
  itemCount: number;
  topLevelKeys: string[];
  responseHeaders: Record<string, string>;
  errors: string[];
  sampleItem: unknown;
  rawPreview: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const { store_id, test_all_stores } = body;

    // Get stores to test
    let storesToTest: any[] = [];
    if (test_all_stores) {
      const { data } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('platform', 'uzum')
        .eq('is_active', true);
      storesToTest = data || [];
    } else if (store_id) {
      const { data } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('id', store_id)
        .eq('platform', 'uzum')
        .single();
      if (data) storesToTest = [data];
    } else {
      // Default: test first store of each seller
      const { data } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('platform', 'uzum')
        .eq('is_active', true)
        .order('seller_id')
        .order('created_at');
      if (data) {
        const seen = new Set<string>();
        for (const s of data) {
          const key = s.seller_id || s.id;
          if (!seen.has(key)) {
            seen.add(key);
            storesToTest.push(s);
          }
        }
      }
    }

    if (storesToTest.length === 0) {
      throw new Error('No Uzum stores found to test');
    }

    const allResults: Record<string, TestResult[]> = {};

    for (const store of storesToTest) {
      const apiKey = Deno.env.get(store.api_key_secret_name);
      if (!apiKey) {
        allResults[store.name] = [{
          label: 'SKIPPED - no API key',
          url: '',
          httpStatus: 0,
          totalElements: 0,
          itemCount: 0,
          topLevelKeys: [],
          responseHeaders: {},
          errors: [`Missing secret: ${store.api_key_secret_name}`],
          sampleItem: null,
          rawPreview: '',
        }];
        continue;
      }

      const shopId = parseInt(store.shop_id);
      const headers = { 'Authorization': apiKey, 'Content-Type': 'application/json' };
      const results: TestResult[] = [];

      const now = Date.now();
      const nowSec = Math.floor(now / 1000);

      // Build URL helper
      const buildUrl = (opts: {
        shopId: number;
        statuses?: string[] | null;
        dateFromMs?: number;
        dateToMs?: number;
        dateFromSec?: number;
        dateToSec?: number;
        group?: boolean;
        size?: number;
      }) => {
        const p = new URLSearchParams();
        p.append('shopIds', String(opts.shopId));
        if (opts.statuses) {
          for (const s of opts.statuses) p.append('statuses', s);
        }
        if (opts.dateFromMs !== undefined) p.append('dateFrom', String(opts.dateFromMs));
        if (opts.dateFromSec !== undefined) p.append('dateFrom', String(opts.dateFromSec));
        if (opts.dateToMs !== undefined) p.append('dateTo', String(opts.dateToMs));
        if (opts.dateToSec !== undefined) p.append('dateTo', String(opts.dateToSec));
        if (opts.group !== undefined) p.append('group', String(opts.group));
        p.append('size', String(opts.size || 10));
        p.append('page', '0');
        return `${UZUM_API_BASE}/v1/finance/orders?${p}`;
      };

      // Date ranges
      const ranges = {
        '1d': { ms: now - 1*24*60*60*1000, sec: nowSec - 1*24*60*60 },
        '7d': { ms: now - 7*24*60*60*1000, sec: nowSec - 7*24*60*60 },
        '30d': { ms: now - 30*24*60*60*1000, sec: nowSec - 30*24*60*60 },
        '90d': { ms: now - 90*24*60*60*1000, sec: nowSec - 90*24*60*60 },
        '365d': { ms: now - 365*24*60*60*1000, sec: nowSec - 365*24*60*60 },
      };

      // === TEST MATRIX ===
      const tests: Array<{ label: string; url: string }> = [
        // Group 1: Standard (milliseconds) with statuses — baseline
        { label: 'MS + statuses + 30d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromMs: ranges['30d'].ms, dateToMs: now }) },
        { label: 'MS + statuses + 365d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromMs: ranges['365d'].ms, dateToMs: now }) },

        // Group 2: Seconds instead of milliseconds — CRITICAL TEST
        { label: 'SEC + statuses + 30d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromSec: ranges['30d'].sec, dateToSec: nowSec }) },
        { label: 'SEC + statuses + 365d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromSec: ranges['365d'].sec, dateToSec: nowSec }) },

        // Group 3: No statuses — maybe statuses param restricts results
        { label: 'MS + NO statuses + 30d', url: buildUrl({ shopId, dateFromMs: ranges['30d'].ms, dateToMs: now }) },
        { label: 'SEC + NO statuses + 30d', url: buildUrl({ shopId, dateFromSec: ranges['30d'].sec, dateToSec: nowSec }) },

        // Group 4: group=true — NEVER TESTED, changes response schema entirely
        { label: 'MS + statuses + group=true + 30d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromMs: ranges['30d'].ms, dateToMs: now, group: true }) },
        { label: 'SEC + statuses + group=true + 30d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromSec: ranges['30d'].sec, dateToSec: nowSec, group: true }) },
        { label: 'MS + NO statuses + group=true + 365d', url: buildUrl({ shopId, dateFromMs: ranges['365d'].ms, dateToMs: now, group: true }) },
        { label: 'SEC + NO statuses + group=true + 365d', url: buildUrl({ shopId, dateFromSec: ranges['365d'].sec, dateToSec: nowSec, group: true }) },

        // Group 5: group=false explicit
        { label: 'MS + statuses + group=false + 365d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromMs: ranges['365d'].ms, dateToMs: now, group: false }) },
        { label: 'SEC + statuses + group=false + 365d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromSec: ranges['365d'].sec, dateToSec: nowSec, group: false }) },

        // Group 6: Very small ranges (1d, 7d) — maybe settlement is recent
        { label: 'MS + statuses + 1d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromMs: ranges['1d'].ms, dateToMs: now }) },
        { label: 'MS + statuses + 7d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromMs: ranges['7d'].ms, dateToMs: now }) },
        { label: 'SEC + statuses + 7d', url: buildUrl({ shopId, statuses: FINANCE_STATUSES, dateFromSec: ranges['7d'].sec, dateToSec: nowSec }) },

        // Group 7: Individual statuses — maybe only one status has data
        { label: 'MS + TO_WITHDRAW only + 365d', url: buildUrl({ shopId, statuses: ['TO_WITHDRAW'], dateFromMs: ranges['365d'].ms, dateToMs: now }) },
        { label: 'MS + PROCESSING only + 365d', url: buildUrl({ shopId, statuses: ['PROCESSING'], dateFromMs: ranges['365d'].ms, dateToMs: now }) },

        // Group 8: Expenses endpoint — never properly tested
        // (handled separately below)
      ];

      // Run all tests
      for (const test of tests) {
        await delay(350); // rate limit
        try {
          const resp = await fetch(test.url, { headers });
          const rawText = await resp.text();

          // Extract response headers
          const respHeaders: Record<string, string> = {};
          resp.headers.forEach((v, k) => { respHeaders[k] = v; });

          let parsed: any = {};
          try { parsed = JSON.parse(rawText); } catch { /* not JSON */ }

          // Extract items from all known response shapes
          const items = parsed.orderItems || parsed.payload?.items || parsed.payload?.orderItems || parsed.items || [];
          const totalElements = parsed.totalElements ?? parsed.payload?.totalElements ?? 0;
          const errors = parsed.errors || [];
          const errorMessages = Array.isArray(errors) ? errors.map((e: any) => `${e.code}: ${e.message}`) : [];
          if (parsed.error) errorMessages.push(parsed.error);

          results.push({
            label: test.label,
            url: test.url.replace(apiKey, '***'),
            httpStatus: resp.status,
            totalElements,
            itemCount: Array.isArray(items) ? items.length : 0,
            topLevelKeys: Object.keys(parsed),
            responseHeaders: respHeaders,
            errors: errorMessages,
            sampleItem: Array.isArray(items) && items.length > 0 ? items[0] : null,
            rawPreview: rawText.substring(0, 500),
          });
        } catch (err) {
          results.push({
            label: test.label,
            url: test.url.replace(apiKey, '***'),
            httpStatus: 0,
            totalElements: 0,
            itemCount: 0,
            topLevelKeys: [],
            responseHeaders: {},
            errors: [String(err)],
            sampleItem: null,
            rawPreview: '',
          });
        }
      }

      // === EXPENSES TEST ===
      await delay(350);
      try {
        const expParams = new URLSearchParams();
        expParams.append('shopIds', String(shopId));
        expParams.append('dateFrom', String(ranges['365d'].ms));
        expParams.append('dateTo', String(now));
        expParams.append('size', '10');
        expParams.append('page', '0');
        const expUrl = `${UZUM_API_BASE}/v1/finance/expenses?${expParams}`;
        const expResp = await fetch(expUrl, { headers });
        const expRaw = await expResp.text();
        const expHeaders: Record<string, string> = {};
        expResp.headers.forEach((v, k) => { expHeaders[k] = v; });

        let expParsed: any = {};
        try { expParsed = JSON.parse(expRaw); } catch {}

        const expenses = expParsed.payload?.expenses || expParsed.expenses || expParsed.payload?.items || [];
        results.push({
          label: 'EXPENSES: MS + 365d',
          url: expUrl.replace(apiKey, '***'),
          httpStatus: expResp.status,
          totalElements: expParsed.payload?.totalExpenses ?? expenses.length ?? 0,
          itemCount: Array.isArray(expenses) ? expenses.length : 0,
          topLevelKeys: Object.keys(expParsed),
          responseHeaders: expHeaders,
          errors: expParsed.errors?.map((e: any) => `${e.code}: ${e.message}`) || [],
          sampleItem: Array.isArray(expenses) && expenses.length > 0 ? expenses[0] : null,
          rawPreview: expRaw.substring(0, 500),
        });
      } catch (err) {
        results.push({
          label: 'EXPENSES: MS + 365d',
          url: '',
          httpStatus: 0,
          totalElements: 0,
          itemCount: 0,
          topLevelKeys: [],
          responseHeaders: {},
          errors: [String(err)],
          sampleItem: null,
          rawPreview: '',
        });
      }

      // === EXPENSES with seconds ===
      await delay(350);
      try {
        const expParams2 = new URLSearchParams();
        expParams2.append('shopIds', String(shopId));
        expParams2.append('dateFrom', String(ranges['365d'].sec));
        expParams2.append('dateTo', String(nowSec));
        expParams2.append('size', '10');
        expParams2.append('page', '0');
        const expUrl2 = `${UZUM_API_BASE}/v1/finance/expenses?${expParams2}`;
        const expResp2 = await fetch(expUrl2, { headers });
        const expRaw2 = await expResp2.text();

        let expParsed2: any = {};
        try { expParsed2 = JSON.parse(expRaw2); } catch {}

        const expenses2 = expParsed2.payload?.expenses || expParsed2.expenses || expParsed2.payload?.items || [];
        results.push({
          label: 'EXPENSES: SEC + 365d',
          url: expUrl2.replace(apiKey, '***'),
          httpStatus: expResp2.status,
          totalElements: expenses2.length,
          itemCount: Array.isArray(expenses2) ? expenses2.length : 0,
          topLevelKeys: Object.keys(expParsed2),
          responseHeaders: {},
          errors: expParsed2.errors?.map((e: any) => `${e.code}: ${e.message}`) || [],
          sampleItem: Array.isArray(expenses2) && expenses2.length > 0 ? expenses2[0] : null,
          rawPreview: expRaw2.substring(0, 500),
        });
      } catch {}

      allResults[store.name] = results;

      // Log summary for this store
      const hasData = results.some(r => r.itemCount > 0);
      const hasErrors = results.some(r => r.errors.length > 0);
      console.log(`[diagnostic] ${store.name} (shop ${shopId}): ${results.length} tests, hasData=${hasData}, hasErrors=${hasErrors}`);
    }

    // Build summary
    const summary = {
      stores_tested: storesToTest.length,
      total_tests: Object.values(allResults).reduce((s, r) => s + r.length, 0),
      any_data_found: Object.values(allResults).some(results => results.some(r => r.itemCount > 0)),
      tests_with_data: Object.values(allResults).flat().filter(r => r.itemCount > 0).length,
      tests_with_errors: Object.values(allResults).flat().filter(r => r.errors.length > 0).length,
      unique_http_statuses: [...new Set(Object.values(allResults).flat().map(r => r.httpStatus))],
    };

    console.log(`[diagnostic] SUMMARY:`, JSON.stringify(summary));

    return new Response(JSON.stringify({
      success: true,
      summary,
      results: allResults,
      timestamp: new Date().toISOString(),
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[diagnostic] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
