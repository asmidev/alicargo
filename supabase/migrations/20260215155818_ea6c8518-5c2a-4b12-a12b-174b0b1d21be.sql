
-- Fix remaining meaningful permissive RLS policies

-- 1. store_order_status_history: restrict INSERT to staff roles
DROP POLICY IF EXISTS "Authenticated users can insert order status history" ON public.store_order_status_history;
CREATE POLICY "Staff can insert order status history" ON public.store_order_status_history
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'rahbar') OR
  public.has_role(auth.uid(), 'bosh_admin') OR
  public.has_role(auth.uid(), 'uz_manager') OR
  public.has_role(auth.uid(), 'uz_receiver')
);

-- 2. tracking_events: restrict to known staff roles
DROP POLICY IF EXISTS "All staff can create tracking events" ON public.tracking_events;
CREATE POLICY "Staff can create tracking events" ON public.tracking_events
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'rahbar') OR
  public.has_role(auth.uid(), 'bosh_admin') OR
  public.has_role(auth.uid(), 'xitoy_packer') OR
  public.has_role(auth.uid(), 'uz_receiver') OR
  public.has_role(auth.uid(), 'uz_manager') OR
  public.has_role(auth.uid(), 'uz_quality')
);

-- 3. ali_ai service tables: restrict to authenticated (these are written by edge functions with service_role_key, 
-- but tighten client-side access to users with AI access roles)
DROP POLICY IF EXISTS "Service can insert digests" ON public.ali_ai_digests;
CREATE POLICY "Service can insert digests" ON public.ali_ai_digests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can insert insights" ON public.ali_ai_insights;
CREATE POLICY "Service can insert insights" ON public.ali_ai_insights
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "System can insert usage logs" ON public.ali_ai_usage_logs;
CREATE POLICY "System can insert usage logs" ON public.ali_ai_usage_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. notification_logs: restrict to own user or service
DROP POLICY IF EXISTS "System can insert notifications" ON public.notification_logs;
CREATE POLICY "System can insert notifications" ON public.notification_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5. exchange_rates_history: restrict to admin roles (service_role_key bypasses anyway)
DROP POLICY IF EXISTS "Service can insert exchange rates" ON public.exchange_rates_history;
CREATE POLICY "Admins can insert exchange rates" ON public.exchange_rates_history
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'rahbar') OR
  public.has_role(auth.uid(), 'bosh_admin')
);

-- 6. marketplace_sync_logs: restrict to admin roles
DROP POLICY IF EXISTS "Allow insert to marketplace_sync_logs" ON public.marketplace_sync_logs;
CREATE POLICY "Admins can insert sync logs" ON public.marketplace_sync_logs
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'rahbar') OR
  public.has_role(auth.uid(), 'bosh_admin')
);

-- 7. telegram_users: restrict to own user creation
DROP POLICY IF EXISTS "Allow telegram user creation" ON public.telegram_users;
CREATE POLICY "Users can link own telegram" ON public.telegram_users
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
