import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';

interface SupplyRequest {
  id: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  warehouseId: number;
  warehouseName?: string;
  type: string;
  items?: Array<{
    offerId: string;
    name?: string;
    count: number;
    defects?: Array<{
      type: string;
      count: number;
    }>;
  }>;
  destination?: {
    address?: string;
  };
  shipmentDate?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      store_id, 
      action = 'list', 
      supply_request_id,
      items,
      warehouse_id,
      page = 1 
    } = await req.json();

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

    // FBY requires campaign ID
    const campaignId = store.fby_campaign_id || store.campaign_id;
    if (!campaignId) {
      throw new Error('FBY campaign ID not configured');
    }

    console.log(`[yandex-supply-requests] Action: ${action} for ${store.name}`);

    // Action: List supply requests
    if (action === 'list') {
      const response = await fetch(
        `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/first-mile/supply-requests`,
        {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page,
            pageSize: 50,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yandex-supply-requests] List error: ${response.status} - ${errorText}`);
        throw new Error(`Yandex API error: ${response.status}`);
      }

      const data = await response.json();
      const supplyRequests: SupplyRequest[] = data.result?.supplyRequests || [];

      console.log(`[yandex-supply-requests] Found ${supplyRequests.length} supply requests`);

      const pending = supplyRequests.filter(sr => sr.status === 'CREATED' || sr.status === 'CONFIRMED');
      const inTransit = supplyRequests.filter(sr => sr.status === 'IN_TRANSIT');

      return new Response(
        JSON.stringify({
          success: true,
          store: store.name,
          total: supplyRequests.length,
          pending_count: pending.length,
          in_transit_count: inTransit.length,
          supply_requests: supplyRequests.map(sr => ({
            id: sr.id,
            status: sr.status,
            type: sr.type,
            warehouse_id: sr.warehouseId,
            warehouse_name: sr.warehouseName,
            created_at: sr.createdAt,
            updated_at: sr.updatedAt,
            shipment_date: sr.shipmentDate,
            destination: sr.destination?.address,
            items_count: sr.items?.length || 0,
            total_units: sr.items?.reduce((sum, item) => sum + item.count, 0) || 0,
          })),
          paging: data.result?.paging,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get supply request details
    if (action === 'get') {
      if (!supply_request_id) {
        throw new Error('supply_request_id is required');
      }

      const response = await fetch(
        `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/first-mile/supply-requests/${supply_request_id}`,
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
        console.error(`[yandex-supply-requests] Get error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to get supply request: ${response.status}`);
      }

      const data = await response.json();
      const sr = data.result;

      return new Response(
        JSON.stringify({
          success: true,
          supply_request: {
            id: sr.id,
            status: sr.status,
            type: sr.type,
            warehouse_id: sr.warehouseId,
            warehouse_name: sr.warehouseName,
            created_at: sr.createdAt,
            updated_at: sr.updatedAt,
            shipment_date: sr.shipmentDate,
            destination: sr.destination?.address,
            items: sr.items?.map((item: { offerId: string; name?: string; count: number; defects?: Array<{ type: string; count: number }> }) => ({
              offer_id: item.offerId,
              name: item.name,
              count: item.count,
              defects: item.defects,
            })),
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Create supply request
    if (action === 'create') {
      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error('items array is required');
      }
      if (!warehouse_id) {
        throw new Error('warehouse_id is required');
      }

      const response = await fetch(
        `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/first-mile/supply-requests`,
        {
          method: 'PUT',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            warehouseId: warehouse_id,
            items: items.map((item: { offer_id: string; count: number }) => ({
              offerId: item.offer_id,
              count: item.count,
            })),
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yandex-supply-requests] Create error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to create supply request: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[yandex-supply-requests] Created supply request: ${data.result?.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Supply request yaratildi',
          supply_request_id: data.result?.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Confirm supply request
    if (action === 'confirm') {
      if (!supply_request_id) {
        throw new Error('supply_request_id is required');
      }

      const response = await fetch(
        `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/first-mile/supply-requests/${supply_request_id}/confirm`,
        {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yandex-supply-requests] Confirm error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to confirm supply request: ${response.status}`);
      }

      console.log(`[yandex-supply-requests] Confirmed supply request ${supply_request_id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Supply request tasdiqlandi',
          supply_request_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error('[yandex-supply-requests] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
