
-- Phase 1: Clean up mis-linked listings
-- Step 1: Unlink variant_barcode listings where the product has 5+ distinct titles
-- AND the listing title doesn't contain the product name (case-insensitive)
WITH mislinked_products AS (
  SELECT product_id
  FROM marketplace_listings
  WHERE product_id IS NOT NULL AND link_strategy = 'variant_barcode'
  GROUP BY product_id
  HAVING count(DISTINCT title) >= 5
),
listings_to_unlink AS (
  SELECT ml.id
  FROM marketplace_listings ml
  JOIN products p ON p.id = ml.product_id
  WHERE ml.product_id IN (SELECT product_id FROM mislinked_products)
    AND ml.link_strategy = 'variant_barcode'
    AND ml.title IS NOT NULL
    AND lower(ml.title) NOT LIKE '%' || lower(p.name) || '%'
)
UPDATE marketplace_listings
SET product_id = NULL, linked_at = NULL, link_strategy = NULL
WHERE id IN (SELECT id FROM listings_to_unlink);

-- Step 2: Delete orphaned auto-created variants for "sumka" product
-- These 112 variants were bulk-inserted on Feb 7 and are not the original 2 manual variants
-- Keep only variants created before Feb 7 (the original manual ones)
DELETE FROM product_variants
WHERE product_id = '435846cf-792d-4ca5-a6ea-bbcb69f7f12f'
  AND created_at::date = '2026-02-07';

-- Step 3: Also clean up orphaned variants for other top offenders
-- Delete variants that were bulk-created and have barcodes matching marketplace listings
-- but belong to products with 5+ distinct listing titles (mis-linked products)
DELETE FROM product_variants pv
USING (
  SELECT p.id as product_id
  FROM products p
  JOIN marketplace_listings ml ON ml.product_id = p.id
  WHERE ml.link_strategy = 'variant_barcode'
  GROUP BY p.id
  HAVING count(DISTINCT ml.title) >= 5
) mislinked
WHERE pv.product_id = mislinked.product_id
  AND pv.created_at::date = '2026-02-07';
