
-- Backfill: delete orphan income transactions for cancelled/returned orders
DELETE FROM public.finance_transactions
WHERE reference_type = 'marketplace_order'
AND reference_id IN (
  SELECT id FROM public.marketplace_orders
  WHERE fulfillment_status IN ('cancelled', 'canceled', 'returned')
);
