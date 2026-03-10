-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Product items viewable by authenticated" ON public.product_items;

-- Create a new SELECT policy that restricts access to management and finance roles
CREATE POLICY "Product items viewable by authorized roles" 
ON public.product_items 
FOR SELECT 
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR 
  has_role(auth.uid(), 'xitoy_manager'::app_role) OR 
  has_role(auth.uid(), 'xitoy_packer'::app_role) OR 
  has_role(auth.uid(), 'uz_manager'::app_role) OR 
  has_role(auth.uid(), 'uz_receiver'::app_role) OR 
  has_role(auth.uid(), 'moliya_xodimi'::app_role)
);