-- Add auto_sync_enabled column to marketplace_stores
ALTER TABLE public.marketplace_stores 
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT true;

-- Add next_sync_at column for tracking scheduled syncs
ALTER TABLE public.marketplace_stores 
ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMP WITH TIME ZONE;

-- Enable realtime for marketplace_sync_logs only (others already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'marketplace_sync_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_sync_logs;
  END IF;
END $$;