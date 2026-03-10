import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MermaidDiagram from "@/components/MermaidDiagram";

const C4Architecture = () => {
  const contextDiagram = `graph TB
    subgraph External["Tashqi Sistema va Foydalanuvchilar"]
        ChinaStaff[Xitoy Filiali Xodimlari]
        UzStaff[O'zbekiston Filiali Xodimlari]
        Investors[Investorlar]
        Customers[Mijozlar]
        ChinaSellers[Xitoy Sotuvchilari]
    end
    
    subgraph AliBrand["AliBrand CRM Platform"]
        Core[Core CRM Sistema]
    end
    
    subgraph ExternalSystems["Tashqi Tizimlar"]
        AbuSaxiyBot[AbuSaxiy Telegram Bot]
        UzumAPI[Uzum Marketplace API]
        YandexAPI[Yandex Market API]
        TelegramAPI[Telegram Bot API]
        InstagramAPI[Instagram Shop API]
        AIVision[AI Vision Service]
    end
    
    ChinaStaff -->|Mahsulot qadoqlash, QR skan| Core
    UzStaff -->|QR skan, qabul tasdiqlash| Core
    Investors -->|Moliyaviy hisobotlar ko'rish| Core
    Customers -->|Buyurtma kuzatuv| Core
    ChinaSellers -->|Mahsulot ma'lumotlari| Core
    
    Core -->|Excel import| AbuSaxiyBot
    Core -->|Stok sinxronizatsiya| UzumAPI
    Core -->|Stok sinxronizatsiya| YandexAPI
    Core -->|Bildirishnomalar| TelegramAPI
    Core -->|Mahsulot listing| InstagramAPI
    Core -->|Video tahlil kelajak| AIVision
    
    style Core fill:#4f46e5,color:#fff,stroke:#312e81,stroke-width:3px
    style ChinaStaff fill:#8b5cf6,color:#fff
    style UzStaff fill:#8b5cf6,color:#fff
    style Investors fill:#10b981,color:#fff
    style Customers fill:#06b6d4,color:#fff`;

  const containerDiagram = `graph TB
    subgraph Frontend["Frontend Container"]
        PWA[PWA Application]
        UI[shadcn/ui Components]
        I18n[i18next O'zbek/Rus/Ingliz]
    end
    
    subgraph Backend["Backend Container - AliBrand Cloud"]
        PostgreSQL[(PostgreSQL Database)]
        Auth[Auth System JWT]
        Storage[File Storage]
        Realtime[Real-time Subscriptions]
    end
    
    subgraph Microservices["Mikroservislar Container"]
        EdgeFunc[Mikroservislar Serverless]
        QRService[QR Generator Service]
        ExcelParser[Excel Parser Module]
        MPSync[Marketplace Sync Worker]
        FinanceCalc[Finance Calculator]
        NotifService[Notification Service]
    end
    
    subgraph ExternalAI["AI Container Kelajak"]
        AIVisionAPI[AI Vision API Python/FastAPI]
        DefectDetector[Defect Detection ML Model]
    end
    
    PWA -->|API calls HTTPS| EdgeFunc
    PWA -->|Auth JWT| Auth
    PWA -->|File upload| Storage
    PWA -->|Real-time updates| Realtime
    
    EdgeFunc -->|SQL queries| PostgreSQL
    QRService -->|UUID gen| PostgreSQL
    ExcelParser -->|Parse & insert| PostgreSQL
    MPSync -->|Sync data| PostgreSQL
    FinanceCalc -->|Calculate| PostgreSQL
    NotifService -->|Push notifications| PWA
    
    EdgeFunc -->|Trigger| QRService
    EdgeFunc -->|Trigger| ExcelParser
    EdgeFunc -->|Trigger| MPSync
    EdgeFunc -->|Trigger| FinanceCalc
    
    AIVisionAPI -->|Video analysis results| EdgeFunc
    DefectDetector -->|ML predictions| AIVisionAPI
    
    style PWA fill:#4f46e5,color:#fff
    style PostgreSQL fill:#10b981,color:#fff
    style EdgeFunc fill:#f59e0b,color:#fff
    style AIVisionAPI fill:#8b5cf6,color:#fff`;

  const componentDiagram = `graph TB
    subgraph FrontendComponents["Frontend Components"]
        AuthModule[Authentication Module]
        ChinaDash[China Branch Dashboard]
        UzDash[Uzbekistan Branch Dashboard]
        QRScanner[QR Scanner Component]
        MPPanel[Marketplace Integration Panel]
        InvestorDash[Investor Finance Dashboard]
        NotifCenter[Notification Center]
        i18nProvider[i18n Provider Context]
    end
    
    subgraph BackendModules["Backend API Modules"]
        ProductAPI[Product Management API]
        BoxQRAPI[Box & QR Management API]
        ShipmentAPI[Shipment Tracking API]
        ExcelHandler[Excel Import Handler]
        MPSyncEngine[Marketplace Sync Engine]
        FinanceService[Financial Calculation Service]
        InvestorEngine[Investor Reporting Engine]
        AIIntegration[AI Integration Layer]
        RLSPolicies[Row Level Security Policies]
    end
    
    subgraph Database["Database Schema"]
        ProfilesTable[profiles table]
        RolesTable[user_roles table 12 roles]
        ProductsTable[products table]
        BoxesTable[boxes table]
        QRTable[box_qr_codes table]
        ShipmentsTable[shipments table]
        InvestorsTable[investors table]
        FinanceTable[financial_transactions table]
        MarketplaceTable[marketplace_connections table]
    end
    
    AuthModule -->|Login/Register| ProductAPI
    ChinaDash -->|Fetch products| ProductAPI
    ChinaDash -->|Create box + QR| BoxQRAPI
    UzDash -->|Scan QR| BoxQRAPI
    UzDash -->|Confirm arrival| ShipmentAPI
    MPPanel -->|Sync stock| MPSyncEngine
    InvestorDash -->|Get reports| InvestorEngine
    
    ProductAPI --> ProductsTable
    BoxQRAPI --> BoxesTable
    BoxQRAPI --> QRTable
    ShipmentAPI --> ShipmentsTable
    ExcelHandler --> ShipmentsTable
    FinanceService --> FinanceTable
    InvestorEngine --> InvestorsTable
    MPSyncEngine --> MarketplaceTable
    
    RLSPolicies -.->|Secure access| ProfilesTable
    RLSPolicies -.->|Secure access| RolesTable
    
    style AuthModule fill:#4f46e5,color:#fff
    style BoxQRAPI fill:#f59e0b,color:#fff
    style InvestorEngine fill:#10b981,color:#fff
    style RLSPolicies fill:#ef4444,color:#fff`;

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
                <h1 className="text-2xl font-bold">C4 Model Arxitektura</h1>
                <p className="text-muted-foreground text-sm">Context → Container → Component Levels</p>
              </div>
            </div>
            <Button size="lg" className="gap-2" onClick={() => window.print()}>
              <Download className="w-4 h-4" />
              PDF yuklab olish
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Simon Brown C4 Model Standart</h2>
          <p className="text-muted-foreground text-lg mb-6">
            C4 Model - professional dasturiy ta'minot arxitekturasini 4 darajada ko'rsatish: Context, Container, Component, Code.
            AliBrand platformasi uchun to'liq 3 daraja diagrammalari (Code level implementation fazasida).
          </p>
          <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <Layers className="w-6 h-6 text-primary" />
            <p className="text-sm">
              <strong>Level 1 Context</strong> (30,000 ft) → <strong>Level 2 Container</strong> (10,000 ft) → <strong>Level 3 Component</strong> (1,000 ft) → <strong>Level 4 Code</strong>
            </p>
          </div>
        </div>

        {/* Level 1: Context */}
        <Card className="mb-12 overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-purple-500/10 to-pink-500/10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                C1
              </div>
              <div>
                <div className="text-sm font-semibold text-purple-600 mb-1">Context Level</div>
                <h3 className="text-2xl font-bold">Tizim Kontekst Diagrammasi</h3>
              </div>
            </div>
            <p className="text-muted-foreground mb-4">
              AliBrand platformasi va uning tashqi tizimlar/foydalanuvchilar bilan o'zaro ta'siri. 30,000 fut balandlikdan ko'rinish.
            </p>
          </div>
          <div className="p-6 bg-background">
            <div className="bg-card p-6 rounded-lg border">
              <MermaidDiagram chart={contextDiagram} className="min-h-[300px]" />
            </div>
          </div>
          <div className="p-6 bg-muted/30">
            <h4 className="font-semibold mb-3">Asosiy Tashqi Elementlar:</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 bg-card rounded">👥 Xitoy/O'zbekiston Filiali Xodimlari</div>
              <div className="p-3 bg-card rounded">💰 Investorlar (cheklangan kirish)</div>
              <div className="p-3 bg-card rounded">🛒 Mijozlar (buyurtma kuzatuv)</div>
              <div className="p-3 bg-card rounded">🚚 AbuSaxiy Logistics Bot</div>
              <div className="p-3 bg-card rounded">🏪 Uzum, Yandex Marketplace API</div>
              <div className="p-3 bg-card rounded">🤖 AI Vision Service (kelajak)</div>
            </div>
          </div>
        </Card>

        {/* Level 2: Container */}
        <Card className="mb-12 overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                C2
              </div>
              <div>
                <div className="text-sm font-semibold text-blue-600 mb-1">Container Level</div>
                <h3 className="text-2xl font-bold">Container Diagrammasi</h3>
              </div>
            </div>
            <p className="text-muted-foreground mb-4">
              Tizim ichidagi asosiy texnologik komponentlar: Frontend PWA, Backend, Mikroservislar, AI. 10,000 fut ko'rinish.
            </p>
          </div>
          <div className="p-6 bg-background">
            <div className="bg-card p-6 rounded-lg border">
              <MermaidDiagram chart={containerDiagram} className="min-h-[400px]" />
            </div>
          </div>
          <div className="p-6 bg-muted/30">
            <Tabs defaultValue="uzbek">
              <TabsList>
                <TabsTrigger value="uzbek">O'zbek</TabsTrigger>
                <TabsTrigger value="russian">Русский</TabsTrigger>
                <TabsTrigger value="english">English</TabsTrigger>
              </TabsList>
              <TabsContent value="uzbek" className="mt-4">
                <h4 className="font-semibold mb-3">Container Tafsilotlari:</h4>
                <div className="space-y-3">
                  <div className="p-3 bg-primary/10 rounded">
                    <strong>Frontend:</strong> PWA + UI Components + i18next (uz/ru/en)
                  </div>
                  <div className="p-3 bg-accent/10 rounded">
                    <strong>Backend:</strong> AliBrand Cloud - PostgreSQL + Auth (JWT) + Storage + Real-time
                  </div>
                  <div className="p-3 bg-orange-500/10 rounded">
                    <strong>Mikroservislar:</strong> Serverless Functions, QR Generator, Excel Parser, MP Sync Workers
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded">
                    <strong>AI Container:</strong> Python/FastAPI - Video Analysis & Defect Detection (Phase 6+)
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="russian" className="mt-4">
                <p className="text-muted-foreground">Русская версия контейнеров...</p>
              </TabsContent>
              <TabsContent value="english" className="mt-4">
                <p className="text-muted-foreground">English container details...</p>
              </TabsContent>
            </Tabs>
          </div>
        </Card>

        {/* Level 3: Component */}
        <Card className="mb-12 overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-green-500/10 to-emerald-500/10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                C3
              </div>
              <div>
                <div className="text-sm font-semibold text-green-600 mb-1">Component Level</div>
                <h3 className="text-2xl font-bold">Component Diagrammasi</h3>
              </div>
            </div>
            <p className="text-muted-foreground mb-4">
              Har bir container ichidagi modullar va komponentlar tuzilmasi. Kod darajasiga yaqin ko'rinish (1,000 ft).
            </p>
          </div>
          <div className="p-6 bg-background">
            <div className="bg-card p-6 rounded-lg border">
              <MermaidDiagram chart={componentDiagram} className="min-h-[400px]" />
            </div>
          </div>
          <div className="p-6 bg-muted/30">
            <h4 className="font-semibold mb-3">Asosiy Komponentlar:</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-semibold text-primary mb-2">Frontend Modules:</h5>
                <ul className="space-y-1 text-sm">
                  <li>• Authentication Module (role-based)</li>
                  <li>• China Branch Dashboard</li>
                  <li>• Uzbekistan Dashboard</li>
                  <li>• QR Scanner Component</li>
                  <li>• Marketplace Integration Panel</li>
                  <li>• Investor Finance Dashboard (restricted)</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-accent mb-2">Backend API Modules:</h5>
                <ul className="space-y-1 text-sm">
                  <li>• Product Management API</li>
                  <li>• Box & QR Management</li>
                  <li>• Shipment Tracking API</li>
                  <li>• Excel Import Handler</li>
                  <li>• Marketplace Sync Engine</li>
                  <li>• Financial Calculation Service</li>
                  <li>• Investor Reporting Engine</li>
                  <li>• <strong>RLS Policies (Security!)</strong></li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* Tech Stack Summary */}
        <Card className="p-8">
          <h3 className="text-2xl font-bold mb-6">Texnologiya Stack Summary</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-3 text-primary">Frontend</h4>
              <ul className="space-y-2 text-sm">
                <li>✓ Modern PWA Framework</li>
                <li>✓ TypeScript</li>
                <li>✓ UI Framework + Components</li>
                <li>✓ PWA Configuration</li>
                <li>✓ i18next (uz/ru/en)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-primary">Backend - AliBrand Cloud</h4>
              <ul className="space-y-2 text-sm">
                <li>✓ PostgreSQL 15+</li>
                <li>✓ Auth System (JWT)</li>
                <li>✓ Storage (S3-compatible)</li>
                <li>✓ Serverless Functions</li>
                <li>✓ Real-time Subscriptions</li>
                <li>✓ Row Level Security</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-primary">Integratsiyalar</h4>
              <ul className="space-y-2 text-sm">
                <li>✓ AbuSaxiy Telegram Bot</li>
                <li>✓ Uzum Marketplace API</li>
                <li>✓ Yandex Market API</li>
                <li>✓ Instagram Shop API</li>
                <li>✓ Telegram Bot API</li>
                <li>✓ AI Vision Service</li>
              </ul>
            </div>
          </div>
        </Card>

      </section>
    </div>
  );
};

export default C4Architecture;