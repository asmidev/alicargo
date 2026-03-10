
-- QADAM 1: Barcode-li, variantsiz mahsulotlarga default variant yaratish
INSERT INTO product_variants (product_id, sku, barcode, price, stock_quantity)
SELECT p.id, p.uuid || '-V1', p.barcode, p.price, 0
FROM products p
WHERE p.barcode IS NOT NULL AND p.barcode != ''
  AND NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id);

-- QADAM 2: Mavjud variantlarga parent product barcode ni copy qilish
UPDATE product_variants pv
SET barcode = p.barcode
FROM products p
WHERE pv.product_id = p.id
  AND (pv.barcode IS NULL OR pv.barcode = '')
  AND p.barcode IS NOT NULL AND p.barcode != '';

-- QADAM 3: Title-link larni barcode-link ga qayta belgilash (agar barcode mos kelsa)
UPDATE marketplace_listings ml
SET link_strategy = 'barcode'
WHERE ml.link_strategy = 'title'
  AND ml.external_barcode IS NOT NULL
  AND ml.external_barcode != ''
  AND ml.product_id IN (
    SELECT p.id FROM products p 
    WHERE p.barcode IS NOT NULL 
      AND p.barcode != ''
      AND LOWER(TRIM(p.barcode)) = LOWER(TRIM(ml.external_barcode))
  );
