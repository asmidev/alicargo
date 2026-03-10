import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, FileText } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const SRS = () => {
  const sections = [
    {
      title: "1. Executive Summary",
      subsections: [
        "1.1 Loyiha Maqsadi",
        "1.2 Asosiy Muammo va Yechim",
        "1.3 Kutilayotgan Natijalar",
        "1.4 Investitsiya va ROI"
      ]
    },
    {
      title: "2. Biznes Jarayoni (Batafsil)",
      subsections: [
        "2.1 AliBrand Biznes Modeli",
        "2.2 To'liq Logistika Zanjiri",
        "2.3 Xitoy Filiali Operatsiyalari",
        "2.4 AbuSaxiy Logistics Integratsiyasi",
        "2.5 O'zbekiston Filiali Operatsiyalari",
        "2.6 Marketplace Sales Channels",
        "2.7 Investor Management",
        "2.8 Customer Journey"
      ]
    },
    {
      title: "3. Funksional Talablar",
      subsections: [
        "3.1 Autentifikatsiya va Rollar (12 ta rol)",
        "3.2 Xitoy Filiali Modullari",
        "3.3 QR Kod Sistema (Critical)",
        "3.4 Excel Import Engine (AbuSaxiy)",
        "3.5 O'zbekiston Qabul Sistema",
        "3.6 Inventory Management",
        "3.7 Marketplace Integration API",
        "3.8 Moliyaviy Modul",
        "3.9 Investor Dashboard",
        "3.10 Nuqson/Qaytarish Sistema",
        "3.11 AI Video Tekshiruv (Kelajak)",
        "3.12 Bildirishnomalar Sistema"
      ]
    },
    {
      title: "4. Nofunksional Talablar",
      subsections: [
        "4.1 Performance Requirements",
        "4.2 Xavfsizlik (Security)",
        "4.3 Scalability",
        "4.4 Reliability & Availability",
        "4.5 Usability & UX",
        "4.6 Maintainability",
        "4.7 Compliance"
      ]
    },
    {
      title: "5. Foydalanuvchi Rollari va Ruxsatlar",
      subsections: [
        "5.1 super_admin",
        "5.2 china_manager",
        "5.3 china_receiver",
        "5.4 china_packer",
        "5.5 china_quality",
        "5.6 uz_manager",
        "5.7 uz_receiver",
        "5.8 uz_quality",
        "5.9 investor",
        "5.10 marketplace_manager",
        "5.11 finance_manager",
        "5.12 customer"
      ]
    },
    {
      title: "6. Texnik Stack",
      subsections: [
        "6.1 Frontend: Modern PWA Framework",
        "6.2 Backend: AliBrand Cloud (PostgreSQL, Auth, Storage)",
        "6.3 PWA Configuration",
        "6.4 Internationalization (i18n)",
        "6.5 Real-time Features",
        "6.6 Third-party Integrations"
      ]
    },
    {
      title: "7. API Spetsifikatsiya",
      subsections: [
        "7.1 RESTful API Endpoints",
        "7.2 Authentication & Authorization",
        "7.3 Excel Import API",
        "7.4 Marketplace API Integration",
        "7.5 QR Generation Service",
        "7.6 Real-time Subscriptions",
        "7.7 Error Handling"
      ]
    },
    {
      title: "8. Ma'lumotlar Bazasi",
      subsections: [
        "8.1 ERD (Entity Relationship Diagram)",
        "8.2 18 ta Jadval Tafsiloti",
        "8.3 Foreign Key Relationships",
        "8.4 Indexes va Performance Optimization",
        "8.5 RLS (Row Level Security) Policies",
        "8.6 Database Triggers",
        "8.7 Backup va Recovery Strategy"
      ]
    },
    {
      title: "9. Excel Import Spetsifikatsiya",
      subsections: [
        "9.1 AbuSaxiy Telegram Bot Integration",
        "9.2 Excel Format Requirements",
        "9.3 Data Parsing Logic",
        "9.4 Auto Status Update",
        "9.5 Error Handling",
        "9.6 Import Logs"
      ]
    },
    {
      title: "10. QR Kod Sistema",
      subsections: [
        "10.1 QR Generatsiya Algoritmi",
        "10.2 QR Ma'lumotlar Struktura",
        "10.3 Quti-QR Mapping",
        "10.4 Skanlash Jarayoni",
        "10.5 Offline QR Support",
        "10.6 Print Format"
      ]
    },
    {
      title: "11. Marketplace Integration",
      subsections: [
        "11.1 Uzum API",
        "11.2 Yandex Market API",
        "11.3 Instagram Shop API",
        "11.4 Telegram Bot",
        "11.5 Stock Sync Logic",
        "11.6 Order Sync Logic",
        "11.7 Webhook Handling"
      ]
    },
    {
      title: "12. Xavfsizlik va Ruxsatlar",
      subsections: [
        "12.1 Authentication Strategy",
        "12.2 Role-based Access Control (RBAC)",
        "12.3 Row Level Security Implementation",
        "12.4 API Keys Encryption",
        "12.5 Data Privacy (GDPR compliance)",
        "12.6 Audit Logs",
        "12.7 Security Best Practices"
      ]
    },
    {
      title: "13. Testing Strategy",
      subsections: [
        "13.1 Unit Tests",
        "13.2 Integration Tests",
        "13.3 E2E Tests",
        "13.4 Performance Tests",
        "13.5 Security Tests",
        "13.6 User Acceptance Testing (UAT)"
      ]
    },
    {
      title: "14. Deployment Plan",
      subsections: [
        "14.1 Environment Setup (Dev, Staging, Prod)",
        "14.2 CI/CD Pipeline",
        "14.3 Database Migration Strategy",
        "14.4 Zero-downtime Deployment",
        "14.5 Rollback Plan",
        "14.6 Monitoring & Alerts"
      ]
    },
    {
      title: "15. Risk Register",
      subsections: [
        "15.1 Xitoy Ombori Tekshiruv Xatosi (CRITICAL)",
        "15.2 AbuSaxiy Excel Format O'zgarishi",
        "15.3 Marketplace API Downtime",
        "15.4 QR Kod Skanerlash Muammolari",
        "15.5 Moliyaviy Hisob-kitob Xatolari",
        "15.6 Data Loss Risk",
        "15.7 Mitigation Strategies"
      ]
    },
    {
      title: "16. Loyiha Jadvali - 7 Bosqich (53 kun)",
      subsections: [
        "16.1 1-Bosqich: Discovery & Texnik Spetsifikatsiya (1-5 kun) - $135-180",
        "16.2 2-Bosqich: CRM Asosiy Backend + Ruxsatlar va Rollar (6-15 kun) - $900",
        "16.3 3-Bosqich: Xitoy Filiali Moduli + AI Verifikatsiya (16-25 kun) - $1,080",
        "16.4 4-Bosqich: Logistika + AbuSaxiy API (26-30 kun) - $450",
        "16.5 5-Bosqich: O'zbekiston Filiali Moduli (31-35 kun) - $720",
        "16.6 6-Bosqich: Moliyaviy Modul + AI Analitika (36-45 kun) - $900",
        "16.7 7-Bosqich: Mijoz Portali / Marketplace (46-53 kun) - $810",
        "Jami: 53 kun, $4,995-5,040"
      ]
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
                <h1 className="text-2xl font-bold">SRS Hujjat</h1>
                <p className="text-muted-foreground text-sm">Software Requirements Specification - 35 sahifa</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <BookOpen className="w-12 h-12 text-primary" />
            <div>
              <h2 className="text-3xl font-bold">To'liq Texnik Hujjat</h2>
              <p className="text-muted-foreground text-lg">
                35 sahifali professional SRS - O'zbek va Ingliz tillarida
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-primary mb-1">35</div>
              <div className="text-sm text-muted-foreground">Sahifalar</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-accent mb-1">16</div>
              <div className="text-sm text-muted-foreground">Bo'limlar</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">53</div>
              <div className="text-sm text-muted-foreground">Kunlar (7 Bosqich)</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-1">3</div>
              <div className="text-sm text-muted-foreground">Tillar (UZ/RU/EN)</div>
            </Card>
          </div>
          
          {/* Corrections Summary */}
          <Card className="p-6 mb-8 bg-green-500/10 border-green-500/20">
            <h3 className="text-xl font-bold mb-4 text-green-700">✅ Tuzatishlar Xulosasi</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Tuzatildi:</strong>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>✓ Xitoyda avtomatik QR generatsiya qo'shildi</li>
                  <li>✓ O'zbekistonda qo'lda tekshiruv aniqroq</li>
                  <li>✓ AbuSaxiy Excel import via Telegram Bot</li>
                  <li>✓ Mijoz buyurtmalari olib tashlandi - AliBrand o'zi xarid qiladi</li>
                </ul>
              </div>
              <div>
                <strong>Yangilandi:</strong>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>✓ 100% Xitoy tekshiruv bottleneck ta'kidlandi</li>
                  <li>✓ Marketplace post-arrival faqat</li>
                  <li>✓ Investor cheklangan kirish aniq belgilandi</li>
                  <li>✓ PWA-first mobile design uchrayiladi</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Document Structure */}
        <Card className="p-8 mb-8">
          <h3 className="text-2xl font-bold mb-6">Hujjat Tuzilmasi</h3>
          <Accordion type="single" collapsible className="w-full">
            {sections.map((section, index) => (
              <AccordionItem key={index} value={`section-${index}`}>
                <AccordionTrigger className="text-lg font-semibold">
                  {section.title}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-4">
                    {section.subsections.map((sub, subIndex) => (
                      <div key={subIndex} className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground transition-colors">
                        <div className="w-2 h-2 rounded-full bg-primary/40" />
                        <span>{sub}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        {/* Sample Content Preview */}
        <Card className="p-8">
          <h3 className="text-2xl font-bold mb-6">Hujjat Namunasi (1-bo'lim)</h3>
          <div className="prose prose-sm max-w-none">
            <h4 className="text-xl font-bold mb-4">1. Executive Summary</h4>
            
            <h5 className="font-semibold mt-4 mb-2">1.1 Loyiha Maqsadi</h5>
            <p className="text-muted-foreground mb-4">
              AliBrand CRM & AI Logistics Platform - Xitoy va boshqa davlatlardan mahsulotlarni xarid qilib,
              O'zbekistonga yetkazib beradigan transchegaraviy logistika kompaniyasi uchun zamonaviy,
              AI (sun'iy intellekt) asosidagi to'liq CRM va Mahsulot Nazorat Tizimi.
            </p>

            <h5 className="font-semibold mt-4 mb-2">1.2 Asosiy Muammo</h5>
            <div className="bg-destructive/10 border-l-4 border-destructive p-4 mb-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>❌ Mahsulotlar aralashib ketadi yoki yo'qoladi</li>
                <li>❌ Filiallar qo'lda va notizimli muloqot qiladi</li>
                <li>❌ Yagona tracking tizimi yo'q</li>
                <li>❌ Moliya ma'lumotlari tarqoq va mos kelmaydi</li>
                <li>❌ Real vaqtda holatni to'liq ko'rish imkoni yo'q</li>
              </ul>
            </div>

            <h5 className="font-semibold mt-4 mb-2">1.3 Yechim</h5>
            <div className="bg-primary/10 border-l-4 border-primary p-4 mb-4">
              <ul className="space-y-2 text-sm text-foreground">
                <li>✅ Har bir mahsulotga noyob UUID va QR kod</li>
                <li>✅ Butun zanjir bo'ylab real-time kuzatuv</li>
                <li>✅ Avtomatik Excel import AbuSaxiy'dan</li>
                <li>✅ QR skanlash bilan bir soniyada tekshiruv</li>
                <li>✅ Marketplace'lar bilan real-time sinxronizatsiya</li>
                <li>✅ Investorlar uchun shaffof moliyaviy hisobotlar</li>
                <li>✅ AI video orqali nuqsonlarni avtomatik aniqlash</li>
              </ul>
            </div>

            <h5 className="font-semibold mt-4 mb-2">1.4 Kutilayotgan Natijalar</h5>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4 bg-green-500/10">
                <div className="text-2xl font-bold text-green-600 mb-1">90%</div>
                <div className="text-sm text-muted-foreground">Yo'qolish kamayadi</div>
              </Card>
              <Card className="p-4 bg-blue-500/10">
                <div className="text-2xl font-bold text-blue-600 mb-1">70%</div>
                <div className="text-sm text-muted-foreground">Vaqt tejash</div>
              </Card>
              <Card className="p-4 bg-purple-500/10">
                <div className="text-2xl font-bold text-purple-600 mb-1">100%</div>
                <div className="text-sm text-muted-foreground">Shaffoflik</div>
              </Card>
              <Card className="p-4 bg-orange-500/10">
                <div className="text-2xl font-bold text-orange-600 mb-1">50%</div>
                <div className="text-sm text-muted-foreground">Xodimlar kamayadi</div>
              </Card>
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground italic">
                To'liq 35 sahifali hujjat barcha bo'limlar, texnik spetsifikatsiyalar, API hujjatlari,
                xavfsizlik talablari, test strategiyasi va deployment plan bilan...
              </p>
            </div>
          </div>
        </Card>

        {/* Languages Section */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <Card className="p-6">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              🇺🇿 O'zbek Versiya
            </h4>
            <p className="text-muted-foreground text-sm mb-4">
              To'liq 35 sahifali texnik hujjat o'zbek tilida. Barcha bo'limlar, diagrammalar,
              jadvallar va spetsifikatsiyalar - client portal orqali ko'rish mumkin.
            </p>
          </Card>
          <Card className="p-6">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              🇬🇧 English Version
            </h4>
            <p className="text-muted-foreground text-sm mb-4">
              Complete 35-page technical document in English. All sections, diagrams,
              tables and specifications - available through client portal.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default SRS;
