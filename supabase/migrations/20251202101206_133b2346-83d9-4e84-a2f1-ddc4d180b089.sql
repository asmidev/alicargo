-- Add DELETE policy for products table to allow managers to delete products
CREATE POLICY "Managers can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR 
  has_role(auth.uid(), 'xitoy_manager'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);