
ALTER TABLE public.handover_invoices 
ADD COLUMN IF NOT EXISTS stock_deducted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stock_deducted_at timestamptz,
ADD COLUMN IF NOT EXISTS matched_items_count integer DEFAULT 0;
