
-- Clean up redundant SELECT policies on store_orders
-- Keep: anon INSERT policy (for checkout) + one authenticated SELECT + authenticated UPDATE
-- Remove overlapping/redundant SELECT policies

DROP POLICY IF EXISTS "Anyone can read store order by ID" ON public.store_orders;
DROP POLICY IF EXISTS "Anon can view own order by id" ON public.store_orders;
DROP POLICY IF EXISTS "Staff can view all store orders" ON public.store_orders;

-- Keep "Authenticated users can read store orders" as the single SELECT policy
-- This covers all CRM staff who need to manage orders
