-- auto_distribute_box_shipping_cost funksiyasini yangilash
-- Nuqsonli (defective) va yetishmayotgan (missing) mahsulotlarni xarajat taqsimotidan chiqarish

CREATE OR REPLACE FUNCTION public.auto_distribute_box_shipping_cost(p_box_id uuid, p_shipping_cost numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_count int;
  cost_per_item numeric;
BEGIN
  -- Faqat OK statusli mahsulotlarni sanash (defective va missing emas)
  SELECT COUNT(*) INTO item_count 
  FROM public.product_items pi
  LEFT JOIN public.verification_items vi ON vi.product_item_id = pi.id
  WHERE pi.box_id = p_box_id
  AND (vi.status IS NULL OR vi.status = 'ok');
  
  IF item_count = 0 THEN
    RAISE NOTICE 'No OK items found in box %', p_box_id;
    RETURN;
  END IF;
  
  cost_per_item := p_shipping_cost / item_count;
  
  -- Faqat OK mahsulotlarga xarajatni taqsimlash
  UPDATE public.product_items pi
  SET 
    international_shipping_cost = cost_per_item,
    final_cost_usd = COALESCE(unit_cost_usd, 0) + COALESCE(domestic_shipping_cost, 0) / 7.25 + cost_per_item,
    cost_breakdown = jsonb_build_object(
      'unit_cost_usd', COALESCE(unit_cost_usd, 0),
      'domestic_shipping_usd', COALESCE(domestic_shipping_cost, 0) / 7.25,
      'international_shipping_usd', cost_per_item,
      'total_usd', COALESCE(unit_cost_usd, 0) + COALESCE(domestic_shipping_cost, 0) / 7.25 + cost_per_item
    ),
    updated_at = now()
  FROM (
    SELECT pi2.id 
    FROM public.product_items pi2
    LEFT JOIN public.verification_items vi ON vi.product_item_id = pi2.id
    WHERE pi2.box_id = p_box_id
    AND (vi.status IS NULL OR vi.status = 'ok')
  ) AS ok_items
  WHERE pi.id = ok_items.id;
  
  RAISE NOTICE 'Distributed % shipping cost across % OK items in box %', p_shipping_cost, item_count, p_box_id;
END;
$$;