
-- Phase 1: Data Cleanup

-- Step 1: Unlink all 84 "phantom barcode" listings where link_strategy = 'barcode'
-- but external_barcode does NOT match the product's actual barcode
UPDATE marketplace_listings ml
SET product_id = NULL, linked_at = NULL, link_strategy = NULL
FROM products p
WHERE ml.product_id = p.id
  AND ml.link_strategy = 'barcode'
  AND ml.external_barcode IS NOT NULL
  AND p.barcode IS NOT NULL
  AND LOWER(TRIM(REPLACE(ml.external_barcode, ' ', ''))) != LOWER(TRIM(REPLACE(p.barcode, ' ', '')));

-- Step 2: Unlink all listings from products that have 5+ distinct listing titles
-- (these are mis-linked magnets like Silikon, Bioaqua)
WITH bad_products AS (
  SELECT ml.product_id
  FROM marketplace_listings ml
  WHERE ml.product_id IS NOT NULL
  GROUP BY ml.product_id
  HAVING COUNT(DISTINCT LOWER(TRIM(ml.title))) >= 5
)
UPDATE marketplace_listings ml
SET product_id = NULL, linked_at = NULL, link_strategy = NULL
FROM bad_products bp
WHERE ml.product_id = bp.product_id;
