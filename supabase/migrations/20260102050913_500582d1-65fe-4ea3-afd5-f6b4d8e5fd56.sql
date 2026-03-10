
-- Create missing product_items for all variant products that have stock but no items
-- Only create items where variant has stock_quantity > current item count

INSERT INTO public.product_items (
  product_id,
  variant_id,
  item_uuid,
  status,
  location,
  unit_cost,
  unit_cost_currency
)
SELECT 
  pv.product_id,
  pv.id as variant_id,
  'ITEM-' || to_char(now(), 'YYYYMMDD') || '-V' || LPAD((ROW_NUMBER() OVER (ORDER BY pv.id, seq))::text, 6, '0') as item_uuid,
  'pending' as status,
  'china' as location,
  pv.price as unit_cost,
  'CNY' as unit_cost_currency
FROM public.product_variants pv
CROSS JOIN generate_series(1, 1000) as seq -- Max 1000 items per variant
WHERE pv.is_active = true
  AND COALESCE(pv.stock_quantity, 0) > 0
  AND seq <= pv.stock_quantity
  AND seq > (
    SELECT COUNT(*) 
    FROM public.product_items pi 
    WHERE pi.variant_id = pv.id
  );
