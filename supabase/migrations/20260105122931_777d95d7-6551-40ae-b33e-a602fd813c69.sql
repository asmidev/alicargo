-- Ali AI Conversations table
CREATE TABLE public.ali_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ali AI Messages table
CREATE TABLE public.ali_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ali_ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ali AI Context Cache - for caching aggregated data
CREATE TABLE public.ali_ai_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  context_type TEXT NOT NULL,
  data JSONB NOT NULL,
  user_role TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ali AI Usage Logs - for tracking and rate limiting
CREATE TABLE public.ali_ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.ali_ai_conversations(id) ON DELETE SET NULL,
  question_preview TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  response_time_ms INTEGER,
  data_scopes_accessed TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_ali_conversations_user ON public.ali_ai_conversations(user_id);
CREATE INDEX idx_ali_messages_conversation ON public.ali_ai_messages(conversation_id);
CREATE INDEX idx_ali_context_cache_key ON public.ali_ai_context_cache(cache_key);
CREATE INDEX idx_ali_context_cache_expires ON public.ali_ai_context_cache(expires_at);
CREATE INDEX idx_ali_usage_logs_user ON public.ali_ai_usage_logs(user_id);
CREATE INDEX idx_ali_usage_logs_created ON public.ali_ai_usage_logs(created_at);

-- Enable RLS
ALTER TABLE public.ali_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ali_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ali_ai_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ali_ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view own conversations"
ON public.ali_ai_conversations FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create own conversations"
ON public.ali_ai_conversations FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
ON public.ali_ai_conversations FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own conversations"
ON public.ali_ai_conversations FOR DELETE
USING (user_id = auth.uid());

-- RLS Policies for messages
CREATE POLICY "Users can view own conversation messages"
ON public.ali_ai_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ali_ai_conversations c 
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own conversation messages"
ON public.ali_ai_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ali_ai_conversations c 
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  )
);

-- RLS Policies for context cache (system managed)
CREATE POLICY "System can manage context cache"
ON public.ali_ai_context_cache FOR ALL
USING (true);

-- RLS Policies for usage logs
CREATE POLICY "Users can view own usage logs"
ON public.ali_ai_usage_logs FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'rahbar') OR has_role(auth.uid(), 'bosh_admin'));

CREATE POLICY "System can insert usage logs"
ON public.ali_ai_usage_logs FOR INSERT
WITH CHECK (true);

-- Admins can view all conversations for analytics
CREATE POLICY "Admins can view all conversations"
ON public.ali_ai_conversations FOR SELECT
USING (has_role(auth.uid(), 'rahbar') OR has_role(auth.uid(), 'bosh_admin'));

-- Updated at trigger for conversations
CREATE TRIGGER update_ali_ai_conversations_updated_at
BEFORE UPDATE ON public.ali_ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();