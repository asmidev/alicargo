import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';

interface YandexWarehouse {
  id: number;
  name: string;
  address?: {
    city?: string;
    street?: string;
    number?: string;
    postcode?: string;
  };
  type?: string;
  partnerId?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { store_id, action = 'list', fulfillment_type = 'fbs' } = await req.json();

    if (!store_id) {
      throw new Error('store_id is required');
    }

    // Get store credentials
    const { data: store, error: storeError } = await supabase
      .from('marketplace_stores')
      .select('*')
      .eq('id', store_id)
      .eq('platform', 'yandex')
      .single();

    if (storeError || !store) {
      throw new Error(`Store not found: ${storeError?.message}`);
    }

    const apiKey = Deno.env.get(store.api_key_secret_name);
    if (!apiKey) {
      throw new Error(`API key not configured: ${store.api_key_secret_name}`);
    }

    const businessId = store.business_id;
    if (!businessId) {
      throw new Error('Business ID not configured for this store');
    }

    console.log(`[yandex-warehouses] Action: ${action} for ${store.name}, type: ${fulfillment_type}`);

    // Action: List warehouses (new v2 API - Feb 2026)
    if (action === 'list') {
      // Use new POST endpoint instead of deprecated GET
      const response = await fetch(
        `${YANDEX_API_BASE}/businesses/${businessId}/warehouses`,
        {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yandex-warehouses] List error: ${response.status} - ${errorText}`);
        throw new Error(`Yandex API error: ${response.status}`);
      }

      const data = await response.json();
      const warehouses: YandexWarehouse[] = data.result?.warehouses || [];

      console.log(`[yandex-warehouses] Found ${warehouses.length} warehouses`);

      return new Response(
        JSON.stringify({
          success: true,
          store: store.name,
          total: warehouses.length,
          warehouses: warehouses.map(w => ({
            id: w.id,
            name: w.name,
            type: w.type,
            partner_id: w.partnerId,
            address: w.address ? {
              city: w.address.city,
              street: w.address.street,
              number: w.address.number,
              postcode: w.address.postcode,
              full: [w.address.city, w.address.street, w.address.number]
                .filter(Boolean)
                .join(', '),
            } : null,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get FBY warehouse slots (for supply requests)
    if (action === 'slots') {
      const campaignId = store.fby_campaign_id || store.campaign_id;
      if (!campaignId) {
        throw new Error('FBY campaign ID not configured');
      }

      const response = await fetch(
        `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/first-mile/warehouses`,
        {
          method: 'GET',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yandex-warehouses] Slots error: ${response.status} - ${errorText}`);
        throw new Error(`Yandex API error: ${response.status}`);
      }

      const data = await response.json();
      const fbyWarehouses = data.result?.warehouses || [];

      console.log(`[yandex-warehouses] Found ${fbyWarehouses.length} FBY warehouses`);

      return new Response(
        JSON.stringify({
          success: true,
          store: store.name,
          fby_warehouses: fbyWarehouses.map((w: { id: number; name: string; address?: { city?: string } }) => ({
            id: w.id,
            name: w.name,
            address: w.address?.city,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get partner FBS warehouses
    if (action === 'partner') {
      const campaignId = store.fbs_campaign_id || store.campaign_id;
      if (!campaignId) {
        throw new Error('Campaign ID not configured');
      }

      // Use business-level endpoint for partner warehouses
      const response = await fetch(
        `${YANDEX_API_BASE}/businesses/${businessId}/warehouses`,
        {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partnerType: 'FBS',
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yandex-warehouses] Partner error: ${response.status} - ${errorText}`);
        throw new Error(`Yandex API error: ${response.status}`);
      }

      const data = await response.json();
      const partnerWarehouses = data.result?.warehouses || [];

      console.log(`[yandex-warehouses] Found ${partnerWarehouses.length} partner FBS warehouses`);

      return new Response(
        JSON.stringify({
          success: true,
          store: store.name,
          partner_warehouses: partnerWarehouses.map((w: YandexWarehouse) => ({
            id: w.id,
            name: w.name,
            type: w.type,
            address: w.address ? {
              city: w.address.city,
              full: [w.address.city, w.address.street, w.address.number]
                .filter(Boolean)
                .join(', '),
            } : null,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error('[yandex-warehouses] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
