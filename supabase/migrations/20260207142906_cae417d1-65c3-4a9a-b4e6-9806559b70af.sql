-- QADAM 4: Backfill — Uzum inactive A/B -> C
UPDATE marketplace_listings 
SET product_rank = CASE 
  WHEN product_rank IN ('A', 'B') AND status = 'inactive' THEN 'C'
  ELSE product_rank
END
WHERE product_rank IN ('A', 'B') 
  AND status = 'inactive'
  AND store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'uzum');

-- Uzum active D with stock -> C
UPDATE marketplace_listings 
SET product_rank = 'C'
WHERE product_rank = 'D' 
  AND status = 'active' 
  AND stock > 0
  AND store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'uzum');

-- Yandex: stock-based differentiation
UPDATE marketplace_listings 
SET product_rank = CASE 
  WHEN stock > 20 THEN 'B'
  WHEN stock > 0 THEN 'C'
  ELSE 'D'
END
WHERE store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'yandex');