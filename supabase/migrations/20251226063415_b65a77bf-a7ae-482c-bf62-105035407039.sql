-- Add notify_tasks column to telegram_users table
ALTER TABLE public.telegram_users 
ADD COLUMN IF NOT EXISTS notify_tasks boolean DEFAULT true;