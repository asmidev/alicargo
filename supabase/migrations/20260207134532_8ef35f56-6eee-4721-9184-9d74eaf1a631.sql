-- QADAM 1: Eski duplicate SELECT policy ni o'chirish
DROP POLICY IF EXISTS "Users can view their own telegram link" ON public.telegram_users;

-- QADAM 3: Marketplace order trigger yaratish (agar mavjud bo'lmasa)
DROP TRIGGER IF EXISTS trigger_notify_new_marketplace_order ON public.marketplace_orders;
CREATE TRIGGER trigger_notify_new_marketplace_order
  AFTER INSERT ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_marketplace_order();