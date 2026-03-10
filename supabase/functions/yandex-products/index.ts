import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';
const API_DELAY_MS = 100;
const MAX_OFFERS = 1500; // Keep manageable within edge function timeout
const BATCH_SIZE = 200;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Interface for the offer-mappings API response
interface YandexOfferMapping {
  offer: {
    offerId: string;
    name?: string;
    barcodes?: string[];
    basicPrice?: {
      value: number;
      currencyId: string;
    };
    vendor?: string;
    vendorCode?: string;
    description?: string;
    pictures?: string[];
    urls?: string[];
    archived?: boolean;
  };
  mapping?: {
    marketSku?: number;
    categoryId?: number;
    categoryName?: string;
  };
}

// Legacy interface kept for backwards compatibility
interface LegacyYandexOffer {
  offerId: string;
  name?: string;
  shopSku?: string;
  marketSku?: number;
  barcodes?: string[];
  price?: {
    value: number;
    currencyId: string;
  };
}

// Extract title from offer-mapping structure
function extractTitle(mapping: YandexOfferMapping): string | null {
  return mapping.offer?.name || mapping.offer?.offerId || null;
}

// Extract barcode from offer-mapping structure
function extractBarcode(mapping: YandexOfferMapping): string | null {
  if (mapping.offer?.barcodes && mapping.offer.barcodes.length > 0) {
    return mapping.offer.barcodes[0];
  }
  return null;
}

// Extract price from offer-mapping structure
function extractPrice(mapping: YandexOfferMapping): number | null {
  return mapping.offer?.basicPrice?.value || null;
}

// Determine if offer is active (not archived)
function isActiveOffer(mapping: YandexOfferMapping): boolean {
  return mapping.offer?.archived !== true;
}

// Detect CDN URLs that block hotlinking (Wildberries, Ozon)
function isBrokenCdnUrl(url: string): boolean {
  return url.includes('wbcontent.net') || url.includes('ozone.ru');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { store_id, page = 1, page_size = 200 } = await req.json();

    if (!store_id) {
      throw new Error('store_id is required');
    }

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

    // Use business_id for the offer-mappings endpoint
    const businessId = store.business_id;
    if (!businessId) {
      throw new Error('No business_id configured for this Yandex store');
    }

    // Also capture campaign_id for diagnostics (Atlas Market uses campaign-level endpoint)
    const campaignId = store.campaign_id || store.shop_id;

    console.log(`[yandex-products] Fetching products for ${store.name} (business: ${businessId}, campaign: ${campaignId})`);

    // PAGINATED FETCHING using offer-mappings endpoint (business-level, not campaign-level)
    let pageToken: string | undefined;
    let allMappings: YandexOfferMapping[] = [];
    let pageCount = 0;
    let apiErrorCode: number | null = null;
    let apiErrorText: string | null = null;

    do {
      if (pageCount > 0) {
        await delay(API_DELAY_MS);
      }

      const requestBody: Record<string, unknown> = {
        archived: false,
        limit: 50, // Yandex API actual max is 50 per page
      };
      
      if (pageToken) {
        requestBody.page_token = pageToken;
      }

      const response = await fetch(
        `${YANDEX_API_BASE}/businesses/${businessId}/offer-mappings`,
        {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        apiErrorCode = response.status;
        apiErrorText = await response.text();
        console.error(`[yandex-products] API error on page ${pageCount} for store ${store.name} (business: ${businessId}): HTTP ${response.status}`);
        console.error(`[yandex-products] Error details: ${apiErrorText}`);
        
        // Distinguish between auth errors (401/403) and other errors
        if (response.status === 401 || response.status === 403) {
          console.error(`[yandex-products] ⚠️ AUTH FAILURE for ${store.name}: API key '${store.api_key_secret_name}' may be expired or invalid for business ${businessId}`);
          // Don't throw — return informative error response instead
          break;
        } else if (response.status === 404) {
          console.error(`[yandex-products] ⚠️ BUSINESS NOT FOUND: business_id=${businessId} not found. Campaign ${campaignId} may belong to a different business.`);
          break;
        }
        
        if (pageCount === 0) {
          // First page failure — escalate as error but with diagnostic details
          throw new Error(`Yandex API error for ${store.name} (business: ${businessId}): HTTP ${response.status} — ${apiErrorText?.substring(0, 200)}`);
        }
        break;
      }

      const data = await response.json();
      const mappings: YandexOfferMapping[] = data.result?.offerMappings || [];
      pageToken = data.result?.paging?.nextPageToken || undefined;
      
      console.log(`[yandex-products] Page ${pageCount}: received ${mappings.length} offers${pageToken ? ' (has more)' : ''}`);
      
      allMappings.push(...mappings);
      pageCount++;

      // Safety limit
      if (allMappings.length >= MAX_OFFERS) {
        console.log(`[yandex-products] Reached max offers limit (${MAX_OFFERS})`);
        break;
      }

    } while (pageToken);
    
    // If API authentication failed entirely — return diagnostic response instead of empty sync
    if (apiErrorCode !== null && allMappings.length === 0) {
      const isAuthError = apiErrorCode === 401 || apiErrorCode === 403;
      const is404 = apiErrorCode === 404;
      return new Response(
        JSON.stringify({
          success: false,
          store: store.name,
          business_id: businessId,
          campaign_id: campaignId,
          api_key_secret: store.api_key_secret_name,
          error_code: apiErrorCode,
          error: isAuthError
            ? `Authentication failed (HTTP ${apiErrorCode}). API key '${store.api_key_secret_name}' may be expired or lack permissions for business ${businessId}.`
            : is404
            ? `Business ${businessId} not found. Check if business_id is correct for this store.`
            : `API error HTTP ${apiErrorCode}: ${apiErrorText?.substring(0, 300)}`,
          diagnosis: isAuthError
            ? 'Check YANDEX_ATLAS_MARKET_API_KEY secret and confirm it has access to this business/campaign'
            : is404
            ? 'Verify store.business_id matches the actual Yandex business that owns this campaign'
            : 'Transient API error — retry or check Yandex Market API status',
          offers_received: 0,
          synced: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[yandex-products] Total offers fetched: ${allMappings.length} across ${pageCount} page(s)`);

    let synced = 0;
    let failed = 0;

    // Build all listing records first, then batch upsert
    const allListings: Record<string, unknown>[] = [];

    for (const mapping of allMappings) {
      const offer = mapping.offer;
      if (!offer?.offerId) continue;

      const title = extractTitle(mapping);
      const barcode = extractBarcode(mapping);
      const price = extractPrice(mapping);
      const isActive = isActiveOffer(mapping);
      // Filter out Wildberries/Ozon CDN URLs that block hotlinking
      const rawImageUrl = offer.pictures && offer.pictures.length > 0 ? offer.pictures[0] : null;
      const imageUrl = rawImageUrl && !isBrokenCdnUrl(rawImageUrl) ? rawImageUrl : null;

      // For hybrid fby_fbs stores, create BOTH fbs and fby listings
      const fulfillmentTypes: string[] = [];
      if (store.fulfillment_type === 'fby_fbs') {
        fulfillmentTypes.push('fbs', 'fby');
      } else {
        fulfillmentTypes.push(store.fulfillment_type || 'fbs');
      }

      for (const ft of fulfillmentTypes) {
        const listingData: Record<string, unknown> = {
          store_id,
          external_sku: offer.offerId,
          external_product_id: mapping.mapping?.marketSku ? String(mapping.mapping.marketSku) : null,
          external_offer_id: offer.offerId,
          external_barcode: barcode,
          fulfillment_type: ft,
          title: title,
          price: price,
          currency: offer.basicPrice?.currencyId || 'UZS',
          status: isActive ? 'active' : 'inactive',
          moderation_status: isActive ? 'active' : 'archived',
          last_synced_at: new Date().toISOString(),
          product_rank: isActive ? 'C' : 'D',
        };
        if (imageUrl) {
          listingData.image_url = imageUrl;
        }
        allListings.push(listingData);
      }
    }

    // Deduplicate by (store_id, external_sku, fulfillment_type) — API may return same offerId across pages
    const seen = new Set<string>();
    const dedupedListings = allListings.filter(l => {
      const key = `${l.store_id}|${l.external_sku}|${l.fulfillment_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[yandex-products] Prepared ${dedupedListings.length} unique listing records (${allListings.length - dedupedListings.length} duplicates removed), upserting in batches of ${BATCH_SIZE}...`);

    // Batch upsert for performance
    for (let i = 0; i < dedupedListings.length; i += BATCH_SIZE) {
      const batch = dedupedListings.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('marketplace_listings')
        .upsert(batch, { onConflict: 'store_id,external_sku,fulfillment_type' });

      if (upsertError) {
        console.error(`[yandex-products] Batch ${Math.floor(i / BATCH_SIZE)} failed:`, upsertError.message);
        failed += batch.length;
      } else {
        synced += batch.length;
      }
    }

    console.log(`[yandex-products] Sync complete: ${synced} synced, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        store: store.name,
        business_id: businessId,
        campaign_id: campaignId,
        api_key_secret: store.api_key_secret_name,
        offers_received: allMappings.length,
        pages_fetched: pageCount,
        synced,
        failed,
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
