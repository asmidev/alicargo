// uzum-fbs-returns v4 — nakladnoy_id + extractReturnDate fix 2026-02-20
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UZUM_BASE = 'https://api-seller.uzum.uz/api/seller-openapi';

async function uzumFetch(apiKey: string, path: string) {
  const res = await fetch(`${UZUM_BASE}${path}`, {
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[uzum-fbs-returns] ${path} → ${res.status}: ${text}`);
    return null;
  }
  return res.json();
}

/** Fetch all return nakladnoys (paginated) for a shop */
async function fetchReturnList(apiKey: string, shopId: number): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const data = await uzumFetch(apiKey, `/v1/shop/${shopId}/return?page=${page}&size=50`);
    if (!data) break;
    const items = Array.isArray(data) ? data : (data.items || data.content || data.payload || []);
    if (items.length === 0) break;
    all.push(...items);
    if (items.length < 50) break;
    page++;
  }
  return all;
}

/** Fetch return details for one nakladnoy */
async function fetchReturnDetail(apiKey: string, shopId: number, returnId: number | string): Promise<any> {
  return uzumFetch(apiKey, `/v1/shop/${shopId}/return/${returnId}`);
}

/** Extract return date — Uzum API turli fieldlarda sana beradi */
function extractReturnDate(retLite: any, detail: any): string {
  const payload = detail?.payload || detail || {};
  const candidates = [
    retLite?.createdAt, retLite?.date, retLite?.returnDate, retLite?.creationDate,
    retLite?.createDate, retLite?.created_at,
    payload?.createdAt, payload?.date, payload?.returnDate, payload?.creationDate,
    detail?.createdAt, detail?.date,
  ];
  for (const v of candidates) {
    if (v && typeof v === 'string' && v.length >= 10) {
      const parsed = new Date(v);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
    if (v && typeof v === 'number' && v > 1000000000) {
      const ms = v > 9999999999 ? v : v * 1000;
      return new Date(ms).toISOString();
    }
  }
  return new Date().toISOString();
}

/** Determine return_type from reason */
function classifyReturn(reason: string | null | undefined): string {
  if (!reason) return 'fbs_seller';
  const upper = reason.toUpperCase();
  if (upper.includes('DEFECT') || upper.includes('DAMAGE') || upper.includes('BROKEN') || upper.includes('YAROQSIZ')) {
    return 'fbs_defect';
  }
  return 'fbs_seller';
}

/** Translate reason to Uzbek */
function translateReason(reason: string | null | undefined): string {
  if (!reason) return 'Sabab ko\'rsatilmagan';
  const map: Record<string, string> = {
    'BUYER_REFUSED': 'Xaridor rad etgan',
    'DEFECT': 'Yaroqsiz tovar',
    'DAMAGE': 'Shikastlangan',
    'WRONG_ITEM': 'Noto\'g\'ri tovar',
    'NOT_MATCHING_DESCRIPTION': 'Tavsifga mos emas',
    'POOR_QUALITY': 'Sifatsiz tovar',
    'EXPIRED': 'Muddati o\'tgan',
    'INCOMPLETE': 'To\'liq emas',
    'COURIER_REFUSED': 'Kuryer rad etgan',
  };
  return map[reason.toUpperCase()] || reason;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const results = { synced: 0, stores: [] as any[], errors: [] as string[] };

  const { data: storeRows, error: storeErr } = await supabase
    .from('marketplace_stores')
    .select('id, name, shop_id, api_key_secret_name')
    .eq('platform', 'uzum')
    .not('shop_id', 'is', null)
    .not('api_key_secret_name', 'is', null);

  if (storeErr || !storeRows || storeRows.length === 0) {
    console.warn('[uzum-fbs-returns] No uzum stores found in DB:', storeErr?.message);
    return new Response(JSON.stringify({ ...results, error: 'No stores found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[uzum-fbs-returns] Found ${storeRows.length} Uzum stores in DB`);

  for (const storeRow of storeRows) {
    const apiKey = Deno.env.get(storeRow.api_key_secret_name);
    if (!apiKey) {
      console.warn(`[uzum-fbs-returns] No API key secret '${storeRow.api_key_secret_name}' for ${storeRow.name}`);
      continue;
    }

    const shopId = parseInt(storeRow.shop_id);
    if (!shopId || isNaN(shopId)) {
      console.warn(`[uzum-fbs-returns] Invalid shopId for ${storeRow.name}: ${storeRow.shop_id}`);
      continue;
    }

    try {
      console.log(`[uzum-fbs-returns] Processing ${storeRow.name} shopId=${shopId}`);

      // Pre-load SKU -> image mapping from marketplace_listings
      const skuToImage: Record<string, string> = {};
      const { data: listingsData } = await supabase
        .from('marketplace_listings')
        .select('external_sku, image_url')
        .eq('store_id', storeRow.id)
        .not('image_url', 'is', null);
      for (const l of listingsData || []) {
        if (l.external_sku && l.image_url) skuToImage[l.external_sku] = l.image_url;
      }
      console.log(`[uzum-fbs-returns] ${storeRow.name}: ${Object.keys(skuToImage).length} SKU-image mappings loaded`);

      const returnList = await fetchReturnList(apiKey, shopId);
      console.log(`[uzum-fbs-returns] ${storeRow.name}: ${returnList.length} return nakladnoys`);

      if (returnList.length === 0) {
        results.stores.push({ name: storeRow.name, synced: 0 });
        continue;
      }

      const nakladnoyIds = returnList.map(r => String(r.id || r.returnId || r.nakladnoyId)).filter(Boolean);
      const { data: existing } = await supabase
        .from('marketplace_returns')
        .select('nakladnoy_id')
        .in('nakladnoy_id', nakladnoyIds);
      const existingSet = new Set((existing || []).map(e => e.nakladnoy_id));

      const newReturns = returnList.filter(r => {
        const id = String(r.id || r.returnId || r.nakladnoyId);
        return id && !existingSet.has(id);
      });

      console.log(`[uzum-fbs-returns] ${storeRow.name}: ${newReturns.length} new nakladnoys to process`);

      let storeSynced = 0;
      for (const retLite of newReturns) {
        const returnId = retLite.id || retLite.returnId || retLite.nakladnoyId;
        if (!returnId) continue;

        // Fetch full detail
        const detail = await fetchReturnDetail(apiKey, shopId, returnId);
        if (!detail) continue;

        // Log detail keys for diagnostics (first return only)
        if (storeSynced === 0) {
          console.log(`[uzum-fbs-returns] retLite keys: ${Object.keys(retLite).join(', ')}`);
          const payload = detail?.payload || detail;
          console.log(`[uzum-fbs-returns] detail keys: ${Object.keys(detail).join(', ')} | payload keys: ${Object.keys(payload).join(', ')}`);
        }

        const payload = detail.payload || detail;
        const detailItems: any[] = payload.items || payload.returnItems || payload.skuList || detail.items || detail.returnItems || [];

        // Extract return date using smart multi-field detection
        const returnDate = extractReturnDate(retLite, detail);

        // Helper: extract image URL with multiple fallbacks
        const extractImageUrl = (item: any, lite: any): string | null => {
          // 1. Direct API fields
          const candidates = [
            item?.image, item?.imageUrl, item?.photoUrl, item?.photo,
            lite?.image, lite?.imageUrl, lite?.photoUrl, lite?.photo,
          ];
          for (const v of candidates) {
            if (v && typeof v === 'string' && v.length > 5) return v;
          }
          // 2. photos array
          const photos = item?.photos || lite?.photos;
          if (Array.isArray(photos) && photos.length > 0 && typeof photos[0] === 'string') return photos[0];
          // 3. photoKey (Uzum CDN)
          const photoKey = item?.photoKey || lite?.photoKey;
          if (photoKey && typeof photoKey === 'string') return `https://images.uzum.uz/${photoKey}`;
          // 4. Listing fallback by SKU
          const sku = item?.skuTitle || item?.offerId || item?.sku || lite?.skuTitle || lite?.offerId;
          if (sku && skuToImage[sku]) return skuToImage[sku];
          return null;
        };

        // Helper: extract real price (UZS)
        const extractAmount = (item: any, lite: any): number | null => {
          const candidates = [
            item?.sellerAmount, item?.offerPrice, item?.totalPrice, item?.salePrice,
            item?.orderAmount, item?.price, item?.totalAmount, item?.amount,
            lite?.sellerAmount, lite?.totalAmount, lite?.orderAmount, lite?.offerPrice,
            lite?.totalPrice, lite?.salePrice, lite?.price,
          ];
          for (const v of candidates) {
            const n = Number(v);
            if (n >= 1000) return n;
          }
          return null;
        };

        const toInsert = detailItems.length > 0
          ? detailItems.map((item: any) => {
              const reason = item.reason || item.returnReason || retLite.reason || retLite.returnReason || null;
              return {
                store_id: storeRow.id || null,
                store_name: storeRow.name,
                platform: 'uzum',
                external_order_id: String(returnId),
                nakladnoy_id: String(returnId),
                product_title: item.title || item.productTitle || item.name || item.skuTitle || 'Noma\'lum',
                sku_title: item.skuTitle || item.offerId || item.sku || null,
                image_url: extractImageUrl(item, retLite),
                quantity: item.quantity || item.count || 1,
                amount: extractAmount(item, retLite),
                currency: 'UZS',
                return_reason: translateReason(reason),
                return_type: classifyReturn(reason),
                return_date: returnDate,
                resolution: 'pending',
              };
            })
          : [{
              store_id: storeRow.id || null,
              store_name: storeRow.name,
              platform: 'uzum',
              external_order_id: String(returnId),
              nakladnoy_id: String(returnId),
              product_title: retLite.productTitle || retLite.title || `Nakladnoy #${returnId}`,
              sku_title: retLite.skuTitle || null,
              image_url: extractImageUrl({}, retLite),
              quantity: retLite.quantity || retLite.count || 1,
              amount: extractAmount({}, retLite),
              currency: 'UZS',
              return_reason: translateReason(retLite.reason || retLite.returnReason),
              return_type: classifyReturn(retLite.reason || retLite.returnReason),
              return_date: returnDate,
              resolution: 'pending',
            }];

        const { error: insertError } = await supabase
          .from('marketplace_returns')
          .insert(toInsert as any);

        if (insertError) {
          console.error(`[uzum-fbs-returns] Insert error for nakladnoy ${returnId}:`, insertError.message);
        } else {
          storeSynced += toInsert.length;
        }

        // Delay to avoid rate limiting (300ms between detail calls)
        await new Promise(r => setTimeout(r, 300));
      }

      results.synced += storeSynced;
      results.stores.push({ name: storeRow.name, shopId, found: returnList.length, synced: storeSynced });

    } catch (err: any) {
      console.error(`[uzum-fbs-returns] Error for ${storeRow.name}:`, err.message);
      results.errors.push(`${storeRow.name}: ${err.message}`);
    }
  }

  console.log(`[uzum-fbs-returns] Done. Total synced: ${results.synced}`);
  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
