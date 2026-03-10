ALTER TABLE public.marketplace_orders 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now();