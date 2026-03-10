UPDATE products p
SET tashkent_manual_stock = sub.max_stock
FROM (
  SELECT ml.product_id, MAX(ml.stock) as max_stock
  FROM marketplace_listings ml
  WHERE ml.fulfillment_type = 'fbs'
    AND ml.stock > 0
    AND ml.product_id IS NOT NULL
  GROUP BY ml.product_id
) sub
WHERE p.id = sub.product_id
  AND (p.tashkent_manual_stock = 0 OR p.tashkent_manual_stock IS NULL);