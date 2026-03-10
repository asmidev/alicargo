-- ==========================================
-- BOSQICH 4: RLS POLICY MUSTAHKAMLASH
-- ==========================================

-- ==========================================
-- 1. MARKETPLACE_QUESTIONS POLICY TUZATISH
-- ==========================================

-- Eski ochiq INSERT policyni o'chirish
DROP POLICY IF EXISTS "System can insert questions" ON marketplace_questions;

-- Eski ochiq UPDATE policyni o'chirish
DROP POLICY IF EXISTS "Authenticated users can answer questions" ON marketplace_questions;

-- Yangi INSERT: Faqat service role (edge functions) orqali
-- NOTE: service_role uchun RLS bypass qilinadi, shuning uchun bu policy 
-- authenticated userlarga insert qilishni bloklaydi
CREATE POLICY "Only service role can insert questions" ON marketplace_questions
  FOR INSERT TO authenticated
  WITH CHECK (false);  -- Authenticated userlar insert qila olmaydi

-- Yangi UPDATE: Faqat manager va adminlar
CREATE POLICY "Managers can update questions" ON marketplace_questions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'bosh_admin'::app_role) OR
    has_role(auth.uid(), 'rahbar'::app_role) OR
    has_role(auth.uid(), 'uz_manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'bosh_admin'::app_role) OR
    has_role(auth.uid(), 'rahbar'::app_role) OR
    has_role(auth.uid(), 'uz_manager'::app_role)
  );

-- ==========================================
-- 2. MARKETPLACE_REVIEWS POLICY TUZATISH
-- ==========================================

-- Eski ochiq INSERT policyni o'chirish
DROP POLICY IF EXISTS "System can insert reviews" ON marketplace_reviews;

-- Eski ochiq UPDATE policyni o'chirish  
DROP POLICY IF EXISTS "Authenticated users can respond to reviews" ON marketplace_reviews;

-- Yangi INSERT: Authenticated userlarga bloklash (service role bypass)
CREATE POLICY "Only service role can insert reviews" ON marketplace_reviews
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- Yangi UPDATE: Faqat manager va adminlar javob yozishi mumkin
CREATE POLICY "Managers can respond to reviews" ON marketplace_reviews
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'bosh_admin'::app_role) OR
    has_role(auth.uid(), 'rahbar'::app_role) OR
    has_role(auth.uid(), 'uz_manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'bosh_admin'::app_role) OR
    has_role(auth.uid(), 'rahbar'::app_role) OR
    has_role(auth.uid(), 'uz_manager'::app_role)
  );

-- ==========================================
-- 3. MARKETPLACE_SYNC_LOGS POLICY TUZATISH
-- ==========================================

-- Eski ochiq INSERT policyni o'chirish
DROP POLICY IF EXISTS "System can insert sync logs" ON marketplace_sync_logs;

-- Yangi INSERT: Authenticated userlarga bloklash (service role bypass)
CREATE POLICY "Only service role can insert sync logs" ON marketplace_sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- Yangi UPDATE: Faqat service role orqali (sync functions)
CREATE POLICY "Only service role can update sync logs" ON marketplace_sync_logs
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

-- ==========================================
-- 4. MARKETPLACE_ORDERS INSERT TUZATISH
-- ==========================================

-- Orders ham faqat service role orqali insert bo'lishi kerak
CREATE POLICY "Only service role can insert orders" ON marketplace_orders
  FOR INSERT TO authenticated
  WITH CHECK (false);