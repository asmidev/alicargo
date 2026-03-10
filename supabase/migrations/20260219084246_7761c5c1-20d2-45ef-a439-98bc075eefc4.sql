-- Add Paynet fields to store_orders table
ALTER TABLE public.store_orders 
  ADD COLUMN IF NOT EXISTS paynet_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS paynet_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paynet_invoice_url TEXT;

-- Index for faster lookups by transaction ID
CREATE INDEX IF NOT EXISTS idx_store_orders_paynet_txn 
  ON public.store_orders(paynet_transaction_id) 
  WHERE paynet_transaction_id IS NOT NULL;
