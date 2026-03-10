
-- Stock audit log table
CREATE TABLE public.stock_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_stock integer,
  new_stock integer,
  change_amount integer,
  change_source text NOT NULL DEFAULT 'auto',
  reference_id text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_stock_audit_product ON public.stock_audit_log(product_id);
CREATE INDEX idx_stock_audit_created ON public.stock_audit_log(created_at DESC);

-- RLS
ALTER TABLE public.stock_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stock audit log"
  ON public.stock_audit_log FOR SELECT TO authenticated USING (true);

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_stock_change()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF OLD.tashkent_manual_stock IS DISTINCT FROM NEW.tashkent_manual_stock THEN
    INSERT INTO public.stock_audit_log (product_id, old_stock, new_stock, change_amount, change_source)
    VALUES (NEW.id, OLD.tashkent_manual_stock, NEW.tashkent_manual_stock,
            COALESCE(NEW.tashkent_manual_stock, 0) - COALESCE(OLD.tashkent_manual_stock, 0), 'auto');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER trg_stock_audit
  AFTER UPDATE OF tashkent_manual_stock ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_stock_change();
