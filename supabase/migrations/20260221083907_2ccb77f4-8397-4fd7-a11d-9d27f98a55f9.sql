
-- handover_invoices
CREATE TABLE public.handover_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  sender_name text,
  pickup_point text,
  invoice_date timestamptz,
  total_orders integer DEFAULT 0,
  not_accepted_count integer DEFAULT 0,
  pdf_url text,
  notes text,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.handover_invoice_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_invoice_id uuid NOT NULL REFERENCES public.handover_invoices(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  accepted boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_hio_invoice ON public.handover_invoice_orders(handover_invoice_id);
CREATE INDEX idx_hi_date ON public.handover_invoices(invoice_date DESC);

ALTER TABLE public.handover_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_invoice_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read handover invoices"
  ON public.handover_invoices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can write handover invoices"
  ON public.handover_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'uz_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'uz_manager'));

CREATE POLICY "Authenticated users can read handover invoice orders"
  ON public.handover_invoice_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can write handover invoice orders"
  ON public.handover_invoice_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'uz_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'uz_manager'));

INSERT INTO storage.buckets (id, name, public) VALUES ('handover-invoices', 'handover-invoices', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Authenticated users can read handover PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'handover-invoices');

CREATE POLICY "Staff can upload handover PDFs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'handover-invoices' AND (public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'uz_manager')));
