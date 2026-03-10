-- Add UZ verification columns to boxes table
ALTER TABLE public.boxes 
  ADD COLUMN IF NOT EXISTS verified_uz BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_uz_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_uz_by UUID REFERENCES auth.users(id);

-- Make sure the columns are accessible
GRANT ALL ON TABLE public.boxes TO authenticated;
GRANT ALL ON TABLE public.boxes TO service_role;

-- Reload schema cache carefully to avoid future bugs
NOTIFY pgrst, 'reload schema';
