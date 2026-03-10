
-- 1-qadam: Buzilgan triggerni o'chirish
DROP TRIGGER IF EXISTS trigger_notify_new_marketplace_order ON public.marketplace_orders;
DROP FUNCTION IF EXISTS notify_new_marketplace_order();

-- 3-qadam: Stuck "running" loglarni tozalash
UPDATE public.marketplace_sync_logs
SET 
  status = 'error',
  error_message = 'Cleaned: stuck due to broken net.http_post trigger',
  completed_at = now()
WHERE status = 'running';
