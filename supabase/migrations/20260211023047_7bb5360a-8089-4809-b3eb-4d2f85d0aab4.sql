
-- Create marketplace_returns table
CREATE TABLE public.marketplace_returns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.marketplace_orders(id),
  store_id uuid REFERENCES public.marketplace_stores(id),
  platform text NOT NULL DEFAULT 'uzum',
  external_order_id text,
  product_title text NOT NULL,
  sku_title text,
  image_url text,
  quantity integer NOT NULL DEFAULT 1,
  amount numeric DEFAULT 0,
  currency text DEFAULT 'UZS',
  return_reason text,
  return_date timestamptz DEFAULT now(),
  resolution text NOT NULL DEFAULT 'pending',
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  product_id uuid REFERENCES public.products(id),
  variant_id uuid REFERENCES public.product_variants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate imports
CREATE UNIQUE INDEX idx_marketplace_returns_external ON public.marketplace_returns (external_order_id, platform, sku_title) WHERE external_order_id IS NOT NULL;

-- Create index for common queries
CREATE INDEX idx_marketplace_returns_resolution ON public.marketplace_returns (resolution);
CREATE INDEX idx_marketplace_returns_store ON public.marketplace_returns (store_id);

-- Enable RLS
ALTER TABLE public.marketplace_returns ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can read returns"
  ON public.marketplace_returns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert returns"
  ON public.marketplace_returns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update returns"
  ON public.marketplace_returns FOR UPDATE
  TO authenticated
  USING (true);
