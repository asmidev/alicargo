-- Add store_ids array column for Uzum stores (they have multiple shop IDs)
ALTER TABLE marketplace_stores 
ADD COLUMN IF NOT EXISTS store_ids TEXT[];

-- Update Uzum stores with their multiple IDs from Excel data
UPDATE marketplace_stores 
SET store_ids = ARRAY['92638', '89165']
WHERE name = 'Atlas Market (Uzum)';

UPDATE marketplace_stores 
SET store_ids = ARRAY['69508', '69555', '70010', '88409']
WHERE name = 'Uzum 2-Market';

UPDATE marketplace_stores 
SET store_ids = ARRAY['49052', '66005', '92815']
WHERE name = 'Uzum 3-Market';

COMMENT ON COLUMN marketplace_stores.store_ids IS 
  'Array of shop/seller IDs for Uzum stores. Each Uzum account can have multiple shops.';