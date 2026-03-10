-- Add AbuSaxiy-specific columns to boxes table
ALTER TABLE public.boxes 
ADD COLUMN IF NOT EXISTS abusaxiy_receipt_number text,
ADD COLUMN IF NOT EXISTS place_number text,
ADD COLUMN IF NOT EXISTS product_description text,
ADD COLUMN IF NOT EXISTS package_type text DEFAULT 'Korobka',
ADD COLUMN IF NOT EXISTS weight_kg numeric,
ADD COLUMN IF NOT EXISTS length_cm numeric,
ADD COLUMN IF NOT EXISTS width_cm numeric,
ADD COLUMN IF NOT EXISTS height_cm numeric,
ADD COLUMN IF NOT EXISTS volume_m3 numeric,
ADD COLUMN IF NOT EXISTS shipping_cost numeric,
ADD COLUMN IF NOT EXISTS estimated_arrival date,
ADD COLUMN IF NOT EXISTS actual_arrival date,
ADD COLUMN IF NOT EXISTS days_in_transit integer,
ADD COLUMN IF NOT EXISTS store_phone text,
ADD COLUMN IF NOT EXISTS store_number text;

-- Add index on receipt number for faster lookups
CREATE INDEX IF NOT EXISTS idx_boxes_abusaxiy_receipt ON public.boxes(abusaxiy_receipt_number);

-- Update shipments table to better track receipt numbers
ALTER TABLE public.shipments
ADD COLUMN IF NOT EXISTS total_places integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_weight_kg numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_volume_m3 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_arrival date;