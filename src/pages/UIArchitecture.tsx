import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, MousePointer, Menu, Search, Plus, Edit, Trash, Save, X, Download, Upload, Eye, Check, AlertTriangle, QrCode, MapPin, Users, Settings, BarChart, DollarSign, Package } from "lucide-react";
import { Link } from "react-router-dom";

const UIArchitecture = () => {
  const screens = [
    {
      id: "dashboard",
      name: "Dashboard (Bosh sahifa)",
      route: "/dashboard",
      roles: ["Barcha rollar"],
      elements: [
        { type: "Header", name: "Navigation Bar", position: "Top", buttons: ["Logo (home ga o'tish)", "Role Badge (joriy rol)", "Language Switcher (uz/ru/en)", "User Profile Menu", "Logout"], functionality: "Global navigatsiya va tizimdan chiqish" },
        { type: "Sidebar", name: "Main Navigation", position: "Left", buttons: ["Dashboard", "Products", "Boxes", "Shipments", "Tracking", "Finance", "Reports", "Admin (faqat admin uchun)"], functionality: "Asosiy sahifalar bo'yicha navigatsiya, rol asosida ko'rinadi" },
        { type: "Card", name: "Statistics Cards", position: "Center Top", buttons: [], functionality: "Umumiy statistika: jami mahsulotlar, qutilarga solishda, jo'natilgan, sotilgan" },
        { type: "Chart", name: "Activity Chart", position: "Center", buttons: ["Filter by Date Range", "Export Chart"], functionality: "Oylik/haftalik faoliyat grafigi" },
        { type: "Table", name: "Recent Activities", position: "Bottom", buttons: ["View Details (har bir qator uchun)"], functionality: "Oxirgi 10 ta harakatlar ro'yxati" }
      ]
    },
    {
      id: "products",
      name: "Products (Mahsulotlar ro'yxati)",
      route: "/products",
      roles: ["Manager", "Bosh admin", "Xitoy filiali xodimi"],
      elements: [
        { type: "Header", name: "Page Title + Actions", position: "Top", buttons: ["+ Add Product", "Import Excel", "Export to Excel", "Filters Toggle"], functionality: "Yangi mahsulot qo'shish, import/export, filterlash" },
        { type: "Filter Bar", name: "Search & Filters", position: "Below Header", buttons: ["Search by Name/SKU", "Filter by Category", "Filter by Status", "Filter by Date", "Clear Filters"], functionality: "Mahsulotlarni qidirish va filterlash" },
        { type: "Table", name: "Products Data Table", position: "Center", buttons: ["Edit (har bir qator)", "Delete (har bir qator)", "View QR Code", "View History", "Checkbox (tanlab o'chirish uchun)", "Sort columns"], functionality: "Barcha mahsulotlar UUID, nomi, kategoriya, narx, holat bilan" },
        { type: "Pagination", name: "Page Controls", position: "Bottom", buttons: ["Previous", "Page Numbers", "Next", "Items per page dropdown"], functionality: "Sahifalash (10/25/50/100 per page)" },
        { type: "Modal", name: "Add/Edit Product Form", position: "Center (popup)", buttons: ["Save", "Cancel", "Upload Image", "Generate UUID (auto)", "Add to Box (dropdown)"], functionality: "Mahsulot yaratish/tahrirlash formasi" }
      ]
    },
    {
      id: "boxes",
      name: "Boxes (Qutilar boshqaruvi)",
      route: "/boxes",
      roles: ["Xitoy filiali xodimi", "Bosh admin"],
      elements: [
        { type: "Header", name: "Page Actions", position: "Top", buttons: ["+ Create New Box", "Print All QR Codes", "Filter Boxes"], functionality: "Yangi quti yaratish va QR kodlarni chop etish" },
        { type: "Grid", name: "Boxes Grid View", position: "Center", buttons: ["View Box Details (har bir karta)", "Print QR (har bir karta)", "Edit Box (har bir karta)", "Seal Box (quti tayyor bo'lsa)", "Delete Box"], functionality: "Barcha qutilar karta ko'rinishida, har birida QR kod va ichidagi mahsulotlar soni" },
        { type: "Card Detail", name: "Box Detail Modal", position: "Center (popup)", buttons: ["Add Product to Box", "Remove Product", "Print QR PDF", "Seal Box (finalize)", "Close"], functionality: "Quti tarkibi, mahsulotlar ro'yxati, QR kod generatsiyasi" },
        { type: "Form", name: "Create Box Form", position: "Right Sidebar", buttons: ["Save Box", "Cancel", "Auto-generate QR (on seal)", "Add Products (multi-select)"], functionality: "Yangi quti yaratish, mahsulot qo'shish, QR auto-generatsiya" },
        { type: "Alert", name: "Verification Checklist", position: "In Box Detail", buttons: ["Mark as Verified", "Report Issue"], functionality: "Xitoyda 100% tekshirish majburiy, quti seal qilishdan oldin" }
      ]
    },
    {
      id: "china-verification",
      name: "China Verification (Xitoy tekshiruvi)",
      route: "/china-verification",
      roles: ["Xitoy filiali xodimi"],
      elements: [
        { type: "Header", name: "Verification Dashboard", position: "Top", buttons: ["Start Verification", "View Pending Boxes"], functionality: "Tekshiruv boshlanishi" },
        { type: "Checklist", name: "Verification Steps", position: "Center", buttons: ["Check Quantity", "Check Quality", "Mark Defective Items", "Take Photos (optional)", "Confirm All Items OK", "Submit Verification"], functionality: "Har bir mahsulotni tekshirish, defektlarni belgilash" },
        { type: "Table", name: "Products in Box", position: "Center", buttons: ["✓ Verified", "✗ Defective", "📷 Add Photo", "Notes"], functionality: "Quti ichidagi mahsulotlar, har biri uchun holat belgilash" },
        { type: "Button Group", name: "Final Actions", position: "Bottom", buttons: ["Seal Box (barcha OK bo'lsa)", "Report Issues", "Return to Manager"], functionality: "Qutini yakunlash yoki muammolarni xabar qilish" },
        { type: "Alert", name: "Warning", position: "Top", buttons: [], functionality: "OGOHLANTIRISH: Defektli mahsulotlar jo'natilmasligi kerak!" }
      ]
    },
    {
      id: "shipments-excel",
      name: "Shipments & Excel Import (Jo'natmalar)",
      route: "/shipments",
      roles: ["Bosh admin", "Manager", "O'zbekiston filiali xodimi"],
      elements: [
        { type: "Header", name: "Shipments Header", position: "Top", buttons: ["Upload Excel (AbuSaxiy)", "View Telegram Bot Link", "Create Manual Shipment", "Filter Shipments"], functionality: "Excel import va qo'lda jo'natma yaratish" },
        { type: "Upload Zone", name: "Excel Import Area", position: "Center Top", buttons: ["Choose File", "Upload", "View Sample Excel", "Download Template"], functionality: "AbuSaxiy dan kelgan Excel faylni yuklash va parse qilish" },
        { type: "Preview", name: "Excel Preview Table", position: "Center", buttons: ["Confirm Import", "Edit Row", "Delete Row", "Cancel"], functionality: "Import qilishdan oldin Excel ma'lumotlarini ko'rish" },
        { type: "Table", name: "Shipments List", position: "Bottom", buttons: ["View Details", "Track Status", "Update Status", "View Contents (QR kodlar)"], functionality: "Barcha jo'natmalar ro'yxati, holat bilan (In Transit, Arrived, etc.)" },
        { type: "Timeline", name: "Shipment Details", position: "Right Panel", buttons: ["Update Status", "Add Note", "View Box QR Codes", "Mark as Arrived"], functionality: "Jo'natma tarixini ko'rish, holatni yangilash" }
      ]
    },
    {
      id: "uzbekistan-arrival",
      name: "Uzbekistan Arrival Confirmation (Yetib kelishni tasdiqlash)",
      route: "/uzbekistan-arrival",
      roles: ["O'zbekiston filiali xodimi"],
      elements: [
        { type: "Header", name: "Scan QR Section", position: "Top", buttons: ["Open QR Scanner", "Manual Entry (UUID)", "View Pending Arrivals"], functionality: "QR kod skanerlash yoki UUID kiritish" },
        { type: "Scanner", name: "QR Code Scanner", position: "Center", buttons: ["Start Camera", "Switch Camera", "Manual UUID Input"], functionality: "QR kod skanerlash (mobil kamera orqali)" },
        { type: "Card", name: "Expected Contents Display", position: "Center", buttons: ["Confirm All Items", "Report Missing Items", "Report Damaged Items", "Add Photos"], functionality: "QR scan qilgandan keyin kutilgan mahsulotlar ro'yxati" },
        { type: "Checklist", name: "Manual Verification", position: "Center", buttons: ["✓ Item OK", "⚠ Missing (Yetishmayapti)", "✗ Damaged (Brak)", "Add Note"], functionality: "Har bir mahsulotni qo'lda tekshirish va belgilash" },
        { type: "Button Group", name: "Final Confirmation", position: "Bottom", buttons: ["Mark as Arrived (barcha OK)", "Report Issues (muammolar bilan)", "Cancel"], functionality: "Yetib kelishni tasdiqlash yoki muammolarni xabar qilish" }
      ]
    },
    {
      id: "tracking",
      name: "Tracking (Kuzatuv tizimi)",
      route: "/tracking",
      roles: ["Barcha rollar"],
      elements: [
        { type: "Header", name: "Tracking Search", position: "Top", buttons: ["Search by UUID", "Search by QR", "Filter by Status", "Filter by Date Range"], functionality: "UUID yoki QR kod orqali qidirish" },
        { type: "Search Bar", name: "UUID/QR Input", position: "Top Center", buttons: ["Search", "Scan QR", "Clear"], functionality: "Tezkor qidiruv" },
        { type: "Timeline", name: "Product Journey Timeline", position: "Center", buttons: ["View Location", "View Photos", "Export Timeline", "Share Link"], functionality: "Mahsulot yoki qutining to'liq sayohati: Xitoyda qo'shildi → Qutiga solindi → Xitoyda tasdiqlandi → Jo'natildi → O'zbekistonda qabul qilindi → Marketplacega yuklandi → Sotildi" },
        { type: "Map", name: "Location Map (optional)", position: "Right Panel", buttons: ["Zoom In", "Zoom Out", "Refresh Location"], functionality: "Jo'natma joylashuvini xaritada ko'rsatish (AbuSaxiy orqali)" },
        { type: "Card", name: "Current Status Card", position: "Top Right", buttons: [], functionality: "Joriy holat rangli badge bilan: Packing, In Transit, Arrived, Sold" }
      ]
    },
    {
      id: "marketplace-sync",
      name: "Marketplace Sync (Marketplace integratsiyasi)",
      route: "/marketplace-sync",
      roles: ["Manager", "Bosh admin"],
      elements: [
        { type: "Header", name: "Marketplace Controls", position: "Top", buttons: ["+ Add Marketplace", "Sync All", "Configure API Keys", "View Sync Logs"], functionality: "Yangi marketplace qo'shish va sozlash" },
        { type: "Cards Grid", name: "Marketplace Cards", position: "Center", buttons: ["Sync Now (har bir marketplace)", "Configure (har bir marketplace)", "View Stats (har bir marketplace)", "Disconnect"], functionality: "Uzum, Yandex, Instagram, Telegram uchun alohida kartalar" },
        { type: "Table", name: "Sync History", position: "Bottom", buttons: ["Retry Failed", "View Details", "Export Log"], functionality: "Sync tarixini ko'rish, muvaffaqiyatli/muvaffaqiyatsiz" },
        { type: "Form", name: "API Configuration Modal", position: "Center (popup)", buttons: ["Save API Keys", "Test Connection", "Cancel"], functionality: "Har bir marketplace uchun API kalitlarni kiritish" },
        { type: "Toggle", name: "Auto-Sync Switch", position: "Top Right", buttons: ["Enable/Disable Auto-Sync"], functionality: "Avtomatik sinxronizatsiyani yoqish/o'chirish" }
      ]
    },
    {
      id: "finance",
      name: "Finance Dashboard (Moliya boshqaruvi)",
      route: "/finance",
      roles: ["Moliya xodimi", "Rahbar", "Bosh admin"],
      elements: [
        { type: "Header", name: "Finance Overview", position: "Top", buttons: ["Add Transaction", "Generate Report", "Export to Excel", "Filter by Date"], functionality: "Tranzaksiya qo'shish va hisobot generatsiya" },
        { type: "Cards", name: "Financial Summary Cards", position: "Top Center", buttons: [], functionality: "Jami xarajat, jami daromad, foyda, qarzdorlik" },
        { type: "Chart", name: "Revenue vs Expenses Chart", position: "Center", buttons: ["Switch to Bar Chart", "Switch to Pie Chart", "Export Chart"], functionality: "Daromad va xarajat grafigi" },
        { type: "Table", name: "Transactions Table", position: "Bottom", buttons: ["View Details", "Edit", "Delete", "Filter by Type", "Sort by Date"], functionality: "Barcha moliyaviy tranzaksiyalar ro'yxati" },
        { type: "Form", name: "Add Transaction Modal", position: "Center (popup)", buttons: ["Save", "Cancel", "Add Attachment", "Select Category", "Select Payment Method"], functionality: "Yangi tranzaksiya qo'shish (xarajat yoki daromad)" }
      ]
    },
    {
      id: "investor-reports",
      name: "Investor Reports (Investor hisobotlari)",
      route: "/investor-reports",
      roles: ["Investor (read-only)"],
      elements: [
        { type: "Header", name: "Investor Dashboard", position: "Top", buttons: ["Download PDF Report", "Filter by Date Range"], functionality: "Investor hisobotlarini ko'rish (faqat o'qish)" },
        { type: "Cards", name: "ROI Summary Cards", position: "Top Center", buttons: [], functionality: "Investitsiya summasi, daromad, ROI foizi" },
        { type: "Chart", name: "Investment Performance Chart", position: "Center", buttons: ["Switch to Monthly View", "Switch to Quarterly View", "Export Chart"], functionality: "Investitsiya samaradorligi grafigi" },
        { type: "Table", name: "Investment Details Table", position: "Bottom", buttons: ["View Details (read-only)"], functionality: "Faqat o'z investitsiyalari haqida ma'lumot (boshqa investorlarni ko'ra olmaydi)" },
        { type: "Alert", name: "Read-Only Notice", position: "Top", buttons: [], functionality: "ESLATMA: Faqat ko'rish rejimi, o'zgartira olmaysiz" }
      ]
    },
    {
      id: "admin-roles",
      name: "Admin: Roles & Permissions (Rollar va ruxsatlar)",
      route: "/admin/roles",
      roles: ["Bosh admin"],
      elements: [
        { type: "Header", name: "Admin Panel Header", position: "Top", buttons: ["+ Add User", "Edit Roles", "View Audit Log"], functionality: "Yangi foydalanuvchi qo'shish va rollarni tahrirlash" },
        { type: "Table", name: "Users & Roles Table", position: "Center", buttons: ["Edit User", "Change Role", "Deactivate User", "View Permissions", "Reset Password"], functionality: "Barcha foydalanuvchilar va ularning rollari" },
        { type: "Matrix", name: "Permissions Matrix", position: "Bottom", buttons: ["Edit Permission", "Save Changes", "Reset to Default"], functionality: "12 rol uchun ruxsatlar matritsasi (CRUD + custom permissions)" },
        { type: "Modal", name: "Edit User Modal", position: "Center (popup)", buttons: ["Save", "Cancel", "Assign Role (dropdown)", "Set Permissions"], functionality: "Foydalanuvchi rolini o'zgartirish va ruxsatlarni sozlash" },
        { type: "Tabs", name: "Admin Sections", position: "Top", buttons: ["Users", "Roles", "Permissions", "Audit Log", "System Settings"], functionality: "Admin panel bo'limlari" }
      ]
    },
    {
      id: "error-handling",
      name: "Error Handling & Claims (Xatoliklar va da'volar)",
      route: "/error-claims",
      roles: ["Manager", "Bosh admin", "O'zbekiston filiali xodimi"],
      elements: [
        { type: "Header", name: "Claims Header", position: "Top", buttons: ["+ New Claim", "Filter by Status", "Export Claims"], functionality: "Yangi da'vo yaratish (AbuSaxiy uchun)" },
        { type: "Table", name: "Claims List", position: "Center", buttons: ["View Details", "Edit", "Close Claim", "Contact AbuSaxiy", "Add Evidence"], functionality: "Barcha da'volar ro'yxati (damaged in transit)" },
        { type: "Form", name: "Create Claim Modal", position: "Center (popup)", buttons: ["Submit Claim", "Upload Photos", "Describe Issue", "Add Products", "Cancel"], functionality: "Da'vo shakli: shikastlangan mahsulot, jo'natma ID, rasmlar" },
        { type: "Timeline", name: "Claim Status Timeline", position: "Right Panel", buttons: ["Add Note", "Update Status"], functionality: "Da'vo holati: Submitted → Under Review → Resolved/Rejected" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Ortga
              </Button>
            </Link>
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold">UI Architecture Design</h1>
              <p className="text-sm text-muted-foreground">Har bir tugma va funksiyaning batafsil rejalashtirilishi</p>
            </div>
            <div className="w-24"></div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 py-12">
        {/* Introduction */}
        <Card className="p-8 mb-12 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5">
          <div className="flex items-start gap-6">
            <div className="p-4 bg-primary/10 rounded-xl">
              <MousePointer className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-4">Architecture Design Overview</h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-4">
                Bu hujjatda AliBrand CRM tizimining har bir sahifasi, har bir tugma, va har bir funksiyaning 
                aniq joylashuvi va vazifasi batafsil ko'rsatilgan. Har bir element qaysi rol uchun ko'rinishi 
                va qanday ishlashi aniq belgilangan.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="p-4 bg-card rounded-lg border">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Menu className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">12 Sahifa</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">To'liq tizim uchun 12 asosiy ekran</p>
                </div>
                <div className="p-4 bg-card rounded-lg border">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <MousePointer className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="font-semibold">50+ Element</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Tugmalar, formalar, jadvallar, chartlar</p>
                </div>
                <div className="p-4 bg-card rounded-lg border">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Users className="h-5 w-5 text-green-600" />
                    </div>
                    <h3 className="font-semibold">12 Rol</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Har bir rol uchun maxsus interfeys</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Screens Accordion */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-6">Sahifalar va Elementlar</h2>
          <Accordion type="single" collapsible className="space-y-4">
            {screens.map((screen, index) => (
              <AccordionItem key={screen.id} value={screen.id} className="border rounded-lg px-6 bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold">{screen.name}</h3>
                        <p className="text-sm text-muted-foreground">Route: {screen.route}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-3 py-1 bg-accent/10 text-accent rounded-full font-semibold">
                        {screen.elements.length} elementlar
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-6 space-y-6">
                    {/* Roles */}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Foydalana oladigan rollar:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {screen.roles.map((role, idx) => (
                          <span key={idx} className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Elements */}
                    <div className="space-y-4">
                      {screen.elements.map((element, idx) => (
                        <Card key={idx} className="p-6 border-l-4 border-l-primary">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-bold text-lg mb-1">{element.name}</h4>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {element.position}
                                  </span>
                                  <span className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                                    {element.type}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Buttons */}
                            {element.buttons.length > 0 && (
                              <div>
                                <h5 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                  <MousePointer className="h-4 w-4" />
                                  Tugmalar va harakatlar:
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                  {element.buttons.map((button, btnIdx) => (
                                    <span
                                      key={btnIdx}
                                      className="px-3 py-1.5 bg-accent/10 text-accent text-xs rounded-md font-medium border border-accent/20"
                                    >
                                      {button}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Functionality */}
                            <div className="p-4 bg-muted/50 rounded-lg">
                              <h5 className="text-sm font-semibold mb-2">📋 Funksiyasi:</h5>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {element.functionality}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Global UI Elements */}
        <Card className="p-8 mt-12 bg-gradient-to-br from-accent/5 to-primary/5">
          <h2 className="text-2xl font-bold mb-6">Global UI Elementlari (Barcha sahifalarda)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-card rounded-lg border">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Menu className="h-5 w-5 text-primary" />
                Navigation Bar (Header)
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Logo (home ga o'tish)</li>
                <li>• Role Badge (joriy foydalanuvchi roli)</li>
                <li>• Language Switcher (🇺🇿 O'zbek / 🇷🇺 Русский / 🇬🇧 English)</li>
                <li>• Notifications Bell (yangi xabarlar)</li>
                <li>• User Profile Dropdown (Profil, Sozlamalar, Chiqish)</li>
              </ul>
            </div>
            <div className="p-6 bg-card rounded-lg border">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Sidebar Navigation
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Dashboard (Home icon)</li>
                <li>• Products (Package icon)</li>
                <li>• Boxes (QrCode icon)</li>
                <li>• Shipments (Upload icon)</li>
                <li>• Tracking (MapPin icon)</li>
                <li>• Finance (DollarSign icon)</li>
                <li>• Reports (BarChart icon)</li>
                <li>• Admin (faqat admin uchun, Settings icon)</li>
              </ul>
            </div>
            <div className="p-6 bg-card rounded-lg border">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Toast Notifications
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Success (yashil): "Muvaffaqiyatli saqlandi"</li>
                <li>• Error (qizil): "Xatolik yuz berdi"</li>
                <li>• Warning (sariq): "Ogohlantiruv: tekshiruv kerak"</li>
                <li>• Info (ko'k): "Yangi jo'natma yetib keldi"</li>
              </ul>
            </div>
            <div className="p-6 bg-card rounded-lg border">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                Status Badges (Holat ko'rsatkichlari)
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Packing (ko'k): Xitoyda qadoqlanmoqda</li>
                <li>• In Transit (sariq): Yo'lda</li>
                <li>• Arrived (yashil): Yetib keldi</li>
                <li>• Sold (to'q yashil): Sotildi</li>
                <li>• Missing (qizil): Yetishmayapti</li>
                <li>• Damaged (qizil): Brak</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Key Interactions Summary */}
        <Card className="p-8 mt-12">
          <h2 className="text-2xl font-bold mb-6">Asosiy Interaksiyalar</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Create Actions</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2 ml-11">
                <li>• Mahsulot yaratish → Modal form → Save → UUID auto-gen</li>
                <li>• Quti yaratish → Sidebar form → Add products → Seal → QR auto-gen</li>
                <li>• Jo'natma yaratish → Excel upload → Preview → Confirm</li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Edit className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-semibold">Edit Actions</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2 ml-11">
                <li>• Edit button → Modal with pre-filled data → Save → Update</li>
                <li>• Inline editing (double-click on cell) → Auto-save</li>
                <li>• Bulk edit (checkbox select) → Actions menu → Apply</li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <Trash className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="font-semibold">Delete Actions</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2 ml-11">
                <li>• Delete button → Confirmation dialog → "Ha, o'chirish" → Delete</li>
                <li>• Bulk delete (checkbox select) → Delete button → Confirm</li>
                <li>• Soft delete (arxivlash, to'liq o'chirmaslik)</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-6 text-center text-muted-foreground">
          <p>© 2025 AliBrand CRM Platform | UI Architecture Design Document</p>
        </div>
      </footer>
    </div>
  );
};

export default UIArchitecture;