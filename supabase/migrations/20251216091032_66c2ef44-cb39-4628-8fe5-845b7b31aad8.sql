-- Phase 3.1: Database Schema Extensions for China Verification System

-- 1. Create defect_categories table first (no dependencies)
CREATE TABLE public.defect_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_uz TEXT NOT NULL,
  name_ru TEXT,
  name_en TEXT,
  icon TEXT,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on defect_categories
ALTER TABLE public.defect_categories ENABLE ROW LEVEL SECURITY;

-- RLS: Everyone can view defect categories
CREATE POLICY "Defect categories viewable by all"
ON public.defect_categories FOR SELECT
USING (true);

-- RLS: Only admins can manage defect categories
CREATE POLICY "Admins can manage defect categories"
ON public.defect_categories FOR ALL
USING (
  has_role(auth.uid(), 'rahbar') OR
  has_role(auth.uid(), 'bosh_admin')
);

-- Insert default defect categories
INSERT INTO public.defect_categories (name, name_uz, name_ru, name_en, icon, sort_order) VALUES
  ('broken', 'Singan', 'Сломанный', 'Broken', 'hammer', 1),
  ('scratched', 'Tirnalgan', 'Поцарапанный', 'Scratched', 'slash', 2),
  ('wrong_color', 'Rangi noto''g''ri', 'Неправильный цвет', 'Wrong color', 'palette', 3),
  ('wrong_size', 'O''lchami noto''g''ri', 'Неправильный размер', 'Wrong size', 'ruler', 4),
  ('incomplete', 'To''liq emas', 'Неполный', 'Incomplete', 'package-open', 5),
  ('damaged_packaging', 'Qadoq buzilgan', 'Поврежденная упаковка', 'Damaged packaging', 'box', 6),
  ('stained', 'Dog''li', 'Загрязненный', 'Stained', 'droplet', 7),
  ('other', 'Boshqa', 'Другое', 'Other', 'help-circle', 99);

-- 2. Create verification_sessions table
CREATE TABLE public.verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  total_items INT DEFAULT 0,
  verified_count INT DEFAULT 0,
  ok_count INT DEFAULT 0,
  defective_count INT DEFAULT 0,
  missing_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on verification_sessions
ALTER TABLE public.verification_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: China staff can manage verification sessions
CREATE POLICY "China staff can manage verification sessions"
ON public.verification_sessions FOR ALL
USING (
  has_role(auth.uid(), 'rahbar') OR
  has_role(auth.uid(), 'bosh_admin') OR
  has_role(auth.uid(), 'xitoy_manager') OR
  has_role(auth.uid(), 'xitoy_packer')
);

-- RLS: All authenticated can view verification sessions
CREATE POLICY "Verification sessions viewable by authenticated"
ON public.verification_sessions FOR SELECT
USING (true);

-- Trigger for verification_sessions updated_at
CREATE TRIGGER update_verification_sessions_updated_at
  BEFORE UPDATE ON public.verification_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create verification_items table
CREATE TABLE public.verification_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.verification_sessions(id) ON DELETE CASCADE,
  product_item_id UUID NOT NULL REFERENCES public.product_items(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ok', 'defective', 'missing')),
  defect_type TEXT,
  notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  photo_urls JSONB DEFAULT '[]'::jsonb,
  ai_confidence DECIMAL(3,2),
  ai_suggestion TEXT,
  ai_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on verification_items
ALTER TABLE public.verification_items ENABLE ROW LEVEL SECURITY;

-- RLS: China staff can manage verification items
CREATE POLICY "China staff can manage verification items"
ON public.verification_items FOR ALL
USING (
  has_role(auth.uid(), 'rahbar') OR
  has_role(auth.uid(), 'bosh_admin') OR
  has_role(auth.uid(), 'xitoy_manager') OR
  has_role(auth.uid(), 'xitoy_packer')
);

-- RLS: All authenticated can view verification items
CREATE POLICY "Verification items viewable by authenticated"
ON public.verification_items FOR SELECT
USING (true);

-- 4. Extend boxes table with verification columns
ALTER TABLE public.boxes 
  ADD COLUMN IF NOT EXISTS verification_required BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS china_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS china_verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verification_session_id UUID,
  ADD COLUMN IF NOT EXISTS verification_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS defect_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_count INT DEFAULT 0;

-- Add foreign key for verification_session_id
ALTER TABLE public.boxes 
  ADD CONSTRAINT fk_boxes_verification_session 
  FOREIGN KEY (verification_session_id) 
  REFERENCES public.verification_sessions(id) ON DELETE SET NULL;

-- 5. Create storage bucket for defect photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'defect-photos', 
  'defect-photos', 
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Storage RLS: China staff can upload defect photos
CREATE POLICY "China staff can upload defect photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'defect-photos' AND
  (
    has_role(auth.uid(), 'rahbar') OR
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'xitoy_manager') OR
    has_role(auth.uid(), 'xitoy_packer')
  )
);

-- Storage RLS: Authenticated can view defect photos
CREATE POLICY "Authenticated can view defect photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'defect-photos' AND
  auth.role() = 'authenticated'
);

-- Storage RLS: China staff can delete defect photos
CREATE POLICY "China staff can delete defect photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'defect-photos' AND
  (
    has_role(auth.uid(), 'rahbar') OR
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'xitoy_manager') OR
    has_role(auth.uid(), 'xitoy_packer')
  )
);

-- 6. Create function to sync verification status to boxes table
CREATE OR REPLACE FUNCTION public.sync_box_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.boxes
    SET 
      china_verified_at = NEW.completed_at,
      china_verified_by = NEW.verified_by,
      verification_session_id = NEW.id,
      verification_complete = true,
      defect_count = NEW.defective_count,
      missing_count = NEW.missing_count
    WHERE id = NEW.box_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync verification status
CREATE TRIGGER on_verification_session_complete
  AFTER UPDATE ON public.verification_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_box_verification_status();

-- Create indexes for better query performance
CREATE INDEX idx_verification_sessions_box_id ON public.verification_sessions(box_id);
CREATE INDEX idx_verification_sessions_status ON public.verification_sessions(status);
CREATE INDEX idx_verification_items_session_id ON public.verification_items(session_id);
CREATE INDEX idx_verification_items_product_item_id ON public.verification_items(product_item_id);
CREATE INDEX idx_verification_items_status ON public.verification_items(status);
CREATE INDEX idx_boxes_verification_complete ON public.boxes(verification_complete);