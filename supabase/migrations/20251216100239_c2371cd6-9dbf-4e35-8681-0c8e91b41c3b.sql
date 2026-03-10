-- Phase A.1: Create exchange_rates_history table
CREATE TABLE public.exchange_rates_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL DEFAULT 'USD',
  rates jsonb NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  source text DEFAULT 'open.er-api.com'
);

-- Enable RLS
ALTER TABLE public.exchange_rates_history ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view exchange rates
CREATE POLICY "Exchange rates viewable by authenticated"
ON public.exchange_rates_history FOR SELECT
USING (true);

-- Allow edge functions to insert rates (using service role)
CREATE POLICY "Service can insert exchange rates"
ON public.exchange_rates_history FOR INSERT
WITH CHECK (true);

-- Phase A.2: Extend products table with currency tracking
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_currency text DEFAULT 'USD';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_exchange_rate numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price_usd numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchased_at timestamp with time zone DEFAULT now();

-- Phase A.3: Extend product_items table with cost and sale tracking
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS unit_cost numeric;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS unit_cost_currency text DEFAULT 'USD';
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS unit_cost_usd numeric;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS exchange_rate_at_purchase numeric;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS sold_at timestamp with time zone;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS sold_price numeric;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS sold_currency text;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS sold_price_usd numeric;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS exchange_rate_at_sale numeric;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS marketplace text;

-- Create trigger function to auto-calculate USD prices for products
CREATE OR REPLACE FUNCTION public.calculate_product_usd_price()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price IS NOT NULL AND NEW.purchase_currency = 'USD' THEN
    NEW.purchase_price_usd := NEW.price;
    NEW.purchase_exchange_rate := 1;
  ELSIF NEW.price IS NOT NULL AND NEW.purchase_exchange_rate IS NOT NULL AND NEW.purchase_exchange_rate > 0 THEN
    NEW.purchase_price_usd := NEW.price / NEW.purchase_exchange_rate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS calculate_product_usd_price_trigger ON public.products;
CREATE TRIGGER calculate_product_usd_price_trigger
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.calculate_product_usd_price();

-- Create trigger function to auto-create finance transactions when product is added
CREATE OR REPLACE FUNCTION public.auto_create_purchase_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create transaction for new products with a price
  IF TG_OP = 'INSERT' AND NEW.price IS NOT NULL AND NEW.quantity IS NOT NULL THEN
    INSERT INTO public.finance_transactions (
      transaction_type,
      amount,
      currency,
      category,
      description,
      reference_id,
      created_by
    ) VALUES (
      'expense',
      NEW.price * NEW.quantity,
      COALESCE(NEW.purchase_currency, 'USD'),
      'Mahsulot sotib olish',
      NEW.name || ' (' || NEW.quantity || ' dona)',
      NEW.id,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-creating purchase transactions
DROP TRIGGER IF EXISTS auto_create_purchase_transaction_trigger ON public.products;
CREATE TRIGGER auto_create_purchase_transaction_trigger
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_purchase_transaction();