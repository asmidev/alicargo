-- Fix categories UPDATE policy by adding explicit WITH CHECK clause
DROP POLICY IF EXISTS "Managers can update categories" ON public.categories;

CREATE POLICY "Managers can update categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role)
)
WITH CHECK (true);