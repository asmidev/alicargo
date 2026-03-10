-- Step 1: Drop existing constraint on marketplace_orders
ALTER TABLE marketplace_orders 
DROP CONSTRAINT IF EXISTS marketplace_orders_fulfillment_type_check;

-- Step 2: Add new constraint that accepts all fulfillment types (case insensitive)
ALTER TABLE marketplace_orders 
ADD CONSTRAINT marketplace_orders_fulfillment_type_check 
CHECK (LOWER(fulfillment_type) = ANY (ARRAY['fby', 'fbs', 'fbu', 'fbo', 'dbs', 'standard', 'fby_fbs']) OR fulfillment_type IS NULL);

-- Step 3: Normalize existing data to lowercase
UPDATE marketplace_orders 
SET fulfillment_type = LOWER(fulfillment_type)
WHERE fulfillment_type IS NOT NULL AND fulfillment_type != LOWER(fulfillment_type);

-- Step 4: Map fbo to fbu for consistency
UPDATE marketplace_orders 
SET fulfillment_type = 'fbu'
WHERE LOWER(fulfillment_type) = 'fbo';