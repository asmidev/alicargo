-- Add 'fby_fbs' to allowed fulfillment types in marketplace_listings
ALTER TABLE marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_fulfillment_type_check;

ALTER TABLE marketplace_listings ADD CONSTRAINT marketplace_listings_fulfillment_type_check
CHECK (fulfillment_type IS NULL OR fulfillment_type = ANY(ARRAY[
  'fby', 'fbs', 'fbu', 'FBS', 'FBY', 'FBU', 'DBS', 'dbs', 'standard', 
  'fby_fbs', 'FBY_FBS'  -- Add hybrid type for dual-fulfillment stores
]));