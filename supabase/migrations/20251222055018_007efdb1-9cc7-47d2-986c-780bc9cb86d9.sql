-- =============================================
-- PHASE 4 ENHANCEMENT: ALL DATABASE CHANGES
-- =============================================

-- 1. PUSH NOTIFICATIONS TABLES
-- =============================================

-- Table for storing push notification subscriptions
CREATE TABLE public.notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.notification_subscriptions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own subscriptions"
ON public.notification_subscriptions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own subscriptions"
ON public.notification_subscriptions FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own subscriptions"
ON public.notification_subscriptions FOR DELETE
USING (user_id = auth.uid());

-- Table for notification logs
CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  sent_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notification_logs FOR SELECT
USING (user_id = auth.uid());

-- System can insert notifications
CREATE POLICY "System can insert notifications"
ON public.notification_logs FOR INSERT
WITH CHECK (true);

-- Users can mark their notifications as read
CREATE POLICY "Users can update their own notifications"
ON public.notification_logs FOR UPDATE
USING (user_id = auth.uid());

-- 2. TELEGRAM USERS TABLE
-- =============================================

CREATE TABLE public.telegram_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  telegram_chat_id TEXT NOT NULL UNIQUE,
  telegram_username TEXT,
  verification_code TEXT,
  is_verified BOOLEAN DEFAULT false,
  notify_shipments BOOLEAN DEFAULT true,
  notify_arrivals BOOLEAN DEFAULT true,
  notify_defects BOOLEAN DEFAULT true,
  notify_daily_summary BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'uz',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own telegram link
CREATE POLICY "Users can view their own telegram link"
ON public.telegram_users FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'rahbar') OR has_role(auth.uid(), 'bosh_admin'));

-- Anyone can insert (needed for bot to create pending links)
CREATE POLICY "Allow telegram user creation"
ON public.telegram_users FOR INSERT
WITH CHECK (true);

-- Users can update their own telegram settings
CREATE POLICY "Users can update their own telegram settings"
ON public.telegram_users FOR UPDATE
USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can delete their own telegram link
CREATE POLICY "Users can delete their own telegram link"
ON public.telegram_users FOR DELETE
USING (user_id = auth.uid());

-- 3. ETA PREDICTIONS - ADD COLUMNS TO SHIPMENTS
-- =============================================

ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS predicted_arrival DATE,
ADD COLUMN IF NOT EXISTS prediction_confidence NUMERIC,
ADD COLUMN IF NOT EXISTS actual_transit_days INTEGER;

-- 4. CARRIER STATS TABLE
-- =============================================

CREATE TABLE public.carrier_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier TEXT NOT NULL UNIQUE,
  avg_transit_days NUMERIC,
  min_transit_days INTEGER,
  max_transit_days INTEGER,
  on_time_rate NUMERIC,
  total_shipments INTEGER DEFAULT 0,
  total_boxes INTEGER DEFAULT 0,
  total_weight_kg NUMERIC DEFAULT 0,
  total_volume_m3 NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  damage_rate NUMERIC DEFAULT 0,
  loss_rate NUMERIC DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.carrier_stats ENABLE ROW LEVEL SECURITY;

-- Stats viewable by authenticated users
CREATE POLICY "Carrier stats viewable by authenticated"
ON public.carrier_stats FOR SELECT
USING (true);

-- Managers can manage stats
CREATE POLICY "Managers can manage carrier stats"
ON public.carrier_stats FOR ALL
USING (
  has_role(auth.uid(), 'rahbar') OR 
  has_role(auth.uid(), 'bosh_admin') OR 
  has_role(auth.uid(), 'xitoy_manager') OR 
  has_role(auth.uid(), 'uz_manager')
);

-- 5. NOTIFICATION PREFERENCES IN PROFILES
-- =============================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "push_enabled": true,
  "email_enabled": false,
  "shipment_updates": true,
  "arrival_alerts": true,
  "defect_alerts": true,
  "daily_summary": false
}'::jsonb;

-- 6. ENABLE REALTIME FOR NOTIFICATIONS
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_logs;