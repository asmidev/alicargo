
-- 1. Dublikatlarni o'chirish (eng oxirgi yozuvni saqlash)
DELETE FROM marketplace_listings
WHERE external_product_id IS NOT NULL
AND id NOT IN (
  SELECT DISTINCT ON (store_id, external_product_id) id
  FROM marketplace_listings
  WHERE external_product_id IS NOT NULL
  ORDER BY store_id, external_product_id, updated_at DESC NULLS LAST
);

-- 2. NULL external_product_id larni o'chirish
DELETE FROM marketplace_listings 
WHERE external_product_id IS NULL;

-- 3. Kelajakda dublikatlarni oldini olish
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_store_ext_product 
ON marketplace_listings(store_id, external_product_id) 
WHERE external_product_id IS NOT NULL;
