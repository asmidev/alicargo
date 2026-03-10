
-- Aggressive cleanup: unlink ALL variant_barcode listings for products with 5+ distinct titles
-- These are definitively mis-linked since the product has too many unrelated listings
WITH mislinked_products AS (
  SELECT product_id
  FROM marketplace_listings
  WHERE product_id IS NOT NULL
  GROUP BY product_id
  HAVING count(DISTINCT title) >= 5
)
UPDATE marketplace_listings
SET product_id = NULL, linked_at = NULL, link_strategy = NULL
WHERE product_id IN (SELECT product_id FROM mislinked_products)
  AND link_strategy = 'variant_barcode';
