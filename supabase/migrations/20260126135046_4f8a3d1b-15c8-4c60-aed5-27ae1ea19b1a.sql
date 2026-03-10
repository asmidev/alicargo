-- =====================================================
-- 3-BOSQICHLI TANNARX HISOBLASH TIZIMI
-- =====================================================

-- 1. products jadvaliga yangi ustunlar
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS domestic_shipping_total numeric DEFAULT 0;

COMMENT ON COLUMN public.products.domestic_shipping_total IS 'Xitoy ichidagi jami yo''l haqqi (CNY)';

-- 2. product_items jadvaliga yangi ustunlar
ALTER TABLE public.product_items 
ADD COLUMN IF NOT EXISTS volume_m3 numeric,
ADD COLUMN IF NOT EXISTS domestic_shipping_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS international_shipping_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_cost_usd numeric,
ADD COLUMN IF NOT EXISTS cost_breakdown jsonb DEFAULT '{}';

COMMENT ON COLUMN public.product_items.volume_m3 IS 'Mahsulot hajmi kubometrda';
COMMENT ON COLUMN public.product_items.domestic_shipping_cost IS 'Xitoy ichidagi yo''l haqqi ulushi (CNY)';
COMMENT ON COLUMN public.product_items.international_shipping_cost IS 'Xalqaro logistika ulushi (USD)';
COMMENT ON COLUMN public.product_items.final_cost_usd IS 'Yakuniy tannarx (USD)';
COMMENT ON COLUMN public.product_items.cost_breakdown IS 'Xarajatlar tafsiloti JSON formatida';

-- 3. Xitoy ichidagi yo'l haqqini taqsimlash funksiyasi
CREATE OR REPLACE FUNCTION public.distribute_domestic_shipping()
RETURNS TRIGGER AS $$
DECLARE
  item_count INTEGER;
  per_item_cost NUMERIC;
  exchange_rate NUMERIC;
BEGIN
  -- Faqat domestic_shipping_total o'zgarganda ishlaydi
  IF NEW.domestic_shipping_total IS NOT NULL AND 
     NEW.domestic_shipping_total > 0 AND
     (OLD.domestic_shipping_total IS NULL OR OLD.domestic_shipping_total != NEW.domestic_shipping_total) THEN
    
    -- Mahsulotga tegishli itemlar sonini olish
    SELECT COUNT(*) INTO item_count 
    FROM public.product_items 
    WHERE product_id = NEW.id;
    
    IF item_count > 0 THEN
      -- Har bir itemga to'g'ri keladigan yo'l haqqi
      per_item_cost := NEW.domestic_shipping_total / item_count;
      
      -- Exchange rate olish (CNY -> USD)
      exchange_rate := COALESCE(NEW.purchase_exchange_rate, 7.25);
      
      -- Barcha itemlarni yangilash
      UPDATE public.product_items 
      SET 
        domestic_shipping_cost = per_item_cost,
        cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
          jsonb_build_object(
            'purchase_price', unit_cost,
            'purchase_currency', unit_cost_currency,
            'domestic_shipping', per_item_cost,
            'domestic_shipping_currency', 'CNY'
          ),
        final_cost_usd = COALESCE(unit_cost_usd, 0) + (per_item_cost / exchange_rate) + COALESCE(international_shipping_cost, 0)
      WHERE product_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger yaratish
DROP TRIGGER IF EXISTS trigger_distribute_domestic_shipping ON public.products;
CREATE TRIGGER trigger_distribute_domestic_shipping
  AFTER UPDATE OF domestic_shipping_total ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.distribute_domestic_shipping();

-- 4. Xalqaro logistikani hajm bo'yicha taqsimlash funksiyasi
CREATE OR REPLACE FUNCTION public.distribute_international_shipping(
  p_box_ids UUID[],
  p_total_shipping_cost NUMERIC
)
RETURNS void AS $$
DECLARE
  total_volume NUMERIC := 0;
  item_record RECORD;
BEGIN
  -- Jami hajmni hisoblash (barcha qutilardagi itemlarning hajmi)
  SELECT COALESCE(SUM(pi.volume_m3), 0) INTO total_volume
  FROM public.product_items pi
  WHERE pi.box_id = ANY(p_box_ids) AND pi.volume_m3 > 0;
  
  -- Agar hajm 0 bo'lsa, teng taqsimlash
  IF total_volume = 0 THEN
    -- Itemlar sonini olish
    SELECT COUNT(*) INTO total_volume
    FROM public.product_items pi
    WHERE pi.box_id = ANY(p_box_ids);
    
    IF total_volume > 0 THEN
      -- Teng taqsimlash
      UPDATE public.product_items 
      SET 
        international_shipping_cost = p_total_shipping_cost / total_volume,
        cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
          jsonb_build_object('international_shipping', p_total_shipping_cost / total_volume, 'distribution_method', 'equal'),
        final_cost_usd = COALESCE(unit_cost_usd, 0) + 
          (COALESCE(domestic_shipping_cost, 0) / COALESCE(exchange_rate_at_purchase, 7.25)) + 
          (p_total_shipping_cost / total_volume)
      WHERE box_id = ANY(p_box_ids);
    END IF;
  ELSE
    -- Hajm bo'yicha taqsimlash
    FOR item_record IN 
      SELECT id, volume_m3, unit_cost_usd, domestic_shipping_cost, exchange_rate_at_purchase
      FROM public.product_items 
      WHERE box_id = ANY(p_box_ids)
    LOOP
      UPDATE public.product_items 
      SET 
        international_shipping_cost = (COALESCE(item_record.volume_m3, 0) / total_volume) * p_total_shipping_cost,
        cost_breakdown = COALESCE(cost_breakdown, '{}'::jsonb) || 
          jsonb_build_object(
            'international_shipping', (COALESCE(item_record.volume_m3, 0) / total_volume) * p_total_shipping_cost, 
            'distribution_method', 'by_volume',
            'volume_ratio', COALESCE(item_record.volume_m3, 0) / total_volume
          ),
        final_cost_usd = COALESCE(item_record.unit_cost_usd, 0) + 
          (COALESCE(item_record.domestic_shipping_cost, 0) / COALESCE(item_record.exchange_rate_at_purchase, 7.25)) + 
          ((COALESCE(item_record.volume_m3, 0) / total_volume) * p_total_shipping_cost)
      WHERE id = item_record.id;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Quti kelganda yakuniy tannarxni qayta hisoblash triggeri
CREATE OR REPLACE FUNCTION public.recalculate_final_cost_on_arrival()
RETURNS TRIGGER AS $$
BEGIN
  -- Faqat status 'arrived' ga o'zgarganda ishlaydi
  IF NEW.status = 'arrived' AND (OLD.status IS NULL OR OLD.status != 'arrived') THEN
    -- Qutidagi barcha itemlarning final_cost_usd ni yangilash
    UPDATE public.product_items pi
    SET final_cost_usd = 
      COALESCE(pi.unit_cost_usd, 0) + 
      (COALESCE(pi.domestic_shipping_cost, 0) / COALESCE(pi.exchange_rate_at_purchase, 7.25)) + 
      COALESCE(pi.international_shipping_cost, 0),
      cost_breakdown = COALESCE(pi.cost_breakdown, '{}'::jsonb) || 
        jsonb_build_object('calculated_at', now(), 'status', 'final')
    WHERE pi.box_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalculate_final_cost ON public.boxes;
CREATE TRIGGER trigger_recalculate_final_cost
  AFTER UPDATE OF status ON public.boxes
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_final_cost_on_arrival();