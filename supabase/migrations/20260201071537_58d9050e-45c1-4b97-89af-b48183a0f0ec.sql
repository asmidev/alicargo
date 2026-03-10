-- Phase E: Fix fulfillment_type constraint and normalize Uzum stores

-- Drop the existing constraint that only allows 'fby', 'fbs', NULL
ALTER TABLE marketplace_listings 
DROP CONSTRAINT IF EXISTS marketplace_listings_fulfillment_type_check;

-- Add new constraint with all valid values including Uzum's 'standard', 'FBS', 'DBS'
-- Also include lowercase versions for consistency
ALTER TABLE marketplace_listings 
ADD CONSTRAINT marketplace_listings_fulfillment_type_check 
CHECK (fulfillment_type IS NULL OR fulfillment_type = ANY (ARRAY['fby', 'fbs', 'FBS', 'FBY', 'DBS', 'dbs', 'standard']));

-- Update all Uzum stores from 'standard' to 'fbs' for consistency
UPDATE marketplace_stores 
SET fulfillment_type = 'fbs' 
WHERE platform = 'uzum' AND (fulfillment_type = 'standard' OR fulfillment_type IS NULL);