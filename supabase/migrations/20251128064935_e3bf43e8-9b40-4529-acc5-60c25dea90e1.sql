-- Create product_items table for individual item tracking
CREATE TABLE public.product_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_uuid TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  box_id UUID REFERENCES boxes(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  location TEXT DEFAULT 'china',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_product_items_product_id ON product_items(product_id);
CREATE INDEX idx_product_items_box_id ON product_items(box_id);
CREATE INDEX idx_product_items_status ON product_items(status);
CREATE INDEX idx_product_items_location ON product_items(location);

-- Enable RLS
ALTER TABLE product_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Product items viewable by authenticated"
  ON product_items FOR SELECT
  USING (true);

CREATE POLICY "Authorized users can manage product items"
  ON product_items FOR ALL
  USING (
    has_role(auth.uid(), 'rahbar') OR
    has_role(auth.uid(), 'bosh_admin') OR
    has_role(auth.uid(), 'xitoy_manager') OR
    has_role(auth.uid(), 'xitoy_packer') OR
    has_role(auth.uid(), 'uz_manager') OR
    has_role(auth.uid(), 'uz_receiver')
  );

-- Update products table comments for clarity
COMMENT ON COLUMN products.price IS 'Buying price per single unit (USD)';
COMMENT ON COLUMN products.weight IS 'Weight per single unit (kg)';
COMMENT ON COLUMN products.quantity IS 'Initial quantity purchased (reference only)';

-- Add trigger for updated_at on product_items
CREATE TRIGGER update_product_items_updated_at
  BEFORE UPDATE ON product_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();