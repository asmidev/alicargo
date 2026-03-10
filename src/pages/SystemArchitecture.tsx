import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Database, Users, Box, Truck, Shield, Layers, GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SystemArchitecture() {
  const navigate = useNavigate();

  useEffect(() => {
    const loadMermaid = async () => {
      const mermaid = await import('mermaid');
      mermaid.default.initialize({
        startOnLoad: true,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#8B5CF6',
          primaryTextColor: '#fff',
          primaryBorderColor: '#6D28D9',
          lineColor: '#E8B923',
          secondaryColor: '#252932',
          tertiaryColor: '#1A1D29',
          background: '#1A1D29',
          mainBkg: '#252932',
          nodeBorder: '#8B5CF6',
          clusterBkg: '#1A1D29',
          titleColor: '#E8B923',
          edgeLabelBackground: '#252932',
        },
        flowchart: { curve: 'basis', padding: 20 },
        securityLevel: 'loose',
      });
      mermaid.default.contentLoaded();
    };
    loadMermaid();
  }, []);

  const c4ContextDiagram = `
graph TB
    subgraph External["Tashqi Tizimlar"]
        AbuSaxiy["🚚 AbuSaxiy<br/>Telegram Bot<br/>Excel Import"]
        Marketplaces["🛒 Marketplaces<br/>Uzum, Yandex<br/>Instagram, Telegram"]
    end

    subgraph Users["Foydalanuvchilar (11 Rol)"]
        Owner["👤 Rahbar<br/>Investor hisobotlari"]
        ChiefMgr["👔 Bosh menejer<br/>To'liq boshqaruv"]
        ChinaTeam["🇨🇳 Xitoy jamoasi<br/>Manager, Packer, Receiver"]
        UzTeam["🇺🇿 O'zbekiston jamoasi<br/>Manager, Receiver, Quality"]
        Finance["💰 Moliya<br/>Hisobotlar"]
        Investor["📊 Investor<br/>Faqat o'qish"]
    end

    subgraph AliBrand["AliBrand CRM Tizimi"]
        Frontend["⚛️ PWA Frontend"]
        Backend["☁️ AliBrand Cloud<br/>Backend"]
        EdgeFn["⚡ Backend Servislar"]
    end

    Users --> Frontend
    Frontend --> Backend
    Frontend --> EdgeFn
    Backend --> AbuSaxiy
    Backend --> Marketplaces
`;

  const erdDiagram = `
erDiagram
    products {
        uuid id PK
        text uuid UK
        text name
        text category
        numeric price
        numeric selling_price
        integer quantity
        text status
        uuid created_by FK
    }
    
    product_items {
        uuid id PK
        text item_uuid UK
        uuid product_id FK
        uuid box_id FK
        text status
        text location
        text notes
    }
    
    boxes {
        uuid id PK
        text box_number UK
        text qr_code
        jsonb qr_data
        text status
        text location
        numeric weight_kg
        numeric volume_m3
        uuid sealed_by FK
    }
    
    shipments {
        uuid id PK
        text shipment_number UK
        text carrier
        text status
        date estimated_arrival
        date arrival_date
        uuid created_by FK
    }
    
    shipment_boxes {
        uuid id PK
        uuid shipment_id FK
        uuid box_id FK
    }
    
    tracking_events {
        uuid id PK
        text entity_type
        uuid entity_id FK
        text event_type
        text location
        text description
        uuid created_by FK
    }
    
    user_roles {
        uuid id PK
        uuid user_id FK
        enum role
    }
    
    profiles {
        uuid id PK
        text full_name
        text phone
        text language
    }
    
    finance_transactions {
        uuid id PK
        text transaction_type
        numeric amount
        text currency
        text category
        uuid created_by FK
    }
    
    categories {
        uuid id PK
        text name UK
        text slug UK
        boolean is_active
    }

    products ||--o{ product_items : "has many"
    boxes ||--o{ product_items : "contains"
    shipments ||--o{ shipment_boxes : "includes"
    boxes ||--o{ shipment_boxes : "assigned to"
    boxes ||--o{ tracking_events : "tracked by"
    user_roles }o--|| profiles : "belongs to"
`;

  const workflowDiagram = `
flowchart LR
    subgraph China["🇨🇳 Xitoy Ombori"]
        P1[Mahsulot yaratish] --> P2[Miqdor kiritish]
        P2 --> P3[Individual item UUID]
        P3 --> B1[Quti yaratish]
        B1 --> B2[Mahsulotlarni joylashtirish]
        B2 --> B3[Qutini muhrlash]
        B3 --> QR[QR kod generatsiya]
    end
    
    subgraph Ship["🚚 Jo'natish"]
        QR --> S1[Qutini tanlash]
        S1 --> S2[Jo'natma yaratish]
        S2 --> S3[AbuSaxiy Excel import]
        S3 --> S4[Status yangilanishi]
    end
    
    subgraph UZ["🇺🇿 O'zbekiston"]
        S4 --> V1[QR skanerlash]
        V1 --> V2[Kutilgan mahsulotlar]
        V2 --> V3{Tekshiruv}
        V3 -->|OK| V4[Tasdiqlash]
        V3 -->|Brak| V5[Nuqsonli]
        V3 -->|Yetishmayapti| V6[Yetishmayapti]
    end
    
    subgraph Finance["💰 Moliya"]
        V4 --> F1[Tranzaksiya yozish]
        V5 --> F2[Zarar hisoblash]
        V6 --> F2
        F1 --> F3[Investor hisobotlari]
        F2 --> F3
    end
`;

  const productLifecycleDiagram = `
stateDiagram-v2
    [*] --> Pending: Mahsulot yaratildi
    Pending --> Packed: Qutiga joylandi
    Packed --> Verified: Xitoyda tekshirildi
    Verified --> InTransit: Jo'natildi
    InTransit --> Arrived: O'zbekistonga yetdi
    Arrived --> Sold: Sotildi
    Arrived --> Damaged: Nuqsonli
    Arrived --> Missing: Yetishmayapti
    Damaged --> [*]
    Missing --> [*]
    Sold --> [*]
`;

  const boxLifecycleDiagram = `
stateDiagram-v2
    [*] --> Packing: Quti yaratildi
    Packing --> Sealed: Muhrlandi + QR
    Sealed --> InTransit: Jo'natmaga qo'shildi
    InTransit --> Arrived: Yetib keldi
    Arrived --> Verified: Tekshirildi
    Verified --> [*]
    
    note right of Packing: Mahsulotlar qo'shish
    note right of Sealed: QR kod generatsiya
    note right of Arrived: QR skanerlash
`;

  const frontendArchDiagram = `
flowchart TB
    subgraph Auth["🔐 Autentifikatsiya"]
        Login["/auth - Login sahifasi"]
        Protected["ProtectedRoute"]
    end
    
    subgraph Layout["📐 CRM Layout"]
        Sidebar["CRMSidebar<br/>Rol asosida navigatsiya"]
        Header["CRMHeader<br/>Til, Profil"]
    end
    
    subgraph Core["📦 Asosiy Sahifalar"]
        Dashboard["/crm/dashboard"]
        Products["/crm/products"]
        Boxes["/crm/boxes"]
        Shipments["/crm/shipments"]
        Tracking["/crm/tracking"]
    end
    
    subgraph Admin["⚙️ Admin"]
        Users["/crm/users"]
        Categories["/crm/admin/categories"]
    end
    
    subgraph Finance["💵 Moliya"]
        FinancePage["/crm/finance"]
    end
    
    subgraph Dialogs["🗂️ Dialoglar"]
        BoxPacking["BoxPackingDialog"]
        QRScanner["QRScannerDialog"]
        BoxVerification["BoxVerificationDialog"]
    end
    
    Login --> Protected
    Protected --> Layout
    Layout --> Core
    Layout --> Admin
    Layout --> Finance
    Boxes --> Dialogs
`;

  const rlsDiagram = `
flowchart TB
    subgraph SELECT["📖 SELECT (O'qish)"]
        S1["products, boxes, shipments<br/>tracking_events, product_items<br/>→ Barcha autentifikatsiya qilinganlar"]
        S2["finance_transactions<br/>→ rahbar, bosh_admin, moliya_xodimi, investor"]
        S3["user_roles<br/>→ Faqat o'z roli yoki adminlar"]
        S4["investor_reports<br/>→ Faqat o'z hisobotlari"]
    end
    
    subgraph INSERT["✏️ INSERT (Yaratish)"]
        I1["products<br/>→ rahbar, bosh_admin, xitoy_manager, manager"]
        I2["boxes<br/>→ rahbar, bosh_admin, xitoy_packer, xitoy_manager"]
        I3["shipments<br/>→ rahbar, bosh_admin, xitoy_manager, uz_manager"]
        I4["tracking_events<br/>→ Barcha xodimlar"]
    end
    
    subgraph UPDATE["🔄 UPDATE (Yangilash)"]
        U1["boxes<br/>→ rahbar, bosh_admin, xitoy_packer,<br/>xitoy_manager, uz_receiver, uz_manager"]
        U2["product_items<br/>→ rahbar, bosh_admin, xitoy_manager,<br/>xitoy_packer, uz_manager, uz_receiver"]
    end
    
    subgraph DELETE["🗑️ DELETE (O'chirish)"]
        D1["categories<br/>→ Faqat bosh_admin"]
        D2["user_roles<br/>→ rahbar, bosh_admin"]
    end
`;

  const techStackDiagram = `
flowchart TB
    subgraph Frontend["⚛️ Frontend"]
        FW["Frontend Framework"]
        Build["Build Tool"]
        UIFw["UI Framework"]
        Components["UI Components"]
        DataLayer["Data Layer"]
        Navigation["Navigation"]
        i18n["i18next"]
    end
    
    subgraph Backend["☁️ Backend"]
        Cloud["AliBrand Cloud"]
        Postgres["PostgreSQL"]
        Auth["Auth System"]
        RLS["Row Level Security"]
        Realtime["Realtime"]
        Edge["Serverless Functions"]
    end
    
    subgraph Features["🔧 Features"]
        QR["qrcode.react<br/>QR Generation"]
        PDF["jspdf<br/>PDF Export"]
        Excel["xlsx<br/>Excel Import"]
        Scanner["html5-qrcode<br/>QR Scanner"]
    end
    
    subgraph Deploy["🚀 Deployment"]
        PWA["PWA<br/>Installable"]
        AliBrandDeploy["AliBrand Platform"]
    end
    
    Frontend --> Backend
    Backend --> Features
    Features --> Deploy
`;

  const rolePermissionsDiagram = `
flowchart LR
    subgraph Roles["11 Rollar"]
        R1["👤 Rahbar"]
        R2["👔 Bosh menejer"]
        R3["🇨🇳 Xitoy menejeri"]
        R4["📦 Xitoy packer"]
        R5["📥 Xitoy receiver"]
        R6["🇺🇿 UZ menejeri"]
        R7["📥 UZ receiver"]
        R8["✅ UZ quality"]
        R9["💰 Moliya"]
        R10["📊 Manager"]
        R11["💵 Investor"]
    end
    
    subgraph Permissions["Ruxsatlar"]
        P1["Dashboard"]
        P2["Mahsulotlar"]
        P3["Qutilar"]
        P4["Jo'natmalar"]
        P5["Kuzatuv"]
        P6["Foydalanuvchilar"]
        P7["Kategoriyalar"]
        P8["Moliya"]
    end
    
    R2 --> P1 & P2 & P3 & P4 & P5 & P6 & P7 & P8
    R3 --> P1 & P2 & P3 & P4 & P5
    R4 --> P3
    R6 --> P1 & P2 & P3 & P4 & P5
    R7 --> P3 & P5
    R9 --> P8
    R1 --> P8
    R11 --> P8
`;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/crm/dashboard')}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              AliBrand CRM - Tizim Arxitekturasi
            </h1>
            <p className="text-muted-foreground mt-1">
              To'liq tizim diagrammalari va spetsifikatsiyalari
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">11</p>
                <p className="text-xs text-muted-foreground">Jadvallar</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-accent" />
              <div>
                <p className="text-2xl font-bold text-foreground">11</p>
                <p className="text-xs text-muted-foreground">Rollar</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <Layers className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-foreground">8</p>
                <p className="text-xs text-muted-foreground">Sahifalar</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-foreground">25+</p>
                <p className="text-xs text-muted-foreground">RLS Policies</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Diagrams Tabs */}
        <Tabs defaultValue="context" className="space-y-6">
          <TabsList className="flex flex-wrap gap-2 h-auto bg-muted p-2">
            <TabsTrigger value="context" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              C4 Context
            </TabsTrigger>
            <TabsTrigger value="erd" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              ERD
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="lifecycle" className="flex items-center gap-2">
              <Box className="h-4 w-4" />
              Lifecycle
            </TabsTrigger>
            <TabsTrigger value="frontend" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Frontend
            </TabsTrigger>
            <TabsTrigger value="rls" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              RLS
            </TabsTrigger>
            <TabsTrigger value="tech" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Tech Stack
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Rollar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="context">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                C4 Context Diagrammasi - Tizim Konteksti
              </h2>
              <p className="text-muted-foreground mb-6">
                AliBrand CRM tizimining tashqi tizimlar va foydalanuvchilar bilan aloqasi
              </p>
              <div className="mermaid overflow-x-auto" key="context">
                {c4ContextDiagram}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="erd">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Entity Relationship Diagram (ERD)
              </h2>
              <p className="text-muted-foreground mb-6">
                Ma'lumotlar bazasi strukturasi - 11 jadval va ularning bog'lanishlari
              </p>
              <div className="mermaid overflow-x-auto" key="erd">
                {erdDiagram}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="workflow">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Asosiy Ish Jarayoni (BPMN Style)
              </h2>
              <p className="text-muted-foreground mb-6">
                Xitoy → Jo'natish → O'zbekiston → Moliya to'liq jarayoni
              </p>
              <div className="mermaid overflow-x-auto" key="workflow">
                {workflowDiagram}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="lifecycle">
            <Card className="p-6 bg-card border-border space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  Mahsulot Hayot Sikli
                </h2>
                <p className="text-muted-foreground mb-6">
                  Mahsulot statuslari: pending → packed → verified → in_transit → arrived → sold/damaged/missing
                </p>
                <div className="mermaid overflow-x-auto" key="product-lifecycle">
                  {productLifecycleDiagram}
                </div>
              </div>
              
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  Quti Hayot Sikli
                </h2>
                <p className="text-muted-foreground mb-6">
                  Quti statuslari: packing → sealed (QR) → in_transit → arrived → verified
                </p>
                <div className="mermaid overflow-x-auto" key="box-lifecycle">
                  {boxLifecycleDiagram}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="frontend">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Frontend Arxitekturasi
              </h2>
              <p className="text-muted-foreground mb-6">
                React komponentlar strukturasi va sahifalar ierarxiyasi
              </p>
              <div className="mermaid overflow-x-auto" key="frontend">
                {frontendArchDiagram}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="rls">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Row Level Security (RLS) Siyosatlari
              </h2>
              <p className="text-muted-foreground mb-6">
                Rol asosida ma'lumotlarga kirish huquqlari
              </p>
              <div className="mermaid overflow-x-auto" key="rls">
                {rlsDiagram}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="tech">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Texnologiya Stack
              </h2>
              <p className="text-muted-foreground mb-6">
                Frontend, Backend, Features va Deployment texnologiyalari
              </p>
              <div className="mermaid overflow-x-auto" key="tech">
                {techStackDiagram}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="roles">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                11 Rol va Ruxsatlar Matritsasi
              </h2>
              <p className="text-muted-foreground mb-6">
                Har bir rolning tizimga kirish huquqlari
              </p>
              <div className="mermaid overflow-x-auto" key="roles">
                {rolePermissionsDiagram}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
