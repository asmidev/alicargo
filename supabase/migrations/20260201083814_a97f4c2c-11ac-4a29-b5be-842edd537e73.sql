-- Phase A: Add fbu to fulfillment_type constraint and ensure all required columns exist

-- A1: Drop old CHECK constraint and add new one with fbu support
ALTER TABLE marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_fulfillment_type_check;

ALTER TABLE marketplace_listings ADD CONSTRAINT marketplace_listings_fulfillment_type_check 
CHECK (
  fulfillment_type IS NULL 
  OR fulfillment_type = ANY (ARRAY['fby'::text, 'fbs'::text, 'fbu'::text, 'FBS'::text, 'FBY'::text, 'FBU'::text, 'DBS'::text, 'dbs'::text, 'standard'::text])
);

-- A2: Ensure columns exist (they already exist per schema, but just in case)
-- external_barcode, stock_fbs, stock_fbu, linked_at already exist per schema

-- A3: Create indexes for barcode-based product linking (if not exist)
CREATE INDEX IF NOT EXISTS idx_listings_external_barcode ON marketplace_listings(external_barcode) WHERE external_barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- A4: Add unique constraint for product linking (store_id + external_barcode should be unique per store)
-- Using partial unique index instead of constraint for NULL handling
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_store_barcode_unique 
ON marketplace_listings(store_id, external_barcode) 
WHERE external_barcode IS NOT NULL;