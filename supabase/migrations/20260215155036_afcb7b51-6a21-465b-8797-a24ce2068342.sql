
-- Create a function to get finance balance without hitting row limits
CREATE OR REPLACE FUNCTION public.get_finance_balance()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total_income', COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount_usd ELSE 0 END), 0),
    'total_expense', COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount_usd ELSE 0 END), 0),
    'balance', COALESCE(
      SUM(CASE WHEN transaction_type = 'income' THEN amount_usd ELSE 0 END) -
      SUM(CASE WHEN transaction_type = 'expense' THEN amount_usd ELSE 0 END),
      0
    )
  )
  FROM finance_transactions;
$$;
