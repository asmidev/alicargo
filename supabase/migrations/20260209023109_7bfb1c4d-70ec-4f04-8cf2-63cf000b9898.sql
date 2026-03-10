-- FAZA 4: RLS siyosatlarini kuchaytirish

-- ai_chat_analysis: cheksiz ALL policyni olib tashlab, aniq ruxsatlar berish
DROP POLICY IF EXISTS "Service role full access chat analysis" ON ai_chat_analysis;
CREATE POLICY "Authenticated can read chat analysis" ON ai_chat_analysis FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service can manage chat analysis" ON ai_chat_analysis FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ali_ai_context_cache: xuddi shunday
DROP POLICY IF EXISTS "System can manage context cache" ON ali_ai_context_cache;
CREATE POLICY "Authenticated can read context cache" ON ali_ai_context_cache FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service can manage context cache" ON ali_ai_context_cache FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');