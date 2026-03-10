
-- Create marketplace enum types
CREATE TYPE public.marketplace_type AS ENUM ('uzum', 'yandex', 'instagram', 'telegram');
CREATE TYPE public.listing_status AS ENUM ('draft', 'pending', 'active', 'paused', 'rejected', 'sold_out');
CREATE TYPE public.attribute_type AS ENUM ('text', 'number', 'select', 'multi_select', 'boolean', 'date', 'color', 'size');

-- Categories Hierarchy Table (supports multi-level categories like Uzum/Yandex)
CREATE TABLE public.categories_hierarchy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES public.categories_hierarchy(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_ru TEXT,
    name_en TEXT,
    slug TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    marketplace marketplace_type,
    external_id TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(slug, marketplace)
);

-- Attribute Definitions Table (defines what attributes each category has)
CREATE TABLE public.attribute_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.categories_hierarchy(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_ru TEXT,
    name_en TEXT,
    attribute_key TEXT NOT NULL,
    attribute_type attribute_type NOT NULL DEFAULT 'text',
    is_required BOOLEAN DEFAULT false,
    is_filterable BOOLEAN DEFAULT false,
    is_variant BOOLEAN DEFAULT false,
    options JSONB,
    validation_rules JSONB,
    unit TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Product Variants Table (for size/color/etc variations of same product)
CREATE TABLE public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    sku TEXT NOT NULL,
    variant_attributes JSONB NOT NULL DEFAULT '{}',
    price NUMERIC,
    selling_price NUMERIC,
    stock_quantity INTEGER DEFAULT 0,
    weight NUMERIC,
    barcode TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Marketplace Listings Table (tracks product listings on each marketplace)
CREATE TABLE public.marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    marketplace marketplace_type NOT NULL,
    external_listing_id TEXT,
    external_category_id TEXT,
    status listing_status DEFAULT 'draft',
    listing_url TEXT,
    listing_data JSONB DEFAULT '{}',
    sync_errors JSONB,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(product_id, variant_id, marketplace)
);

-- Marketplace Category Mappings (maps our categories to marketplace categories)
CREATE TABLE public.marketplace_category_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_category_id UUID REFERENCES public.categories_hierarchy(id) ON DELETE CASCADE NOT NULL,
    marketplace marketplace_type NOT NULL,
    external_category_id TEXT NOT NULL,
    external_category_path TEXT,
    confidence_score NUMERIC DEFAULT 1.0,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(internal_category_id, marketplace)
);

-- Add new columns to products table for marketplace readiness
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories_hierarchy(id),
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS model TEXT,
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS dimensions_cm JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS marketplace_ready BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS main_image_url TEXT,
ADD COLUMN IF NOT EXISTS gallery_urls JSONB DEFAULT '[]';

-- Enable RLS on all new tables
ALTER TABLE public.categories_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_category_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories_hierarchy (viewable by all, editable by managers)
CREATE POLICY "Categories viewable by authenticated" ON public.categories_hierarchy
FOR SELECT USING (true);

CREATE POLICY "Managers can manage categories" ON public.categories_hierarchy
FOR ALL USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'xitoy_manager') OR 
    has_role(auth.uid(), 'uz_manager') OR
    has_role(auth.uid(), 'manager')
);

-- RLS Policies for attribute_definitions
CREATE POLICY "Attributes viewable by authenticated" ON public.attribute_definitions
FOR SELECT USING (true);

CREATE POLICY "Managers can manage attributes" ON public.attribute_definitions
FOR ALL USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'manager')
);

-- RLS Policies for product_variants
CREATE POLICY "Variants viewable by authenticated" ON public.product_variants
FOR SELECT USING (true);

CREATE POLICY "Managers can manage variants" ON public.product_variants
FOR ALL USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'xitoy_manager') OR 
    has_role(auth.uid(), 'manager')
);

-- RLS Policies for marketplace_listings
CREATE POLICY "Listings viewable by authenticated" ON public.marketplace_listings
FOR SELECT USING (true);

CREATE POLICY "Managers can manage listings" ON public.marketplace_listings
FOR ALL USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'uz_manager') OR 
    has_role(auth.uid(), 'manager')
);

-- RLS Policies for marketplace_category_mappings
CREATE POLICY "Mappings viewable by authenticated" ON public.marketplace_category_mappings
FOR SELECT USING (true);

CREATE POLICY "Managers can manage mappings" ON public.marketplace_category_mappings
FOR ALL USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'manager')
);

-- Create indexes for performance
CREATE INDEX idx_categories_parent ON public.categories_hierarchy(parent_id);
CREATE INDEX idx_categories_marketplace ON public.categories_hierarchy(marketplace);
CREATE INDEX idx_attributes_category ON public.attribute_definitions(category_id);
CREATE INDEX idx_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_listings_product ON public.marketplace_listings(product_id);
CREATE INDEX idx_listings_marketplace ON public.marketplace_listings(marketplace);
CREATE INDEX idx_mappings_category ON public.marketplace_category_mappings(internal_category_id);

-- Trigger for updated_at
CREATE TRIGGER update_categories_hierarchy_updated_at
BEFORE UPDATE ON public.categories_hierarchy
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_listings_updated_at
BEFORE UPDATE ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
