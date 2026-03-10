-- Phase 1: Cognitive Intelligence Upgrade - User Preferences Table
-- Stores user preferences, learned patterns, and conversation summaries

CREATE TABLE public.ali_ai_user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_language TEXT DEFAULT 'uz',
  preferred_detail_level TEXT DEFAULT 'normal' CHECK (preferred_detail_level IN ('brief', 'normal', 'detailed')),
  favorite_topics TEXT[] DEFAULT '{}',
  learned_context JSONB DEFAULT '{}',
  conversation_summaries JSONB DEFAULT '[]',
  last_topics TEXT[] DEFAULT '{}',
  total_queries INTEGER DEFAULT 0,
  avg_query_complexity TEXT DEFAULT 'simple' CHECK (avg_query_complexity IN ('simple', 'medium', 'complex')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.ali_ai_user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
CREATE POLICY "Users can view own preferences"
  ON public.ali_ai_user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.ali_ai_user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.ali_ai_user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Add columns to track model usage and complexity in usage logs
ALTER TABLE public.ali_ai_usage_logs
  ADD COLUMN IF NOT EXISTS model_used TEXT DEFAULT 'google/gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS query_complexity TEXT DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS tokens_estimate INTEGER;

-- Add summary column to conversations for long-term memory
ALTER TABLE public.ali_ai_conversations
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';

-- Create index for faster preference lookups
CREATE INDEX IF NOT EXISTS idx_ali_ai_user_preferences_user_id 
  ON public.ali_ai_user_preferences(user_id);

-- Create index for faster topic searches
CREATE INDEX IF NOT EXISTS idx_ali_ai_conversations_topics 
  ON public.ali_ai_conversations USING GIN(topics);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_ali_ai_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_ali_ai_preferences_timestamp ON public.ali_ai_user_preferences;
CREATE TRIGGER update_ali_ai_preferences_timestamp
  BEFORE UPDATE ON public.ali_ai_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_ali_ai_preferences_updated_at();