
ALTER TABLE public.financial_periods 
  ADD COLUMN IF NOT EXISTS buying_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS domestic_shipping_cost numeric DEFAULT 0;
