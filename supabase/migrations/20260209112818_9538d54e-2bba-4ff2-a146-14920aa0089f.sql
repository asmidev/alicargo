
-- 1-qadam: products jadvaliga source ustunini qo'shish
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- 2-qadam: Mavjud PROD- prefiksli mahsulotlarni marketplace_auto deb belgilash
UPDATE public.products SET source = 'marketplace_auto' WHERE uuid LIKE 'PROD-%';
