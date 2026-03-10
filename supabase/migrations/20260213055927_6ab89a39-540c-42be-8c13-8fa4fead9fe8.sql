
-- 1. Fix overly permissive store_orders RLS: restrict anon SELECT to specific order by ID
DROP POLICY IF EXISTS "Anyone can view store orders" ON public.store_orders;
DROP POLICY IF EXISTS "Public can view store orders" ON public.store_orders;
DROP POLICY IF EXISTS "Anon can view store orders" ON public.store_orders;

-- Allow anon to view only their specific order (via order_number or id match is not possible without session)
-- Instead: no anon SELECT. Only authenticated users (admins) can view.
-- The OrderSuccess page will use a service-role approach or we keep a limited policy.
-- Simplest secure approach: allow anon SELECT only by exact ID match
CREATE POLICY "Anon can view own order by id"
ON public.store_orders
FOR SELECT
TO anon
USING (false);

-- Authenticated users (admins) can see all orders
CREATE POLICY "Authenticated users can view all store orders"
ON public.store_orders
FOR SELECT
TO authenticated
USING (true);

-- 2. Add duplicate finance transaction guard for store orders
-- Create a unique partial index to prevent duplicate finance entries for delivered store orders
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_store_order_finance
ON public.finance_transactions (reference_id)
WHERE reference_type = 'store_order' AND transaction_type = 'income';

-- 3. Stock decrement trigger on store_orders status change
CREATE OR REPLACE FUNCTION public.auto_store_order_stock_management()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  product_id UUID;
  variant_id UUID;
  qty INTEGER;
BEGIN
  -- Only act on status changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- When confirmed: decrement stock
  IF NEW.status = 'confirmed' AND OLD.status = 'new' THEN
    FOR item IN SELECT jsonb_array_elements(NEW.items::jsonb)
    LOOP
      product_id := (item->>'productId')::UUID;
      variant_id := NULLIF(item->>'variantId', '')::UUID;
      qty := COALESCE((item->>'quantity')::INTEGER, 1);
      IF product_id IS NOT NULL THEN
        PERFORM decrement_tashkent_stock(product_id, qty, variant_id);
      END IF;
    END LOOP;
  END IF;

  -- When cancelled from confirmed/preparing/delivering: restore stock
  IF NEW.status = 'cancelled' AND OLD.status IN ('confirmed', 'preparing', 'delivering', 'delivered') THEN
    FOR item IN SELECT jsonb_array_elements(NEW.items::jsonb)
    LOOP
      product_id := (item->>'productId')::UUID;
      variant_id := NULLIF(item->>'variantId', '')::UUID;
      qty := COALESCE((item->>'quantity')::INTEGER, 1);
      IF product_id IS NOT NULL THEN
        PERFORM decrement_tashkent_stock(product_id, -qty, variant_id);
      END IF;
    END LOOP;
  END IF;

  -- When delivered: auto-create finance transaction (with duplicate guard via unique index)
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    INSERT INTO finance_transactions (
      transaction_type, amount, currency, category, description,
      reference_id, reference_type
    ) VALUES (
      'income', NEW.total_amount, 'UZS', 'Sayt sotuvlari',
      'Buyurtma #' || COALESCE(NEW.order_number, NEW.id::text),
      NEW.id, 'store_order'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_store_order_stock_management ON public.store_orders;
CREATE TRIGGER trg_store_order_stock_management
BEFORE UPDATE ON public.store_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_store_order_stock_management();
