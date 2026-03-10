
-- Fix: Create missing product_items for variant products with stock but no items
-- This one-time migration ensures all variants have their corresponding product_items

-- First, fix any unboxed items with incorrect 'packed' status
UPDATE public.product_items 
SET status = 'pending' 
WHERE box_id IS NULL AND status = 'packed';

-- Create missing product_items for variants that have stock_quantity but fewer product_items than expected
INSERT INTO public.product_items (
  product_id,
  variant_id,
  item_uuid,
  status,
  location,
  unit_cost,
  unit_cost_currency,
  unit_cost_usd
)
SELECT 
  pv.product_id,
  pv.id as variant_id,
  'ITEM-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD((ROW_NUMBER() OVER (ORDER BY pv.id))::text, 6, '0') as item_uuid,
  'pending' as status,
  'china' as location,
  pv.price as unit_cost,
  'CNY' as unit_cost_currency,
  CASE WHEN pv.price IS NOT NULL THEN pv.price / 7.2 ELSE NULL END as unit_cost_usd
FROM public.product_variants pv
CROSS JOIN generate_series(1, GREATEST(COALESCE(pv.stock_quantity, 0), 0)) as seq
WHERE pv.is_active = true
  AND COALESCE(pv.stock_quantity, 0) > 0
  AND seq > (
    SELECT COUNT(*) 
    FROM public.product_items pi 
    WHERE pi.variant_id = pv.id AND pi.box_id IS NULL
  );

-- Also create product_items for non-variant products that have quantity but no items
INSERT INTO public.product_items (
  product_id,
  item_uuid,
  status,
  location,
  unit_cost,
  unit_cost_currency,
  unit_cost_usd
)
SELECT 
  p.id as product_id,
  'ITEM-' || to_char(now(), 'YYYYMMDD') || '-P' || LPAD((ROW_NUMBER() OVER (ORDER BY p.id))::text, 6, '0') as item_uuid,
  'pending' as status,
  'china' as location,
  p.price as unit_cost,
  COALESCE(p.purchase_currency, 'USD') as unit_cost_currency,
  p.purchase_price_usd as unit_cost_usd
FROM public.products p
CROSS JOIN generate_series(1, GREATEST(COALESCE(p.quantity, 0), 0)) as seq
WHERE COALESCE(p.has_variants, false) = false
  AND COALESCE(p.quantity, 0) > 0
  AND seq > (
    SELECT COUNT(*) 
    FROM public.product_items pi 
    WHERE pi.product_id = p.id AND pi.box_id IS NULL AND pi.variant_id IS NULL
  );
