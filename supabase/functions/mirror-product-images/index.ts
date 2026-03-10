import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { product_ids } = await req.json();

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      throw new Error('product_ids array is required');
    }

    console.log(`[mirror-images] Starting mirror for ${product_ids.length} products`);

    // Fetch products with their current images
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, main_image_url')
      .in('id', product_ids);

    if (fetchError) throw fetchError;

    // Also check marketplace listings for alternative images
    const { data: listings } = await supabase
      .from('marketplace_listings')
      .select('product_id, image_url')
      .in('product_id', product_ids)
      .not('image_url', 'is', null);

    // Build a map of product_id -> best available image URL
    const listingImages: Record<string, string> = {};
    for (const l of listings || []) {
      if (l.image_url && !isBrokenCdn(l.image_url)) {
        listingImages[l.product_id] = l.image_url;
      }
    }

    const mirrored: string[] = [];
    const failed: { id: string; name: string; reason: string }[] = [];
    const usedListingFallback: string[] = [];

    for (const product of products || []) {
      try {
        // Determine source URL: prefer listing fallback over broken CDN
        let sourceUrl = product.main_image_url;

        if (!sourceUrl || isBrokenCdn(sourceUrl)) {
          if (listingImages[product.id]) {
            sourceUrl = listingImages[product.id];
            usedListingFallback.push(product.id);
          }
        }

        if (!sourceUrl) {
          failed.push({ id: product.id, name: product.name, reason: 'No image URL available' });
          continue;
        }

        if (!isBrokenCdn(sourceUrl) && sourceUrl === product.main_image_url) {
          // Image is already from a working CDN, skip mirroring
          console.log(`[mirror-images] ${product.name}: image already OK, skipping`);
          continue;
        }

        console.log(`[mirror-images] Downloading: ${sourceUrl}`);

        // Download the image
        const imgResponse = await fetch(sourceUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Referer': new URL(sourceUrl).origin + '/',
          },
        });

        if (!imgResponse.ok) {
          failed.push({ id: product.id, name: product.name, reason: `HTTP ${imgResponse.status}` });
          continue;
        }

        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.includes('webp') ? 'webp'
          : contentType.includes('png') ? 'png'
          : 'jpg';

        const imageBytes = new Uint8Array(await imgResponse.arrayBuffer());

        if (imageBytes.length < 1000) {
          failed.push({ id: product.id, name: product.name, reason: 'Image too small (likely blocked)' });
          continue;
        }

        const fileName = `${product.id}.${ext}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageBytes, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          failed.push({ id: product.id, name: product.name, reason: uploadError.message });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        // Update product
        const { error: updateError } = await supabase
          .from('products')
          .update({ main_image_url: urlData.publicUrl })
          .eq('id', product.id);

        if (updateError) {
          failed.push({ id: product.id, name: product.name, reason: updateError.message });
          continue;
        }

        console.log(`[mirror-images] ✓ ${product.name} -> ${urlData.publicUrl}`);
        mirrored.push(product.id);

      } catch (err) {
        failed.push({ id: product.id, name: product.name, reason: err.message });
      }
    }

    console.log(`[mirror-images] Done: ${mirrored.length} mirrored, ${failed.length} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        mirrored: mirrored.length,
        failed,
        used_listing_fallback: usedListingFallback.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[mirror-images] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function isBrokenCdn(url: string): boolean {
  return url.includes('wbcontent.net') || url.includes('ozone.ru');
}
