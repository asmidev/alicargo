import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phase = 'status', startDate = '2026-01-01', store_id } = await req.json().catch(() => ({}));

    // Phase: status — return current state
    if (phase === 'status') {
      const { count: ordersCount } = await supabase.from('marketplace_orders').select('*', { count: 'exact', head: true });
      const { count: finSummaryCount } = await supabase.from('marketplace_finance_summary').select('*', { count: 'exact', head: true });
      const { count: returnsCount } = await supabase.from('marketplace_returns').select('*', { count: 'exact', head: true });
      const { count: autoTxCount } = await supabase.from('finance_transactions').select('*', { count: 'exact', head: true }).eq('reference_type', 'marketplace_order');

      return new Response(JSON.stringify({
        success: true,
        phase: 'status',
        counts: {
          orders: ordersCount,
          finance_summary: finSummaryCount,
          returns: returnsCount,
          auto_transactions: autoTxCount,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Phase: clean — delete derived data
    if (phase === 'clean') {
      console.log(`[full-resync] Phase: clean — deleting derived data (before ${startDate})`);
      
      // 0. Delete old orders before startDate
      const { count: deletedOrders } = await supabase
        .from('marketplace_orders')
        .delete()
        .lt('ordered_at', startDate)
        .select('*', { count: 'exact', head: true });
      console.log(`[full-resync] Deleted ${deletedOrders} old orders before ${startDate}`);

      // 1. Delete all marketplace finance summaries
      const { count: deletedFinance } = await supabase
        .from('marketplace_finance_summary')
        .delete()
        .gte('period_date', '2000-01-01')
        .select('*', { count: 'exact', head: true });
      console.log(`[full-resync] Deleted ${deletedFinance} finance summary records`);

      // 2. Delete auto-generated marketplace income transactions
      const { count: deletedTx } = await supabase
        .from('finance_transactions')
        .delete()
        .eq('reference_type', 'marketplace_order')
        .select('*', { count: 'exact', head: true });
      console.log(`[full-resync] Deleted ${deletedTx} auto marketplace transactions`);

      // 3. Delete all marketplace returns
      const { count: deletedReturns } = await supabase
        .from('marketplace_returns')
        .delete()
        .gte('created_at', '2000-01-01')
        .select('*', { count: 'exact', head: true });
      console.log(`[full-resync] Deleted ${deletedReturns} returns`);

      return new Response(JSON.stringify({
        success: true,
        phase: 'clean',
        deleted: {
          old_orders: deletedOrders,
          finance_summary: deletedFinance,
          auto_transactions: deletedTx,
          returns: deletedReturns,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Phase: sync_orders — sync orders for a specific store
    if (phase === 'sync_orders') {
      if (!store_id) throw new Error('store_id required for sync_orders phase');

      const { data: store } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform')
        .eq('id', store_id)
        .single();

      if (!store) throw new Error('Store not found');

      console.log(`[full-resync] Syncing orders for ${store.name} (${store.platform}) from ${startDate}`);

      if (store.platform === 'yandex') {
        // Yandex: use dateFrom chunking
        let nextDateFrom: string | null = startDate;
        let totalSynced = 0;
        let iterations = 0;

        while (nextDateFrom && iterations < 30) {
          iterations++;
          const { data, error } = await supabase.functions.invoke('yandex-orders', {
            body: { store_id, dateFrom: nextDateFrom },
          });

          if (error) {
            console.error(`[full-resync] yandex-orders error:`, error);
            break;
          }

          totalSynced += data?.synced || 0;
          nextDateFrom = data?.nextDateFrom || null;
          console.log(`[full-resync] Yandex iteration ${iterations}: synced=${data?.synced}, next=${nextDateFrom}`);

          if (nextDateFrom) await delay(1000);
        }

        return new Response(JSON.stringify({
          success: true,
          phase: 'sync_orders',
          store: store.name,
          platform: 'yandex',
          totalSynced,
          iterations,
          completed: !nextDateFrom,
          nextDateFrom,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } else if (store.platform === 'uzum') {
        // Uzum: use date_from in epoch ms
        const dateFromMs = new Date(startDate).getTime();
        const { data, error } = await supabase.functions.invoke('uzum-orders', {
          body: {
            store_id,
            action: 'sync',
            date_from: dateFromMs,
            lightweight: false,
            enrich_commission: true,
          },
        });

        if (error) {
          console.error(`[full-resync] uzum-orders error:`, error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          phase: 'sync_orders',
          store: store.name,
          platform: 'uzum',
          result: data?.result,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Phase: sync_finance — recalculate marketplace_finance_summary
    if (phase === 'sync_finance') {
      console.log(`[full-resync] Syncing finance from ${startDate}`);

      const { data, error } = await supabase.functions.invoke('sync-marketplace-finance', {
        body: { date_from: startDate },
      });

      if (error) {
        console.error(`[full-resync] sync-marketplace-finance error:`, error);
      }

      return new Response(JSON.stringify({
        success: true,
        phase: 'sync_finance',
        result: data,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Phase: sync_returns — sync returns for a specific store
    if (phase === 'sync_returns') {
      if (!store_id) throw new Error('store_id required for sync_returns phase');

      const { data: store } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform')
        .eq('id', store_id)
        .single();

      if (!store) throw new Error('Store not found');

      if (store.platform === 'yandex') {
        const { data, error } = await supabase.functions.invoke('yandex-returns', {
          body: { store_id, dateFrom: startDate },
        });
        return new Response(JSON.stringify({
          success: true,
          phase: 'sync_returns',
          store: store.name,
          result: data,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else if (store.platform === 'uzum') {
        const { data, error } = await supabase.functions.invoke('uzum-returns', {
          body: { store_id, dateFrom: startDate },
        });
        return new Response(JSON.stringify({
          success: true,
          phase: 'sync_returns',
          store: store.name,
          result: data,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Phase: list_stores — get all active stores
    if (phase === 'list_stores') {
      const { data: stores } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform, is_active')
        .eq('is_active', true)
        .order('platform');

      return new Response(JSON.stringify({
        success: true,
        phase: 'list_stores',
        stores,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error(`Unknown phase: ${phase}`);

  } catch (error) {
    console.error('[full-resync] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
