
-- Create variant_sku_mappings table
CREATE TABLE public.variant_sku_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  external_sku TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_variant_store UNIQUE (variant_id, store_id)
);

-- Indexes
CREATE INDEX idx_variant_sku_mappings_variant ON public.variant_sku_mappings(variant_id);
CREATE INDEX idx_variant_sku_mappings_store ON public.variant_sku_mappings(store_id);
CREATE INDEX idx_variant_sku_mappings_sku ON public.variant_sku_mappings(external_sku);

-- Enable RLS
ALTER TABLE public.variant_sku_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff can view variant SKU mappings"
ON public.variant_sku_mappings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authorized staff can insert variant SKU mappings"
ON public.variant_sku_mappings FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'rahbar') OR
  has_role(auth.uid(), 'bosh_admin') OR
  has_role(auth.uid(), 'uz_manager') OR
  has_role(auth.uid(), 'xitoy_manager')
);

CREATE POLICY "Authorized staff can update variant SKU mappings"
ON public.variant_sku_mappings FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'rahbar') OR
  has_role(auth.uid(), 'bosh_admin') OR
  has_role(auth.uid(), 'uz_manager') OR
  has_role(auth.uid(), 'xitoy_manager')
);

CREATE POLICY "Authorized staff can delete variant SKU mappings"
ON public.variant_sku_mappings FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'rahbar') OR
  has_role(auth.uid(), 'bosh_admin') OR
  has_role(auth.uid(), 'uz_manager') OR
  has_role(auth.uid(), 'xitoy_manager')
);
