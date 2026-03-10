-- Phase M: Create Uzum category commission reference table
CREATE TABLE IF NOT EXISTS public.uzum_category_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text UNIQUE NOT NULL,
  category_name_uz text,
  commission_rate numeric NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.uzum_category_commissions ENABLE ROW LEVEL SECURITY;

-- Create read policy for all authenticated users
CREATE POLICY "Allow read access to all authenticated users" 
ON public.uzum_category_commissions 
FOR SELECT 
TO authenticated
USING (true);

-- Create admin write policy
CREATE POLICY "Allow admin write access" 
ON public.uzum_category_commissions 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('rahbar', 'bosh_admin')
  )
);

-- Insert known category commission rates based on Uzum's structure
INSERT INTO public.uzum_category_commissions (category_name, category_name_uz, commission_rate) VALUES
  ('Elektronika', 'Elektronika', 12),
  ('Kiyimlar', 'Kiyimlar', 15),
  ('Uy-rozgor buyumlari', 'Uy-ro''zg''or buyumlari', 18),
  ('Aksessuarlar', 'Aksessuarlar', 10),
  ('Kosmetika va parfyumeriya', 'Kosmetika va parfyumeriya', 8),
  ('Bolalar tovarlari', 'Bolalar tovarlari', 15),
  ('Oyoq kiyimlar', 'Oyoq kiyimlar', 15),
  ('Sport va dam olish', 'Sport va dam olish', 15),
  ('Oziq-ovqat', 'Oziq-ovqat', 5),
  ('Avtomobil uchun', 'Avtomobil uchun', 12),
  ('Uy-bog maishiy texnika', 'Uy-bo''g'' maishiy texnika', 20),
  ('Xobbi va ijodiyot', 'Xobbi va ijodiyot', 15),
  ('Salomatlik', 'Salomatlik', 10),
  ('Zargarlik buyumlari', 'Zargarlik buyumlari', 10),
  ('Kitoblar', 'Kitoblar', 8),
  ('Kantselyariya', 'Kantselyariya', 12),
  ('Qurilish va tamir', 'Qurilish va ta''mir', 18),
  ('Uy hayvonlari uchun', 'Uy hayvonlari uchun', 15),
  ('Bogdorchilik', 'Bog''dorchilik', 18)
ON CONFLICT (category_name) DO UPDATE SET
  commission_rate = EXCLUDED.commission_rate,
  updated_at = now();

-- Add category_title column to marketplace_listings if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'marketplace_listings' 
    AND column_name = 'category_title'
  ) THEN
    ALTER TABLE public.marketplace_listings ADD COLUMN category_title text;
  END IF;
END $$;