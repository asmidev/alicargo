-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Boxes viewable by all authenticated" ON public.boxes;

-- Create a new SELECT policy that restricts access to appropriate roles
CREATE POLICY "Boxes viewable by authorized roles" 
ON public.boxes 
FOR SELECT 
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR 
  has_role(auth.uid(), 'xitoy_manager'::app_role) OR 
  has_role(auth.uid(), 'xitoy_packer'::app_role) OR 
  has_role(auth.uid(), 'xitoy_receiver'::app_role) OR 
  has_role(auth.uid(), 'uz_manager'::app_role) OR 
  has_role(auth.uid(), 'uz_receiver'::app_role) OR 
  has_role(auth.uid(), 'uz_quality'::app_role)
);