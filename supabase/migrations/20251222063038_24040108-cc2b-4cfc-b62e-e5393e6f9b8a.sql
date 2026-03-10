-- Activity Feed table for tracking all activities
CREATE TABLE public.activity_feed (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_type text NOT NULL, -- 'verification', 'box_created', 'shipment_updated', 'defect_found', 'message', 'handoff'
  entity_type text, -- 'box', 'shipment', 'product', 'session'
  entity_id uuid,
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User Presence table for tracking online status
CREATE TABLE public.user_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'online', -- 'online', 'away', 'busy', 'offline'
  current_activity text, -- 'verifying_box', 'packing', 'idle'
  current_entity_id uuid, -- The box/shipment they're working on
  current_entity_type text,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  location text, -- 'china', 'uzbekistan'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Shift Handoff Notes table
CREATE TABLE public.shift_handoffs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id uuid NOT NULL,
  to_user_id uuid, -- NULL means "to next shift" (anyone)
  to_role text, -- Target role if not specific user
  location text NOT NULL, -- 'china', 'uzbekistan'
  title text NOT NULL,
  content text NOT NULL,
  priority text DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  is_read boolean DEFAULT false,
  read_at timestamp with time zone,
  read_by uuid,
  expires_at timestamp with time zone, -- Auto-expire old notes
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Team Messages table for chat
CREATE TABLE public.team_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'general', -- 'general', 'china', 'uzbekistan', 'urgent'
  content text NOT NULL,
  reply_to_id uuid REFERENCES public.team_messages(id),
  mentions uuid[] DEFAULT '{}', -- Array of mentioned user IDs
  attachments jsonb DEFAULT '[]'::jsonb, -- File attachments
  is_pinned boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  edited_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Message Read Status table
CREATE TABLE public.message_read_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.team_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_status ENABLE ROW LEVEL SECURITY;

-- Activity Feed Policies
CREATE POLICY "Activity feed viewable by authenticated"
  ON public.activity_feed FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert activities"
  ON public.activity_feed FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- User Presence Policies
CREATE POLICY "Presence viewable by authenticated"
  ON public.user_presence FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own presence"
  ON public.user_presence FOR ALL
  USING (user_id = auth.uid());

-- Shift Handoffs Policies
CREATE POLICY "Handoffs viewable by authenticated"
  ON public.shift_handoffs FOR SELECT
  USING (true);

CREATE POLICY "Staff can create handoffs"
  ON public.shift_handoffs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update relevant handoffs"
  ON public.shift_handoffs FOR UPDATE
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR to_user_id IS NULL);

-- Team Messages Policies
CREATE POLICY "Messages viewable by authenticated"
  ON public.team_messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can send messages"
  ON public.team_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND sender_id = auth.uid());

CREATE POLICY "Users can update own messages"
  ON public.team_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- Message Read Status Policies
CREATE POLICY "Users can view read status"
  ON public.message_read_status FOR SELECT
  USING (true);

CREATE POLICY "Users can mark messages read"
  ON public.message_read_status FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Enable realtime for collaboration tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_handoffs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;

-- Index for better performance
CREATE INDEX idx_activity_feed_created_at ON public.activity_feed(created_at DESC);
CREATE INDEX idx_activity_feed_user_id ON public.activity_feed(user_id);
CREATE INDEX idx_team_messages_channel ON public.team_messages(channel);
CREATE INDEX idx_team_messages_created_at ON public.team_messages(created_at DESC);
CREATE INDEX idx_shift_handoffs_location ON public.shift_handoffs(location);
CREATE INDEX idx_user_presence_status ON public.user_presence(status);