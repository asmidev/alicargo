
-- Add order status history table
CREATE TABLE IF NOT EXISTS public.store_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.store_orders(id) ON DELETE CASCADE NOT NULL,
  old_status store_order_status,
  new_status store_order_status NOT NULL,
  changed_by uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.store_order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read order status history"
  ON public.store_order_status_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert order status history"
  ON public.store_order_status_history FOR INSERT TO authenticated WITH CHECK (true);

-- RLS for store_orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_orders' AND policyname = 'Authenticated users can read store orders') THEN
    CREATE POLICY "Authenticated users can read store orders"
      ON public.store_orders FOR SELECT TO authenticated USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_orders' AND policyname = 'Authenticated users can update store orders') THEN
    CREATE POLICY "Authenticated users can update store orders"
      ON public.store_orders FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

-- Trigger to track status changes
CREATE OR REPLACE FUNCTION public.track_store_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.store_order_status_history (order_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER track_store_order_status
  BEFORE UPDATE ON public.store_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.track_store_order_status_change();
