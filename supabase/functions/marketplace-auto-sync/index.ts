import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncResult {
  store_id: string;
  store_name: string;
  platform: string;
  sync_type: string;
  success: boolean;
  records_processed: number;
  error?: string;
  duration_ms: number;
}

// Normalize sync_type to match database constraint
// DB allows: orders, listings, stock, prices, full
function normalizeSyncType(syncType: string): string {
  const typeMap: Record<string, string> = {
    'stocks': 'stock',
    'auto_orders': 'orders',
    'auto_listings': 'listings',
    'auto_stock': 'stock',
    'auto_stocks': 'stock',
    'auto_prices': 'prices',
    'auto_full': 'full',
    'commission_enrichment': 'orders',
    'competitor_analysis': 'prices', // Competitor analysis logs as prices type
  };
  return typeMap[syncType] || syncType;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: SyncResult[] = [];
  let totalProcessed = 0;
  let successCount = 0;
  let errorCount = 0;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for sync configuration
    let syncType = "orders"; // default
    let triggerAI = true;
    let sendAlerts = true;
    let isAutoSync = false;
    let maxStores = 0; // 0 = all stores (no limit)

    try {
      const body = await req.json();
      syncType = body.sync_type || "orders";
      triggerAI = body.trigger_ai !== false;
      sendAlerts = body.send_alerts !== false;
      isAutoSync = body.auto === true;
      maxStores = body.max_stores || 0;
    } catch {
      // Use defaults if no body
    }

    // Normalize sync type for logging (stocks -> stock)
    const normalizedSyncType = normalizeSyncType(syncType);
    
    console.log(`[marketplace-auto-sync] Starting ${syncType} (normalized: ${normalizedSyncType}) sync, maxStores=${maxStores || 'all'}`);

    // Get all active stores
    const { data: allStores, error: storesError } = await supabase
      .from("marketplace_stores")
      .select("*")
      .eq("is_active", true)
      .order("platform");

    // For orders auto-sync: sort by actual last ORDER sync from sync_logs (not generic last_sync_at)
    if (syncType === "orders" && isAutoSync && allStores?.length) {
      const { data: lastOrderSyncs } = await supabase
        .from('marketplace_sync_logs')
        .select('store_id, started_at')
        .eq('sync_type', 'orders')
        .eq('status', 'success')
        .order('started_at', { ascending: false });

      // Build map of store_id -> last order sync time
      const lastOrderSyncMap = new Map<string, string>();
      for (const log of lastOrderSyncs || []) {
        if (!lastOrderSyncMap.has(log.store_id)) {
          lastOrderSyncMap.set(log.store_id, log.started_at);
        }
      }

      // Sort: stores with NO order sync first (null), then oldest order sync first
      allStores.sort((a, b) => {
        const aTime = lastOrderSyncMap.get(a.id);
        const bTime = lastOrderSyncMap.get(b.id);
        if (!aTime && !bTime) return 0;
        if (!aTime) return -1; // a never synced orders -> prioritize
        if (!bTime) return 1;
        return aTime < bTime ? -1 : 1; // oldest first
      });

      console.log(`[marketplace-auto-sync] Order rotation priority: ${allStores.slice(0, 5).map(s => `${s.name}(${lastOrderSyncMap.get(s.id)?.slice(11,16) || 'NEVER'})`).join(', ')}`);
    }

    if (storesError) {
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    if (!allStores || allStores.length === 0) {
      console.log("[marketplace-auto-sync] No active stores found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No active stores to sync",
          results: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FIX: Platform-fair round-robin for orders/stock sync to prevent timeout.
    // Ensures at least 1 Yandex store is included per cycle so no platform starves.
    const effectiveMaxStores = ((syncType === "orders" || syncType === "stocks" || syncType === "stock") && isAutoSync) ? (maxStores || 3) : (maxStores || 0);
    let stores;
    if (effectiveMaxStores > 0) {
      // Platform-fair rotation: ensure each platform gets at least 1 slot
      const uzumStores = allStores.filter(s => s.platform === 'uzum');
      const yandexStores = allStores.filter(s => s.platform === 'yandex');
      
      if (uzumStores.length > 0 && yandexStores.length > 0 && effectiveMaxStores >= 2) {
        // Reserve 1 slot for Yandex (least recently synced), rest for round-robin
        const yandexSlots = Math.max(1, Math.min(yandexStores.length, Math.floor(effectiveMaxStores / 3)));
        const uzumSlots = effectiveMaxStores - yandexSlots;
        stores = [...uzumStores.slice(0, uzumSlots), ...yandexStores.slice(0, yandexSlots)];
        console.log(`[marketplace-auto-sync] Platform-fair: ${uzumSlots} Uzum + ${yandexSlots} Yandex slots`);
      } else {
        stores = allStores.slice(0, effectiveMaxStores);
      }
    } else {
      stores = allStores;
    }

    console.log(`[marketplace-auto-sync] Processing ${stores.length}/${allStores.length} stores (round-robin: ${effectiveMaxStores > 0 ? 'yes' : 'no'})`);

    // Global cleanup: 1 soatdan oshiq stuck "running" loglarni tozalash
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stuckLogs } = await supabase
      .from('marketplace_sync_logs')
      .update({
        status: 'error',
        error_message: 'Auto-cleaned: stuck in running state for >1 hour',
        completed_at: new Date().toISOString(),
      })
      .eq('status', 'running')
      .lt('started_at', oneHourAgo)
      .select('id');

    if (stuckLogs?.length) {
      console.log(`[marketplace-auto-sync] Cleaned ${stuckLogs.length} stuck sync logs`);
    }

    // Process each store with retry mechanism
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 2000;
    
    for (const store of stores) {
      let retryCount = 0;
      let syncSuccess = false;
      
      while (retryCount <= MAX_RETRIES && !syncSuccess) {
        const storeStartTime = Date.now();
        
        try {
          if (retryCount > 0) {
            console.log(`[marketplace-auto-sync] Retry ${retryCount}/${MAX_RETRIES} for ${store.name}`);
          } else {
            console.log(`[marketplace-auto-sync] Syncing ${store.name} (${store.platform}) - ${syncType}${isAutoSync ? ' [lightweight]' : ''}`);
          }

          // Determine which function to call based on platform and sync type
          let functionName: string;
          // deno-lint-ignore no-explicit-any
          let data: any = null;
          let error: Error | null = null;
          
          if (syncType === "stocks" || syncType === "stock") {
            // PHASE 10: Yandex product pre-sync skipped for stock-only sync to avoid timeout
            // Listings are synced separately by the listings cron every 30min
            
            // Use dedicated stock functions
            functionName = store.platform === "uzum" ? "uzum-stocks" : "yandex-stocks";
            const result = await supabase.functions.invoke(functionName, {
              body: { store_id: store.id, action: "sync" },
            });
            data = result.data;
            error = result.error;
            
          } else if (syncType === "orders") {
            // Use orders functions — lightweight mode for auto-sync
            functionName = store.platform === "uzum" ? "uzum-orders" : "yandex-orders";
            const orderBody: Record<string, unknown> = { store_id: store.id, action: "sync" };
            if (isAutoSync) {
              // Lightweight: 7 days, skip FBO/commission/enrichment for Uzum
              orderBody.lightweight = true;
              // Yandex: limit to 7 days
              orderBody.days = 7;
            }
            const result = await supabase.functions.invoke(functionName, {
              body: orderBody,
            });
            data = result.data;
            error = result.error;
            
          } else if (syncType === "listings" || syncType === "products") {
            // Use dedicated products functions for listings sync
            functionName = store.platform === "uzum" ? "uzum-products" : "yandex-products";
            const productsResult = await supabase.functions.invoke(functionName, {
              body: { store_id: store.id },
            });
            data = productsResult.data;
            error = productsResult.error;
            
            // FIX 3: For Yandex, also trigger stock sync after products
            if (store.platform === "yandex" && !error) {
              console.log(`[marketplace-auto-sync] Triggering Yandex stock sync for ${store.name}...`);
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const stocksResult = await supabase.functions.invoke("yandex-stocks", {
                body: { store_id: store.id, action: "sync" },
              });
              
              if (stocksResult.data) {
                // Merge stock sync results
                data = {
                  ...productsResult.data,
                  stocks_sync: stocksResult.data,
                };
              }
              
              if (stocksResult.error) {
                console.error(`[marketplace-auto-sync] Yandex stock sync warning:`, stocksResult.error);
              }
            }
          } else if (syncType === "commission_enrichment") {
            // Commission enrichment: only for Uzum stores, resync delivered orders
            if (store.platform === "uzum") {
              functionName = "uzum-orders";
              const result = await supabase.functions.invoke(functionName, {
                body: { store_id: store.id, action: "resync_delivered" },
              });
              data = result.data;
              error = result.error;
            } else {
              // Skip Yandex for commission enrichment (handled by 5% fallback)
              console.log(`[marketplace-auto-sync] Skipping commission enrichment for Yandex store ${store.name}`);
              results.push({
                store_id: store.id,
                store_name: store.name,
                platform: store.platform,
                sync_type: syncType,
                success: true,
                records_processed: 0,
                duration_ms: 0,
              });
              continue;
            }
          } else if (syncType === "competitor_analysis") {
            // Competitor analysis: call platform-specific competitor analysis function
            functionName = store.platform === "uzum" ? "uzum-competitor-analysis" : "yandex-competitor-analysis";
            
          if (store.platform === "uzum") {
              // Uzum: batch analyze top listings with store_id
              const caResult = await supabase.functions.invoke(functionName, {
                body: { action: "batch_analyze", store_id: store.id, limit: 10 },
              });
              data = caResult.data;
              error = caResult.error;
            } else {
              // Yandex: get price position for all active SKUs
              const caResult = await supabase.functions.invoke(functionName, {
                body: { action: "get_price_position", store_id: store.id, limit: 50 },
              });
              data = caResult.data;
              error = caResult.error;
            }
          } else {
            // No handler for this sync_type — skip (legacy yandex-sync removed to prevent data corruption)
            console.log(`[marketplace-auto-sync] No handler for sync_type=${syncType} on ${store.platform}, skipping ${store.name}`);
            results.push({
              store_id: store.id,
              store_name: store.name,
              platform: store.platform,
              sync_type: syncType,
              success: true,
              records_processed: 0,
              duration_ms: Date.now() - storeStartTime,
            });
            syncSuccess = true;
            continue;
          }

          const duration = Date.now() - storeStartTime;

          if (error) {
            console.error(`[marketplace-auto-sync] Error syncing ${store.name}:`, error);
            
            // Retry on certain errors
            if (retryCount < MAX_RETRIES && (error.message?.includes("timeout") || error.message?.includes("429"))) {
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * retryCount));
              continue;
            }
            
            results.push({
              store_id: store.id,
              store_name: store.name,
              platform: store.platform,
              sync_type: syncType,
              success: false,
              records_processed: 0,
              error: error.message,
              duration_ms: duration,
            });
            errorCount++;
            syncSuccess = true; // Exit retry loop on final failure
          } else if (data?.success === false) {
            console.error(`[marketplace-auto-sync] Sync failed for ${store.name}:`, data.error);
            
            // Retry on rate limit errors
            if (retryCount < MAX_RETRIES && data.error?.includes("429")) {
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * retryCount));
              continue;
            }
            
            results.push({
              store_id: store.id,
              store_name: store.name,
              platform: store.platform,
              sync_type: syncType,
              success: false,
              records_processed: data.records_processed || 0,
              error: data.error,
              duration_ms: duration,
            });
            errorCount++;
            syncSuccess = true;
          } else {
          const processed = data?.records_processed || data?.synced || data?.result?.synced || data?.result?.total_orders || data?.result?.stored || data?.result?.analyzed || 0;
            
            // Log fallback diagnostics for Uzum stock sync
            const fallbackUsed = data?.fallback_used || data?.result?.fallback_used;
            const fallbackReturned = data?.result?.fallback_returned || 0;
            const stockApiReturned = data?.result?.stock_api_returned || 0;
            if (fallbackUsed) {
              console.log(`[marketplace-auto-sync] ${store.name}: Stock API returned ${stockApiReturned}, used product API fallback (${fallbackReturned} SKUs)`);
            }
            
            console.log(`[marketplace-auto-sync] Successfully synced ${store.name}: ${processed} records${fallbackUsed ? ' (via fallback)' : ''}`);
            
            // Proactive FBU date cache scan — capture dates before TTL expires
            if (syncType === "orders" && store.platform === "uzum") {
              try {
                console.log(`[marketplace-auto-sync] Scanning recent FBU order dates for ${store.name}...`);
                const scanResult = await supabase.functions.invoke("uzum-finance", {
                  body: { store_id: store.id, action: "scan_recent_fbu_orders" },
                });
                const newlyCached = scanResult.data?.result?.newly_cached || 0;
                if (newlyCached > 0) {
                  console.log(`[marketplace-auto-sync] FBU date scan: ${newlyCached} new dates cached for ${store.name}`);
                }
              } catch (scanErr) {
                console.error(`[marketplace-auto-sync] FBU date scan error for ${store.name}:`, scanErr);
              }
            }

            // FBU orders sync via Finance API for Uzum stores
            // Finance now self-enriches images from listings — runs BEFORE enrichment
            if (syncType === "orders" && store.platform === "uzum") {
              try {
                console.log(`[marketplace-auto-sync] Syncing FBU orders via Finance API for ${store.name}...`);
                const fbuResult = await supabase.functions.invoke("uzum-finance", {
                  body: { store_id: store.id, action: "sync_fbu_orders" },
                });
                const fbuSynced = fbuResult.data?.result?.synced || 0;
                const cacheHits = fbuResult.data?.result?.cache_hits || 0;
                if (fbuSynced > 0) {
                  console.log(`[marketplace-auto-sync] FBU sync: ${fbuSynced} orders (${cacheHits} with real dates) for ${store.name}`);
                  totalProcessed += fbuSynced;
                } else {
                  console.log(`[marketplace-auto-sync] FBU sync: 0 orders for ${store.name} (settlement pending)`);
                }
              } catch (fbuErr) {
                console.error(`[marketplace-auto-sync] FBU sync error for ${store.name}:`, fbuErr);
              }

              // Also run fbo_summary to capture invoices/returns into the database
              try {
                console.log(`[marketplace-auto-sync] Running fbo_summary for ${store.name}...`);
                const fboResult = await supabase.functions.invoke("uzum-finance", {
                  body: { store_id: store.id, action: "fbo_summary" },
                });
                const fboOrders = fboResult.data?.result?.orders_totals?.itemCount || 0;
                const fboInvoices = fboResult.data?.result?.invoices?.length || 0;
                console.log(`[marketplace-auto-sync] FBO summary for ${store.name}: ${fboOrders} order items, ${fboInvoices} invoices`);
              } catch (fboErr) {
                console.error(`[marketplace-auto-sync] FBO summary error for ${store.name}:`, fboErr);
              }
            }

            // Post-finance enrichment: runs LAST to fill any remaining image gaps
            // This ensures enrichment output is never overwritten by finance
            if (syncType === "orders" && store.platform === "uzum") {
              try {
                console.log(`[marketplace-auto-sync] Triggering item enrichment for Uzum store ${store.name}...`);
                await supabase.functions.invoke("uzum-orders", {
                  body: { store_id: store.id, action: "enrich_items" },
                });
              } catch (enrichErr) {
                console.error(`[marketplace-auto-sync] Enrichment error for ${store.name}:`, enrichErr);
              }
            }
            
            results.push({
              store_id: store.id,
              store_name: store.name,
              platform: store.platform,
              sync_type: syncType,
              success: true,
              records_processed: processed,
              duration_ms: duration,
            });
            totalProcessed += processed;
            successCount++;
            syncSuccess = true;
          }

        } catch (storeError) {
          const duration = Date.now() - storeStartTime;
          console.error(`[marketplace-auto-sync] Exception syncing ${store.name}:`, storeError);
          
          // Retry on exceptions
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * retryCount));
            continue;
          }
          
          results.push({
            store_id: store.id,
            store_name: store.name,
            platform: store.platform,
            sync_type: syncType,
            success: false,
            records_processed: 0,
            error: storeError instanceof Error ? storeError.message : "Unknown error",
            duration_ms: duration,
          });
          errorCount++;
          syncSuccess = true;
        }
      }
      
      // Rate limiting: wait 500ms between stores
      if (stores.indexOf(store) < stores.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // REMOVED: Global Tashkent Stock Sync (was overwriting order-based decrements)
    // tashkent_manual_stock is now managed exclusively by:
    // - confirm_arrived_products (increment)
    // - uzum-orders / yandex-orders (decrement on FBS orders)
    // - direct_sales (decrement)
    // - manual inline editing

    // === AUTO-LINKING: Sync tugagandan keyin ulanmagan listinglarni ulash (stock/commission sync uchun skip) ===
    if (successCount > 0 && syncType !== "stocks" && syncType !== "stock" && syncType !== "commission_enrichment") {
      try {
        // Bosqich A: Smart link (barcode/SKU/title orqali mavjud productlarga ulash)
        console.log("[marketplace-auto-sync] Auto-linking Stage A: smart_link...");
        const smartLinkResult = await supabase.functions.invoke("marketplace-link-products", {
          body: { action: "smart_link" },
        });
        const smartLinked = smartLinkResult.data?.result?.linked || 0;
        console.log(`[marketplace-auto-sync] Smart link: ${smartLinked} listings linked`);

        // Bosqich B: Create from listings (qolganlarni yangi product yaratib ulash)
        console.log("[marketplace-auto-sync] Auto-linking Stage B: create_from_listings...");
        const createResult = await supabase.functions.invoke("marketplace-link-products", {
          body: { action: "create_from_listings" },
        });
        const created = createResult.data?.result?.created_products?.length || 0;
        const totalLinked = createResult.data?.result?.total_linked || 0;
        console.log(`[marketplace-auto-sync] Create from listings: ${created} products created, ${totalLinked} listings linked`);
      } catch (linkError) {
        console.error("[marketplace-auto-sync] Auto-linking error:", linkError);
      }
    }

    // Log sync per store so each store appears in sync_logs for accurate rotation tracking
    const syncLogEntries = results.map(r => ({
      store_id: r.store_id,
      sync_type: normalizedSyncType,
      status: r.success ? "success" : "error",
      records_processed: r.records_processed,
      records_created: r.records_processed,
      records_failed: r.success ? 0 : 1,
      error_message: r.error || null,
      error_details: { mode: isAutoSync ? "auto" : "manual", original_sync_type: syncType, duration_ms: r.duration_ms },
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: r.duration_ms,
    }));

    const { error: logError } = syncLogEntries.length > 0
      ? await supabase.from("marketplace_sync_logs").insert(syncLogEntries)
      : { error: null };

    if (logError) {
      console.error("[marketplace-auto-sync] Failed to log sync:", logError);
    }

    // Trigger AI analytics if enabled and sync was successful
    if (triggerAI && successCount > 0 && syncType === "orders") {
      try {
        console.log("[marketplace-auto-sync] Triggering AI analytics...");
        await supabase.functions.invoke("marketplace-ai-analytics", {
          body: { auto_triggered: true },
        });
      } catch (aiError) {
        console.error("[marketplace-auto-sync] AI analytics error:", aiError);
      }
    }

    // Send Telegram alert: errors OR successful orders sync with new records
    if (sendAlerts && (errorCount > 0 || (syncType === "orders" && totalProcessed > 0))) {
      try {
        const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
        if (telegramBotToken) {
          let alertMessage: string;
          
          if (errorCount > 0) {
            alertMessage = `⚠️ Marketplace Auto-Sync\n\n` +
              `Sinxronizatsiya: ${syncType}\n` +
              `Muvaffaqiyatli: ${successCount}/${stores.length}\n` +
              `Xatoliklar: ${errorCount}\n\n` +
              `Xato bo'lgan do'konlar:\n` +
              results
                .filter(r => !r.success)
                .map(r => `• ${r.store_name}: ${r.error}`)
                .join("\n");
          } else {
            // Success notification for orders sync
            alertMessage = `✅ Yangi buyurtmalar sinxronlandi\n\n` +
              `📦 Jami: ${totalProcessed} ta buyurtma\n` +
              `🏪 ${successCount} ta do'kon\n` +
              `⏱ ${Math.round((Date.now() - startTime) / 1000)}s\n\n` +
              results
                .filter(r => r.success && r.records_processed > 0)
                .map(r => `• ${r.store_name}: ${r.records_processed} ta`)
                .join("\n");
          }

          // PHASE 9: Get admin users with telegram_chat_id - verify profiles table query
          const { data: admins, error: adminError } = await supabase
            .from("profiles")
            .select("telegram_chat_id")
            .not("telegram_chat_id", "is", null);
          
          if (adminError) {
            console.error("[marketplace-auto-sync] Error fetching admin Telegram IDs:", adminError);
          }
          console.log(`[marketplace-auto-sync] Found ${admins?.length || 0} admins with Telegram chat IDs`);

          for (const admin of admins || []) {
            if (admin.telegram_chat_id) {
              await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: admin.telegram_chat_id,
                  text: alertMessage.substring(0, 4000),
                  parse_mode: "HTML",
                }),
              });
            }
          }
        }
      } catch (alertError) {
        console.error("[marketplace-auto-sync] Alert error:", alertError);
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[marketplace-auto-sync] Completed in ${totalDuration}ms: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        message: `Synced ${successCount}/${stores.length} stores (${allStores.length} total)`,
        sync_type: syncType,
        summary: {
          total_stores: allStores.length,
          stores_processed: stores.length,
          success_count: successCount,
          error_count: errorCount,
          total_records: totalProcessed,
          duration_ms: totalDuration,
          round_robin: effectiveMaxStores > 0,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[marketplace-auto-sync] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        results,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
