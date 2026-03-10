-- Add DELETE policy for boxes table
CREATE POLICY "Authorized users can delete boxes" 
ON public.boxes 
FOR DELETE 
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR 
  has_role(auth.uid(), 'xitoy_manager'::app_role)
);