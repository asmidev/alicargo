-- Commission Backfill + Finance Transactions Fix

-- Step 1: Barcode matching for Uzum
UPDATE marketplace_orders mo
SET commission = ROUND(mo.total_amount * ml.commission_rate / 100)
FROM (
  SELECT DISTINCT ON (external_barcode, store_id) 
    external_barcode, store_id, commission_rate
  FROM marketplace_listings 
  WHERE commission_rate > 0 AND external_barcode IS NOT NULL
  ORDER BY external_barcode, store_id, last_synced_at DESC NULLS LAST
) ml
WHERE ml.store_id = mo.store_id
  AND ml.external_barcode = (mo.items->0->>'barcode')
  AND (mo.commission IS NULL OR mo.commission = 0)
  AND mo.fulfillment_status = 'delivered'
  AND mo.store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'uzum');

-- Step 2: productId matching for remaining Uzum orders
UPDATE marketplace_orders mo
SET commission = ROUND(mo.total_amount * ml.commission_rate / 100)
FROM (
  SELECT DISTINCT ON (external_product_id, store_id) 
    external_product_id, store_id, commission_rate
  FROM marketplace_listings 
  WHERE commission_rate > 0 AND external_product_id IS NOT NULL
  ORDER BY external_product_id, store_id, last_synced_at DESC NULLS LAST
) ml
WHERE ml.store_id = mo.store_id
  AND ml.external_product_id = (mo.items->0->>'productId')::text
  AND (mo.commission IS NULL OR mo.commission = 0)
  AND mo.fulfillment_status = 'delivered'
  AND mo.store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'uzum');

-- Step 3: Store average rate fallback for remaining Uzum orders
UPDATE marketplace_orders mo
SET commission = ROUND(mo.total_amount * avg_rates.avg_rate / 100)
FROM (
  SELECT store_id, AVG(commission_rate) as avg_rate
  FROM marketplace_listings
  WHERE commission_rate > 0
  GROUP BY store_id
) avg_rates
WHERE avg_rates.store_id = mo.store_id
  AND (mo.commission IS NULL OR mo.commission = 0)
  AND mo.fulfillment_status = 'delivered'
  AND mo.total_amount > 0
  AND mo.store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'uzum');

-- Step 4: Yandex 5% fallback
UPDATE marketplace_orders
SET commission = ROUND(total_amount * 0.05)
WHERE (commission IS NULL OR commission = 0)
  AND fulfillment_status = 'delivered'
  AND total_amount > 0
  AND store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'yandex');

-- Step 5: Fix finance_transactions from GROSS to NET (both UUID, direct comparison)
UPDATE finance_transactions ft
SET 
  amount = mo.total_amount - mo.commission,
  marketplace_commission = mo.commission
FROM marketplace_orders mo
WHERE ft.reference_id = mo.id
  AND ft.reference_type = 'marketplace_order'
  AND mo.commission > 0
  AND (ft.marketplace_commission IS NULL OR ft.marketplace_commission = 0);