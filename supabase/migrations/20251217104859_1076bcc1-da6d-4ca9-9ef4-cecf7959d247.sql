-- Add delete policy for finance_transactions so related transactions can be cleaned up
CREATE POLICY "Authorized users can delete finance transactions"
ON public.finance_transactions
FOR DELETE
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR 
  has_role(auth.uid(), 'moliya_xodimi'::app_role)
);