import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/paynet-payment/, '');

  // ─── WEBHOOK — Paynet callback ────────────────────────────────────────────
  if (path === '/webhook' || path === '/webhook/') {
    try {
      const body = await req.json();
      console.log('[Paynet Webhook]', JSON.stringify(body));

      const transactionId = body?.transaction_id || body?.transactionId;
      const status        = body?.status;
      const orderId       = body?.order_id || body?.orderId || body?.extra;

      if (!transactionId) {
        return new Response(JSON.stringify({ error: 'No transaction_id' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Map Paynet status → our status
      const paynetStatusMap: Record<string, string> = {
        'SUCCESS': 'paid',
        'PAID':    'paid',
        'FAILED':  'failed',
        'CANCELLED': 'cancelled',
        'EXPIRED': 'expired',
      };

      const paynetStatus = paynetStatusMap[String(status).toUpperCase()] || 'unknown';

      // Update store_orders
      const query = supabase
        .from('store_orders')
        .update({
          paynet_status: paynetStatus,
          paynet_transaction_id: String(transactionId),
        });

      if (orderId) {
        await query.eq('id', orderId);
      } else {
        await query.eq('paynet_transaction_id', String(transactionId));
      }

      // If paid → confirm order
      if (paynetStatus === 'paid') {
        const { data: order } = orderId
          ? await supabase.from('store_orders').select('id, status').eq('id', orderId).maybeSingle()
          : await supabase.from('store_orders').select('id, status').eq('paynet_transaction_id', String(transactionId)).maybeSingle();

        if (order && order.status === 'new') {
          await supabase.from('store_orders').update({ status: 'confirmed' }).eq('id', order.id);
          console.log('[Paynet] Order confirmed:', order.id);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('[Paynet Webhook Error]', err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── CREATE INVOICE ───────────────────────────────────────────────────────
  if (req.method === 'POST' && (path === '' || path === '/')) {
    try {
      const MERCHANT_ID = Deno.env.get('PAYNET_MERCHANT_ID');
      const SECRET_KEY  = Deno.env.get('PAYNET_SECRET_KEY');
      const SERVICE_ID  = Deno.env.get('PAYNET_SERVICE_ID');
      const PAYNET_URL  = Deno.env.get('PAYNET_API_URL') || 'https://api.paynet.uz/v1';

      if (!MERCHANT_ID || !SECRET_KEY || !SERVICE_ID) {
        return new Response(JSON.stringify({
          error: 'Paynet API kalitlari hali sozlanmagan. Iltimos, merchant hisobni yarating va kalitlarni kiriting.'
        }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const body = await req.json();
      const { order_id, amount, customer_phone, customer_name, return_url } = body;

      if (!order_id || !amount) {
        return new Response(JSON.stringify({ error: 'order_id va amount kerak' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify order exists
      const { data: order, error: orderError } = await supabase
        .from('store_orders')
        .select('id, order_number, total_amount, status')
        .eq('id', order_id)
        .maybeSingle();

      if (orderError || !order) {
        return new Response(JSON.stringify({ error: 'Buyurtma topilmadi' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Build Paynet invoice payload
      // NOTE: Actual field names may vary — update when official docs are received
      const invoicePayload = {
        merchant_id: MERCHANT_ID,
        service_id: SERVICE_ID,
        amount: Math.round(amount), // in tiyin (UZS * 100) or UZS — verify with docs
        order_id: order_id,
        description: `AliBrand buyurtma ${order.order_number || order_id}`,
        customer: {
          phone: customer_phone,
          name:  customer_name,
        },
        return_url: return_url || `https://alicargo-joy.lovable.app/order-success/${order_id}`,
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/paynet-payment/webhook`,
      };

      // HMAC-SHA256 signature (common Paynet pattern)
      const signString = `${MERCHANT_ID}${SERVICE_ID}${order_id}${Math.round(amount)}${SECRET_KEY}`;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(SECRET_KEY);
      const msgData = encoder.encode(signString);
      const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
      const signHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

      invoicePayload['signature'] = signHex;

      console.log('[Paynet] Creating invoice for order:', order_id, 'amount:', amount);

      const paynetResponse = await fetch(`${PAYNET_URL}/invoice/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET_KEY}` },
        body: JSON.stringify(invoicePayload),
      });

      const paynetData = await paynetResponse.json();
      console.log('[Paynet] Response:', JSON.stringify(paynetData));

      if (!paynetResponse.ok) {
        return new Response(JSON.stringify({ error: 'Paynet xatoligi', details: paynetData }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Save transaction info to order
      const invoiceUrl = paynetData?.payment_url || paynetData?.redirect_url || paynetData?.url;
      const transactionId = paynetData?.transaction_id || paynetData?.invoice_id || paynetData?.id;

      await supabase.from('store_orders').update({
        paynet_transaction_id: String(transactionId || ''),
        paynet_invoice_url: invoiceUrl || null,
        paynet_status: 'pending',
        payment_type: 'paynet',
      }).eq('id', order_id);

      return new Response(JSON.stringify({
        success: true,
        payment_url: invoiceUrl,
        transaction_id: transactionId,
        raw: paynetData,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
      console.error('[Paynet Error]', err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
