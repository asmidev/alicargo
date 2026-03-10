-- Enable required extensions for cron and HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create function to trigger marketplace stock sync via edge function
CREATE OR REPLACE FUNCTION public.trigger_marketplace_stock_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_store RECORD;
  v_request_id bigint;
BEGIN
  -- Get store info to determine platform
  SELECT id, platform, name INTO v_store
  FROM marketplace_stores
  WHERE id = NEW.store_id;
  
  -- Only trigger if we have a valid store and stock actually changed
  IF v_store.id IS NOT NULL AND OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity THEN
    -- Call the sync trigger edge function via pg_net
    SELECT extensions.net.http_post(
      url := 'https://qnbxnldkzuoydqgzagvu.supabase.co/functions/v1/marketplace-sync-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYnhubGRrenVveWRxZ3phZ3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODc4NjQsImV4cCI6MjA3OTY2Mzg2NH0.qtQBorH6DKn0ZVnuK7GFPjeHn1xnqU3Ia_BcgxMkpG4'
      ),
      body := jsonb_build_object(
        'listing_id', NEW.id,
        'store_id', NEW.store_id,
        'product_id', NEW.product_id,
        'platform', v_store.platform,
        'old_stock', OLD.stock_quantity,
        'new_stock', NEW.stock_quantity,
        'trigger_type', 'stock_change'
      )
    ) INTO v_request_id;
    
    -- Log the trigger event
    RAISE NOTICE 'Marketplace stock sync triggered for listing %, request_id: %', NEW.id, v_request_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on marketplace_listings for stock changes
DROP TRIGGER IF EXISTS on_marketplace_stock_change ON public.marketplace_listings;
CREATE TRIGGER on_marketplace_stock_change
  AFTER UPDATE OF stock_quantity ON public.marketplace_listings
  FOR EACH ROW
  WHEN (OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity)
  EXECUTE FUNCTION public.trigger_marketplace_stock_sync();

-- Create function to notify on new marketplace orders
CREATE OR REPLACE FUNCTION public.notify_new_marketplace_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_store RECORD;
  v_request_id bigint;
BEGIN
  -- Get store info
  SELECT name, platform INTO v_store
  FROM marketplace_stores
  WHERE id = NEW.store_id;
  
  -- Call telegram alert for new order
  SELECT extensions.net.http_post(
    url := 'https://qnbxnldkzuoydqgzagvu.supabase.co/functions/v1/send-telegram-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYnhubGRrenVveWRxZ3phZ3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODc4NjQsImV4cCI6MjA3OTY2Mzg2NH0.qtQBorH6DKn0ZVnuK7GFPjeHn1xnqU3Ia_BcgxMkpG4'
    ),
    body := jsonb_build_object(
      'event_type', 'new_marketplace_order',
      'data', jsonb_build_object(
        'order_number', NEW.external_order_id,
        'platform', v_store.platform,
        'store_name', v_store.name,
        'total', NEW.total_amount,
        'customer_name', NEW.customer_name,
        'items_count', jsonb_array_length(COALESCE(NEW.items, '[]'::jsonb))
      ),
      'target_roles', ARRAY['rahbar', 'bosh_admin', 'manager']
    )
  ) INTO v_request_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new marketplace orders
DROP TRIGGER IF EXISTS on_new_marketplace_order ON public.marketplace_orders;
CREATE TRIGGER on_new_marketplace_order
  AFTER INSERT ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_marketplace_order();

-- Add low_stock_threshold column to marketplace_stores if not exists
ALTER TABLE public.marketplace_stores 
ADD COLUMN IF NOT EXISTS low_stock_threshold integer DEFAULT 5;

-- Add notify_marketplace_orders and notify_low_stock to telegram_users if not exists
ALTER TABLE public.telegram_users
ADD COLUMN IF NOT EXISTS notify_marketplace_orders boolean DEFAULT true;

ALTER TABLE public.telegram_users
ADD COLUMN IF NOT EXISTS notify_low_stock boolean DEFAULT true;