-- Add business_id column for Yandex stores (required for product endpoints)
ALTER TABLE marketplace_stores 
ADD COLUMN IF NOT EXISTS business_id TEXT;

-- Add comments explaining the difference between campaign_id and business_id
COMMENT ON COLUMN marketplace_stores.business_id IS 'Yandex businessId - required for product/offer endpoints. Different from campaignId.';
COMMENT ON COLUMN marketplace_stores.campaign_id IS 'Yandex campaignId - used for order and stock endpoints.';