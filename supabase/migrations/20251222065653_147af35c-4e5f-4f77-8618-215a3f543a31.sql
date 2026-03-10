-- Add notify_messages column to telegram_users for chat notifications
ALTER TABLE public.telegram_users 
ADD COLUMN IF NOT EXISTS notify_messages boolean DEFAULT true;