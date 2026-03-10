-- Expand product_inventory_overview to include non-active product statuses used in the app
-- This fixes empty Key Indicators table when products are in 'arrived' or 'pending' status.

CREATE OR REPLACE VIEW public.product_inventory_overview AS
SELECT
  p.id,
  p.name,
  p.main_image_url,
  p.selling_price,
  p.avg_daily_sales,
  p.tashkent_manual_stock,
  p.warehouse_price,
  ch.name AS category_name,
  COALESCE(
    (
      SELECT count(*) AS count
      FROM public.product_items pi
      JOIN public.boxes b ON pi.box_id = b.id
      WHERE pi.product_id = p.id
        AND (b.status = ANY (ARRAY['in_transit'::text, 'in_china'::text, 'customs'::text, 'delivered'::text]))
        AND b.location <> 'uzbekistan'::text
    ),
    0::bigint
  ) AS in_transit_count,
  COALESCE(
    (
      SELECT count(*) AS count
      FROM public.product_items pi
      JOIN public.boxes b ON pi.box_id = b.id
      WHERE pi.product_id = p.id
        AND b.location = 'uzbekistan'::text
        AND pi.status <> 'sold'::text
    ),
    0::bigint
  ) AS tashkent_count,
  COALESCE(
    (
      SELECT sum(ml.marketplace_stock) AS sum
      FROM public.marketplace_listings ml
      WHERE ml.product_id = p.id
    ),
    0::bigint
  ) AS marketplace_stock,
  (
    SELECT jsonb_object_agg(ms.name, ml.marketplace_stock) AS jsonb_object_agg
    FROM public.marketplace_listings ml
    JOIN public.marketplace_stores ms ON ml.store_id = ms.id
    WHERE ml.product_id = p.id
      AND ml.marketplace_stock > 0
  ) AS marketplace_breakdown,
  NULL::numeric AS predicted_demand,
  NULL::numeric AS recommended_reorder,
  NULL::numeric AS calculated_avg_daily_sales,
  NULL::numeric AS days_until_stockout,
  NULL::text AS optimal_reorder_date
FROM public.products p
LEFT JOIN public.categories_hierarchy ch ON p.category_id = ch.id
WHERE p.status IN ('active','arrived','pending')
ORDER BY p.name;
