-- Add seller_id column for Uzum stores (used for GraphQL API)
ALTER TABLE marketplace_stores 
ADD COLUMN IF NOT EXISTS seller_id TEXT;

COMMENT ON COLUMN marketplace_stores.seller_id IS 'Uzum Seller ID - required for GraphQL API catalog fetching';