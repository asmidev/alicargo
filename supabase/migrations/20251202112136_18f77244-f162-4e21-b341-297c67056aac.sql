-- Fix categories SELECT policy to allow admins to see all categories
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;

-- Regular users see only active categories
CREATE POLICY "Users can view active categories"
ON public.categories
FOR SELECT
TO authenticated
USING (
  is_active = true OR
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role)
);