
-- =====================================================
-- PHASE 1: FINANCE SYSTEM COMPLETE SCHEMA
-- =====================================================

-- 1. Expense Categories Table
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_uz TEXT,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#6B7280',
  is_operational BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default expense categories
INSERT INTO public.expense_categories (name, name_uz, icon, color, is_operational, sort_order) VALUES
  ('Mahsulot sotib olish', 'Mahsulot sotib olish', 'package', '#3B82F6', true, 1),
  ('Yuk tashish', 'Yuk tashish xarajati', 'truck', '#8B5CF6', true, 2),
  ('Ish haqi', 'Ish haqi va maosh', 'users', '#EC4899', true, 3),
  ('Ijara', 'Ombor va ofis ijarasi', 'building', '#F59E0B', true, 4),
  ('Marketing', 'Reklama va marketing', 'megaphone', '#10B981', true, 5),
  ('Kommunal', 'Kommunal xizmatlar', 'zap', '#6366F1', true, 6),
  ('Soliq', 'Soliqlar va yig''imlar', 'file-text', '#EF4444', true, 7),
  ('Boshqa', 'Boshqa xarajatlar', 'more-horizontal', '#6B7280', true, 99)
ON CONFLICT (name) DO NOTHING;

-- 2. Accounts Receivable (Debitorlik - mijozlardan olinadigan qarzlar)
CREATE TABLE IF NOT EXISTS public.accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'USD',
  amount_usd NUMERIC,
  exchange_rate_used NUMERIC,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'written_off')),
  paid_amount NUMERIC DEFAULT 0,
  reference_type TEXT, -- 'direct_sale', 'marketplace_order', 'other'
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Accounts Payable (Kreditorlik - yetkazib beruvchilarga to'lanadigan qarzlar)
CREATE TABLE IF NOT EXISTS public.accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'USD',
  amount_usd NUMERIC,
  exchange_rate_used NUMERIC,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  paid_amount NUMERIC DEFAULT 0,
  reference_type TEXT, -- 'product_purchase', 'shipping', 'service', 'other'
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Update finance_transactions table
ALTER TABLE public.finance_transactions 
ADD COLUMN IF NOT EXISTS reference_type TEXT,
ADD COLUMN IF NOT EXISTS exchange_rate_used NUMERIC,
ADD COLUMN IF NOT EXISTS amount_usd NUMERIC;

-- 5. Update financial_periods table with more fields
ALTER TABLE public.financial_periods
ADD COLUMN IF NOT EXISTS direct_sales_revenue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS marketplace_revenue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_income NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_expenses NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payroll_expenses NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rent_expenses NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS marketing_expenses NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_expenses NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS opening_inventory_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_inventory_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS accounts_receivable_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS accounts_payable_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ;

-- 6. Enable RLS on new tables
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for expense_categories (read-only for all authenticated)
CREATE POLICY "Expense categories viewable by authenticated users"
ON public.expense_categories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Expense categories manageable by admins"
ON public.expense_categories FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('rahbar', 'bosh_admin', 'moliya_xodimi')
  )
);

-- 8. RLS Policies for accounts_receivable
CREATE POLICY "Accounts receivable viewable by finance roles"
ON public.accounts_receivable FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('rahbar', 'bosh_admin', 'moliya_xodimi', 'manager')
  )
);

CREATE POLICY "Accounts receivable manageable by finance roles"
ON public.accounts_receivable FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('rahbar', 'bosh_admin', 'moliya_xodimi')
  )
);

-- 9. RLS Policies for accounts_payable
CREATE POLICY "Accounts payable viewable by finance roles"
ON public.accounts_payable FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('rahbar', 'bosh_admin', 'moliya_xodimi', 'manager')
  )
);

CREATE POLICY "Accounts payable manageable by finance roles"
ON public.accounts_payable FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('rahbar', 'bosh_admin', 'moliya_xodimi')
  )
);

-- 10. Trigger: Auto-calculate USD amount for finance_transactions
CREATE OR REPLACE FUNCTION public.calculate_transaction_usd()
RETURNS TRIGGER AS $$
DECLARE
  current_rate NUMERIC;
BEGIN
  -- Get current exchange rate for UZS
  SELECT (rates->>'UZS')::NUMERIC INTO current_rate
  FROM public.exchange_rates_history
  ORDER BY fetched_at DESC
  LIMIT 1;
  
  -- Default rate if not found
  IF current_rate IS NULL THEN
    current_rate := 12850;
  END IF;
  
  -- Store the exchange rate used
  NEW.exchange_rate_used := current_rate;
  
  -- Calculate USD amount based on currency
  IF NEW.currency = 'USD' THEN
    NEW.amount_usd := NEW.amount;
  ELSIF NEW.currency = 'UZS' THEN
    NEW.amount_usd := NEW.amount / current_rate;
  ELSIF NEW.currency = 'CNY' THEN
    NEW.amount_usd := NEW.amount / 7.25;
  ELSE
    NEW.amount_usd := NEW.amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_calculate_transaction_usd ON public.finance_transactions;
CREATE TRIGGER trigger_calculate_transaction_usd
  BEFORE INSERT OR UPDATE ON public.finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_transaction_usd();

-- 11. Trigger: Auto-create income transaction for direct_sales
CREATE OR REPLACE FUNCTION public.auto_create_direct_sale_income()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.finance_transactions (
    transaction_type,
    amount,
    currency,
    category,
    description,
    reference_id,
    reference_type,
    created_by
  ) VALUES (
    'income',
    NEW.total_price,
    NEW.currency,
    'To''g''ridan-to''g''ri sotuv',
    COALESCE(NEW.product_name, 'Mahsulot') || ' - ' || COALESCE(NEW.receipt_number, NEW.id::text),
    NEW.id,
    'direct_sale',
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_create_direct_sale_income ON public.direct_sales;
CREATE TRIGGER trigger_auto_create_direct_sale_income
  AFTER INSERT ON public.direct_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_direct_sale_income();

-- 12. Trigger: Auto-create income for delivered marketplace orders
CREATE OR REPLACE FUNCTION public.auto_create_marketplace_income()
RETURNS TRIGGER AS $$
DECLARE
  store_name TEXT;
  store_platform TEXT;
BEGIN
  -- Only trigger when status changes to delivered
  IF NEW.fulfillment_status = 'delivered' AND 
     (OLD.fulfillment_status IS NULL OR OLD.fulfillment_status != 'delivered') THEN
    
    -- Get store info
    SELECT name, platform INTO store_name, store_platform
    FROM public.marketplace_stores
    WHERE id = NEW.store_id;
    
    -- Check if transaction already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.finance_transactions 
      WHERE reference_id = NEW.id AND reference_type = 'marketplace_order'
    ) THEN
      INSERT INTO public.finance_transactions (
        transaction_type,
        amount,
        currency,
        category,
        description,
        reference_id,
        reference_type
      ) VALUES (
        'income',
        COALESCE(NEW.total_amount, 0),
        COALESCE(NEW.currency, 'UZS'),
        'Marketplace sotuv - ' || COALESCE(store_platform, 'unknown'),
        'Order #' || COALESCE(NEW.external_order_id, NEW.id::text) || ' (' || COALESCE(store_name, 'Store') || ')',
        NEW.id,
        'marketplace_order'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_create_marketplace_income ON public.marketplace_orders;
CREATE TRIGGER trigger_auto_create_marketplace_income
  AFTER UPDATE ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_marketplace_income();

-- 13. Trigger: Auto-create shipping expense when box shipping_cost is set
CREATE OR REPLACE FUNCTION public.auto_create_shipping_expense()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shipping_cost IS NOT NULL AND NEW.shipping_cost > 0 AND
     (OLD.shipping_cost IS NULL OR OLD.shipping_cost != NEW.shipping_cost) THEN
    
    -- Delete old transaction if exists (to update amount)
    DELETE FROM public.finance_transactions 
    WHERE reference_id = NEW.id AND reference_type = 'shipping';
    
    -- Create new expense transaction
    INSERT INTO public.finance_transactions (
      transaction_type,
      amount,
      currency,
      category,
      description,
      reference_id,
      reference_type
    ) VALUES (
      'expense',
      NEW.shipping_cost,
      'USD',
      'Yuk tashish',
      'Quti: ' || COALESCE(NEW.box_number, NEW.id::text),
      NEW.id,
      'shipping'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_create_shipping_expense ON public.boxes;
CREATE TRIGGER trigger_auto_create_shipping_expense
  AFTER UPDATE ON public.boxes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_shipping_expense();

-- 14. Updated_at triggers for new tables
CREATE TRIGGER update_accounts_receivable_updated_at
  BEFORE UPDATE ON public.accounts_receivable
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_payable_updated_at
  BEFORE UPDATE ON public.accounts_payable
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_finance_transactions_reference ON public.finance_transactions(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_type_date ON public.finance_transactions(transaction_type, created_at);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_status ON public.accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON public.accounts_payable(status);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_due_date ON public.accounts_receivable(due_date);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_due_date ON public.accounts_payable(due_date);
