import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StoreHealthResult {
  store_id: string;
  store_name: string;
  platform: string;
  fulfillment_type: string | null;
  api_connected: boolean;
  error?: string;
  response_time_ms?: number;
}

// Correct Uzum Seller OpenAPI base URL
const UZUM_BASE_URL = 'https://api-seller.uzum.uz/api/seller-openapi';

// Yandex Market Partner API v2 base URL
const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';

// Rate limiting: delay between stores in ms
const STORE_DELAY_MS = 500;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper for fetch with retry on rate limit
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, options);
    
    // If rate limited (429), wait and retry
    if (response.status === 429 && attempt < retries) {
      console.log(`Rate limited, waiting ${RETRY_DELAY_MS * attempt}ms before retry ${attempt + 1}`);
      await delay(RETRY_DELAY_MS * attempt);
      continue;
    }
    
    return response;
  }
  
  // Should never reach here, but just in case
  return fetch(url, options);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { store_id } = await req.json().catch(() => ({}));

    // Get stores to check
    let query = supabase.from('marketplace_stores').select('*').eq('is_active', true);
    if (store_id) {
      query = query.eq('id', store_id);
    }

    const { data: stores, error: storesError } = await query;

    if (storesError) {
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    const results: StoreHealthResult[] = [];

    // Process stores SEQUENTIALLY with delays to avoid rate limiting
    for (let i = 0; i < (stores || []).length; i++) {
      const store = stores![i];
      
      // Add delay between stores (except for the first one)
      if (i > 0) {
        await delay(STORE_DELAY_MS);
      }
      
      const apiKey = Deno.env.get(store.api_key_secret_name);
      
      if (!apiKey) {
        results.push({
          store_id: store.id,
          store_name: store.name,
          platform: store.platform,
          fulfillment_type: store.fulfillment_type,
          api_connected: false,
          error: `API key not configured: ${store.api_key_secret_name}`,
        });
        continue;
      }

      const startTime = Date.now();

      try {
        if (store.platform === 'uzum') {
          // Test Uzum API connection using the orders endpoint (lightweight call)
          const shopId = store.shop_id;
          const url = `${UZUM_BASE_URL}/v2/fbs/orders?shopIds=${shopId}&page=0&size=1`;
          
          console.log(`[${i + 1}/${stores!.length}] Testing Uzum store ${store.name}`);

          const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: {
              'Authorization': apiKey, // NO Bearer prefix for Uzum
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });

          const responseTime = Date.now() - startTime;
          const responseText = await response.text();
          
          console.log(`Uzum response for ${store.name} (${response.status}): ${responseText.substring(0, 200)}`);

          if (response.ok) {
            try {
              const data = JSON.parse(responseText);
              // Check if the response has the expected structure
              if (data.payload !== undefined || data.orders !== undefined) {
                results.push({
                  store_id: store.id,
                  store_name: store.name,
                  platform: store.platform,
                  fulfillment_type: store.fulfillment_type,
                  api_connected: true,
                  response_time_ms: responseTime,
                });
              } else if (data.error) {
                results.push({
                  store_id: store.id,
                  store_name: store.name,
                  platform: store.platform,
                  fulfillment_type: store.fulfillment_type,
                  api_connected: false,
                  error: `API returned error: ${data.error}`,
                  response_time_ms: responseTime,
                });
              } else {
                // Response is OK but unexpected format - still count as connected
                results.push({
                  store_id: store.id,
                  store_name: store.name,
                  platform: store.platform,
                  fulfillment_type: store.fulfillment_type,
                  api_connected: true,
                  response_time_ms: responseTime,
                });
              }
            } catch {
              results.push({
                store_id: store.id,
                store_name: store.name,
                platform: store.platform,
                fulfillment_type: store.fulfillment_type,
                api_connected: false,
                error: `Invalid JSON response: ${responseText.substring(0, 100)}`,
                response_time_ms: responseTime,
              });
            }
          } else if (response.status === 429) {
            results.push({
              store_id: store.id,
              store_name: store.name,
              platform: store.platform,
              fulfillment_type: store.fulfillment_type,
              api_connected: false,
              error: `Rate limited (429) - try again later`,
              response_time_ms: responseTime,
            });
          } else {
            results.push({
              store_id: store.id,
              store_name: store.name,
              platform: store.platform,
              fulfillment_type: store.fulfillment_type,
              api_connected: false,
              error: `API error: ${response.status} - ${responseText.substring(0, 200)}`,
              response_time_ms: responseTime,
            });
          }
        } else if (store.platform === 'yandex') {
          // Test Yandex API v2 connection
          const businessId = store.business_id;
          const campaignId = store.campaign_id || store.fby_campaign_id || store.fbs_campaign_id;
          
          if (!campaignId && !businessId) {
            results.push({
              store_id: store.id,
              store_name: store.name,
              platform: store.platform,
              fulfillment_type: store.fulfillment_type,
              api_connected: false,
              error: 'No campaign ID or business ID configured',
            });
            continue;
          }

          console.log(`[${i + 1}/${stores!.length}] Testing Yandex store ${store.name} with v2 API`);

          // Use v2 API endpoint for campaign info
          let response: Response | null = null;
          let usedEndpoint = '';
          
          if (campaignId) {
            // Try v2 campaign endpoint first (lightweight check)
            usedEndpoint = 'v2/campaigns';
            response = await fetchWithRetry(
              `${YANDEX_API_BASE}/v2/campaigns/${campaignId}`,
              {
                headers: {
                  'Api-Key': apiKey,
                  'Content-Type': 'application/json',
                },
              }
            );
          }
          
          // If campaign endpoint failed, try business endpoint
          if ((!response || !response.ok) && businessId) {
            usedEndpoint = 'v2/businesses';
            response = await fetchWithRetry(
              `${YANDEX_API_BASE}/v2/businesses/${businessId}`,
              {
                headers: {
                  'Api-Key': apiKey,
                  'Content-Type': 'application/json',
                },
              }
            );
          }

          const responseTime = Date.now() - startTime;

          if (response && response.ok) {
            results.push({
              store_id: store.id,
              store_name: store.name,
              platform: store.platform,
              fulfillment_type: store.fulfillment_type,
              api_connected: true,
              response_time_ms: responseTime,
            });
          } else {
            const errorText = response ? await response.text() : 'No response';
            const statusCode = response?.status || 0;
            
            // Check for deprecation error
            let errorMessage = `API error (${usedEndpoint}): ${statusCode} - ${errorText.substring(0, 200)}`;
            if (errorText.includes('NO_ACCESS_BY_DEPRECATION_POLICY')) {
              errorMessage = 'API version deprecated - needs v2 migration';
            }
            
            results.push({
              store_id: store.id,
              store_name: store.name,
              platform: store.platform,
              fulfillment_type: store.fulfillment_type,
              api_connected: false,
              error: errorMessage,
              response_time_ms: responseTime,
            });
          }
        }
      } catch (err) {
        results.push({
          store_id: store.id,
          store_name: store.name,
          platform: store.platform,
          fulfillment_type: store.fulfillment_type,
          api_connected: false,
          error: err instanceof Error ? err.message : 'Connection failed',
          response_time_ms: Date.now() - startTime,
        });
      }
    }

    const connectedCount = results.filter(r => r.api_connected).length;
    const totalCount = results.length;

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_stores: totalCount,
          connected: connectedCount,
          disconnected: totalCount - connectedCount,
        },
        stores: results,
      }),
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
