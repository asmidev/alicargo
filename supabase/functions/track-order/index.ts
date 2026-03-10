import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== 'string' || phone.length < 10) {
      return new Response(JSON.stringify({ error: 'Invalid phone number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean phone - keep only digits and +
    const cleanPhone = phone.replace(/[^\\d+]/g, '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: orders, error } = await supabase
      .from('store_orders')
      .select('id, order_number, status, total_amount, delivery_type, created_at, items')
      .eq('customer_phone', cleanPhone)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Sanitize - only return safe fields
    const sanitized = (orders || []).map(o => ({
      order_number: o.order_number,
      status: o.status,
      total_amount: o.total_amount,
      delivery_type: o.delivery_type,
      created_at: o.created_at,
      items_count: Array.isArray(o.items) ? o.items.length : 0,
    }));

    return new Response(JSON.stringify({ orders: sanitized }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Track order error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
