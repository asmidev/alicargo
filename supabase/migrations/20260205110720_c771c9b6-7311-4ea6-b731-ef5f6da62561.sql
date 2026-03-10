-- Phase 1 Part 2: Fix C3 - Tighten existing marketplace tables RLS policies

-- Fix ai_chat_analysis table
DROP POLICY IF EXISTS "Authenticated users can manage chat analysis" ON ai_chat_analysis;
CREATE POLICY "Managers can manage chat analysis"
  ON ai_chat_analysis FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'manager')
  );

-- Fix ai_analysis_cache table (system managed)
DROP POLICY IF EXISTS "System can manage cache" ON ai_analysis_cache;
CREATE POLICY "System can manage cache"
  ON ai_analysis_cache FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin')
  )
  WITH CHECK (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin')
  );

-- Fix shift_handoffs table - use from_user_id and to_user_id columns
DROP POLICY IF EXISTS "shift_handoffs_select" ON shift_handoffs;
DROP POLICY IF EXISTS "Authenticated users can view shift handoffs" ON shift_handoffs;
CREATE POLICY "Users can view relevant shift handoffs"
  ON shift_handoffs FOR SELECT TO authenticated
  USING (
    from_user_id = auth.uid() OR
    to_user_id = auth.uid() OR
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin')
  );