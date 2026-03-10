
-- payment_cards table
CREATE TABLE public.payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number text NOT NULL,
  card_holder text NOT NULL,
  bank_name text NOT NULL DEFAULT 'Uzcard',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_cards ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (needed for checkout)
CREATE POLICY "Authenticated users can read payment cards"
  ON public.payment_cards FOR SELECT TO authenticated USING (true);

-- Only bosh_admin/rahbar can write
CREATE POLICY "Admin can manage payment cards"
  ON public.payment_cards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar'))
  WITH CHECK (public.has_role(auth.uid(), 'bosh_admin') OR public.has_role(auth.uid(), 'rahbar'));

-- Anon users can read active cards (for public store checkout)
CREATE POLICY "Anon can read active payment cards"
  ON public.payment_cards FOR SELECT TO anon USING (is_active = true);
