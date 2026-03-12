-- Fix generate_claim_number trigger - incorrect SUBSTRING offset
-- 'CLM-2026-0001' positions: C=1, L=2, M=3, -=4, 2=5, 0=6, 2=7, 6=8, -=9, 0=10
-- FROM 6 returns '026-0001' which can't be cast to INTEGER
-- FROM 10 returns '0001' which is correct

CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_num INTEGER;
BEGIN
  year_prefix := to_char(now(), 'YYYY');
  
  -- 'CLM-' = 4 chars, year = 4 chars, '-' = 1 char = total 9 chars prefix
  -- So sequence starts at position 10
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(claim_number FROM 10) AS INTEGER)), 
    0
  ) + 1
  INTO next_num
  FROM public.defect_claims
  WHERE claim_number LIKE 'CLM-' || year_prefix || '-%';
  
  NEW.claim_number := 'CLM-' || year_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
