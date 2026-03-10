
-- Create promo_codes table
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC NOT NULL,
  min_order_amount NUMERIC DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add promo columns to store_orders
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- RLS for promo_codes
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active promo codes" ON public.promo_codes
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Admins manage promo codes" ON public.promo_codes
  FOR ALL USING (
    public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin')
  );
