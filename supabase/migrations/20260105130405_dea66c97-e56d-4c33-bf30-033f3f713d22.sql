-- Phase 2: Proactive Intelligence - Insights Table
-- Stores AI-discovered insights, alerts, and proactive suggestions

CREATE TABLE public.ali_ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('alert', 'trend', 'prediction', 'suggestion', 'digest')),
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  action_url TEXT,
  action_label TEXT,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ali_ai_insights ENABLE ROW LEVEL SECURITY;

-- Global insights (user_id is null) can be seen by admins, personal by owner
CREATE POLICY "Users can view own insights"
  ON public.ali_ai_insights FOR SELECT
  USING (
    user_id = auth.uid() OR 
    (user_id IS NULL AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('rahbar', 'bosh_admin')
    ))
  );

CREATE POLICY "Users can update own insights"
  ON public.ali_ai_insights FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Service role can insert insights
CREATE POLICY "Service can insert insights"
  ON public.ali_ai_insights FOR INSERT
  WITH CHECK (true);

-- Daily digest tracking table
CREATE TABLE public.ali_ai_digests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_type TEXT NOT NULL DEFAULT 'daily',
  digest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  metrics JSONB DEFAULT '{}',
  sent_via TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, digest_type, digest_date)
);

-- Enable RLS
ALTER TABLE public.ali_ai_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own digests"
  ON public.ali_ai_digests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert digests"
  ON public.ali_ai_digests FOR INSERT
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_ali_ai_insights_user_unread 
  ON public.ali_ai_insights(user_id, is_read) 
  WHERE is_read = false AND is_dismissed = false;

CREATE INDEX idx_ali_ai_insights_type 
  ON public.ali_ai_insights(insight_type, created_at DESC);

CREATE INDEX idx_ali_ai_insights_expires 
  ON public.ali_ai_insights(expires_at) 
  WHERE expires_at IS NOT NULL;

CREATE INDEX idx_ali_ai_digests_user_date 
  ON public.ali_ai_digests(user_id, digest_date DESC);