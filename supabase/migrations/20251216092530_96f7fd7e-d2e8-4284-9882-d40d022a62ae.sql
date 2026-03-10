-- Add unique constraint for session_id + product_item_id to enable upserts
ALTER TABLE public.verification_items 
ADD CONSTRAINT verification_items_session_product_unique 
UNIQUE (session_id, product_item_id);