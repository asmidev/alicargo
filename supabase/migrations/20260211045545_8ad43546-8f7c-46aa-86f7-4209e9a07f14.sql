
-- RPC function: get_daily_finance_summary
-- Barcha agregatsiyalarni serverda bajaradi, 1000 qator limitini chetlab o'tadi
CREATE OR REPLACE FUNCTION public.get_daily_finance_summary(p_date text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_result jsonb;
  v_income numeric := 0;
  v_expense numeric := 0;
  v_marketplace_income numeric := 0;
  v_direct_sale_income numeric := 0;
  v_warehouse_value_uzs numeric := 0;
  v_transit_boxes bigint := 0;
  v_arrived_boxes bigint := 0;
  v_receivable_usd numeric := 0;
  v_payable_usd numeric := 0;
  v_low_stock bigint := 0;
  v_open_claims bigint := 0;
  v_overdue_tasks bigint := 0;
  v_exchange_rate numeric := 12800;
  v_stores jsonb := '[]'::jsonb;
BEGIN
  v_day_start := (p_date || 'T00:00:00+05:00')::timestamptz;
  v_day_end := (p_date || 'T23:59:59.999+05:00')::timestamptz;

  -- 1. Finance transactions aggregation
  SELECT
    COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount_usd ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount_usd ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'income' AND reference_type = 'marketplace_order' THEN amount_usd ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'income' AND reference_type = 'direct_sale' THEN amount_usd ELSE 0 END), 0)
  INTO v_income, v_expense, v_marketplace_income, v_direct_sale_income
  FROM finance_transactions
  WHERE created_at >= v_day_start AND created_at <= v_day_end;

  -- 2. Warehouse value (Tashkent)
  SELECT COALESCE(SUM(COALESCE(cost_price, 0) * COALESCE(stock_quantity, 0)), 0)
  INTO v_warehouse_value_uzs
  FROM product_variants;

  -- 3. Boxes counts
  SELECT COUNT(*) INTO v_transit_boxes FROM boxes WHERE status = 'in_transit';
  SELECT COUNT(*) INTO v_arrived_boxes FROM boxes WHERE actual_arrival >= v_day_start AND actual_arrival <= v_day_end;

  -- 4. Debts
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_receivable_usd
  FROM accounts_receivable WHERE status IN ('pending', 'overdue');

  SELECT COALESCE(SUM(amount_usd), 0) INTO v_payable_usd
  FROM accounts_payable WHERE status IN ('pending', 'overdue');

  -- 5. Alerts
  SELECT COUNT(*) INTO v_low_stock FROM stock_alerts WHERE is_resolved = false;
  SELECT COUNT(*) INTO v_open_claims FROM defect_claims WHERE status IN ('new', 'submitted', 'in_review');
  SELECT COUNT(*) INTO v_overdue_tasks FROM tasks WHERE status = 'todo' AND due_date < now();

  -- 6. Exchange rate from history
  SELECT COALESCE((rates->>'UZS')::numeric, 12800) INTO v_exchange_rate
  FROM exchange_rates_history
  ORDER BY fetched_at DESC LIMIT 1;

  -- 7. Marketplace stores summary (filter out zero-result stores)
  SELECT COALESCE(jsonb_agg(store_row), '[]'::jsonb)
  INTO v_stores
  FROM (
    SELECT jsonb_build_object(
      'name', COALESCE(ms.name, 'Nomalum'),
      'platform', COALESCE(ms.platform, 'unknown'),
      'orders', COALESCE(mfs.orders_count, 0),
      'delivered', COALESCE(mfs.delivered_count, 0),
      'gross_revenue', COALESCE(mfs.gross_revenue, 0),
      'net_revenue', COALESCE(mfs.net_revenue, 0),
      'commission', COALESCE(mfs.commission_total, 0),
      'currency', COALESCE(mfs.currency, 'UZS')
    ) as store_row
    FROM marketplace_finance_summary mfs
    JOIN marketplace_stores ms ON ms.id = mfs.store_id
    WHERE mfs.period_date = p_date::date
      AND mfs.period_type = 'daily'
      AND (COALESCE(mfs.orders_count, 0) > 0 OR COALESCE(mfs.gross_revenue, 0) > 0)
  ) sub;

  -- Build result
  v_result := jsonb_build_object(
    'date', p_date,
    'income_usd', ROUND(v_income::numeric, 2),
    'expense_usd', ROUND(v_expense::numeric, 2),
    'net_profit_usd', ROUND((v_income - v_expense)::numeric, 2),
    'income_uzs', ROUND((v_income * v_exchange_rate)::numeric, 0),
    'expense_uzs', ROUND((v_expense * v_exchange_rate)::numeric, 0),
    'net_profit_uzs', ROUND(((v_income - v_expense) * v_exchange_rate)::numeric, 0),
    'marketplace_income_usd', ROUND(v_marketplace_income::numeric, 2),
    'direct_sale_income_usd', ROUND(v_direct_sale_income::numeric, 2),
    'marketplace_stores', v_stores,
    'warehouse_value_uzs', v_warehouse_value_uzs,
    'boxes_in_transit', v_transit_boxes,
    'boxes_arrived_yesterday', v_arrived_boxes,
    'receivable_usd', ROUND(v_receivable_usd::numeric, 2),
    'payable_usd', ROUND(v_payable_usd::numeric, 2),
    'low_stock_alerts', v_low_stock,
    'open_claims', v_open_claims,
    'overdue_tasks', v_overdue_tasks,
    'exchange_rate', v_exchange_rate
  );

  RETURN v_result;
END;
$function$;

-- Add unique constraint for digest upsert (prevent duplicate daily summaries)
ALTER TABLE public.ali_ai_digests 
  ADD CONSTRAINT ali_ai_digests_user_type_date_unique 
  UNIQUE (user_id, digest_type, digest_date);
