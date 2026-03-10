
-- Store profit distribution config table
CREATE TABLE public.store_profit_distribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  worker_commission_pct numeric NOT NULL DEFAULT 5,
  investor_share_pct numeric NOT NULL DEFAULT 0,
  investor_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id)
);

ALTER TABLE public.store_profit_distribution ENABLE ROW LEVEL SECURITY;

-- Owner/Chief Manager full access
CREATE POLICY "Admin full access" ON public.store_profit_distribution
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin'));

-- Investor can read their own store distributions
CREATE POLICY "Investor read own" ON public.store_profit_distribution
  FOR SELECT TO authenticated
  USING (investor_user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_store_profit_distribution_updated_at
  BEFORE UPDATE ON public.store_profit_distribution
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: all 10 stores with 5% worker commission
INSERT INTO public.store_profit_distribution (store_id, worker_commission_pct, investor_share_pct, investor_user_id) VALUES
  ('3f00ee86-54df-4c0f-a915-dec86a015f92', 5, 0, NULL),  -- ALI BRAND MARKET (Uzum)
  ('93fd314e-8f92-406b-9b8b-f1dc9d5e2a65', 5, 0, NULL),  -- AliBrand.Market (Yandex)
  ('0d8ab77d-39a2-4c47-b903-24a63ca851b6', 5, 0, NULL),  -- Atlas Market (Yandex)
  ('c00dbe6e-e822-40ae-9254-1255a72cdb2b', 5, 0, NULL),  -- Atlas Market (Uzum)
  ('22b6a78a-22ad-4bba-8e1d-3765befe1b29', 5, 0, NULL),  -- Atlas.Market (Uzum)
  ('ccae9859-55fc-48ed-91b1-03d842b62a48', 5, 0, NULL),  -- Uzum China Market (Uzum)
  ('bbb1c1bb-14ae-40c0-89c9-69ae6d695dd1', 5, 0, NULL),  -- Xit market (Uzum)
  -- BM Stores: 50% investor share
  ('3d42b027-cfa3-4dc1-aee5-40a540536221', 5, 50, 'd526c8c1-40f5-4a51-b529-63e5378ba818'),  -- BM Store (Uzum)
  ('38fb06b8-9344-446c-b650-1206543f371b', 5, 50, 'd526c8c1-40f5-4a51-b529-63e5378ba818'),  -- BM_store (Yandex)
  ('8f338a88-8297-45ea-966b-c2cee7b7c478', 5, 50, 'd526c8c1-40f5-4a51-b529-63e5378ba818');  -- BM_store (Uzum)
