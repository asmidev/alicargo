import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Database } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MermaidDiagram from "@/components/MermaidDiagram";

const ERD = () => {
  const tables = [
    {
      name: "profiles",
      description: "Foydalanuvchi profillari (auth.users bilan bog'langan)",
      columns: ["id (uuid, PK)", "full_name", "phone", "avatar_url", "branch", "created_at", "updated_at"]
    },
    {
      name: "user_roles",
      description: "Foydalanuvchi rollari tizimi (12 ta rol)",
      columns: ["id (uuid, PK)", "user_id (FK → profiles)", "role (enum)", "created_at"],
      roles: ["super_admin", "china_manager", "china_receiver", "china_packer", "china_quality", "uz_manager", "uz_receiver", "uz_quality", "investor", "marketplace_manager", "finance_manager", "customer"]
    },
    {
      name: "products",
      description: "Mahsulotlar katalogi",
      columns: ["id (uuid, PK)", "name_uz", "name_ru", "name_en", "sku", "category", "china_price", "weight_kg", "volume_m3", "images", "created_at"]
    },
    {
      name: "boxes",
      description: "Xitoydan yuborilgan qutular",
      columns: ["id (uuid, PK)", "box_number", "qr_code", "weight_kg", "dimensions", "packed_by", "packed_at", "status", "china_warehouse_id", "created_at"]
    },
    {
      name: "box_qr_codes",
      description: "Har bir quti uchun generatsiya qilingan QR kodlar",
      columns: ["id (uuid, PK)", "box_id (FK → boxes)", "qr_code_data", "qr_image_url", "generated_at", "scanned_count", "last_scanned_at"]
    },
    {
      name: "products_in_box",
      description: "Qutidagi mahsulotlar ro'yxati",
      columns: ["id (uuid, PK)", "box_id (FK → boxes)", "product_id (FK → products)", "quantity", "expected_quantity", "condition", "added_at"]
    },
    {
      name: "shipments",
      description: "AbuSaxiy orqali jo'natmalar",
      columns: ["id (uuid, PK)", "shipment_number", "total_boxes", "weight_kg", "sent_from_china_at", "arrived_uz_at", "status", "tracking_number", "abusaxiy_cost", "created_at"]
    },
    {
      name: "boxes_in_shipment",
      description: "Jo'natmadagi qutular",
      columns: ["id (uuid, PK)", "shipment_id (FK → shipments)", "box_id (FK → boxes)", "added_at"]
    },
    {
      name: "excel_import_logs",
      description: "AbuSaxiy Telegram botidan import qilingan Excel fayllar",
      columns: ["id (uuid, PK)", "file_name", "file_url", "imported_at", "imported_by", "rows_processed", "status", "error_log"]
    },
    {
      name: "defect_reports",
      description: "Nuqsonli/shikastlangan mahsulotlar haqida hisobotlar",
      columns: ["id (uuid, PK)", "box_id (FK)", "product_id (FK)", "defect_type", "description", "images", "video_url", "reported_by", "reported_at", "status", "resolution"]
    },
    {
      name: "marketplace_connections",
      description: "Marketplace integratsiyalari (Uzum, Yandex, etc)",
      columns: ["id (uuid, PK)", "marketplace_name", "api_key_encrypted", "store_id", "sync_enabled", "last_sync_at", "created_at"]
    },
    {
      name: "marketplace_orders",
      description: "Marketplace'lardan kelgan buyurtmalar",
      columns: ["id (uuid, PK)", "marketplace_id (FK)", "order_number", "customer_name", "customer_phone", "product_id (FK)", "quantity", "price", "status", "created_at"]
    },
    {
      name: "inventory",
      description: "O'zbekiston omboridagi mavjud stok",
      columns: ["id (uuid, PK)", "product_id (FK → products)", "box_id (FK → boxes)", "quantity_available", "location", "last_updated"]
    },
    {
      name: "investors",
      description: "Investorlar ma'lumotlari",
      columns: ["id (uuid, PK)", "user_id (FK → profiles)", "investment_amount", "investment_date", "share_percentage", "status", "created_at"]
    },
    {
      name: "financial_transactions",
      description: "Barcha moliyaviy operatsiyalar",
      columns: ["id (uuid, PK)", "transaction_type", "amount", "currency", "related_to_type", "related_to_id", "investor_id (FK)", "description", "created_at"]
    },
    {
      name: "investor_dividends",
      description: "Investorlar dividendlari hisob-kitobi",
      columns: ["id (uuid, PK)", "investor_id (FK → investors)", "period_start", "period_end", "revenue", "expenses", "profit", "dividend_amount", "paid_at", "status"]
    },
    {
      name: "costs",
      description: "Xarajatlar va to'lovlar",
      columns: ["id (uuid, PK)", "cost_type", "amount", "currency", "related_to", "paid_to", "paid_at", "description", "invoice_url"]
    },
    {
      name: "ai_analysis_logs",
      description: "AI video tekshiruv natijalari (kelajak bosqich)",
      columns: ["id (uuid, PK)", "video_url", "analysis_result", "defects_detected", "confidence_score", "processed_at", "model_version"]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Ma'lumotlar Bazasi ERD</h1>
                <p className="text-muted-foreground text-sm">To'liq ma'lumotlar bazasi sxemasi</p>
              </div>
            </div>
            <Button size="lg" className="gap-2" onClick={() => window.print()}>
              <Download className="w-4 h-4" />
              SQL eksport
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Ma'lumotlar Bazasi Arxitekturasi</h2>
          <p className="text-muted-foreground text-lg mb-6">
            18 ta asosiy jadval, to'liq foreign key munosabatlari, Row Level Security (RLS) policies,
            va avtomatik triggerlar bilan.
          </p>
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-primary mb-1">18</div>
              <div className="text-sm text-muted-foreground">Jadvallar</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-accent mb-1">25+</div>
              <div className="text-sm text-muted-foreground">Foreign Keys</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">12</div>
              <div className="text-sm text-muted-foreground">Foydalanuvchi Rollari</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-1">100%</div>
              <div className="text-sm text-muted-foreground">RLS Himoyalangan</div>
            </Card>
          </div>
        </div>

        {/* ERD Visual with Mermaid */}
        <Card className="mb-12 overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-green-500/10 to-emerald-500/10">
            <h3 className="text-xl font-bold mb-2">Entity Relationship Diagram (Mermaid ERD)</h3>
            <p className="text-muted-foreground">To'liq ma'lumotlar bazasi sxemasi - barcha jadvallar va munosabatlari</p>
          </div>
          <div className="bg-background p-8">
            <div className="bg-card p-6 rounded-lg border">
              <MermaidDiagram chart={`erDiagram
    profiles ||--o{ user_roles : "has"
    profiles ||--o{ investors : "can be"
    profiles {
        uuid id PK
        text full_name
        text phone
        text avatar_url
        text branch
        timestamp created_at
    }
    
    user_roles {
        uuid id PK
        uuid user_id FK
        enum role
        timestamp created_at
    }
    
    products ||--o{ products_in_box : "contained in"
    products ||--o{ inventory : "tracked"
    products {
        uuid id PK
        text sku UK
        text name_uz
        text name_ru
        text name_en
        text category
        numeric china_price
        numeric weight_kg
        jsonb images
    }
    
    boxes ||--o{ products_in_box : "contains"
    boxes ||--o{ box_qr_codes : "has"
    boxes ||--o{ boxes_in_shipment : "part of"
    boxes {
        uuid id PK
        text box_number UK
        text qr_code
        numeric weight_kg
        jsonb dimensions
        uuid packed_by FK
        enum status
        timestamp packed_at
    }
    
    box_qr_codes {
        uuid id PK
        uuid box_id FK
        text qr_code_data
        text qr_image_url
        timestamp generated_at
        int scanned_count
    }
    
    products_in_box {
        uuid id PK
        uuid box_id FK
        uuid product_id FK
        int quantity
        int expected_quantity
        enum condition
    }
    
    shipments ||--o{ boxes_in_shipment : "includes"
    shipments {
        uuid id PK
        text shipment_number UK
        int total_boxes
        numeric weight_kg
        timestamp sent_from_china_at
        timestamp arrived_uz_at
        enum status
        text tracking_number
        numeric abusaxiy_cost
    }
    
    boxes_in_shipment {
        uuid id PK
        uuid shipment_id FK
        uuid box_id FK
        timestamp added_at
    }
    
    excel_import_logs {
        uuid id PK
        text file_name
        text file_url
        timestamp imported_at
        uuid imported_by FK
        int rows_processed
        enum status
        jsonb error_log
    }
    
    defect_reports {
        uuid id PK
        uuid box_id FK
        uuid product_id FK
        enum defect_type
        text description
        jsonb images
        text video_url
        uuid reported_by FK
        enum status
    }
    
    marketplace_connections ||--o{ marketplace_orders : "receives"
    marketplace_connections {
        uuid id PK
        text marketplace_name
        text api_key_encrypted
        text store_id
        boolean sync_enabled
        timestamp last_sync_at
    }
    
    marketplace_orders {
        uuid id PK
        uuid marketplace_id FK
        text order_number
        text customer_name
        uuid product_id FK
        int quantity
        numeric price
        enum status
    }
    
    inventory {
        uuid id PK
        uuid product_id FK
        uuid box_id FK
        int quantity_available
        text location
        timestamp last_updated
    }
    
    investors ||--o{ financial_transactions : "has"
    investors ||--o{ investor_dividends : "earns"
    investors {
        uuid id PK
        uuid user_id FK
        numeric investment_amount
        date investment_date
        numeric share_percentage
        enum status
    }
    
    financial_transactions {
        uuid id PK
        enum transaction_type
        numeric amount
        text currency
        text related_to_type
        uuid related_to_id
        uuid investor_id FK
        text description
        timestamp created_at
    }
    
    investor_dividends {
        uuid id PK
        uuid investor_id FK
        date period_start
        date period_end
        numeric revenue
        numeric expenses
        numeric profit
        numeric dividend_amount
        timestamp paid_at
        enum status
    }
    
    costs {
        uuid id PK
        enum cost_type
        numeric amount
        text currency
        text related_to
        text paid_to
        timestamp paid_at
        text invoice_url
    }
    
    ai_analysis_logs {
        uuid id PK
        text video_url
        jsonb analysis_result
        jsonb defects_detected
        numeric confidence_score
        timestamp processed_at
        text model_version
    }`} className="min-h-[600px]" />
              <div className="mt-6 text-center text-sm text-muted-foreground">
                <p className="font-semibold mb-2">📊 18 jadval, 25+ Foreign Keys, 100% RLS himoyalangan</p>
                <p>Barcha jadvallar PostgreSQL 15+ da ishlab chiqiladi</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Tables List */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold mb-6">Jadvallar Tafsiloti</h3>
          {tables.map((table, index) => (
            <Card key={index} className="overflow-hidden hover:shadow-[var(--shadow-elegant)] transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-xl font-bold text-primary mb-2">{table.name}</h4>
                    <p className="text-muted-foreground">{table.description}</p>
                  </div>
                  <span className="px-3 py-1 bg-muted rounded-full text-sm font-semibold">
                    {table.columns.length} ustun
                  </span>
                </div>

                <Tabs defaultValue="columns" className="w-full">
                  <TabsList>
                    <TabsTrigger value="columns">Ustunlar</TabsTrigger>
                    {table.roles && <TabsTrigger value="roles">Rollar</TabsTrigger>}
                    <TabsTrigger value="sql">SQL</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="columns" className="mt-4">
                    <div className="grid md:grid-cols-2 gap-2">
                      {table.columns.map((col, i) => (
                        <div key={i} className="px-3 py-2 bg-muted/50 rounded font-mono text-sm">
                          {col}
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {table.roles && (
                    <TabsContent value="roles" className="mt-4">
                      <div className="grid md:grid-cols-3 gap-2">
                        {table.roles.map((role, i) => (
                          <div key={i} className="px-3 py-2 bg-primary/10 rounded text-sm font-semibold">
                            {role}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  )}

                  <TabsContent value="sql" className="mt-4">
                    <div className="bg-muted/50 p-4 rounded font-mono text-sm overflow-x-auto">
                      <pre className="text-muted-foreground">
{`CREATE TABLE public.${table.name} (
  ${table.columns.join(',\n  ')}
);

ALTER TABLE public.${table.name} ENABLE ROW LEVEL SECURITY;

-- RLS policies qo'shiladi...`}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </Card>
          ))}
        </div>

        {/* Security Section */}
        <Card className="mt-12 p-8 bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-200">
          <h3 className="text-2xl font-bold mb-4 text-red-900 dark:text-red-100">🔒 Xavfsizlik (Security)</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Row Level Security (RLS)</h4>
              <p className="text-muted-foreground text-sm">
                Barcha jadvallar RLS bilan himoyalangan. Har bir foydalanuvchi faqat o'z rolga mos
                ma'lumotlarni ko'radi va tahrirlaydi.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Role-based Access Control</h4>
              <p className="text-muted-foreground text-sm">
                12 ta rol: super_admin, china_manager, china_receiver, china_packer, china_quality,
                uz_manager, uz_receiver, uz_quality, investor, marketplace_manager, finance_manager, customer.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Encrypted Secrets</h4>
              <p className="text-muted-foreground text-sm">
                API kalitlar va maxfiy ma'lumotlar xavfsiz saqlash tizimi yordamida shifrlangan holda saqlanadi.
              </p>
            </div>
          </div>
        </Card>
      </section>

    </div>
  );
};

export default ERD;
