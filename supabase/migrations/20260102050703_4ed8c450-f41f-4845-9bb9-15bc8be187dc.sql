
-- Fix: Remove duplicate unboxed product_items that exceed variant stock_quantity
-- This corrects the over-creation from the previous migration

-- Delete excess unboxed items for variants where actual count exceeds stock_quantity
DELETE FROM product_items 
WHERE id IN (
  SELECT pi.id 
  FROM product_items pi
  JOIN product_variants pv ON pv.id = pi.variant_id
  WHERE pi.box_id IS NULL
    AND pi.item_uuid LIKE 'ITEM-20260102-%'  -- Only items created by today's migration
);
