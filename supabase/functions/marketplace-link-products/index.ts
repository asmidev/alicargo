import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * marketplace-link-products: Auto-links marketplace_listings to internal products
 * 
 * Multi-strategy linking approach:
 * 1. Exact barcode match (product.barcode)
 * 2. Variant barcode match (product_variants.barcode) - NEW!
 * 3. Title fuzzy match (contains)
 * 
 * Actions:
 * - auto_link / smart_link: Multi-strategy matching
 * - manual_link: Link a specific listing to a product
 * - unlink: Remove product link from a listing
 * - status: Get linking statistics
 */

// Calculate similarity between two strings (simple word overlap)
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const matchingWords = words1.filter(w1 => 
    words2.some(w2 => w1 === w2)
  );
  
  return matchingWords.length / Math.max(words1.length, words2.length);
}

interface Product {
  id: string;
  name: string;
  barcode: string | null;
}

interface ProductVariant {
  id: string;
  product_id: string;
  sku: string | null;
  barcode: string | null;
}

interface Listing {
  id: string;
  external_barcode: string | null;
  external_sku: string | null;
  title: string | null;
  price: number | null;
  store_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      action = 'auto_link',
      store_id,
      listing_id,
      product_id,
      min_title_similarity = 0.5, // Minimum similarity for title matching
    } = await req.json();

    let result: unknown = null;

    if (action === 'auto_link' || action === 'smart_link') {
      // Smart multi-strategy auto-linking
      console.log(`[marketplace-link-products] Starting smart auto-link${store_id ? ` for store ${store_id}` : ' for all stores'}...`);
      
      // Get unlinked listings
      let listingsQuery = supabase
        .from('marketplace_listings')
        .select('id, external_barcode, external_sku, title, store_id')
        .is('product_id', null);
      
      if (store_id) {
        listingsQuery = listingsQuery.eq('store_id', store_id);
      }
      
      const { data: unlinkedListings, error: listingsError } = await listingsQuery;
      
      if (listingsError) {
        throw new Error(`Failed to fetch listings: ${listingsError.message}`);
      }
      
      console.log(`[marketplace-link-products] Found ${unlinkedListings?.length || 0} unlinked listings`);
      
      // Get all products with barcodes
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, barcode');
      
      if (productsError) {
        throw new Error(`Failed to fetch products: ${productsError.message}`);
      }
      
      console.log(`[marketplace-link-products] Found ${products?.length || 0} products to match against`);
      
      // NEW: Also fetch product variants with barcodes
      // Fetch ALL product variants (with barcode OR sku) for matching
      const { data: productVariants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, product_id, sku, barcode');
      
      if (variantsError) {
        console.warn(`[marketplace-link-products] Failed to fetch variants: ${variantsError.message}`);
      }
      
      console.log(`[marketplace-link-products] Found ${productVariants?.length || 0} variants for matching`);
      
      // Helper: normalize barcode (remove leading zeros, trim whitespace)
      const normalizeBarcode = (code: string | null | undefined): string => {
        if (!code) return '';
        return code.replace(/^0+/, '').trim().toLowerCase();
      };
      
      // Create normalized barcode-to-product lookup maps
      const productBarcodeMap: Record<string, Product> = {};
      for (const product of (products as Product[] || [])) {
        if (product.barcode) {
          const normalized = normalizeBarcode(product.barcode);
          if (normalized) {
            productBarcodeMap[normalized] = product;
          }
        }
      }
      
      // Create normalized variant barcode to product_id lookup
      const variantBarcodeToProductId: Record<string, string> = {};
      // Track how many variants each product has (for size guard)
      const productVariantCount: Record<string, number> = {};
      for (const variant of (productVariants as ProductVariant[] || [])) {
        productVariantCount[variant.product_id] = (productVariantCount[variant.product_id] || 0) + 1;
        if (variant.barcode && variant.product_id) {
          const normalized = normalizeBarcode(variant.barcode);
          if (normalized) {
            variantBarcodeToProductId[normalized] = variant.product_id;
          }
        }
      }
      
      // Create variant SKU to product_id lookup (for SKU-based matching)
      const variantSkuToProductId: Record<string, string> = {};
      for (const variant of (productVariants as ProductVariant[] || [])) {
        if (variant.sku && variant.product_id) {
          variantSkuToProductId[variant.sku.trim().toLowerCase()] = variant.product_id;
        }
      }
      
      let linkedByBarcode = 0;
      let linkedByVariantBarcode = 0;
      let linkedByVariantSku = 0;
      let linkedByTitle = 0;
      let notFound = 0;
      const linkDetails: Array<{ 
        listing_id: string; 
        product_id: string; 
        product_name: string;
        strategy: string;
      }> = [];
      
      for (const listing of (unlinkedListings as Listing[] || [])) {
        let matchedProduct: Product | null = null;
        let matchStrategy = '';
        
        // Strategy 1: Normalized product barcode match (highest confidence)
        if (!matchedProduct && listing.external_barcode) {
          const normalizedListingBarcode = normalizeBarcode(listing.external_barcode);
          if (normalizedListingBarcode && productBarcodeMap[normalizedListingBarcode]) {
            matchedProduct = productBarcodeMap[normalizedListingBarcode];
            matchStrategy = 'barcode';
            linkedByBarcode++;
          }
        }
        
        // Strategy 2: Normalized variant barcode match
        // GUARD: Skip variant_barcode matching for generic products (short names < 8 chars)
        // GUARD: Skip if product already has 15+ variants (likely a mis-linked magnet)
        // GUARD: Validate title overlap to prevent cross-product barcode pollution
        if (!matchedProduct && listing.external_barcode) {
          const normalizedListingBarcode = normalizeBarcode(listing.external_barcode);
          if (normalizedListingBarcode && variantBarcodeToProductId[normalizedListingBarcode]) {
            const productId = variantBarcodeToProductId[normalizedListingBarcode];
            const candidateProduct = (products as Product[]).find(p => p.id === productId) || null;
            
            if (candidateProduct) {
              const productName = candidateProduct.name.toLowerCase().trim();
              const variantCount = productVariantCount[productId] || 0;
              
              // Guard 1: Skip generic short product names (< 8 chars)
              if (productName.length < 8) {
                console.log(`[marketplace-link-products] SKIP variant_barcode: product "${candidateProduct.name}" too short (${productName.length} chars) for listing "${listing.title}"`);
              }
              // Guard 2: Skip products with too many variants (likely mis-linked)
              else if (variantCount >= 15) {
                console.log(`[marketplace-link-products] SKIP variant_barcode: product "${candidateProduct.name}" has ${variantCount} variants (max 15) for listing "${listing.title}"`);
              }
              // Guard 3: Title validation - at least 40% word overlap
              else {
                const titleOverlap = listing.title ? calculateSimilarity(listing.title.toLowerCase(), productName) : 0;
                if (titleOverlap >= 0.3 || !listing.title) {
                  matchedProduct = candidateProduct;
                  matchStrategy = 'variant_barcode';
                  linkedByVariantBarcode++;
                } else {
                  console.log(`[marketplace-link-products] SKIP variant_barcode: low title overlap (${(titleOverlap * 100).toFixed(0)}%) between "${listing.title}" and product "${candidateProduct.name}"`);
                }
              }
            }
          }
        }
        
        // Strategy 2.5: External SKU to variant SKU match (NEW!)
        if (!matchedProduct && listing.external_sku) {
          const normalizedSku = listing.external_sku.trim().toLowerCase();
          if (normalizedSku && variantSkuToProductId[normalizedSku]) {
            const productId = variantSkuToProductId[normalizedSku];
            matchedProduct = (products as Product[]).find(p => p.id === productId) || null;
            if (matchedProduct) {
              matchStrategy = 'variant_sku';
              linkedByVariantSku++;
            }
          }
        }
        
        // Strategy 3: Title similarity (fuzzy match) - TIGHTENED threshold
        // Increased from 0.5 to 0.7 to reduce false positives
        const STRICT_TITLE_SIMILARITY = Math.max(min_title_similarity, 0.7);
        
        if (!matchedProduct && listing.title && products) {
          const listingTitle = listing.title.toLowerCase().trim();
          let bestMatch: Product | null = null;
          let bestSimilarity = 0;
          
          for (const product of (products as Product[])) {
            const productName = product.name.toLowerCase().trim();
            
            // Check exact contains — only if product name is 12+ chars and listing title contains it
            // Increased from 8 to 12 to prevent generic names like "Silikon", "Bioaqua" from matching
            if (productName.length >= 12 && productName.length <= 60 && listingTitle.includes(productName)) {
              bestMatch = product;
              bestSimilarity = 1;
              break;
            }
            
            // Calculate word-based similarity with stricter threshold
            const similarity = calculateSimilarity(listingTitle, productName);
            if (similarity > bestSimilarity && similarity >= STRICT_TITLE_SIMILARITY) {
              bestSimilarity = similarity;
              bestMatch = product;
            }
          }
          
          if (bestMatch && bestSimilarity >= STRICT_TITLE_SIMILARITY) {
            matchedProduct = bestMatch;
            matchStrategy = 'title';
            linkedByTitle++;
          }
        }
        
        // Link the listing if a match was found
        if (matchedProduct) {
          const { error: updateError } = await supabase
            .from('marketplace_listings')
            .update({ 
              product_id: matchedProduct.id,
              linked_at: new Date().toISOString(),
              link_strategy: matchStrategy,
            })
            .eq('id', listing.id);
          
          if (!updateError) {
            linkDetails.push({
              listing_id: listing.id,
              product_id: matchedProduct.id,
              product_name: matchedProduct.name,
              strategy: matchStrategy,
            });
          }
        } else {
          notFound++;
        }
      }
      
      const totalLinked = linkedByBarcode + linkedByVariantBarcode + linkedByVariantSku + linkedByTitle;
      console.log(`[marketplace-link-products] Smart link complete: ${totalLinked} linked (barcode: ${linkedByBarcode}, variant_barcode: ${linkedByVariantBarcode}, variant_sku: ${linkedByVariantSku}, title: ${linkedByTitle}), ${notFound} no match`);
      
      result = {
        action: 'smart_link',
        total_checked: unlinkedListings?.length || 0,
        total_linked: totalLinked,
        linked_by_barcode: linkedByBarcode,
        linked_by_variant_barcode: linkedByVariantBarcode,
        linked_by_variant_sku: linkedByVariantSku,
        linked_by_title: linkedByTitle,
        not_found: notFound,
        details: linkDetails.slice(0, 50), // Return first 50 for reference
      };
      
    } else if (action === 'manual_link') {
      // Manually link a specific listing to a product
      if (!listing_id || !product_id) {
        throw new Error('listing_id and product_id are required for manual_link');
      }
      
      const { error: updateError } = await supabase
        .from('marketplace_listings')
        .update({ 
          product_id,
          linked_at: new Date().toISOString(),
          link_strategy: 'manual',
        })
        .eq('id', listing_id);
      
      if (updateError) {
        throw new Error(`Failed to link: ${updateError.message}`);
      }
      
      result = {
        action: 'manual_link',
        success: true,
        listing_id,
        product_id,
      };
      
    } else if (action === 'unlink') {
      // Remove product link from a listing
      if (!listing_id) {
        throw new Error('listing_id is required for unlink');
      }
      
      const { error: updateError } = await supabase
        .from('marketplace_listings')
        .update({ 
          product_id: null,
          linked_at: null,
          link_strategy: null,
        })
        .eq('id', listing_id);
      
      if (updateError) {
        throw new Error(`Failed to unlink: ${updateError.message}`);
      }
      
      result = {
        action: 'unlink',
        success: true,
        listing_id,
      };
      
    } else if (action === 'status') {
      // Get linking statistics
      let linkedQuery = supabase
        .from('marketplace_listings')
        .select('id, link_strategy', { count: 'exact' })
        .not('product_id', 'is', null);
      
      let unlinkedQuery = supabase
        .from('marketplace_listings')
        .select('id', { count: 'exact' })
        .is('product_id', null);
      
      let unlinkedWithBarcodeQuery = supabase
        .from('marketplace_listings')
        .select('id', { count: 'exact' })
        .is('product_id', null)
        .not('external_barcode', 'is', null);
      
      if (store_id) {
        linkedQuery = linkedQuery.eq('store_id', store_id);
        unlinkedQuery = unlinkedQuery.eq('store_id', store_id);
        unlinkedWithBarcodeQuery = unlinkedWithBarcodeQuery.eq('store_id', store_id);
      }
      
      const [linkedResult, unlinkedResult, unlinkedWithBarcodeResult] = await Promise.all([
        linkedQuery,
        unlinkedQuery,
        unlinkedWithBarcodeQuery,
      ]);
      
      // Count by strategy
      const strategyCount: Record<string, number> = {};
      for (const listing of (linkedResult.data || [])) {
        const strategy = (listing as { link_strategy?: string }).link_strategy || 'unknown';
        strategyCount[strategy] = (strategyCount[strategy] || 0) + 1;
      }
      
      result = {
        action: 'status',
        linked_count: linkedResult.count || 0,
        unlinked_count: unlinkedResult.count || 0,
        unlinked_with_barcode: unlinkedWithBarcodeResult.count || 0,
        link_rate: linkedResult.count && (linkedResult.count + (unlinkedResult.count || 0)) > 0
          ? Math.round((linkedResult.count / (linkedResult.count + (unlinkedResult.count || 0))) * 100)
          : 0,
        by_strategy: strategyCount,
      };
      
    } else if (action === 'create_from_listings') {
      // PHASE G: Auto-create products from unlinked marketplace listings
      console.log(`[marketplace-link-products] Starting create_from_listings action...`);
      
      // Get unlinked listings with titles (for product creation)
      let listingsQuery = supabase
        .from('marketplace_listings')
        .select('id, external_barcode, external_sku, title, price, store_id')
        .is('product_id', null)
        .not('title', 'is', null);
      
      if (store_id) {
        listingsQuery = listingsQuery.eq('store_id', store_id);
      }
      
      const { data: unlinkedListings, error: listingsError } = await listingsQuery.limit(200);
      
      if (listingsError) {
        throw new Error(`Failed to fetch listings: ${listingsError.message}`);
      }
      
      console.log(`[marketplace-link-products] Found ${unlinkedListings?.length || 0} unlinked listings with titles`);
      
      // Get existing products for deduplication
      const { data: existingProducts } = await supabase
        .from('products')
        .select('id, name, barcode');
      
      // Create a map for quick title lookup (lowercase, normalized)
      const existingProductsByTitle = new Map<string, { id: string; name: string }>();
      const existingProductsByBarcode = new Map<string, { id: string; name: string }>();
      
      for (const product of (existingProducts || [])) {
        const normalizedTitle = product.name.toLowerCase().trim().replace(/\s+/g, ' ');
        existingProductsByTitle.set(normalizedTitle, { id: product.id, name: product.name });
        
        if (product.barcode) {
          existingProductsByBarcode.set(product.barcode, { id: product.id, name: product.name });
        }
      }
      
      let productsCreated = 0;
      let listingsLinked = 0;
      let duplicatesSkipped = 0;
      const createdProducts: Array<{ name: string; barcode: string | null; linked_listings: number }> = [];
      
      // Group listings by normalized title for deduplication
      const listingsByTitle = new Map<string, Listing[]>();
      
      for (const listing of (unlinkedListings as Listing[] || [])) {
        if (!listing.title) continue;
        
        const normalizedTitle = listing.title.toLowerCase().trim().replace(/\s+/g, ' ');
        
        if (!listingsByTitle.has(normalizedTitle)) {
          listingsByTitle.set(normalizedTitle, []);
        }
        listingsByTitle.get(normalizedTitle)!.push(listing);
      }
      
      console.log(`[marketplace-link-products] Grouped into ${listingsByTitle.size} unique product titles`);
      
      // Process each unique title
      for (const [normalizedTitle, listings] of listingsByTitle) {
        // Check if product with this title already exists
        if (existingProductsByTitle.has(normalizedTitle)) {
          const existingProduct = existingProductsByTitle.get(normalizedTitle)!;
          
          // Link all listings to existing product
          for (const listing of listings) {
            await supabase
              .from('marketplace_listings')
              .update({ 
                product_id: existingProduct.id,
                linked_at: new Date().toISOString(),
                link_strategy: 'auto_create_existing',
              })
              .eq('id', listing.id);
            listingsLinked++;
          }
          duplicatesSkipped++;
          continue;
        }
        
        // Check if product with same barcode exists
        // GUARD: Only match if existing product name has meaningful overlap with listing title
        const firstListing = listings[0];
        if (firstListing.external_barcode && existingProductsByBarcode.has(firstListing.external_barcode)) {
          const existingProduct = existingProductsByBarcode.get(firstListing.external_barcode)!;
          
          // Title overlap guard: prevent barcode corruption where unrelated products share a barcode
          const listingTitle = (firstListing.title || '').toLowerCase().trim();
          const existingName = existingProduct.name.toLowerCase().trim();
          const titleOverlap = calculateSimilarity(listingTitle, existingName);
          
          if (titleOverlap >= 0.3 || existingName.length < 4) {
            // Link all listings to existing product
            for (const listing of listings) {
              await supabase
                .from('marketplace_listings')
                .update({ 
                  product_id: existingProduct.id,
                  linked_at: new Date().toISOString(),
                  link_strategy: 'auto_create_barcode',
                })
                .eq('id', listing.id);
              listingsLinked++;
            }
            duplicatesSkipped++;
            continue;
          } else {
            console.log(`[marketplace-link-products] SKIP barcode match in create_from_listings: low title overlap (${(titleOverlap * 100).toFixed(0)}%) between listing "${firstListing.title}" and product "${existingProduct.name}" (barcode: ${firstListing.external_barcode})`);
            // Fall through to create a new product instead
          }
        }
        
        // Create new product from listing
        const productUUID = `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            uuid: productUUID,
            name: firstListing.title!,
            barcode: firstListing.external_barcode || null,
            status: 'pending',
            has_variants: true,
            price: typeof firstListing.price === 'number' ? firstListing.price : null,
            purchase_currency: 'UZS',
            source: 'marketplace_auto',
          })
          .select('id, name')
          .single();
        
        if (createError) {
          console.error(`[marketplace-link-products] Failed to create product: ${createError.message}`);
          continue;
        }
        
        // Auto-create default variant with barcode
        const variantSku = `${productUUID}-V1`;
        const { error: variantError } = await supabase
          .from('product_variants')
          .insert({
            product_id: newProduct.id,
            sku: variantSku,
            barcode: firstListing.external_barcode || null,
            price: typeof firstListing.price === 'number' ? firstListing.price : null,
            stock_quantity: 0,
            is_active: true,
          });
        
        if (variantError) {
          console.warn(`[marketplace-link-products] Failed to create variant for ${newProduct.name}: ${variantError.message}`);
        }
        
        productsCreated++;
        
        // Link all listings with same title to this new product
        for (const listing of listings) {
          await supabase
            .from('marketplace_listings')
            .update({ 
              product_id: newProduct.id,
              linked_at: new Date().toISOString(),
              link_strategy: 'auto_create',
            })
            .eq('id', listing.id);
          listingsLinked++;
        }
        
        // Update lookup maps
        existingProductsByTitle.set(normalizedTitle, { id: newProduct.id, name: newProduct.name });
        if (firstListing.external_barcode) {
          existingProductsByBarcode.set(firstListing.external_barcode, { id: newProduct.id, name: newProduct.name });
        }
        
        createdProducts.push({
          name: newProduct.name,
          barcode: firstListing.external_barcode,
          linked_listings: listings.length,
        });
      }
      
      console.log(`[marketplace-link-products] Create from listings complete: ${productsCreated} products created, ${listingsLinked} listings linked, ${duplicatesSkipped} duplicates skipped`);
      
      result = {
        action: 'create_from_listings',
        listings_processed: unlinkedListings?.length || 0,
        unique_titles: listingsByTitle.size,
        products_created: productsCreated,
        listings_linked: listingsLinked,
        duplicates_skipped: duplicatesSkipped,
        created_products: createdProducts.slice(0, 30), // Return first 30 for reference
      };
    } else if (action === 'relink') {
      // Re-link title-based listings using barcode matching where possible
      // WITH SAFETY GUARDS matching smart_link
      console.log(`[marketplace-link-products] Starting relink action (with guards)...`);
      
      // Get listings linked by title that have barcodes — also fetch title for validation
      let relinkQuery = supabase
        .from('marketplace_listings')
        .select('id, external_barcode, product_id, title')
        .eq('link_strategy', 'title')
        .not('external_barcode', 'is', null);
      
      if (store_id) {
        relinkQuery = relinkQuery.eq('store_id', store_id);
      }
      
      const { data: titleListings, error: relinkError } = await relinkQuery;
      
      if (relinkError) {
        throw new Error(`Failed to fetch title listings: ${relinkError.message}`);
      }
      
      // Get all products with barcodes AND names (for guards)
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, barcode')
        .not('barcode', 'is', null);
      
      // Build product lookup by id for name checks
      const productById: Record<string, { id: string; name: string; barcode: string | null }> = {};
      const barcodeToProduct: Record<string, string> = {};
      for (const p of (allProducts || [])) {
        productById[p.id] = p;
        if (p.barcode) {
          barcodeToProduct[p.barcode.replace(/^0+/, '').trim().toLowerCase()] = p.id;
        }
      }
      
      // Also check variant barcodes — track variant counts per product
      const { data: allVariants } = await supabase
        .from('product_variants')
        .select('product_id, barcode')
        .not('barcode', 'is', null);
      
      const relinkVariantCount: Record<string, number> = {};
      const variantBarcodeToProduct: Record<string, string> = {};
      for (const v of (allVariants || [])) {
        relinkVariantCount[v.product_id] = (relinkVariantCount[v.product_id] || 0) + 1;
        if (v.barcode) {
          const norm = v.barcode.replace(/^0+/, '').trim().toLowerCase();
          if (!variantBarcodeToProduct[norm]) {
            variantBarcodeToProduct[norm] = v.product_id;
          }
        }
      }
      
      let relinkedCount = 0;
      let unchangedCount = 0;
      let skippedByGuard = 0;
      
      for (const listing of (titleListings || []) as Array<{ id: string; external_barcode: string | null; product_id: string; title: string | null }>) {
        if (!listing.external_barcode) continue;
        const normBarcode = listing.external_barcode.replace(/^0+/, '').trim().toLowerCase();
        
        // Check direct product barcode first
        let matchedProductId = barcodeToProduct[normBarcode];
        let strategy = 'relink_barcode';
        
        // If no direct match, try variant barcode with guards
        if (!matchedProductId && variantBarcodeToProduct[normBarcode]) {
          const candidateProductId = variantBarcodeToProduct[normBarcode];
          const candidateProduct = productById[candidateProductId];
          
          if (candidateProduct) {
            const productName = candidateProduct.name.toLowerCase().trim();
            const variantCount = relinkVariantCount[candidateProductId] || 0;
            
            // Guard 1: Skip generic short product names (< 8 chars)
            if (productName.length < 8) {
              console.log(`[relink] SKIP: product "${candidateProduct.name}" too short for listing "${listing.title}"`);
              skippedByGuard++;
              unchangedCount++;
              continue;
            }
            // Guard 2: Skip products with too many variants
            if (variantCount >= 15) {
              console.log(`[relink] SKIP: product "${candidateProduct.name}" has ${variantCount} variants for listing "${listing.title}"`);
              skippedByGuard++;
              unchangedCount++;
              continue;
            }
            // Guard 3: Title overlap validation (>= 30%)
            const titleOverlap = listing.title ? calculateSimilarity(listing.title.toLowerCase(), productName) : 0;
            if (titleOverlap < 0.3 && listing.title) {
              console.log(`[relink] SKIP: low title overlap (${(titleOverlap * 100).toFixed(0)}%) "${listing.title}" vs "${candidateProduct.name}"`);
              skippedByGuard++;
              unchangedCount++;
              continue;
            }
            
            matchedProductId = candidateProductId;
            strategy = 'relink_variant_barcode';
          }
        }
        
        if (matchedProductId) {
          await supabase
            .from('marketplace_listings')
            .update({
              product_id: matchedProductId,
              link_strategy: strategy,
              linked_at: new Date().toISOString(),
            })
            .eq('id', listing.id);
          relinkedCount++;
        } else {
          unchangedCount++;
        }
      }
      
      console.log(`[marketplace-link-products] Relink complete: ${relinkedCount} relinked, ${unchangedCount} unchanged, ${skippedByGuard} skipped by guards`);
      
      result = {
        action: 'relink',
        total_checked: titleListings?.length || 0,
        relinked: relinkedCount,
        unchanged: unchangedCount,
        skipped_by_guard: skippedByGuard,
      };
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
