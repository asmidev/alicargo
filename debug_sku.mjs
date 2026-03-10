import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(url, key);

async function checkSkuData(sku) {
    console.log(`Checking data for SKU: ${sku}`);

    // 1. Mappingni tekshirish
    const { data: mappings, error: mapError } = await supabase
        .from('variant_sku_mappings')
        .select('variant_id, external_sku')
        .eq('external_sku', sku);

    if (mapError) {
        console.error("Mapping Error:", mapError);
        return;
    }

    console.log("Mappings found:", mappings);

    if (!mappings || mappings.length === 0) {
        console.log("No mapping found for this SKU.");
        // Try ILIKE just in case
        const { data: similar } = await supabase
            .from('variant_sku_mappings')
            .select('external_sku')
            .ilike('external_sku', `%${sku.split('-')[0]}%`)
            .limit(5);
        console.log("Similar SKUs in DB:", similar);
        return;
    }

    const mapping = mappings[0];
    const variantId = mapping.variant_id;
    const productId = mapping.product_id;

    // 2. Variantni tekshirish
    if (variantId) {
        const { data: variant, error: varError } = await supabase
            .from('product_variants')
            .select('*')
            .eq('id', variantId)
            .single();
        console.log("Variant Data:", variant);
    }

    // 3. Productni tekshirish
    const targetProdId = productId || (variantId ? (await supabase.from('product_variants').select('product_id').eq('id', variantId).single()).data?.product_id : null);

    if (targetProdId) {
        const { data: product, error: prodError } = await supabase
            .from('products')
            .select('*')
            .eq('id', targetProdId)
            .single();
        console.log("Product Data:", product);
    } else {
        console.log("No Product ID found for this mapping.");
    }
}

// Skrinshottagi SKU: ABMARKE-ARZONSUM-ЧЕРН-13
// Kirill yozuvidagi ЧЕРН (CHERN) ni e'tiborga olib tekshiramiz
checkSkuData("ABMARKE-ARZONSUM-ЧЕРН-13");
