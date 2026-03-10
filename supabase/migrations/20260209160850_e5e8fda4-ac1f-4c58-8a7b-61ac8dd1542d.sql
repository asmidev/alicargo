
ALTER TABLE public.marketplace_finance_summary 
DROP CONSTRAINT marketplace_finance_summary_sync_source_check;

ALTER TABLE public.marketplace_finance_summary 
ADD CONSTRAINT marketplace_finance_summary_sync_source_check 
CHECK (sync_source = ANY (ARRAY['api'::text, 'calculated'::text, 'manual'::text, 'zero_fill'::text]));
