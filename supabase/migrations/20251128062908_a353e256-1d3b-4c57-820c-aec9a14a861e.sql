-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active categories
CREATE POLICY "Authenticated users can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Managers can insert categories
CREATE POLICY "Managers can insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'rahbar') OR
    public.has_role(auth.uid(), 'bosh_admin') OR
    public.has_role(auth.uid(), 'xitoy_manager') OR
    public.has_role(auth.uid(), 'manager')
  );

-- Managers can update categories
CREATE POLICY "Managers can update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'rahbar') OR
    public.has_role(auth.uid(), 'bosh_admin')
  );

-- Only bosh_admin can delete categories
CREATE POLICY "Bosh admin can delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'bosh_admin'));

-- Seed default categories
INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Elektronika', 'elektronika', 1),
  ('Kiyim', 'kiyim', 2),
  ('Uy jihozlari', 'uy-jihozlari', 3),
  ('Sport', 'sport', 4),
  ('Boshqa', 'boshqa', 5);