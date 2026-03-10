-- Drop the current SELECT policy that includes investors
DROP POLICY IF EXISTS "Finance viewable by authorized roles" ON public.finance_transactions;

-- Create a new SELECT policy without investor role
CREATE POLICY "Finance viewable by authorized roles" 
ON public.finance_transactions 
FOR SELECT 
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR 
  has_role(auth.uid(), 'moliya_xodimi'::app_role)
);