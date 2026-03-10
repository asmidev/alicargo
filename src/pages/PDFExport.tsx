import { useEffect } from "react";
import { Network, Database, Layout, BookOpen, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const PDFExport = () => {
  useEffect(() => {
    document.title = "AliBrand CRM - Phase 1 Deliverables Report";
  }, []);

  const bpmnDiagrams = [
    {
      title: "1. Xarid Qarori va Buyurtma Berish",
      description: "Manager tomonidan mahsulot tanlash va Xitoy sotuvchilariga buyurtma berish jarayoni"
    },
    {
      title: "2. Xitoyda Qadoqlash + QR Generatsiya + 100% Tekshiruv",
      description: "Mahsulotlarni qabul qilish, qutilarga joylashtirish, QR kod yaratish va to'liq tekshirish"
    },
    {
      title: "3. AbuSaxiy Excel Import va Status Yangilanishi",
      description: "Telegram bot orqali Excel fayllarni import qilish va jo'natma statuslarini yangilash"
    },
    {
      title: "4. O'zbekistonda QR Skanerlash va Qo'lda Tasdiqlash",
      description: "Qutilarni QR orqali skanerlash va xodim tomonidan qo'lda tekshirish"
    },
    {
      title: "5. Marketplace Sinxronizatsiya va Sotish",
      description: "Mahsulotlarni Uzum, Yandex, Instagram, Telegram kanallariga yuklash"
    },
    {
      title: "6. Moliya va Ko'p Variantli To'lov",
      description: "Xarajatlar, daromadlar va investorlar uchun hisobotlar"
    },
    {
      title: "7. Investor Hisobotlari (Cheklangan Kirish)",
      description: "Har bir investor faqat o'z moliyaviy ma'lumotlarini ko'radi"
    },
    {
      title: "8. Butun Jarayon Kuzatuv (UUID/QR)",
      description: "Har bir mahsulot va qutini bosqichma-bosqich kuzatish"
    },
    {
      title: "9. Xato Qayta Ishlash (Transport vaqtida shikastlangan)",
      description: "Nuqsonli mahsulotlar uchun AbuSaxiy'ga da'vo qilish jarayoni"
    }
  ];

  const c4Diagrams = [
    {
      title: "Context Diagram (Tashqi Integratsiyalar)",
      description: "Xitoy sotuvchilari, AbuSaxiy bot, Uzum/Yandex/Instagram/Telegram marketplace'lar bilan aloqa"
    },
    {
      title: "Container Diagram (Arxitektura Komponentlari)",
      description: "PWA Frontend, AliBrand Cloud Backend, Microservices, AI Layer, Excel Parser"
    },
    {
      title: "Component Diagram (Ichki Modullar)",
      description: "Auth Module, Product Management, QR Generator, Logistics Tracker, Finance Module, Investor Dashboard"
    }
  ];

  const erdTables = [
    "users (rollar bilan)",
    "purchase_decisions",
    "products (UUID)",
    "boxes (QR kod)",
    "box_contents",
    "shipments",
    "excel_import_logs",
    "marketplace_orders",
    "marketplace_sync_logs",
    "finance_transactions",
    "investor_reports",
    "user_roles"
  ];

  const wireframes = [
    "Login / Autentifikatsiya",
    "Xitoy Filiali Dashboard",
    "Qadoqlash Ekrani (Xitoy)",
    "QR Kod Ko'rish va Print",
    "Jo'natma Yaratish (Xitoy)",
    "Excel Import Ekrani",
    "Jo'natmalar Ro'yxati",
    "O'zbekiston Dashboard",
    "QR Scanner (O'zbekiston)",
    "Qabul va Tekshiruv Ekrani",
    "Nuqsonli Mahsulot Hisoboti",
    "Ombor / Inventory Dashboard",
    "Marketplace Ulanishlar",
    "Marketplace Orders Sync",
    "Investor Dashboard",
    "Moliya Dashboard (Admin)",
    "Xarajatlar Ro'yxati",
    "Mijoz Portal - Login",
    "Mijoz - Buyurtma Kuzatuv",
    "Mijoz - Buyurtmalar Tarixi",
    "Bildirishnomalar Markazi",
    "Foydalanuvchi Sozlamalari"
  ];

  const userRoles = [
    "super_admin - To'liq tizim nazorati",
    "china_manager - Xitoy filiali boshqaruvi",
    "china_receiver - Mahsulot qabul qilish",
    "china_packer - Qadoqlash va QR yaratish",
    "china_quality - Sifat nazorati",
    "uz_manager - O'zbekiston filiali boshqaruvi",
    "uz_receiver - Qabul va skanerlash",
    "uz_quality - Sifat tekshiruvi",
    "investor - Moliyaviy hisobotlar (cheklangan)",
    "marketplace_manager - Marketplace integratsiya",
    "finance_manager - Moliyaviy boshqaruv",
    "customer - Mijoz portali"
  ];

  return (
    <div className="min-h-screen bg-white text-black print:bg-white">
      {/* Floating Print Button */}
      <div className="fixed bottom-8 right-8 z-50 print:hidden">
        <Button
          size="lg"
          onClick={() => window.print()}
          className="gap-2 shadow-lg"
        >
          <Printer className="w-5 h-5" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Cover Page */}
      <div className="min-h-screen flex flex-col items-center justify-center p-12 page-break-after">
        <div className="text-center max-w-4xl">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-[#D91A2C] to-[#E6323F] rounded-2xl flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-6xl font-bold mb-4 text-[#D91A2C]">
              AliBrand CRM & AI Logistics Platform
            </h1>
            <div className="h-1 w-32 bg-gradient-to-r from-[#D91A2C] to-[#E6323F] mx-auto mb-6"></div>
          </div>
          
          <h2 className="text-4xl font-bold mb-6 text-gray-800">
            1-Bosqich: Discovery & Texnik Spetsifikatsiya
          </h2>
          
          <p className="text-xl text-gray-600 mt-8">
            Professional Outsourcing Company tomonidan tayyorlangan to'liq texnik hujjatlar paketi
          </p>

          <div className="mt-12 text-sm text-gray-600">
            <p>Professional Outsourcing Company</p>
            <p className="mt-2">Hisobot sanasi: Noyabr 2025</p>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="min-h-screen p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-[#D91A2C] border-b-4 border-[#D91A2C] pb-4">
          Mundarija
        </h2>
        <div className="space-y-4 text-lg">
          <div className="flex justify-between border-b pb-2">
            <span>1. BPMN 2.0 Diagrammalari (9 ta)</span>
            <span className="text-gray-600">3</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>2. C4 Arxitektura Diagrammalari (3 daraja)</span>
            <span className="text-gray-600">4</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>3. ERD (Ma'lumotlar Bazasi)</span>
            <span className="text-gray-600">5</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>4. Wireframes (22 ta ekran)</span>
            <span className="text-gray-600">6</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>5. Foydalanuvchi Rollari (12 ta)</span>
            <span className="text-gray-600">7</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>6. Texnik Stack</span>
            <span className="text-gray-600">8</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>7. Xavfsizlik va Compliance</span>
            <span className="text-gray-600">9</span>
          </div>
        </div>
      </div>

      {/* BPMN Diagrams */}
      <div className="min-h-screen p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-[#D91A2C] border-b-4 border-[#D91A2C] pb-4">
          1. BPMN 2.0 Diagrammalari
        </h2>
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Network className="w-8 h-8 text-[#D91A2C]" />
            <div>
              <h3 className="text-xl font-bold">9 ta to'liq biznes jarayon diagrammalari</h3>
              <p className="text-gray-600">Swimlane formatida, barcha rollar bilan</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {bpmnDiagrams.map((diagram, index) => (
            <div key={index} className="border-l-4 border-[#D91A2C] pl-6 py-3">
              <h4 className="font-bold text-lg mb-2">{diagram.title}</h4>
              <p className="text-gray-700">{diagram.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h4 className="font-bold mb-4">BPMN Asosiy Xususiyatlari:</h4>
          <ul className="space-y-2 text-sm list-disc list-inside text-gray-700">
            <li>Swimlane formatida har bir rol uchun alohida yo'lak</li>
            <li>To'liq xatoliklar va istisno holatlari qayta ishlash</li>
            <li>Real-time bildirishnomalar integratsiyasi</li>
            <li>Parallel jarayonlar va approval workflow'lar</li>
            <li>Mermaid kod va SVG formatida export</li>
          </ul>
        </div>
      </div>

      {/* C4 Architecture */}
      <div className="min-h-screen p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-[#D91A2C] border-b-4 border-[#D91A2C] pb-4">
          2. C4 Arxitektura Diagrammalari
        </h2>
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Layout className="w-8 h-8 text-[#D91A2C]" />
            <div>
              <h3 className="text-xl font-bold">3 ta daraja: Context, Container, Component</h3>
              <p className="text-gray-600">Tizim arxitekturasi to'liq tahlili</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {c4Diagrams.map((diagram, index) => (
            <div key={index} className="border-2 border-gray-200 rounded-lg p-6">
              <h4 className="font-bold text-xl mb-3 text-[#E6323F]">{diagram.title}</h4>
              <p className="text-gray-700 mb-4">{diagram.description}</p>
              <div className="bg-gray-50 h-48 rounded-lg flex items-center justify-center text-gray-400">
                [Diagram {index + 1} - {diagram.title}]
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h4 className="font-bold mb-4">Texnik Stack:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Frontend:</strong> Modern PWA Framework, TypeScript
            </div>
            <div>
              <strong>Backend:</strong> AliBrand Cloud (PostgreSQL, Auth, Storage)
            </div>
            <div>
              <strong>Microservices:</strong> Serverless Functions
            </div>
            <div>
              <strong>AI:</strong> AI Service (Vision, LLM)
            </div>
          </div>
        </div>
      </div>

      {/* ERD */}
      <div className="min-h-screen p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-[#D91A2C] border-b-4 border-[#D91A2C] pb-4">
          3. ERD (Ma'lumotlar Bazasi)
        </h2>
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-8 h-8 text-[#00A86B]" />
            <div>
              <h3 className="text-xl font-bold">To'liq ma'lumotlar bazasi sxemasi</h3>
              <p className="text-gray-600">PostgreSQL + Row Level Security (RLS)</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {erdTables.map((table, index) => (
            <div key={index} className="border-l-4 border-[#00A86B] pl-4 py-2">
              <div className="font-mono text-sm font-bold">{table}</div>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 h-96 rounded-lg flex items-center justify-center text-gray-400 mb-8">
          [Complete ERD Diagram - All Tables with Relationships]
        </div>

        <div className="p-6 bg-gray-50 rounded-lg">
          <h4 className="font-bold mb-4">Database Xususiyatlari:</h4>
          <ul className="space-y-2 text-sm list-disc list-inside text-gray-700">
            <li>Row Level Security (RLS) har bir jadval uchun</li>
            <li>UUID primary keys barcha jadvallar uchun</li>
            <li>Foreign key constraints va indexlar</li>
            <li>Timestamp fields (created_at, updated_at)</li>
            <li>Soft delete support (deleted_at)</li>
            <li>Real-time subscriptions orqali</li>
          </ul>
        </div>
      </div>

      {/* Wireframes */}
      <div className="min-h-screen p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-[#D91A2C] border-b-4 border-[#D91A2C] pb-4">
          4. High-Fidelity Wireframes
        </h2>
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Layout className="w-8 h-8 text-[#E6323F]" />
            <div>
              <h3 className="text-xl font-bold">22 ta professional responsive ekranlar</h3>
              <p className="text-gray-600">PWA-first dizayn, mobile va desktop</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {wireframes.map((wireframe, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-[#D91A2C] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gradient-to-br from-[#FFB300] to-[#DC143C] text-white flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                <div className="text-sm font-medium">{wireframe}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-gray-50 rounded-lg">
          <h4 className="font-bold mb-4">Dizayn Xususiyatlari:</h4>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <strong>Responsive Design:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-700">
                <li>Mobile-first PWA</li>
                <li>Tablet optimized</li>
                <li>Desktop layouts</li>
              </ul>
            </div>
            <div>
              <strong>UI Components:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-700">
                <li>shadcn/ui components</li>
                <li>Modern UI Framework</li>
                <li>Custom color system</li>
              </ul>
            </div>
            <div>
              <strong>Accessibility:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-700">
                <li>WCAG 2.1 AA standard</li>
                <li>Keyboard navigation</li>
                <li>Screen reader support</li>
              </ul>
            </div>
            <div>
              <strong>Internationalization:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-700">
                <li>O'zbek (asosiy)</li>
                <li>Rus</li>
                <li>Ingliz</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* User Roles */}
      <div className="min-h-screen p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-[#D91A2C] border-b-4 border-[#D91A2C] pb-4">
          5. Foydalanuvchi Rollari va Ruxsatlar
        </h2>
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-2">12 ta rol - Role-Based Access Control (RBAC)</h3>
          <p className="text-gray-600">Har bir rol uchun aniq ruxsatlar va cheklovlar</p>
        </div>

        <div className="space-y-4">
          {userRoles.map((role, index) => (
            <div key={index} className="border-l-4 border-[#D91A2C] pl-6 py-3 bg-gray-50 rounded-r-lg">
              <div className="font-bold">{role.split(' - ')[0]}</div>
              <div className="text-sm text-gray-700 mt-1">{role.split(' - ')[1]}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h4 className="font-bold mb-4">RBAC Tizimi Xususiyatlari:</h4>
          <ul className="space-y-2 text-sm list-disc list-inside text-gray-700">
            <li>Row Level Security (RLS)</li>
            <li>JWT token-based authentication</li>
            <li>Multi-factor authentication (MFA) support</li>
            <li>Session management va automatic logout</li>
            <li>Permission inheritance va delegation</li>
            <li>Audit logs barcha muhim amallar uchun</li>
          </ul>
        </div>
      </div>

      {/* Technical Stack */}
      <div className="min-h-screen p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-[#D91A2C] border-b-4 border-[#D91A2C] pb-4">
          6. Texnik Stack va Arxitektura
        </h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-2xl font-bold mb-4 text-[#E6323F]">Frontend</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">Framework</div>
                <div className="text-sm text-gray-700">Modern PWA Framework, TypeScript</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">Styling</div>
                <div className="text-sm text-gray-700">Modern UI Framework, Components, Animations</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">PWA</div>
                <div className="text-sm text-gray-700">Service Workers, Offline support, Push notifications</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">State Management</div>
                <div className="text-sm text-gray-700">React Query (TanStack Query), Zustand</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-4 text-[#E6323F]">Backend</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">Database</div>
                <div className="text-sm text-gray-700">AliBrand Cloud (PostgreSQL), Row Level Security</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">Authentication</div>
                <div className="text-sm text-gray-700">Auth System, JWT, MFA support</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">Storage</div>
                <div className="text-sm text-gray-700">AliBrand Storage (images, documents, QR codes)</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">Microservices</div>
                <div className="text-sm text-gray-700">Mikroservislar (Serverless)</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-4 text-[#E6323F]">AI & Integrations</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">AI Models</div>
                <div className="text-sm text-gray-700">AliBrand AI Models (Vision, LLM)</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">Excel Parsing</div>
                <div className="text-sm text-gray-700">Telegram Bot API, xlsx library</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">Marketplaces</div>
                <div className="text-sm text-gray-700">Uzum API, Yandex API, Instagram/Telegram</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-bold mb-2">QR Generation</div>
                <div className="text-sm text-gray-700">qrcode library, PDF generation</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Compliance */}
      <div className="p-12">
        <h2 className="text-4xl font-bold mb-8 text-[#D91A2C] border-b-4 border-[#D91A2C] pb-4">
          7. Xavfsizlik va Compliance
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-3 text-[#E6323F]">Xavfsizlik Choralari</h3>
            <ul className="space-y-2 list-disc list-inside text-gray-700">
              <li>Row Level Security (RLS) har bir jadval uchun</li>
              <li>JWT token-based authentication, MFA support</li>
              <li>HTTPS only, SSL certificates</li>
              <li>Input validation va sanitization</li>
              <li>SQL injection protection</li>
              <li>CSRF va XSS protection</li>
              <li>Rate limiting API endpoints uchun</li>
              <li>Audit logs barcha muhim amallar uchun</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 text-[#E6323F]">Data Privacy</h3>
            <ul className="space-y-2 list-disc list-inside text-gray-700">
              <li>Investor ma'lumotlari to'liq ajratilgan (har bir investor faqat o'ziniki)</li>
              <li>Sensitive data encryption at rest va in transit</li>
              <li>GDPR compliance (Evropa mijozlar uchun)</li>
              <li>Data backup va disaster recovery</li>
              <li>Automatic data retention policies</li>
            </ul>
          </div>

          <div className="mt-12 p-8 bg-gray-50 rounded-lg border-2 border-[#D91A2C]">
            <h3 className="text-2xl font-bold mb-4 text-center">Shartnoma Tasdigi</h3>
            <div className="grid grid-cols-2 gap-8 mt-6">
              <div>
                <div className="font-bold mb-2">Client:</div>
                <div className="text-sm text-gray-600 mb-4">AliBrand</div>
                <div className="border-t-2 border-gray-300 pt-2 mt-12">
                  <div className="text-sm">Imzo / Sana</div>
                </div>
              </div>
              <div>
                <div className="font-bold mb-2">Contractor:</div>
                <div className="text-sm text-gray-600 mb-4">Professional Outsourcing Company</div>
                <div className="border-t-2 border-gray-300 pt-2 mt-12">
                  <div className="text-sm">Imzo / Sana</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>© 2025 Professional Outsourcing Company</p>
          <p className="mt-1">AliBrand CRM & AI Logistics Platform - Phase 1 Deliverables</p>
        </div>
      </div>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .page-break-after {
            page-break-after: always;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}} />
    </div>
  );
};

export default PDFExport;
