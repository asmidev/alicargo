import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_LIMIT = 50;
const TIME_BUDGET_MS = 110000; // 110 seconds max runtime

/**
 * process-stock-queue: Processes pending stock sync entries from marketplace_sync_queue
 * 
 * Flow:
 * 1. Get pending entries from queue (limit 50)
 * 2. Mark them as 'processing'
 * 3. Group by product_id and call tashkent-stock-sync
 * 4. Mark as 'processed' or 'failed'
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[process-stock-queue] Starting queue processing...`);

    // 1. Get pending entries
    const { data: pendingItems, error: fetchError } = await supabase
      .from('marketplace_sync_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (fetchError) {
      throw new Error(`Failed to fetch pending items: ${fetchError.message}`);
    }

    if (!pendingItems?.length) {
      console.log(`[process-stock-queue] No pending items in queue`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          result: { 
            processed: 0, 
            failed: 0, 
            message: 'No pending items' 
          } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-stock-queue] Found ${pendingItems.length} pending items`);

    // 2. Mark all as 'processing'
    const itemIds = pendingItems.map(item => item.id);
    const { error: updateError } = await supabase
      .from('marketplace_sync_queue')
      .update({ status: 'processing' })
      .in('id', itemIds);

    if (updateError) {
      console.error(`[process-stock-queue] Failed to mark items as processing:`, updateError);
    }

    // 3. Group by product_id
    const productIds = [...new Set(pendingItems.map(item => item.product_id).filter(Boolean))];
    console.log(`[process-stock-queue] Processing ${productIds.length} unique products`);

    let processedCount = 0;
    let failedCount = 0;
    const results: Array<{ product_id: string; success: boolean; error?: string }> = [];

    // 4. Call tashkent-stock-sync for each product
    for (const productId of productIds) {
      // Check time budget
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log(`[process-stock-queue] Time budget exceeded, stopping. Processed: ${processedCount}`);
        break;
      }

      try {
        console.log(`[process-stock-queue] Syncing product ${productId}`);

        // Call tashkent-stock-sync directly with internal service call
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/tashkent-stock-sync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'push',
            product_id: productId,
          }),
        });

        const syncResult = await syncResponse.json();

        if (!syncResponse.ok || !syncResult.success) {
          throw new Error(syncResult.error || 'Sync failed');
        }

        // Mark queue items for this product as processed
        const productItemIds = pendingItems
          .filter(item => item.product_id === productId)
          .map(item => item.id);

        await supabase
          .from('marketplace_sync_queue')
          .update({ 
            status: 'processed', 
            processed_at: new Date().toISOString() 
          })
          .in('id', productItemIds);

        processedCount += productItemIds.length;
        results.push({ product_id: productId, success: true });
        console.log(`[process-stock-queue] Successfully synced product ${productId}`);

      } catch (syncError) {
        const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown error';
        console.error(`[process-stock-queue] Failed to sync product ${productId}:`, errorMessage);

        // Mark queue items for this product as failed
        const productItemIds = pendingItems
          .filter(item => item.product_id === productId)
          .map(item => item.id);

        await supabase
          .from('marketplace_sync_queue')
          .update({ 
            status: 'failed', 
            processed_at: new Date().toISOString(),
            error_message: errorMessage,
          })
          .in('id', productItemIds);

        failedCount += productItemIds.length;
        results.push({ product_id: productId, success: false, error: errorMessage });
      }
    }

    // Handle items without product_id (mark as failed)
    const noProductItems = pendingItems.filter(item => !item.product_id);
    if (noProductItems.length > 0) {
      const noProductIds = noProductItems.map(item => item.id);
      await supabase
        .from('marketplace_sync_queue')
        .update({ 
          status: 'failed', 
          processed_at: new Date().toISOString(),
          error_message: 'No product_id specified',
        })
        .in('id', noProductIds);
      
      failedCount += noProductIds.length;
      console.log(`[process-stock-queue] Marked ${noProductIds.length} items without product_id as failed`);
    }

    const result = {
      processed: processedCount,
      failed: failedCount,
      products_synced: productIds.length,
      duration_ms: Date.now() - startTime,
      results,
    };

    console.log(`[process-stock-queue] Completed:`, result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[process-stock-queue] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
