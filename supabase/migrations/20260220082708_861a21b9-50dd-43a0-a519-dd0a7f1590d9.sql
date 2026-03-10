
-- fbs_invoices: Uzum ga topshirilgan yetkazib berish nakladnoylari
CREATE TABLE IF NOT EXISTS public.fbs_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id text NOT NULL,
  store_id uuid REFERENCES public.marketplace_stores(id),
  store_name text,
  platform text DEFAULT 'uzum',
  status text,
  order_count integer DEFAULT 0,
  invoice_date timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid,
  stock_deducted boolean DEFAULT false,
  stock_deducted_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, invoice_id)
);

-- fbs_invoice_items: har bir invoice dagi buyurtma/tovar
CREATE TABLE IF NOT EXISTS public.fbs_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.fbs_invoices(id) ON DELETE CASCADE,
  external_order_id text,
  product_title text,
  sku_title text,
  image_url text,
  quantity integer DEFAULT 1,
  amount numeric,
  currency text DEFAULT 'UZS',
  variant_id uuid,
  product_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fbs_invoices_store_id ON public.fbs_invoices(store_id);
CREATE INDEX IF NOT EXISTS idx_fbs_invoices_status ON public.fbs_invoices(status);
CREATE INDEX IF NOT EXISTS idx_fbs_invoice_items_invoice_id ON public.fbs_invoice_items(invoice_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_fbs_invoices_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_fbs_invoices_updated ON public.fbs_invoices;
CREATE TRIGGER trg_fbs_invoices_updated
  BEFORE UPDATE ON public.fbs_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_fbs_invoices_updated_at();

-- RLS
ALTER TABLE public.fbs_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fbs_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage fbs_invoices"
  ON public.fbs_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage fbs_invoice_items"
  ON public.fbs_invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
