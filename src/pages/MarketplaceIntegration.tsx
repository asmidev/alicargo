import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, ShoppingCart, Store, Globe, Database, Code, Cpu, Calendar, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEffect } from "react";

const MarketplaceIntegration = () => {
  useEffect(() => {
    // Initialize Mermaid
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      window.mermaid?.initialize({ 
        startOnLoad: true, 
        theme: 'default',
        flowchart: { useMaxWidth: true }
      });
      // @ts-ignore
      window.mermaid?.run();
    };
    document.head.appendChild(script);
    
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/deliverables">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Marketplace Integratsiya Rejasi</h1>
                <p className="text-muted-foreground text-sm">Uzum Market & Yandex Market API Integratsiyasi</p>
              </div>
            </div>
            <Button size="lg" className="gap-2" onClick={() => window.print()}>
              <Download className="w-4 h-4" />
              PDF Export
            </Button>
          </div>
        </div>
      </header>

      {/* Executive Summary */}
      <section className="container mx-auto px-6 py-12">
        <Card className="p-8 mb-12 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
          <h2 className="text-3xl font-bold mb-4">Executive Summary / Qisqa Xulosa</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-3 text-primary">🇺🇿 O'zbekcha</h3>
              <p className="text-muted-foreground leading-relaxed">
                Ushbu hujjat AliBrand CRM tizimini Uzum Market va Yandex Market marketplace'lari bilan 
                to'liq integratsiya qilish uchun batafsil texnik reja taqdim etadi. Integratsiya 
                mahsulotlarni avtomatik sinxronlash, kategoriyalar moslashtirish, atributlar boshqaruvi 
                va buyurtmalar oqimini o'z ichiga oladi. Bu logistika tizimimizni marketplace savdolari 
                bilan birlashtirib, xatolarni kamaytiradi va sotuvlarni oshiradi.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-3 text-primary">🇬🇧 English</h3>
              <p className="text-muted-foreground leading-relaxed">
                This document presents a comprehensive technical plan for integrating AliBrand CRM 
                with Uzum Market and Yandex Market marketplaces. The integration covers automatic 
                product synchronization, category mapping, attribute management, and order flow. 
                This will unite our logistics system with marketplace sales, reducing errors 
                and increasing revenue.
              </p>
            </div>
          </div>
          
          {/* Key Metrics */}
          <div className="grid md:grid-cols-4 gap-4 mt-8">
            <Card className="p-4 text-center bg-background">
              <div className="text-3xl font-bold text-primary mb-1">2</div>
              <div className="text-sm text-muted-foreground">Marketplace'lar</div>
            </Card>
            <Card className="p-4 text-center bg-background">
              <div className="text-3xl font-bold text-accent mb-1">15-20</div>
              <div className="text-sm text-muted-foreground">Kun (Implementation)</div>
            </Card>
            <Card className="p-4 text-center bg-background">
              <div className="text-3xl font-bold text-green-600 mb-1">$800-1200</div>
              <div className="text-sm text-muted-foreground">Taxminiy Xarajat</div>
            </Card>
            <Card className="p-4 text-center bg-background">
              <div className="text-3xl font-bold text-orange-600 mb-1">5+</div>
              <div className="text-sm text-muted-foreground">Yangi Jadvallar</div>
            </Card>
          </div>
        </Card>

        {/* Research Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Globe className="w-8 h-8 text-primary" />
            1. Marketplace Tadqiqoti / Research
          </h2>
          
          <Tabs defaultValue="uzum" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="uzum">Uzum Market</TabsTrigger>
              <TabsTrigger value="yandex">Yandex Market</TabsTrigger>
              <TabsTrigger value="comparison">Taqqoslash / Comparison</TabsTrigger>
            </TabsList>

            <TabsContent value="uzum">
              <Card className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <Store className="w-8 h-8 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Uzum Market</h3>
                    <p className="text-muted-foreground">O'zbekistonning yetakchi e-commerce platformasi</p>
                    <a href="https://uzum.uz" target="_blank" rel="noopener" className="text-primary text-sm hover:underline">
                      uzum.uz →
                    </a>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-lg">📂 Kategoriya Tizimi</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• <strong>Ierarxik struktura:</strong> 3-5 darajali kategoriyalar</li>
                      <li>• <strong>Asosiy kategoriyalar:</strong> Elektronika, Kiyim, Uy-ro'zg'or, Go'zallik, Sport</li>
                      <li>• <strong>Sub-kategoriyalar:</strong> Brand, Model, O'lcham, Rang bo'yicha</li>
                      <li>• <strong>Dinamik filterlar:</strong> Narx, Reyting, Mavjudlik</li>
                    </ul>
                    
                    <h4 className="font-semibold mb-3 text-lg mt-6">🏷️ Mahsulot Atributlari</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• <strong>Asosiy:</strong> Nom, SKU, Narx, Miqdor, Tavsif</li>
                      <li>• <strong>Logistika:</strong> Og'irlik, O'lchamlar (Length/Width/Height)</li>
                      <li>• <strong>Media:</strong> Rasmlar (min 3), Video</li>
                      <li>• <strong>Variantlar:</strong> Rang, O'lcham, Xotira hajmi</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3 text-lg">🔌 API Imkoniyatlari</h4>
                    <div className="bg-muted/50 p-4 rounded-lg text-sm">
                      <p className="text-muted-foreground mb-3">
                        <strong>Status:</strong> Rasmiy ochiq API hozircha mavjud emas. 
                        Seller Center orqali qo'lda yoki Excel import ishlatiladi.
                      </p>
                      <p className="text-muted-foreground mb-3">
                        <strong>Muqobil yechim:</strong> GraphQL API (norasmiy) yoki 
                        Seller Portal screen-scraping.
                      </p>
                      <p className="text-muted-foreground">
                        <strong>Kelajak:</strong> Rasmiy Partner API kutilmoqda (2024-2025).
                      </p>
                    </div>
                    
                    <h4 className="font-semibold mb-3 text-lg mt-6">📋 Seller Requirements</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Ro'yxatdan o'tish: seller.uzum.uz</li>
                      <li>• Hujjatlar: STIR, Guvohnoma</li>
                      <li>• Fulfillment: Uzum omboriga yetkazish</li>
                      <li>• Komissiya: 3-15% (kategoriyaga qarab)</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="yandex">
              <Card className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-16 h-16 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <ShoppingCart className="w-8 h-8 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Yandex Market</h3>
                    <p className="text-muted-foreground">Rossiyaning yirik marketplace'i, xalqaro imkoniyatlari bilan</p>
                    <a href="https://market.yandex.com" target="_blank" rel="noopener" className="text-primary text-sm hover:underline">
                      market.yandex.com →
                    </a>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-lg">📂 Kategoriya Tizimi</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• <strong>Ierarxik struktura:</strong> 5-7 darajali chuqur kategoriyalar</li>
                      <li>• <strong>"Leaf categories":</strong> Faqat eng pastki kategoriyaga joylashtirish</li>
                      <li>• <strong>Category tree API:</strong> POST v2/categories/tree</li>
                      <li>• <strong>Parameters API:</strong> POST v2/category/{'{categoryId}'}/parameters</li>
                    </ul>
                    
                    <h4 className="font-semibold mb-3 text-lg mt-6">🏷️ Mahsulot Atributlari</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• <strong>Asosiy:</strong> offerId (SKU), name, vendor, model</li>
                      <li>• <strong>Kategoriya xususiyatlari:</strong> parameterValues (dinamik)</li>
                      <li>• <strong>Variantlar:</strong> distinctive characteristics (rang, o'lcham)</li>
                      <li>• <strong>Barcode:</strong> EAN/UPC yoki Yandex generatsiya qiladi</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3 text-lg">🔌 API Endpoints</h4>
                    <div className="bg-muted/50 p-4 rounded-lg text-sm font-mono">
                      <p className="mb-2">POST /v2/categories/tree</p>
                      <p className="mb-2">POST /v2/category/{'{id}'}/parameters</p>
                      <p className="mb-2">POST /v2/businesses/{'{id}'}/offer-mappings/update</p>
                      <p className="mb-2">POST /v2/campaigns/{'{id}'}/offers/update</p>
                      <p>POST /v2/tariffs/calculate</p>
                    </div>
                    
                    <h4 className="font-semibold mb-3 text-lg mt-6">📄 YML Feed Format</h4>
                    <div className="bg-muted/50 p-4 rounded-lg text-sm">
                      <p className="text-muted-foreground mb-2">
                        <strong>Format:</strong> XML (Yandex Market Language)
                      </p>
                      <p className="text-muted-foreground mb-2">
                        <strong>Elements:</strong> shop, categories, offers
                      </p>
                      <p className="text-muted-foreground">
                        <strong>Encoding:</strong> UTF-8 / Windows-1251
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="comparison">
              <Card className="p-6">
                <h3 className="text-xl font-bold mb-6">Taqqoslash Jadvali / Comparison Table</h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold">Xususiyat / Feature</th>
                        <th className="text-center py-3 px-4 font-semibold bg-purple-500/10">Uzum Market</th>
                        <th className="text-center py-3 px-4 font-semibold bg-red-500/10">Yandex Market</th>
                        <th className="text-center py-3 px-4 font-semibold bg-primary/10">AliBrand (hozirgi)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-3 px-4">Kategoriya darajalari</td>
                        <td className="text-center py-3 px-4 bg-purple-500/5">3-5</td>
                        <td className="text-center py-3 px-4 bg-red-500/5">5-7</td>
                        <td className="text-center py-3 px-4 bg-primary/5">1 (flat)</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-4">Dinamik atributlar</td>
                        <td className="text-center py-3 px-4 bg-purple-500/5">✅ Ha</td>
                        <td className="text-center py-3 px-4 bg-red-500/5">✅ Ha (50+ per category)</td>
                        <td className="text-center py-3 px-4 bg-primary/5">❌ Yo'q</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-4">Variantlar (SKU)</td>
                        <td className="text-center py-3 px-4 bg-purple-500/5">✅ Rang, O'lcham</td>
                        <td className="text-center py-3 px-4 bg-red-500/5">✅ Distinctive chars</td>
                        <td className="text-center py-3 px-4 bg-primary/5">❌ Yo'q</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-4">Rasmiy API</td>
                        <td className="text-center py-3 px-4 bg-purple-500/5">❌ Yo'q (hozircha)</td>
                        <td className="text-center py-3 px-4 bg-red-500/5">✅ Partner API</td>
                        <td className="text-center py-3 px-4 bg-primary/5">N/A</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-4">Feed format</td>
                        <td className="text-center py-3 px-4 bg-purple-500/5">Excel/Manual</td>
                        <td className="text-center py-3 px-4 bg-red-500/5">YML (XML) / JSON API</td>
                        <td className="text-center py-3 px-4 bg-primary/5">N/A</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-4">Barcode support</td>
                        <td className="text-center py-3 px-4 bg-purple-500/5">Optional</td>
                        <td className="text-center py-3 px-4 bg-red-500/5">✅ Auto-generate</td>
                        <td className="text-center py-3 px-4 bg-primary/5">❌ Yo'q</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4">Logistika atributlari</td>
                        <td className="text-center py-3 px-4 bg-purple-500/5">✅ Weight, Dims</td>
                        <td className="text-center py-3 px-4 bg-red-500/5">✅ Weight, Dims, Cargo</td>
                        <td className="text-center py-3 px-4 bg-primary/5">✅ Weight, Price only</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <h4 className="font-semibold text-orange-700 dark:text-orange-300 mb-2">⚠️ Gap Analysis / Kamchiliklar</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>1. AliBrand hozirda kategoriya ierarxiyasini qo'llab-quvvatlamaydi</li>
                    <li>2. Dinamik atributlar (kategoriyaga bog'liq xususiyatlar) yo'q</li>
                    <li>3. Mahsulot variantlari (rang, o'lcham) alohida SKU sifatida saqlanmaydi</li>
                    <li>4. Barcode/EAN field mavjud emas</li>
                    <li>5. Marketplace mapping jadvali yo'q</li>
                  </ul>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Database Schema Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Database className="w-8 h-8 text-primary" />
            2. Database Schema Yangilanishlari
          </h2>

          <Card className="p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Yangi Jadvallar / New Tables</h3>
            
            <div className="bg-muted/50 p-4 rounded-lg mb-6">
              <pre className="mermaid text-sm">
{`erDiagram
    categories_hierarchy ||--o{ categories_hierarchy : "parent"
    categories_hierarchy ||--o{ attribute_sets : "has"
    categories_hierarchy ||--o{ products : "contains"
    
    categories_hierarchy {
        uuid id PK
        uuid parent_id FK
        text name_uz
        text name_ru
        text name_en
        text uzum_category_id
        text yandex_category_id
        int level
        boolean is_leaf
        jsonb marketplace_mapping
    }
    
    attribute_sets ||--o{ attribute_definitions : "contains"
    attribute_sets {
        uuid id PK
        uuid category_id FK
        text name
        text marketplace
        boolean is_required
    }
    
    attribute_definitions {
        uuid id PK
        uuid attribute_set_id FK
        text name_uz
        text name_ru
        text yandex_param_id
        text uzum_param_id
        text data_type
        jsonb allowed_values
        text unit
        boolean is_variant
    }
    
    product_variants ||--o{ product_items : "generates"
    product_variants {
        uuid id PK
        uuid product_id FK
        text variant_sku
        jsonb variant_attributes
        numeric price_modifier
        text barcode
        int stock_quantity
    }
    
    marketplace_listings {
        uuid id PK
        uuid product_id FK
        text marketplace
        text external_product_id
        text external_sku
        text listing_status
        timestamp last_synced
        jsonb sync_errors
    }
    
    marketplace_category_mappings {
        uuid id PK
        uuid local_category_id FK
        text marketplace
        text external_category_id
        text external_category_path
        jsonb attribute_mapping
    }`}
              </pre>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="sql-1">
                <AccordionTrigger className="font-semibold">
                  📄 categories_hierarchy - SQL Schema
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`-- Ierarxik kategoriyalar jadvali
CREATE TABLE public.categories_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.categories_hierarchy(id) ON DELETE CASCADE,
  name_uz TEXT NOT NULL,
  name_ru TEXT,
  name_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  is_leaf BOOLEAN NOT NULL DEFAULT false,
  uzum_category_id TEXT,
  yandex_category_id TEXT,
  marketplace_mapping JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for parent lookup
CREATE INDEX idx_categories_parent ON public.categories_hierarchy(parent_id);
CREATE INDEX idx_categories_level ON public.categories_hierarchy(level);

-- RLS Policy
ALTER TABLE public.categories_hierarchy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories viewable by all authenticated"
  ON public.categories_hierarchy FOR SELECT
  USING (true);

CREATE POLICY "Managers can manage categories"
  ON public.categories_hierarchy FOR ALL
  USING (
    has_role(auth.uid(), 'rahbar'::app_role) OR
    has_role(auth.uid(), 'bosh_admin'::app_role) OR
    has_role(auth.uid(), 'marketplace_manager'::app_role)
  );`}</pre>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sql-2">
                <AccordionTrigger className="font-semibold">
                  📄 attribute_definitions - SQL Schema
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`-- Kategoriya atributlari
CREATE TABLE public.attribute_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories_hierarchy(id) ON DELETE CASCADE,
  name_uz TEXT NOT NULL,
  name_ru TEXT,
  name_en TEXT,
  attribute_key TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'text', -- text, number, enum, boolean
  allowed_values JSONB, -- For enums: ["Red", "Blue", "Green"]
  unit TEXT, -- kg, cm, etc.
  is_required BOOLEAN DEFAULT false,
  is_variant BOOLEAN DEFAULT false, -- Used for product variants (color, size)
  is_filterable BOOLEAN DEFAULT true,
  yandex_param_id TEXT,
  uzum_param_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(category_id, attribute_key)
);

-- RLS
ALTER TABLE public.attribute_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attributes viewable by authenticated"
  ON public.attribute_definitions FOR SELECT
  USING (true);`}</pre>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sql-3">
                <AccordionTrigger className="font-semibold">
                  📄 product_variants - SQL Schema
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`-- Mahsulot variantlari (Rang, O'lcham, etc.)
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_sku TEXT NOT NULL UNIQUE,
  variant_attributes JSONB NOT NULL DEFAULT '{}',
  -- Example: {"color": "Red", "size": "XL", "memory": "128GB"}
  price_modifier NUMERIC DEFAULT 0, -- +/- from base price
  barcode TEXT, -- EAN/UPC
  stock_quantity INTEGER DEFAULT 0,
  images JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_variants_barcode ON public.product_variants(barcode);

-- RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Variants viewable by authenticated"
  ON public.product_variants FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage variants"
  ON public.product_variants FOR ALL
  USING (
    has_role(auth.uid(), 'rahbar'::app_role) OR
    has_role(auth.uid(), 'bosh_admin'::app_role) OR
    has_role(auth.uid(), 'xitoy_manager'::app_role)
  );`}</pre>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sql-4">
                <AccordionTrigger className="font-semibold">
                  📄 marketplace_listings - SQL Schema
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`-- Marketplace listinglar
CREATE TABLE public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  marketplace TEXT NOT NULL, -- 'uzum', 'yandex', 'ozon'
  external_product_id TEXT,
  external_sku TEXT,
  external_url TEXT,
  listing_status TEXT DEFAULT 'draft', -- draft, pending, active, rejected, paused
  listing_price NUMERIC,
  currency TEXT DEFAULT 'UZS',
  last_synced_at TIMESTAMPTZ,
  sync_errors JSONB DEFAULT '[]',
  marketplace_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(product_id, marketplace, variant_id)
);

-- Indexes
CREATE INDEX idx_listings_product ON public.marketplace_listings(product_id);
CREATE INDEX idx_listings_marketplace ON public.marketplace_listings(marketplace);
CREATE INDEX idx_listings_status ON public.marketplace_listings(listing_status);

-- RLS
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listings viewable by authorized"
  ON public.marketplace_listings FOR SELECT
  USING (
    has_role(auth.uid(), 'rahbar'::app_role) OR
    has_role(auth.uid(), 'bosh_admin'::app_role) OR
    has_role(auth.uid(), 'marketplace_manager'::app_role)
  );`}</pre>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Updated Products Table */}
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">Mavjud Products Jadvaliga Qo'shimchalar</h3>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre>{`-- Products jadvaliga yangi ustunlar
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS 
  category_id UUID REFERENCES public.categories_hierarchy(id);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS 
  brand TEXT;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS 
  model TEXT;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS 
  barcode TEXT;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS 
  custom_attributes JSONB DEFAULT '{}';

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS 
  dimensions_cm JSONB; -- {"length": 10, "width": 5, "height": 3}

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS 
  has_variants BOOLEAN DEFAULT false;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS 
  marketplace_ready BOOLEAN DEFAULT false;

-- Index for category
CREATE INDEX IF NOT EXISTS idx_products_category 
  ON public.products(category_id);`}</pre>
            </div>
          </Card>
        </div>

        {/* Architecture Diagram */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Code className="w-8 h-8 text-primary" />
            3. Arxitektura / Architecture
          </h2>

          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">C4 Container Diagram - Marketplace Integration</h3>
            <div className="bg-muted/50 p-4 rounded-lg">
              <pre className="mermaid">
{`flowchart TB
    subgraph "External Systems"
        UZUM[("🛒 Uzum Market<br/>seller.uzum.uz")]
        YANDEX[("🛒 Yandex Market<br/>Partner API")]
    end
    
    subgraph "AliBrand CRM"
        subgraph "Frontend"
            DASH["📊 Dashboard"]
            PROD["📦 Products Page"]
            MARKET["🌐 Marketplace Sync UI"]
            CAT["📂 Category Manager"]
        end
        
        subgraph "Backend (Mikroservislar)"
            SYNC["sync-marketplace<br/>Backend Servis"]
            CATEGORY["category-sync<br/>Backend Servis"]
            YML["yml-generator<br/>Backend Servis"]
        end
        
        subgraph "Database (PostgreSQL)"
            DB_PROD[("products")]
            DB_VAR[("product_variants")]
            DB_CAT[("categories_hierarchy")]
            DB_LIST[("marketplace_listings")]
            DB_ATTR[("attribute_definitions")]
        end
        
        subgraph "AI Layer (Future Phase)"
            AI_CAT["🤖 Auto-Categorizer"]
            AI_ATTR["🤖 Attribute Extractor"]
        end
    end
    
    DASH --> PROD
    PROD --> MARKET
    MARKET --> SYNC
    CAT --> CATEGORY
    
    SYNC --> UZUM
    SYNC --> YANDEX
    CATEGORY --> YANDEX
    YML --> YANDEX
    
    SYNC --> DB_LIST
    SYNC --> DB_PROD
    CATEGORY --> DB_CAT
    
    PROD --> DB_PROD
    PROD --> DB_VAR
    CAT --> DB_CAT
    CAT --> DB_ATTR
    
    AI_CAT -.-> DB_CAT
    AI_ATTR -.-> DB_ATTR`}
              </pre>
            </div>
          </Card>
        </div>

        {/* BPMN Workflow */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <ArrowRight className="w-8 h-8 text-primary" />
            4. BPMN - Marketplace Sync Workflow
          </h2>

          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">Mahsulot Sinxronizatsiya Oqimi</h3>
            <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
              <pre className="mermaid">
{`sequenceDiagram
    participant M as Marketplace Manager
    participant UI as AliBrand UI
    participant EF as Backend Servis
    participant DB as Database
    participant YM as Yandex Market API
    participant UM as Uzum Seller Center
    
    Note over M,UM: 1. Kategoriya Sinxronizatsiyasi
    M->>UI: Kategoriya sozlamalari
    UI->>EF: GET /category-sync
    EF->>YM: POST v2/categories/tree
    YM-->>EF: Category tree JSON
    EF->>DB: Upsert categories_hierarchy
    DB-->>EF: Success
    EF-->>UI: Categories updated
    
    Note over M,UM: 2. Mahsulot Tayyorlash
    M->>UI: Mahsulotni marketplace uchun tayyorlash
    UI->>EF: POST /prepare-listing
    EF->>DB: Get product + category + attributes
    EF->>EF: Validate required attributes
    alt Missing attributes
        EF-->>UI: Error: Missing fields
        UI-->>M: Show validation errors
    else All valid
        EF->>DB: Update marketplace_listings (draft)
        EF-->>UI: Ready for sync
    end
    
    Note over M,UM: 3. Yandex Market ga Push
    M->>UI: Sync to Yandex Market
    UI->>EF: POST /sync-yandex
    EF->>DB: Get listing data
    EF->>YM: POST v2/businesses/{id}/offer-mappings/update
    YM-->>EF: Offer created/updated
    EF->>DB: Update listing status = "active"
    EF-->>UI: Sync complete
    
    Note over M,UM: 4. Uzum Market ga Push (Manual/Excel)
    M->>UI: Export for Uzum
    UI->>EF: POST /export-uzum-excel
    EF->>DB: Get products for Uzum
    EF->>EF: Generate Excel file
    EF-->>UI: Download Excel
    UI-->>M: Excel file
    M->>UM: Upload via Seller Center`}
              </pre>
            </div>
          </Card>
        </div>

        {/* UI Components */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Cpu className="w-8 h-8 text-primary" />
            5. UI Komponentlar / Frontend Enhancements
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-bold mb-4">📂 Category Manager Page</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Tree view kategoriya navigatsiyasi</li>
                <li>• Drag-and-drop reordering</li>
                <li>• Marketplace mapping modal</li>
                <li>• Bulk import/export</li>
                <li>• Attribute assignment per category</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold mb-4">🏷️ Product Editor Enhancements</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Hierarchical category selector (cascading dropdowns)</li>
                <li>• Dynamic attribute form (based on category)</li>
                <li>• Variant builder (color/size matrix)</li>
                <li>• Barcode scanner/generator</li>
                <li>• Marketplace preview panel</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold mb-4">🌐 Marketplace Sync Dashboard</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Multi-marketplace status overview</li>
                <li>• Sync history log</li>
                <li>• Error/warning alerts</li>
                <li>• Bulk sync actions</li>
                <li>• Price/stock update controls</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold mb-4">📊 Marketplace Analytics</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Sales by marketplace chart</li>
                <li>• Listing performance metrics</li>
                <li>• Inventory levels across platforms</li>
                <li>• Commission/fee breakdown</li>
                <li>• Conversion rates comparison</li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-primary" />
            6. Timeline & Budget / Jadval va Byudjet
          </h2>

          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">Implementation Roadmap</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4">Bosqich / Phase</th>
                    <th className="text-center py-3 px-4">Kunlar / Days</th>
                    <th className="text-center py-3 px-4">Narx / Cost</th>
                    <th className="text-left py-3 px-4">Deliverables</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-semibold">1. Database Schema</td>
                    <td className="text-center py-3 px-4">2-3</td>
                    <td className="text-center py-3 px-4">$150-200</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      5 new tables, migrations, RLS policies
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-semibold">2. Category System</td>
                    <td className="text-center py-3 px-4">3-4</td>
                    <td className="text-center py-3 px-4">$200-250</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      Tree UI, attribute manager, mapping
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-semibold">3. Product Variants</td>
                    <td className="text-center py-3 px-4">2-3</td>
                    <td className="text-center py-3 px-4">$150-200</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      Variant builder, SKU generator, barcode
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-semibold">4. Yandex Market API</td>
                    <td className="text-center py-3 px-4">4-5</td>
                    <td className="text-center py-3 px-4">$250-350</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      OAuth, sync servislar, YML generator
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-semibold">5. Uzum Integration</td>
                    <td className="text-center py-3 px-4">2-3</td>
                    <td className="text-center py-3 px-4">$100-150</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      Excel export, manual sync workflow
                    </td>
                  </tr>
                  <tr className="border-b bg-primary/5">
                    <td className="py-3 px-4 font-bold">JAMI / TOTAL</td>
                    <td className="text-center py-3 px-4 font-bold">15-20</td>
                    <td className="text-center py-3 px-4 font-bold">$850-1,150</td>
                    <td className="py-3 px-4"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Kutilayotgan Natijalar / Expected Benefits
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Marketplace sotuvlari +40-60% oshishi</li>
                  <li>• Qo'lda kiritish xatolarini 90% kamaytirish</li>
                  <li>• Mahsulot yaratish vaqtini 70% qisqartirish</li>
                  <li>• Real-time inventory sinxronizatsiya</li>
                </ul>
              </div>
              
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <h4 className="font-semibold text-orange-700 dark:text-orange-300 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Xavflar va Yechimlar / Risks & Mitigations
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>API rate limits:</strong> Batch processing, queue system</li>
                  <li>• <strong>Uzum API yo'qligi:</strong> Excel/manual fallback ready</li>
                  <li>• <strong>Category changes:</strong> Weekly sync job</li>
                  <li>• <strong>Data privacy:</strong> Encrypted API keys in Vault</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* API Prep Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Code className="w-8 h-8 text-primary" />
            7. API Integration Roadmap
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 border-red-500/30 bg-red-500/5">
              <h3 className="font-bold mb-4 text-red-600 dark:text-red-400">
                🔴 Yandex Market API Setup
              </h3>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-2">
                  <span className="font-mono bg-red-500/20 px-2 rounded">1</span>
                  <span>Yandex Partner Portal'da ro'yxatdan o'tish</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-red-500/20 px-2 rounded">2</span>
                  <span>OAuth2 client_id va client_secret olish</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-red-500/20 px-2 rounded">3</span>
                  <span>Xavfsiz saqlash tizimiga API keys saqlash</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-red-500/20 px-2 rounded">4</span>
                  <span>Backend servis: Token refresh flow</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-red-500/20 px-2 rounded">5</span>
                  <span>Test: 10 ta mahsulotni sync qilish</span>
                </li>
              </ol>
            </Card>

            <Card className="p-6 border-purple-500/30 bg-purple-500/5">
              <h3 className="font-bold mb-4 text-purple-600 dark:text-purple-400">
                🟣 Uzum Market Setup
              </h3>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-2">
                  <span className="font-mono bg-purple-500/20 px-2 rounded">1</span>
                  <span>seller.uzum.uz'da do'kon ro'yxati</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-purple-500/20 px-2 rounded">2</span>
                  <span>Kategoriya mapping qo'lda yaratish</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-purple-500/20 px-2 rounded">3</span>
                  <span>Excel template yuklab olish va tahlil</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-purple-500/20 px-2 rounded">4</span>
                  <span>Excel generator backend servis</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-purple-500/20 px-2 rounded">5</span>
                  <span>Manual upload workflow documentation</span>
                </li>
              </ol>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <Card className="p-8 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Keyingi Qadamlar / Next Steps</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Ushbu reja Phase 4+ davomida amalga oshirilishi mumkin. Database schema'ni 
              hoziroq qo'shib, kelajakda marketplace integratsiyasiga tayyor bo'lish mumkin.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Button size="lg" className="gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Rejani Tasdiqlash
              </Button>
              <Button variant="outline" size="lg" className="gap-2">
                <Calendar className="w-5 h-5" />
                Jadvalga Qo'shish
              </Button>
            </div>
          </div>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Hujjat yaratilgan: {new Date().toLocaleDateString('uz-UZ')}</p>
          <p>AliBrand CRM - Marketplace Integration Plan v1.0</p>
        </div>
      </section>
    </div>
  );
};

export default MarketplaceIntegration;
