
-- Phase 8.1: AI-Powered Marketplace Infrastructure

-- Webhook events log for all marketplace notifications
CREATE TABLE public.marketplace_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  event_type text NOT NULL,
  external_event_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- AI event analysis for webhook events
CREATE TABLE public.marketplace_ai_event_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id uuid REFERENCES public.marketplace_webhook_events(id) ON DELETE CASCADE,
  classification text NOT NULL,
  urgency_score integer CHECK (urgency_score >= 0 AND urgency_score <= 100),
  risk_score integer CHECK (risk_score >= 0 AND risk_score <= 100),
  ai_recommendation text,
  recommended_actions jsonb,
  model_used text,
  tokens_used integer,
  processed_at timestamptz DEFAULT now()
);

-- Customer communications (marketplace chats)
CREATE TABLE public.marketplace_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  external_chat_id text NOT NULL,
  order_id text,
  external_order_id text,
  customer_name text,
  customer_phone text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer DEFAULT 0,
  status text DEFAULT 'open',
  priority text DEFAULT 'normal',
  assigned_to uuid,
  ai_sentiment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, external_chat_id)
);

-- Chat messages
CREATE TABLE public.marketplace_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES public.marketplace_chats(id) ON DELETE CASCADE,
  external_message_id text,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'seller', 'system', 'ai_suggested')),
  message text,
  attachments jsonb,
  is_read boolean DEFAULT false,
  ai_sentiment text,
  ai_intent text,
  ai_suggested_response text,
  created_at timestamptz DEFAULT now()
);

-- AI chat analysis
CREATE TABLE public.ai_chat_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.marketplace_chat_messages(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES public.marketplace_chats(id) ON DELETE CASCADE,
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative', 'angry')),
  intent text,
  urgency text CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  suggested_response text,
  response_confidence numeric,
  response_used boolean DEFAULT false,
  resolution_outcome text,
  model_used text,
  created_at timestamptz DEFAULT now()
);

-- Returns management
CREATE TABLE public.marketplace_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  external_return_id text NOT NULL,
  order_id text,
  external_order_id text,
  status text NOT NULL DEFAULT 'pending',
  return_type text,
  reason text,
  reason_category text,
  items jsonb NOT NULL DEFAULT '[]',
  photos jsonb,
  customer_name text,
  customer_phone text,
  decision text CHECK (decision IN ('approved', 'rejected', 'partial', 'pending', 'escalated')),
  decision_comment text,
  decided_by uuid,
  decided_at timestamptz,
  refund_amount numeric,
  refund_currency text DEFAULT 'UZS',
  ai_recommendation text,
  ai_fraud_score integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, external_return_id)
);

-- AI return decisions
CREATE TABLE public.ai_return_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid REFERENCES public.marketplace_returns(id) ON DELETE CASCADE,
  recommended_decision text NOT NULL,
  confidence_score numeric,
  reasoning text,
  fraud_indicators jsonb,
  similar_returns_count integer,
  auto_approved boolean DEFAULT false,
  model_used text,
  created_at timestamptz DEFAULT now()
);

-- Reviews management
CREATE TABLE public.marketplace_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  marketplace text NOT NULL,
  external_review_id text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  pros text,
  cons text,
  photos jsonb,
  customer_name text,
  order_id text,
  our_response text,
  response_status text DEFAULT 'pending' CHECK (response_status IN ('pending', 'responded', 'skipped', 'ai_draft')),
  responded_at timestamptz,
  responded_by uuid,
  ai_generated_response text,
  ai_sentiment text,
  review_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, external_review_id)
);

-- Questions management
CREATE TABLE public.marketplace_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  marketplace text NOT NULL,
  external_question_id text,
  question_text text NOT NULL,
  customer_name text,
  our_answer text,
  answer_status text DEFAULT 'pending' CHECK (answer_status IN ('pending', 'answered', 'skipped', 'ai_draft')),
  answered_at timestamptz,
  answered_by uuid,
  ai_generated_answer text,
  question_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, external_question_id)
);

-- AI price recommendations
CREATE TABLE public.ai_price_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  current_price numeric NOT NULL,
  recommended_price numeric NOT NULL,
  min_price numeric,
  max_price numeric,
  reasoning text,
  factors jsonb,
  expected_sales_impact numeric,
  expected_profit_impact numeric,
  confidence_score numeric,
  competitor_prices jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'expired')),
  applied_at timestamptz,
  applied_by uuid,
  result_tracked boolean DEFAULT false,
  actual_sales_impact numeric,
  model_used text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Competitor prices tracking
CREATE TABLE public.ai_competitor_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  competitor_name text,
  competitor_sku text,
  competitor_price numeric NOT NULL,
  competitor_currency text DEFAULT 'UZS',
  our_price numeric,
  price_difference numeric,
  price_difference_percent numeric,
  is_cheaper boolean,
  source text,
  fetched_at timestamptz DEFAULT now()
);

-- Demand forecasts
CREATE TABLE public.ai_demand_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE SET NULL,
  forecast_period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  predicted_units integer NOT NULL,
  confidence_low integer,
  confidence_high integer,
  confidence_score numeric,
  factors jsonb,
  should_reorder boolean DEFAULT false,
  recommended_reorder_quantity integer,
  optimal_reorder_date date,
  model_used text,
  created_at timestamptz DEFAULT now()
);

-- AI listing analysis
CREATE TABLE public.ai_listing_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  overall_score integer CHECK (overall_score >= 0 AND overall_score <= 100),
  title_score integer,
  description_score integer,
  image_score integer,
  keyword_coverage numeric,
  improvements jsonb,
  optimized_title text,
  optimized_description text,
  suggested_keywords text[],
  competitor_comparison jsonb,
  model_used text,
  analyzed_at timestamptz DEFAULT now()
);

-- AI generated content
CREATE TABLE public.ai_generated_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('title', 'description', 'keywords', 'bullet_points')),
  language text DEFAULT 'uz',
  marketplace text,
  original_content text,
  generated_content text NOT NULL,
  was_applied boolean DEFAULT false,
  applied_at timestamptz,
  applied_by uuid,
  model_used text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.marketplace_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_ai_event_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_return_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_price_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_competitor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_listing_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can view webhook events" ON public.marketplace_webhook_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert webhook events" ON public.marketplace_webhook_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update webhook events" ON public.marketplace_webhook_events FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view AI event analysis" ON public.marketplace_ai_event_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert AI event analysis" ON public.marketplace_ai_event_analysis FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can manage chats" ON public.marketplace_chats FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage chat messages" ON public.marketplace_chat_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage chat analysis" ON public.ai_chat_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage returns" ON public.marketplace_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage return decisions" ON public.ai_return_decisions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage reviews" ON public.marketplace_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage questions" ON public.marketplace_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage price recommendations" ON public.ai_price_recommendations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage competitor prices" ON public.ai_competitor_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage demand forecasts" ON public.ai_demand_forecasts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage listing analysis" ON public.ai_listing_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage generated content" ON public.ai_generated_content FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role policies for edge functions
CREATE POLICY "Service role full access webhook events" ON public.marketplace_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access AI event analysis" ON public.marketplace_ai_event_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access chats" ON public.marketplace_chats FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access chat messages" ON public.marketplace_chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access chat analysis" ON public.ai_chat_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access returns" ON public.marketplace_returns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access return decisions" ON public.ai_return_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access reviews" ON public.marketplace_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access questions" ON public.marketplace_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access price recommendations" ON public.ai_price_recommendations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access competitor prices" ON public.ai_competitor_prices FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access demand forecasts" ON public.ai_demand_forecasts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access listing analysis" ON public.ai_listing_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access generated content" ON public.ai_generated_content FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_webhook_events_store ON public.marketplace_webhook_events(store_id);
CREATE INDEX idx_webhook_events_processed ON public.marketplace_webhook_events(processed);
CREATE INDEX idx_webhook_events_type ON public.marketplace_webhook_events(event_type);
CREATE INDEX idx_webhook_events_created ON public.marketplace_webhook_events(created_at DESC);

CREATE INDEX idx_chats_store ON public.marketplace_chats(store_id);
CREATE INDEX idx_chats_status ON public.marketplace_chats(status);
CREATE INDEX idx_chats_unread ON public.marketplace_chats(unread_count) WHERE unread_count > 0;

CREATE INDEX idx_returns_store ON public.marketplace_returns(store_id);
CREATE INDEX idx_returns_status ON public.marketplace_returns(status);
CREATE INDEX idx_returns_decision ON public.marketplace_returns(decision);

CREATE INDEX idx_reviews_store ON public.marketplace_reviews(store_id);
CREATE INDEX idx_reviews_product ON public.marketplace_reviews(product_id);
CREATE INDEX idx_reviews_status ON public.marketplace_reviews(response_status);

CREATE INDEX idx_questions_store ON public.marketplace_questions(store_id);
CREATE INDEX idx_questions_product ON public.marketplace_questions(product_id);
CREATE INDEX idx_questions_status ON public.marketplace_questions(answer_status);

CREATE INDEX idx_price_recs_product ON public.ai_price_recommendations(product_id);
CREATE INDEX idx_price_recs_status ON public.ai_price_recommendations(status);

CREATE INDEX idx_demand_forecasts_product ON public.ai_demand_forecasts(product_id);
CREATE INDEX idx_demand_forecasts_period ON public.ai_demand_forecasts(period_start, period_end);

CREATE INDEX idx_listing_analysis_product ON public.ai_listing_analysis(product_id);
CREATE INDEX idx_listing_analysis_listing ON public.ai_listing_analysis(listing_id);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_returns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_price_recommendations;
