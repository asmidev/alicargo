-- =============================================
-- BOSQICH 1: TO'G'RIDAN-TO'G'RI SOTUV TIZIMI
-- =============================================

-- 1.1 Direct Sales Jadvali
CREATE TABLE public.direct_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Mahsulot ma'lumotlari
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_item_id UUID REFERENCES product_items(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  
  -- Narx va valyuta
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC NOT NULL CHECK (total_price >= 0),
  currency TEXT NOT NULL DEFAULT 'UZS',
  price_usd NUMERIC,
  exchange_rate_at_sale NUMERIC,
  
  -- Xaridor ma'lumotlari (ixtiyoriy)
  customer_name TEXT,
  customer_phone TEXT,
  customer_notes TEXT,
  
  -- To'lov
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer')),
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partial', 'refunded')),
  
  -- Referenslar
  receipt_number TEXT UNIQUE,
  finance_transaction_id UUID REFERENCES finance_transactions(id) ON DELETE SET NULL,
  movement_id UUID REFERENCES inventory_movements(id) ON DELETE SET NULL,
  
  -- Meta
  sold_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- 1.2 Indekslar
CREATE INDEX idx_direct_sales_product ON direct_sales(product_id);
CREATE INDEX idx_direct_sales_date ON direct_sales(created_at DESC);
CREATE INDEX idx_direct_sales_receipt ON direct_sales(receipt_number);
CREATE INDEX idx_direct_sales_sold_by ON direct_sales(sold_by);
CREATE INDEX idx_direct_sales_payment_status ON direct_sales(payment_status);

-- 1.3 Updated_at Trigger
CREATE TRIGGER update_direct_sales_updated_at
  BEFORE UPDATE ON direct_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 1.4 RLS
ALTER TABLE direct_sales ENABLE ROW LEVEL SECURITY;

-- UZ xodimlar va managerlar ko'ra oladi (uz_receiver, uz_quality, uz_manager, bosh_manager, bosh_admin, rahbar)
CREATE POLICY "UZ staff can view direct sales"
  ON direct_sales FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'uz_receiver') OR 
    has_role(auth.uid(), 'uz_quality') OR 
    has_role(auth.uid(), 'uz_manager') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'rahbar')
  );

-- UZ xodimlar va managerlar yarata oladi
CREATE POLICY "UZ staff can create direct sales"
  ON direct_sales FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'uz_receiver') OR 
    has_role(auth.uid(), 'uz_quality') OR 
    has_role(auth.uid(), 'uz_manager') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'rahbar')
  );

-- Faqat managerlar tahrir qila oladi
CREATE POLICY "UZ managers can update direct sales"
  ON direct_sales FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'uz_manager') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'rahbar')
  )
  WITH CHECK (
    has_role(auth.uid(), 'uz_manager') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'rahbar')
  );

-- 1.5 Receipt Number Generator Function
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  today_prefix TEXT;
  seq_num INTEGER;
BEGIN
  today_prefix := 'DS-' || to_char(now(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(receipt_number, '^DS-\d{8}-', ''), '')::INTEGER
  ), 0) + 1
  INTO seq_num
  FROM direct_sales
  WHERE receipt_number LIKE today_prefix || '-%';
  
  RETURN today_prefix || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.6 Auto-generate receipt number trigger
CREATE OR REPLACE FUNCTION set_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := generate_receipt_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_set_receipt_number
  BEFORE INSERT ON direct_sales
  FOR EACH ROW
  EXECUTE FUNCTION set_receipt_number();

-- 1.7 Realtime uchun
ALTER PUBLICATION supabase_realtime ADD TABLE direct_sales;