import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UZUM_API_BASE = 'https://api-seller.uzum.uz/api/seller-openapi';
const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';

/** Convert various date formats to ISO string for PostgreSQL */
function parseInvoiceDate(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // DD.MM.YYYY format
  const ddmmyyyy = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }
  // Already ISO-like (YYYY-MM-DD...) — return as-is
  if (/^\d{4}-\d{2}/.test(s)) return s;
  // Timestamp number
  if (/^\d{10,13}$/.test(s)) {
    const ms = s.length <= 10 ? Number(s) * 1000 : Number(s);
    return new Date(ms).toISOString();
  }
  // Try native parse
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const UZUM_STORE_CONFIGS = [
  { storeKey: 'UZUM_ALI_BRAND_MARKET_API_KEY', shopId: '49052', name: 'ALI BRAND MARKET' },
  { storeKey: 'UZUM_ATLAS_MARKET_API_KEY', shopId: '69508', name: 'Atlas Market' },
  { storeKey: 'UZUM_ATLAS_MARKET_2_API_KEY', shopId: '88409', name: 'Atlas.Market' },
  { storeKey: 'UZUM_BM_STORE_API_KEY', shopId: '89165', name: 'BM Store' },
  { storeKey: 'UZUM_BM_STORE_2_API_KEY', shopId: '92638', name: 'BM_store' },
  { storeKey: 'UZUM_CHINA_MARKET_API_KEY', shopId: '69555', name: 'Uzum China Market' },
  { storeKey: 'UZUM_XIT_MARKET_API_KEY', shopId: '70010', name: 'Xit market' },
  { storeKey: 'UZUM_ALIBRAND_MARKET_API_KEY', shopId: '92815', name: 'Alibrand.Market' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const results: any[] = [];
  let totalSaved = 0;

  try {
    let targetShopId: string | null = null;
    try {
      const body = await req.json();
      targetShopId = body?.shopId || null;
    } catch (_) {}

    // ═══════════════════════════════════════════
    // PART 1: UZUM INVOICES (seller-level /v1/invoice)
    // ═══════════════════════════════════════════
    for (const store of UZUM_STORE_CONFIGS) {
      if (targetShopId && store.shopId !== targetShopId) continue;

      const apiKey = Deno.env.get(store.storeKey);
      if (!apiKey) {
        results.push({ store: store.name, platform: 'uzum', error: 'No API key' });
        continue;
      }

      const { data: storeRow } = await supabase
        .from('marketplace_stores')
        .select('id')
        .eq('platform', 'uzum')
        .eq('shop_id', store.shopId)
        .maybeSingle();

      const storeDbId = storeRow?.id || null;

      try {
        let page = 0;
        const invoicesMap: Record<string, any> = {};

        while (true) {
          // ✅ Seller-level endpoint — /v1/invoice ishlaydi
          const url = `${UZUM_API_BASE}/v1/invoice?page=${page}&size=50`;
          const resp = await fetch(url, {
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json',
            },
          });

          if (!resp.ok) {
            const errText = await resp.text();
            console.error(`[uzum-supply] ${store.name} | page=${page} → HTTP ${resp.status}: ${errText}`);
            break;
          }

          const json = await resp.json();
          // Response: massiv yoki {payload: [...]} yoki {content: [...]}
          const items = Array.isArray(json) ? json : (json?.payload || json?.content || json?.invoices || []);
          if (!items.length) break;

          for (const inv of items) {
            const invId = String(inv.id || inv.invoiceId || inv.invoice_id);
            // shopId bo'yicha filtr — faqat shu do'konga tegishli invoiclar
            const invShopId = String(inv.shopId || inv.shop_id || '');
            if (invShopId && invShopId !== store.shopId) continue;
            invoicesMap[invId] = inv;
          }

          if (items.length < 50) break;
          page++;
        }

        const invoiceList = Object.values(invoicesMap);
        console.info(`[uzum-supply] ${store.name}: ${invoiceList.length} ta invoice topildi`);

        for (const inv of invoiceList) {
          const invId = String(inv.id || inv.invoiceId || inv.invoice_id);

          // Status parsing — /v1/invoice javobida invoiceStatus.value yoki status bo'lishi mumkin
          const status = inv.invoiceStatus?.value || inv.status || 'UNKNOWN';
          // Sana — dateCreated yoki createdAt
          const invoiceDate = inv.dateCreated || inv.createdAt || inv.created_at || inv.date || null;
          // Mahsulotlar soni
          const orderCount = inv.totalToStock || inv.orderCount || inv.order_count || inv.ordersCount || 0;

          const { data: savedInvoice, error: upsertErr } = await supabase
            .from('fbs_invoices')
            .upsert(
              {
                invoice_id: invId,
                store_id: storeDbId,
                store_name: store.name,
                platform: 'uzum',
                status,
                order_count: orderCount,
                invoice_date: parseInvoiceDate(invoiceDate),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'store_id,invoice_id', ignoreDuplicates: false }
            )
            .select('id')
            .single();

          if (upsertErr) {
            console.error(`[uzum-supply] Upsert xatosi (${invId}):`, upsertErr.message);
            continue;
          }
          if (!savedInvoice?.id) continue;

          // ✅ Items uchun: /v1/shop/{shopId}/invoice/products?invoiceId={id}
          await new Promise(r => setTimeout(r, 200));
          const ordersResp = await fetch(
            `${UZUM_API_BASE}/v1/shop/${store.shopId}/invoice/products?invoiceId=${invId}&page=0&size=200`,
            {
              headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!ordersResp.ok) {
            // Fallback: eski endpoint sinab ko'rish
            const fallbackResp = await fetch(
              `${UZUM_API_BASE}/v1/fbs/invoice/${invId}/orders?page=0&size=200`,
              { headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' } }
            );
            if (fallbackResp.ok) {
              const fbJson = await fallbackResp.json();
              const fbOrders = fbJson?.payload?.orders || fbJson?.orders || fbJson?.content || [];
              await saveInvoiceItems(supabase, savedInvoice.id, fbOrders, 'fbs');
            }
            totalSaved++;
            continue;
          }

          const ordersJson = await ordersResp.json();
          // /v1/shop/{shopId}/invoice/products javob tuzilmasi
          const products = Array.isArray(ordersJson) ? ordersJson : (ordersJson?.payload?.products || ordersJson?.payload || ordersJson?.content || ordersJson?.products || []);
          await saveInvoiceItems(supabase, savedInvoice.id, products, 'seller');

          // order_count ni haqiqiy items soniga yangilash
          if (products.length > 0) {
            const totalQty = products.reduce((sum: number, p: any) => sum + (p.quantity || p.count || p.totalToStock || 1), 0);
            await supabase.from('fbs_invoices').update({ order_count: totalQty }).eq('id', savedInvoice.id);
          }

          totalSaved++;
        }

        results.push({
          store: store.name,
          platform: 'uzum',
          shopId: store.shopId,
          invoices_fetched: invoiceList.length,
        });
      } catch (err: any) {
        console.error(`[uzum-supply] ${store.name} xatosi:`, err.message);
        results.push({ store: store.name, platform: 'uzum', error: err.message });
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // ═══════════════════════════════════════════
    // PART 2: YANDEX FBS SHIPMENTS (PUT /first-mile/shipments)
    // ═══════════════════════════════════════════
    try {
      const { data: yandexStores } = await supabase
        .from('marketplace_stores')
        .select('id, name, campaign_id, fbs_campaign_id, fby_campaign_id, api_key_secret_name')
        .eq('platform', 'yandex');

      for (const yStore of yandexStores || []) {
        const apiKey = Deno.env.get(yStore.api_key_secret_name);
        if (!apiKey) {
          results.push({ store: yStore.name, platform: 'yandex', error: 'No API key' });
          continue;
        }

        // FBS shipments — fbs_campaign_id birinchi, keyin campaign_id (FBY campaign ishlamaydi)
        const campaignIds = [
          yStore.fbs_campaign_id,
          yStore.campaign_id,
        ].filter(Boolean);

        if (campaignIds.length === 0) {
          console.info(`[yandex-supply] ${yStore.name}: campaign ID yo'q, o'tkazildi`);
          continue;
        }

        let fetched = false;

        for (const campaignId of campaignIds) {
          if (fetched) break;

          try {
            console.info(`[yandex-supply] ${yStore.name}: FBS shipments campaignId=${campaignId}`);

            // Oxirgi 90 kunlik shipmentlarni olish
            const now = new Date();
            const dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            const dateFromStr = `${dateFrom.getFullYear()}-${String(dateFrom.getMonth()+1).padStart(2,'0')}-${String(dateFrom.getDate()).padStart(2,'0')}`;
            const dateToStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

            let pageToken: string | undefined;
            let allShipments: any[] = [];

            while (true) {
              const url = `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/first-mile/shipments${pageToken ? `?pageToken=${pageToken}&limit=30` : '?limit=30'}`;
              const listResp = await fetch(url, {
                method: 'PUT',
                headers: {
                  'Api-Key': apiKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  dateFrom: dateFromStr,
                  dateTo: dateToStr,
                }),
              });

              if (listResp.status === 404) {
                console.warn(`[yandex-supply] ${yStore.name} campaignId=${campaignId} → 404`);
                break;
              }

              if (!listResp.ok) {
                const errText = await listResp.text();
                console.error(`[yandex-supply] ${yStore.name} → HTTP ${listResp.status}: ${errText}`);
                break;
              }

              const listData = await listResp.json();
              const shipments = listData.result?.shipments || [];
              allShipments.push(...shipments);

              const nextToken = listData.result?.paging?.nextPageToken;
              if (!nextToken || shipments.length === 0) break;
              pageToken = nextToken;
            }

            if (allShipments.length === 0) {
              console.info(`[yandex-supply] ${yStore.name} campaignId=${campaignId}: 0 ta shipment`);
              continue;
            }

            fetched = true;
            console.info(`[yandex-supply] ${yStore.name}: ${allShipments.length} ta shipment topildi`);

            let yandexSaved = 0;

            for (const sh of allShipments) {
              const shId = String(sh.id);
              const orderCount = sh.orderIds?.length || sh.factCount || sh.plannedCount || 0;
              const status = sh.status || 'UNKNOWN';
              const shipDate = sh.planIntervalFrom || sh.statusUpdateTime || null;

              const { data: savedInvoice, error: upsertErr } = await supabase
                .from('fbs_invoices')
                .upsert(
                  {
                    invoice_id: shId,
                    store_id: yStore.id,
                    store_name: yStore.name,
                    platform: 'yandex',
                    status,
                    order_count: orderCount,
                    invoice_date: parseInvoiceDate(shipDate),
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'store_id,invoice_id', ignoreDuplicates: false }
                )
                .select('id')
                .single();

              if (upsertErr) {
                console.error(`[yandex-supply] Upsert xatosi (${shId}):`, upsertErr.message);
                continue;
              }
              if (!savedInvoice?.id) continue;

              // Shipment ichidagi orderlarni fbs_invoice_items ga saqlash
              if (sh.orderIds && sh.orderIds.length > 0) {
                await supabase.from('fbs_invoice_items').delete().eq('invoice_id', savedInvoice.id);

                // Orderlar haqida ma'lumot olish (batchda)
                const orderItems: any[] = [];
                const batchSize = 50;
                for (let i = 0; i < sh.orderIds.length; i += batchSize) {
                  const batch = sh.orderIds.slice(i, i + batchSize);
                  // Yandex orders jadvalidan ma'lumot olish
                  const { data: orders } = await supabase
                    .from('marketplace_orders')
                    .select('external_order_id, items, total_amount')
                    .eq('store_id', yStore.id)
                    .in('external_order_id', batch.map(String));

                  if (orders) {
                    for (const ord of orders) {
                      const items = Array.isArray(ord.items) ? ord.items as any[] : [];
                      const firstItem = items[0] || {};
                      orderItems.push({
                        invoice_id: savedInvoice.id,
                        external_order_id: ord.external_order_id,
                        product_title: firstItem.title || firstItem.offerName || null,
                        sku_title: firstItem.offerId || null,
                        quantity: items.reduce((sum: number, it: any) => sum + (it.count || 1), 0) || 1,
                        amount: ord.total_amount || null,
                        currency: 'UZS',
                      });
                    }
                  }
                }

                // Agar DB dan topilmasa — orderIds ni oddiy holda saqlash
                if (orderItems.length === 0) {
                  for (const ordId of sh.orderIds) {
                    orderItems.push({
                      invoice_id: savedInvoice.id,
                      external_order_id: String(ordId),
                      product_title: `Order #${ordId}`,
                      sku_title: null,
                      quantity: 1,
                      amount: null,
                      currency: 'UZS',
                    });
                  }
                }

                if (orderItems.length > 0) {
                  await supabase.from('fbs_invoice_items').insert(orderItems);
                  await supabase.from('fbs_invoices').update({ order_count: orderItems.length }).eq('id', savedInvoice.id);
                }
              }

              yandexSaved++;
              totalSaved++;
            }

            results.push({
              store: yStore.name,
              platform: 'yandex',
              campaignId,
              shipments_fetched: allShipments.length,
              saved: yandexSaved,
            });
          } catch (err: any) {
            console.error(`[yandex-supply] ${yStore.name} xatosi (campaignId=${campaignId}):`, err.message);
          }

          await new Promise(r => setTimeout(r, 500));
        }

        if (!fetched) {
          results.push({ store: yStore.name, platform: 'yandex', error: 'No shipments found for any campaign ID' });
        }
      }
    } catch (yandexErr: any) {
      console.error('[yandex-supply] Umumiy xatolik:', yandexErr.message);
      results.push({ platform: 'yandex', error: yandexErr.message });
    }

    return new Response(
      JSON.stringify({ success: true, total_invoices_saved: totalSaved, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ═══════════════════════════════════════════
// Helper: Invoice itemlarni saqlash
// ═══════════════════════════════════════════
async function saveInvoiceItems(supabase: any, invoiceDbId: string, items: any[], source: 'seller' | 'fbs') {
  await supabase.from('fbs_invoice_items').delete().eq('invoice_id', invoiceDbId);

  const itemsToInsert: any[] = [];

  for (const item of items) {
    if (source === 'seller') {
      // /v1/shop/{shopId}/invoice/products response
      itemsToInsert.push({
        invoice_id: invoiceDbId,
        external_order_id: String(item.productId || item.skuId || item.id || ''),
        product_title: item.title || item.productTitle || item.name || null,
        sku_title: item.skuTitle || item.sku || null,
        image_url: item.imageUrl || item.image || null,
        quantity: item.quantity || item.count || item.totalToStock || 1,
        amount: item.price || item.fullPrice || item.amount || null,
        currency: 'UZS',
      });
    } else {
      // /v1/fbs/invoice/{id}/orders fallback
      const skuTitle = item.skuTitle || item.sku_title || item.productSku || item.items?.[0]?.skuTitle || null;
      const productTitle = item.productTitle || item.product_title || item.title || item.items?.[0]?.title || null;
      itemsToInsert.push({
        invoice_id: invoiceDbId,
        external_order_id: String(item.id || item.orderId || item.order_id || ''),
        product_title: productTitle,
        sku_title: skuTitle,
        image_url: item.imageUrl || item.image_url || item.items?.[0]?.imageUrl || null,
        quantity: item.quantity || item.items?.[0]?.quantity || 1,
        amount: item.amount || item.price || item.sellerPrice || null,
        currency: 'UZS',
      });
    }
  }

  if (itemsToInsert.length > 0) {
    await supabase.from('fbs_invoice_items').insert(itemsToInsert);
  }

  return itemsToInsert.length;
}
