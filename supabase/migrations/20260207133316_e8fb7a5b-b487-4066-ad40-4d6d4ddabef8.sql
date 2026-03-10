
-- QADAM 1: Title-linked listinglardan yangi variant barcode yaratish
INSERT INTO product_variants (product_id, sku, barcode, price, stock_quantity)
SELECT DISTINCT ON (ml.external_barcode)
  ml.product_id,
  ml.external_barcode,
  ml.external_barcode,
  ml.price,
  0
FROM marketplace_listings ml
WHERE ml.link_strategy = 'title'
  AND ml.external_barcode IS NOT NULL AND ml.external_barcode != ''
  AND NOT EXISTS (
    SELECT 1 FROM product_variants pv 
    WHERE pv.barcode = ml.external_barcode
  );

-- QADAM 2: Title-linked listinglarni barcode strategiyaga o'tkazish
UPDATE marketplace_listings ml
SET link_strategy = 'barcode'
WHERE ml.link_strategy = 'title'
  AND ml.external_barcode IS NOT NULL AND ml.external_barcode != ''
  AND EXISTS (
    SELECT 1 FROM product_variants pv 
    WHERE pv.barcode = ml.external_barcode
    AND pv.product_id = ml.product_id
  );

-- QADAM 3: Noto'g'ri linklarni unlink qilish (title juda qisqa, listing juda uzun)
UPDATE marketplace_listings ml
SET product_id = NULL, link_strategy = NULL
FROM products p
WHERE ml.product_id = p.id
  AND ml.link_strategy = 'title'
  AND LENGTH(ml.title) > LENGTH(p.name) * 3;
