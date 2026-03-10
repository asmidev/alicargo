
-- Drop existing SELECT policy on telegram_users
DROP POLICY IF EXISTS "Users can view own telegram settings" ON public.telegram_users;

-- Create updated SELECT policy that allows verification lookup
CREATE POLICY "Users can view own telegram settings"
ON public.telegram_users
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id IS NULL
  OR has_role(auth.uid(), 'rahbar')
  OR has_role(auth.uid(), 'bosh_admin')
);
