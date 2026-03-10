-- Quti topilganda shipping_cost ni avtomatik taqsimlash funksiyasi
CREATE OR REPLACE FUNCTION public.auto_distribute_box_shipping_cost(
  p_box_id UUID,
  p_shipping_cost NUMERIC,
  p_volume_m3 NUMERIC
)
RETURNS jsonb AS $$
DECLARE
  item_count INTEGER;
  per_item_volume NUMERIC;
  per_item_shipping NUMERIC;
  updated_count INTEGER := 0;
BEGIN
  -- Qutidagi itemlar sonini olish
  SELECT COUNT(*) INTO item_count 
  FROM public.product_items 
  WHERE box_id = p_box_id;
  
  IF item_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Qutida mahsulot topilmadi', 'updated', 0);
  END IF;
  
  -- Har bir itemga to'g'ri keladigan hajm
  per_item_volume := COALESCE(p_volume_m3, 0) / item_count;
  
  -- Har bir itemga to'g'ri keladigan shipping cost
  per_item_shipping := COALESCE(p_shipping_cost, 0) / item_count;
  
  -- Barcha itemlarni yangilash: volume_m3, international_shipping_cost, final_cost_usd
  UPDATE public.product_items 
  SET 
    volume_m3 = per_item_volume,
    international_shipping_cost = per_item_shipping,
    cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
      jsonb_build_object(
        'international_shipping', per_item_shipping, 
        'distribution_method', 'auto_equal',
        'volume_per_item', per_item_volume,
        'total_box_volume', p_volume_m3,
        'total_shipping_cost', p_shipping_cost,
        'distributed_at', now()
      ),
    final_cost_usd = COALESCE(unit_cost_usd, 0) + 
      (COALESCE(domestic_shipping_cost, 0) / COALESCE(exchange_rate_at_purchase, 7.25)) + 
      per_item_shipping
  WHERE box_id = p_box_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Yo''l haqqi avtomatik taqsimlandi',
    'updated', updated_count,
    'per_item_volume', per_item_volume,
    'per_item_shipping', per_item_shipping
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.auto_distribute_box_shipping_cost IS 'PDF import qilganda trek raqam orqali topilgan qutidagi barcha mahsulotlarga hajm va yo''l haqqini avtomatik taqsimlaydi';