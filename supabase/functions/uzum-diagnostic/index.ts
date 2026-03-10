import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UZUM_API_BASE = 'https://api-seller.uzum.uz/api/seller-openapi';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action = 'finance_diagnostic' } = await req.json().catch(() => ({}));

    // Get all Uzum stores
    const { data: stores } = await supabase
      .from('marketplace_stores')
      .select('id, name, shop_id, seller_id, platform, api_key_secret_name')
      .eq('platform', 'uzum')
      .eq('is_active', true);

    if (!stores?.length) {
      return new Response(JSON.stringify({ error: 'No active Uzum stores found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();
    const thirtyDays = now - (30 * 24 * 60 * 60 * 1000);
    const sixMonths = now - (180 * 24 * 60 * 60 * 1000);
    const oneYear = now - (365 * 24 * 60 * 60 * 1000);
    const results: any[] = [];

    // Use first store for parameter variation tests
    const testStore = stores[0];
    const apiKey = Deno.env.get(testStore.api_key_secret_name) || '';
    const shopId = testStore.shop_id;
    const sellerId = testStore.seller_id;

    console.log(`Testing store: ${testStore.name}, shopId: ${shopId}, sellerId: ${sellerId}`);

    const tests = [
      // === EXISTING TESTS ===
      // Test 1: Current format (raw auth, shopIds)
      {
        name: '1. Current: raw auth + shopIds, 6mo',
        url: `${UZUM_API_BASE}/v1/finance/orders?shopIds=${shopId}&statuses=TO_WITHDRAW&statuses=PROCESSING&statuses=CANCELED&statuses=PARTIALLY_CANCELLED&dateFrom=${sixMonths}&dateTo=${now}&size=10&page=0`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
      // Test 2: 1yr range
      {
        name: '2. Current: raw auth + shopIds, 1yr',
        url: `${UZUM_API_BASE}/v1/finance/orders?shopIds=${shopId}&statuses=TO_WITHDRAW&statuses=PROCESSING&statuses=CANCELED&statuses=PARTIALLY_CANCELLED&dateFrom=${oneYear}&dateTo=${now}&size=10&page=0`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
      // Test 3: No statuses, 6mo
      {
        name: '3. No statuses, 6mo',
        url: `${UZUM_API_BASE}/v1/finance/orders?shopIds=${shopId}&dateFrom=${sixMonths}&dateTo=${now}&size=10&page=0`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
      // Test 4: No statuses, 1yr
      {
        name: '4. No statuses, 1yr',
        url: `${UZUM_API_BASE}/v1/finance/orders?shopIds=${shopId}&dateFrom=${oneYear}&dateTo=${now}&size=10&page=0`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },

      // === NEW TESTS FROM PLAN ===
      // Test 5: group=true, 6mo
      {
        name: '5. NEW: group=true, 6mo',
        url: `${UZUM_API_BASE}/v1/finance/orders?shopIds=${shopId}&statuses=TO_WITHDRAW&statuses=PROCESSING&statuses=CANCELED&statuses=PARTIALLY_CANCELLED&dateFrom=${sixMonths}&dateTo=${now}&size=10&page=0&group=true`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
      // Test 6: group=true, 1yr
      {
        name: '6. NEW: group=true, 1yr',
        url: `${UZUM_API_BASE}/v1/finance/orders?shopIds=${shopId}&statuses=TO_WITHDRAW&statuses=PROCESSING&statuses=CANCELED&statuses=PARTIALLY_CANCELLED&dateFrom=${oneYear}&dateTo=${now}&size=10&page=0&group=true`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
      // Test 7: Seller-level invoices (no shopId)
      {
        name: '7. NEW: GET /v1/invoice (seller-level)',
        url: `${UZUM_API_BASE}/v1/invoice?page=0&size=10`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
      // Test 8: Seller-level returns (no shopId)
      {
        name: '8. NEW: GET /v1/return (seller-level)',
        url: `${UZUM_API_BASE}/v1/return?page=0&size=10`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
      // Test 9: FBS invoices with statuses
      {
        name: '9. NEW: GET /v1/fbs/invoice (FBS invoices)',
        url: `${UZUM_API_BASE}/v1/fbs/invoice?statuses=NEW&statuses=IN_PROGRESS&statuses=COMPLETED&page=0&size=10`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
      // Test 10: 30-day range, no statuses
      {
        name: '10. NEW: No statuses, 30 days only',
        url: `${UZUM_API_BASE}/v1/finance/orders?shopIds=${shopId}&dateFrom=${thirtyDays}&dateTo=${now}&size=10&page=0`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
      // Test 11: Finance expenses endpoint
      {
        name: '11. NEW: GET /v1/finance/expenses',
        url: `${UZUM_API_BASE}/v1/finance/expenses?shopIds=${shopId}&dateFrom=${sixMonths}&dateTo=${now}&size=10&page=0`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
      // Test 12: CONTROL - FBS orders (should work)
      {
        name: '12. CONTROL: /v2/fbs/orders (should work)',
        url: `${UZUM_API_BASE}/v2/fbs/orders?shopId=${shopId}&dateFrom=${new Date(sixMonths).toISOString()}&dateTo=${new Date(now).toISOString()}&limit=5&offset=0`,
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      },
    ];

    for (const test of tests) {
      try {
        const fetchOpts: RequestInit = {
          method: test.method || 'GET',
          headers: test.headers,
        };
        if ((test as any).body) fetchOpts.body = (test as any).body;

        const resp = await fetch(test.url, fetchOpts);
        const text = await resp.text();
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch {}

        results.push({
          test: test.name,
          status: resp.status,
          totalElements: parsed?.totalElements ?? parsed?.payload?.totalElements ?? 'N/A',
          itemCount: parsed?.orderItems?.length ?? parsed?.payload?.items?.length ?? parsed?.items?.length ?? parsed?.content?.length ?? 'N/A',
          responsePreview: text.substring(0, 500),
        });
      } catch (err) {
        results.push({ test: test.name, status: 'ERROR', error: String(err) });
      }
      await new Promise(r => setTimeout(r, 250));
    }

    // Test ALL stores with current format
    const allStoreResults: any[] = [];
    for (const store of stores) {
      try {
        const storeApiKey = Deno.env.get(store.api_key_secret_name) || '';
        const url = `${UZUM_API_BASE}/v1/finance/orders?shopIds=${store.shop_id}&statuses=TO_WITHDRAW&statuses=PROCESSING&statuses=CANCELED&statuses=PARTIALLY_CANCELLED&dateFrom=${oneYear}&dateTo=${now}&size=10&page=0`;
        const resp = await fetch(url, {
          headers: { 'Authorization': storeApiKey, 'Content-Type': 'application/json' },
        });
        const data = await resp.json();
        allStoreResults.push({
          store: store.name,
          shop_id: store.shop_id,
          seller_id: store.seller_id,
          status: resp.status,
          totalElements: data.totalElements ?? 0,
          itemCount: data.orderItems?.length ?? 0,
          responsePreview: JSON.stringify(data).substring(0, 200),
        });
      } catch (err) {
        allStoreResults.push({ store: store.name, error: String(err) });
      }
      await new Promise(r => setTimeout(r, 250));
    }

    return new Response(JSON.stringify({
      test_store: { name: testStore.name, shop_id: shopId, seller_id: sellerId },
      parameter_tests: results,
      all_stores_finance_test: allStoreResults,
      timestamp: new Date().toISOString(),
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
