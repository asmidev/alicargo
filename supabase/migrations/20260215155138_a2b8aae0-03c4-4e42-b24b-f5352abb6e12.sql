
-- 1. store_orders: Tighten UPDATE policies (replace two overlapping permissive UPDATE policies with one role-based)
DROP POLICY IF EXISTS "Authenticated users can update store orders" ON public.store_orders;
DROP POLICY IF EXISTS "Staff can update store orders" ON public.store_orders;
CREATE POLICY "Staff can update store orders" ON public.store_orders
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'uz_manager') OR
    has_role(auth.uid(), 'uz_receiver')
  );

-- 2. store_categories: Replace ALL with role-based
DROP POLICY IF EXISTS "Authenticated users can manage store categories" ON public.store_categories;
CREATE POLICY "Admins can manage store categories" ON public.store_categories
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin')
  )
  WITH CHECK (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin')
  );

-- 3. marketplace_returns: Tighten INSERT and UPDATE
DROP POLICY IF EXISTS "Authenticated users can insert returns" ON public.marketplace_returns;
DROP POLICY IF EXISTS "Authenticated users can update returns" ON public.marketplace_returns;
CREATE POLICY "Staff can insert returns" ON public.marketplace_returns
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'manager')
  );
CREATE POLICY "Staff can update returns" ON public.marketplace_returns
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'manager')
  );

-- 4. fbu_activity_log: Tighten ALL
DROP POLICY IF EXISTS "Service role can manage fbu_activity_log" ON public.fbu_activity_log;
CREATE POLICY "Staff can manage fbu_activity_log" ON public.fbu_activity_log
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'manager')
  );

-- 5. fbu_order_date_cache: Tighten ALL
DROP POLICY IF EXISTS "Service role full access" ON public.fbu_order_date_cache;
CREATE POLICY "Staff can manage fbu_order_date_cache" ON public.fbu_order_date_cache
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'manager')
  );

-- 6. categories: Fix WITH CHECK on UPDATE (already has USING with role check, just tighten WITH CHECK)
DROP POLICY IF EXISTS "Managers can update categories" ON public.categories;
CREATE POLICY "Managers can update categories" ON public.categories
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin')
  )
  WITH CHECK (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin')
  );
