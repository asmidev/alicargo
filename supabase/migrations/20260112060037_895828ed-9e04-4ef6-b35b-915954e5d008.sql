-- Create a table to track sync schedules (if not exists)
CREATE TABLE IF NOT EXISTS public.marketplace_sync_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  sync_type text NOT NULL DEFAULT 'pull_all',
  frequency_minutes integer NOT NULL DEFAULT 30,
  is_enabled boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_sync_schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Authenticated users can view sync schedules" ON public.marketplace_sync_schedules;
DROP POLICY IF EXISTS "Authenticated users can manage sync schedules" ON public.marketplace_sync_schedules;

CREATE POLICY "Authenticated users can view sync schedules"
ON public.marketplace_sync_schedules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage sync schedules"
ON public.marketplace_sync_schedules
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add realtime for sync logs only (others already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_sync_logs;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create default sync schedules for all active stores
INSERT INTO marketplace_sync_schedules (store_id, sync_type, frequency_minutes, is_enabled, next_run_at)
SELECT id, 'pull_all', 30, true, now() + interval '5 minutes'
FROM marketplace_stores
WHERE is_active = true
  AND id NOT IN (SELECT store_id FROM marketplace_sync_schedules WHERE store_id IS NOT NULL);

-- Add index for faster sync queries
CREATE INDEX IF NOT EXISTS idx_sync_schedules_next_run 
ON marketplace_sync_schedules(next_run_at) 
WHERE is_enabled = true;