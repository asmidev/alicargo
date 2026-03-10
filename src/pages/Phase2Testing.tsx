import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer, CheckCircle2, AlertCircle } from "lucide-react";

const Phase2Testing = () => {
  const testScenarios = [
    {
      module: "1. Authentication & Authorization",
      scenarios: [
        {
          id: "AUTH-001",
          title: "Manager Account Bootstrap",
          steps: [
            "Navigate to /auth page",
            "Verify signup form is accessible (bootstrap mode)",
            "Create first manager account with email/password",
            "Login with created credentials",
            "Verify redirect to /crm/dashboard"
          ],
          expected: "Manager successfully created and logged in",
          priority: "Critical"
        },
        {
          id: "AUTH-002",
          title: "Public Signup Disabled After Bootstrap",
          steps: [
            "Logout from manager account",
            "Try to access signup form",
            "Verify signup is disabled with appropriate message"
          ],
          expected: "Signup form should not be accessible",
          priority: "Critical"
        },
        {
          id: "AUTH-003",
          title: "Language Switcher",
          steps: [
            "On auth page, click language switcher",
            "Select Russian (Русский)",
            "Verify UI text changes to Russian",
            "Select English",
            "Verify UI text changes to English",
            "Select Uzbek (O'zbekcha)",
            "Verify UI returns to Uzbek"
          ],
          expected: "Language changes persist and update all UI text",
          priority: "High"
        }
      ]
    },
    {
      module: "2. User Management (Manager Only)",
      scenarios: [
        {
          id: "USER-001",
          title: "Create New User Accounts",
          steps: [
            "Login as manager",
            "Navigate to /crm/users",
            "Click 'Foydalanuvchi qo'shish' button",
            "Fill in user details (email, full name, phone)",
            "Select role from dropdown (test with different roles)",
            "Set temporary password",
            "Click save",
            "Verify user appears in users list"
          ],
          expected: "New user created successfully with assigned role",
          priority: "Critical"
        },
        {
          id: "USER-002",
          title: "Role Assignment Validation",
          steps: [
            "Create users with each of the 12 roles",
            "Verify each role appears correctly in user list",
            "Test role-based sidebar visibility for each role"
          ],
          expected: "Each role shows only permitted menu items",
          priority: "Critical"
        }
      ]
    },
    {
      module: "3. Products Management",
      scenarios: [
        {
          id: "PROD-001",
          title: "Create Product with Individual Items",
          steps: [
            "Navigate to /crm/products",
            "Click 'Mahsulot qo'shish' button",
            "Enter product name (e.g., 'iPhone 15 Pro')",
            "Enter category (e.g., 'Electronics')",
            "Enter quantity: 10",
            "Enter unit price: $5.00",
            "Add notes (optional)",
            "Click 'Saqlash'",
            "Verify product appears in list",
            "Expand product items view",
            "Verify 10 individual items created with unique UUIDs"
          ],
          expected: "Product created with 10 separate product_items, each with status 'pending' and location 'china'",
          priority: "Critical"
        },
        {
          id: "PROD-002",
          title: "Product Items Status Display",
          steps: [
            "View products list",
            "Check status breakdown for each product",
            "Verify color coding: green (available), yellow (in_transit), red (damaged)"
          ],
          expected: "Status counts and colors display correctly",
          priority: "High"
        },
        {
          id: "PROD-003",
          title: "Search and Filter Products",
          steps: [
            "Enter search term in search box",
            "Verify filtered results",
            "Test category filter dropdown",
            "Test status filter"
          ],
          expected: "Products filter correctly based on search criteria",
          priority: "Medium"
        }
      ]
    },
    {
      module: "4. Box Management & QR Generation",
      scenarios: [
        {
          id: "BOX-001",
          title: "Create Empty Box",
          steps: [
            "Navigate to /crm/boxes",
            "Click 'Quti qo'shish' button",
            "Enter box number (e.g., 'BOX-001')",
            "Select location: 'china'",
            "Select status: 'packing'",
            "Add notes (optional)",
            "Click save",
            "Verify box appears in list"
          ],
          expected: "Empty box created successfully",
          priority: "Critical"
        },
        {
          id: "BOX-002",
          title: "Pack Items into Box",
          steps: [
            "Find a box with status 'packing'",
            "Click 'Mahsulotlar qo'shish' button",
            "Search for product by name or UUID",
            "Select multiple available items (status: pending, location: china)",
            "Click 'Tanlangan mahsulotlarni qo'shish'",
            "Verify items added to box",
            "Verify item status changed to 'packed'",
            "Verify item box_id updated"
          ],
          expected: "Items successfully packed into box, statuses updated",
          priority: "Critical"
        },
        {
          id: "BOX-003",
          title: "Seal Box and Generate QR Code",
          steps: [
            "Click 'Yopish va QR yaratish' button on packed box",
            "Verify box status changes to 'sealed'",
            "Verify QR code generated and displayed",
            "Click 'QR Kodni Chop Etish' button",
            "Verify PDF opens with:",
            "  - AliBrand branding",
            "  - Box number",
            "  - QR code (scannable)",
            "  - List of all items in box with UUIDs",
            "  - Sealed date and time"
          ],
          expected: "Box sealed, QR generated, PDF printable and contains all box details",
          priority: "Critical"
        },
        {
          id: "BOX-004",
          title: "QR Code Data Integrity",
          steps: [
            "Generate QR code for box",
            "Use QR scanner app to scan printed QR",
            "Verify QR contains valid JSON data",
            "Verify JSON includes: box_id, box_number, items array with UUIDs, sealed_at"
          ],
          expected: "QR code contains complete box data in valid JSON format",
          priority: "Critical"
        }
      ]
    },
    {
      module: "5. Shipments & Excel Import",
      scenarios: [
        {
          id: "SHIP-001",
          title: "Create Shipment",
          steps: [
            "Navigate to /crm/shipments",
            "Click 'Jo'natma qo'shish' button",
            "Enter shipment number (e.g., 'SHIP-2025-001')",
            "Select carrier (e.g., 'AbuSaxiy')",
            "Enter tracking number",
            "Select departure date",
            "Select expected arrival date",
            "Add notes",
            "Click save"
          ],
          expected: "Shipment created successfully",
          priority: "Critical"
        },
        {
          id: "SHIP-002",
          title: "Excel Import - AbuSaxiy Format",
          steps: [
            "Navigate to /crm/shipments",
            "Click 'Excel Yuklash' button",
            "Upload Excel file with columns: box_number, status, location, tracking_number",
            "Verify progress bar shows during upload",
            "Verify success toast message",
            "Check shipment statuses updated",
            "Check box statuses updated to 'in_transit'",
            "Verify tracking events created"
          ],
          expected: "Excel data imported, statuses updated, tracking events logged",
          priority: "Critical"
        },
        {
          id: "SHIP-003",
          title: "Excel Import Error Handling",
          steps: [
            "Upload Excel with missing required columns",
            "Verify error message displayed",
            "Upload Excel with invalid box numbers",
            "Verify only valid rows processed",
            "Verify error summary shown"
          ],
          expected: "Errors caught and reported, valid data still processed",
          priority: "High"
        }
      ]
    },
    {
      module: "6. Tracking System",
      scenarios: [
        {
          id: "TRACK-001",
          title: "Track Product Lifecycle",
          steps: [
            "Navigate to /crm/tracking",
            "Search for product by UUID",
            "Verify timeline shows all events:",
            "  - Product created (pending, china)",
            "  - Packed into box",
            "  - Box sealed",
            "  - Shipment in transit",
            "  - Arrived in Uzbekistan",
            "Verify each event has timestamp and user"
          ],
          expected: "Complete product journey visible with all status changes",
          priority: "High"
        },
        {
          id: "TRACK-002",
          title: "Track Box Lifecycle",
          steps: [
            "Search for box by box_number or QR code",
            "Verify timeline shows:",
            "  - Box created",
            "  - Items added (with UUIDs)",
            "  - Box sealed",
            "  - Added to shipment",
            "  - In transit",
            "  - Arrived"
          ],
          expected: "Complete box journey with all contained items visible",
          priority: "High"
        }
      ]
    },
    {
      module: "7. Finance Module",
      scenarios: [
        {
          id: "FIN-001",
          title: "Record Finance Transaction",
          steps: [
            "Navigate to /crm/finance",
            "Click 'Tranzaksiya qo'shish' button",
            "Select transaction type: 'expense'",
            "Select category: 'product_purchase'",
            "Enter amount: 1000",
            "Select currency: USD",
            "Enter description",
            "Add reference ID (optional)",
            "Click save",
            "Verify transaction appears in list",
            "Verify dashboard totals updated"
          ],
          expected: "Transaction recorded, totals calculated correctly",
          priority: "High"
        },
        {
          id: "FIN-002",
          title: "Finance Dashboard Calculations",
          steps: [
            "Add multiple income transactions",
            "Add multiple expense transactions",
            "Verify Total Income card shows correct sum",
            "Verify Total Expenses card shows correct sum",
            "Verify Net Profit card shows (income - expenses)",
            "Test filtering by date range"
          ],
          expected: "All calculations accurate, filters work correctly",
          priority: "High"
        }
      ]
    },
    {
      module: "8. Role-Based Access Control (RBAC)",
      scenarios: [
        {
          id: "RBAC-001",
          title: "Rahbar (Owner) Access",
          steps: [
            "Login as Rahbar role",
            "Verify sidebar shows ONLY:",
            "  - Investor hisobotlari",
            "  - Moliyaviy analitika",
            "Try to access /crm/products directly via URL",
            "Verify redirect or access denied"
          ],
          expected: "Rahbar sees only finance and investor reports, cannot access other modules",
          priority: "Critical"
        },
        {
          id: "RBAC-002",
          title: "Bosh menejer (Chief Manager) Access",
          steps: [
            "Login as Bosh menejer",
            "Verify sidebar shows ALL modules",
            "Verify can access /crm/users",
            "Verify can create/edit/delete users",
            "Verify can change user roles"
          ],
          expected: "Chief Manager has full system access",
          priority: "Critical"
        },
        {
          id: "RBAC-003",
          title: "Xitoy ombor xodimi (China Warehouse Staff) Access",
          steps: [
            "Login as Xitoy ombor xodimi",
            "Verify sidebar shows:",
            "  - Dashboard",
            "  - Qutini qo'shish",
            "  - Mahsulotlar",
            "Navigate to boxes page",
            "Verify can only see today's boxes",
            "Verify can pack items",
            "Verify can print QR codes",
            "Verify CANNOT delete boxes",
            "Try to access /crm/finance directly",
            "Verify access denied"
          ],
          expected: "China warehouse staff has limited access, cannot delete or access finance",
          priority: "Critical"
        },
        {
          id: "RBAC-004",
          title: "Investor Access",
          steps: [
            "Login as Investor",
            "Verify sidebar shows ONLY 'My Investments'",
            "Verify can see own investment data",
            "Verify CANNOT see other investors' data",
            "Verify all data is read-only (no edit buttons)",
            "Try to access other modules via URL",
            "Verify access denied"
          ],
          expected: "Investor sees only own data, read-only access",
          priority: "Critical"
        }
      ]
    },
    {
      module: "9. PWA Features",
      scenarios: [
        {
          id: "PWA-001",
          title: "PWA Installation",
          steps: [
            "Open app in mobile browser (Chrome/Safari)",
            "Look for 'Add to Home Screen' prompt",
            "Install PWA",
            "Verify app icon appears on home screen",
            "Launch app from home screen",
            "Verify app opens in standalone mode (no browser UI)"
          ],
          expected: "App installable as PWA, runs in standalone mode",
          priority: "High"
        },
        {
          id: "PWA-002",
          title: "PWA Manifest Verification",
          steps: [
            "Open browser DevTools",
            "Go to Application tab",
            "Check Manifest section",
            "Verify:",
            "  - name: 'AliBrand CRM'",
            "  - theme_color matches app",
            "  - icons present (192x192, 512x512)",
            "  - start_url correct",
            "  - display: 'standalone'"
          ],
          expected: "PWA manifest properly configured",
          priority: "Medium"
        }
      ]
    },
    {
      module: "10. Real-Time Updates",
      scenarios: [
        {
          id: "REALTIME-001",
          title: "Real-Time Box Updates",
          steps: [
            "Open /crm/boxes in two browser windows",
            "Login as different users in each window",
            "In window 1: Create a new box",
            "In window 2: Verify new box appears automatically (no refresh)",
            "In window 1: Update box status",
            "In window 2: Verify status updates automatically"
          ],
          expected: "Changes sync in real-time across multiple sessions",
          priority: "Medium"
        },
        {
          id: "REALTIME-002",
          title: "Real-Time Product Items Updates",
          steps: [
            "Open /crm/products in two windows",
            "In window 1: Pack item into box",
            "In window 2: Verify item status updates to 'packed' automatically",
            "Verify product status breakdown updates"
          ],
          expected: "Product item changes reflect immediately",
          priority: "Medium"
        }
      ]
    },
    {
      module: "11. Performance & Loading States",
      scenarios: [
        {
          id: "PERF-001",
          title: "Loading Skeletons",
          steps: [
            "Clear browser cache",
            "Navigate to /crm/products",
            "Verify skeleton loaders display while data loads",
            "Navigate to /crm/boxes",
            "Verify skeleton loaders display",
            "Navigate to /crm/dashboard",
            "Verify dashboard cards show skeleton state"
          ],
          expected: "Skeleton loaders display during data fetch, smooth transition to real data",
          priority: "Medium"
        },
        {
          id: "PERF-002",
          title: "Excel Upload Progress",
          steps: [
            "Navigate to /crm/shipments",
            "Upload large Excel file (100+ rows)",
            "Verify progress bar displays",
            "Verify progress percentage updates",
            "Verify completion message"
          ],
          expected: "Progress bar shows upload/processing status",
          priority: "Medium"
        }
      ]
    },
    {
      module: "12. Database & RLS Policies",
      scenarios: [
        {
          id: "DB-001",
          title: "RLS Policy - Products",
          steps: [
            "Login as China warehouse staff",
            "Create a product",
            "Login as Uzbekistan staff",
            "Try to access same product",
            "Verify can see product (read-only)",
            "Try to edit product",
            "Verify edit not allowed"
          ],
          expected: "RLS policies enforce correct read/write permissions",
          priority: "Critical"
        },
        {
          id: "DB-002",
          title: "RLS Policy - Finance Transactions",
          steps: [
            "Login as non-finance user",
            "Try to access /crm/finance via URL",
            "Verify access denied",
            "Login as finance specialist",
            "Verify can access finance module",
            "Verify can create/view transactions"
          ],
          expected: "Only finance roles can access finance data",
          priority: "Critical"
        },
        {
          id: "DB-003",
          title: "RLS Policy - Investor Reports",
          steps: [
            "Create investor report for Investor A",
            "Login as Investor A",
            "Verify can see own report",
            "Login as Investor B",
            "Verify CANNOT see Investor A's report",
            "Login as Rahbar",
            "Verify can see all investor reports"
          ],
          expected: "Investors see only own data, Rahbar sees all",
          priority: "Critical"
        }
      ]
    }
  ];

  const acceptanceCriteria = [
    {
      category: "Authentication & Security",
      criteria: [
        "Manager can create first account via bootstrap",
        "Public signup disabled after bootstrap",
        "All 12 roles implemented and functional",
        "RLS policies enforced on all tables",
        "Session management working (auto-logout after inactivity)",
        "Password reset functionality working"
      ]
    },
    {
      category: "Core CRUD Operations",
      criteria: [
        "Products: Create, Read, Update, Delete (CRUD) working",
        "Individual product items created automatically",
        "Boxes: Create, Read, Update, Delete working",
        "Box packing dialog functional",
        "Shipments: Create, Read, Update working",
        "Finance transactions: Create, Read working",
        "Users: Create, Read, Update, Delete (Manager only)"
      ]
    },
    {
      category: "QR Code System",
      criteria: [
        "QR codes auto-generate when box sealed",
        "QR contains valid JSON with all box data",
        "QR codes scannable with standard scanners",
        "PDF export includes branding and all details",
        "QR codes print clearly on A4 format"
      ]
    },
    {
      category: "Excel Import",
      criteria: [
        "Excel files upload successfully",
        "Required columns validated",
        "Box statuses update from Excel data",
        "Tracking events created for each import",
        "Error handling for invalid data",
        "Import logs saved to database"
      ]
    },
    {
      category: "Tracking & Timeline",
      criteria: [
        "Product lifecycle tracked from creation to sale",
        "Box lifecycle tracked from creation to delivery",
        "All status changes logged with timestamps",
        "User who made change recorded",
        "Timeline displays chronologically",
        "Search by UUID/box number working"
      ]
    },
    {
      category: "UI/UX & Internationalization",
      criteria: [
        "Uzbek language is default",
        "Russian translation complete",
        "English translation complete",
        "Language persists after refresh",
        "Responsive design works on mobile/tablet/desktop",
        "Loading states display correctly",
        "Error messages user-friendly",
        "Gradient buttons styled consistently"
      ]
    },
    {
      category: "PWA Features",
      criteria: [
        "PWA installable on mobile devices",
        "App runs in standalone mode",
        "Manifest.json properly configured",
        "Icons display correctly",
        "Theme color applied",
        "Service worker registered (future offline support)"
      ]
    },
    {
      category: "Performance",
      criteria: [
        "Pages load within 2 seconds (3G network)",
        "No N+1 query issues",
        "Large Excel imports complete within 30 seconds",
        "Real-time updates work without lag",
        "Skeleton loaders display during data fetch",
        "No console errors or warnings"
      ]
    }
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
          PDF Yuklab Olish
        </Button>
      </div>

      {/* Cover Page */}
      <div className="min-h-screen flex flex-col items-center justify-center p-12 page-break-after">
        <div className="text-center max-w-4xl">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              AliBrand CRM
            </h1>
            <div className="h-1 w-32 bg-gradient-to-r from-primary to-secondary mx-auto mb-6"></div>
          </div>
          
          <h2 className="text-4xl font-bold mb-6 text-gray-800">
            2-Bosqich: Test Rejasi va Qabul Mezoni
          </h2>
          
          <p className="text-xl text-gray-600 mt-8">
            CRM Backend + RBAC Tizimini To'liq Test Qilish Uchun Batafsil Ko'rsatmalar
          </p>

          <div className="mt-12 grid grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="text-4xl font-bold text-primary mb-2">12</div>
              <div className="text-sm text-muted-foreground">Test Modullari</div>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-4xl font-bold text-primary mb-2">48</div>
              <div className="text-sm text-muted-foreground">Test Senariyalari</div>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-4xl font-bold text-primary mb-2">8</div>
              <div className="text-sm text-muted-foreground">Qabul Kategoriyalari</div>
            </Card>
          </div>

          <div className="mt-12 text-sm text-gray-600">
            <p>Professional Outsourcing Company</p>
            <p className="mt-2">Sanasi: Dekabr 2025</p>
            <p className="mt-2">Davomiyligi: 27 Noyabr - 6 Dekabr 2025 (10 kun)</p>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="min-h-screen p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-primary border-b-4 border-primary pb-4">
          Mundarija
        </h2>
        <div className="space-y-4 text-lg">
          <div className="flex justify-between border-b pb-2">
            <span>1. Test Rejasi Haqida</span>
            <span className="text-gray-600">3</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>2. Autentifikatsiya va Avtorizatsiya</span>
            <span className="text-gray-600">4</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>3. Foydalanuvchilar Boshqaruvi</span>
            <span className="text-gray-600">6</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>4. Mahsulotlar Moduli</span>
            <span className="text-gray-600">8</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>5. Qutlar va QR Kodlar</span>
            <span className="text-gray-600">10</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>6. Jo'natmalar va Excel Import</span>
            <span className="text-gray-600">13</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>7. Kuzatuv Tizimi</span>
            <span className="text-gray-600">15</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>8. Moliya Moduli</span>
            <span className="text-gray-600">17</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>9. Role-Based Access Control (RBAC)</span>
            <span className="text-gray-600">19</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>10. PWA Xususiyatlari</span>
            <span className="text-gray-600">22</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>11. Real-Time Yangilanishlar</span>
            <span className="text-gray-600">23</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>12. Database va RLS Siyosatlar</span>
            <span className="text-gray-600">24</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>13. Qabul Mezoni</span>
            <span className="text-gray-600">26</span>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-primary border-b-4 border-primary pb-4">
          1. Test Rejasi Haqida
        </h2>
        
        <div className="space-y-6 text-gray-700">
          <div>
            <h3 className="text-2xl font-bold mb-4 text-gray-800">Maqsad</h3>
            <p className="leading-relaxed">
              Ushbu test rejasi 2-Bosqich yetkazilib berilgan barcha funksiyalarni to'liq tekshirish uchun 
              batafsil ko'rsatmalar beradi. Har bir test senariysida aniq qadamlar, kutilayotgan natijalar va 
              ustuvorlik darajasi ko'rsatilgan.
            </p>
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-4 text-gray-800">Qamrov</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>12 ta modul: Autentifikatsiya, Foydalanuvchilar, Mahsulotlar, Qutlar, Jo'natmalar, Kuzatuv, Moliya, RBAC, PWA, Real-time, Performance, Database</li>
              <li>48 ta test senariysii: Har bir muhim funksiya uchun alohida test</li>
              <li>150+ ta individual qadam: Har bir senariysda batafsil qadamlar</li>
              <li>Ustuvorlik darajalari: Critical, High, Medium</li>
            </ul>
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-4 text-gray-800">Test Muhiti</h3>
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Frontend URL:</strong> https://[project-name].alibrand.app
                </div>
                <div>
                  <strong>Backend:</strong> AliBrand Cloud Backend
                </div>
                <div>
                  <strong>Brauzerlar:</strong> Chrome, Safari, Firefox
                </div>
                <div>
                  <strong>Qurilmalar:</strong> Desktop, Tablet, Mobile
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-yellow-800 mb-2">Muhim Eslatma</h4>
                <p className="text-sm text-yellow-700">
                  Barcha Critical ustuvorlikli testlar muvaffaqiyatli o'tishi shart. High va Medium 
                  ustuvorlikli testlarning aksariyati ham o'tishi kerak. Har qanday Critical test 
                  muvaffaqiyatsiz bo'lsa, 2-Bosqich qabul qilinmaydi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Scenarios */}
      {testScenarios.map((module, moduleIndex) => (
        <div key={moduleIndex} className="p-12 page-break-after">
          <h2 className="text-3xl font-bold mb-8 text-primary border-b-4 border-primary pb-4">
            {module.module}
          </h2>

          <div className="space-y-8">
            {module.scenarios.map((scenario, scenarioIndex) => (
              <div key={scenarioIndex} className="border-2 border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm font-bold bg-gray-100 px-3 py-1 rounded">
                        {scenario.id}
                      </span>
                      <span className={`text-xs font-bold px-3 py-1 rounded ${
                        scenario.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                        scenario.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {scenario.priority}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">{scenario.title}</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold mb-2 text-gray-700">Test Qadamlari:</h4>
                    <ol className="space-y-2">
                      {scenario.steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                            {stepIndex + 1}
                          </span>
                          <span className="text-sm text-gray-700 flex-1">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
                    <h4 className="font-bold text-green-800 text-sm mb-1">Kutilayotgan Natija:</h4>
                    <p className="text-sm text-green-700">{scenario.expected}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Acceptance Criteria */}
      <div className="p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-primary border-b-4 border-primary pb-4">
          13. Qabul Mezoni (Acceptance Criteria)
        </h2>

        <div className="mb-6">
          <p className="text-gray-700 leading-relaxed">
            2-Bosqich qabul qilinishi uchun quyidagi barcha mezonlar bajarilishi kerak. 
            Har bir kategoriyada keltirilgan funksiyalarning 100% ishlashi shart.
          </p>
        </div>

        <div className="space-y-6">
          {acceptanceCriteria.map((category, index) => (
            <div key={index} className="border-2 border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                {category.category}
              </h3>
              <ul className="space-y-2">
                {category.criteria.map((criterion, criterionIndex) => (
                  <li key={criterionIndex} className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Test Results Template */}
      <div className="p-12 page-break-after">
        <h2 className="text-4xl font-bold mb-8 text-primary border-b-4 border-primary pb-4">
          14. Test Natijalari Jadvali
        </h2>

        <div className="mb-6">
          <p className="text-gray-700 leading-relaxed mb-4">
            Quyidagi jadval test natijalarini qayd qilish uchun ishlatiladi. Har bir test 
            senariysidan keyin natijani belgilang.
          </p>
        </div>

        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-3 text-left">Test ID</th>
              <th className="border border-gray-300 p-3 text-left">Test Nomi</th>
              <th className="border border-gray-300 p-3 text-left">Ustuvorlik</th>
              <th className="border border-gray-300 p-3 text-center">Natija</th>
              <th className="border border-gray-300 p-3 text-left">Izohlar</th>
            </tr>
          </thead>
          <tbody>
            {testScenarios.flatMap(module => 
              module.scenarios.map((scenario, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3 font-mono text-xs">
                    {scenario.id}
                  </td>
                  <td className="border border-gray-300 p-3">
                    {scenario.title}
                  </td>
                  <td className="border border-gray-300 p-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      scenario.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                      scenario.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {scenario.priority}
                    </span>
                  </td>
                  <td className="border border-gray-300 p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-green-500 rounded"></div>
                      <div className="w-6 h-6 border-2 border-red-500 rounded"></div>
                    </div>
                  </td>
                  <td className="border border-gray-300 p-3">
                    <div className="h-8"></div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h4 className="font-bold mb-4">Test Yakunlash:</h4>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-700 mb-2"><strong>Tester Ismi:</strong></p>
              <div className="border-b-2 border-gray-300 h-8"></div>
            </div>
            <div>
              <p className="text-sm text-gray-700 mb-2"><strong>Sana:</strong></p>
              <div className="border-b-2 border-gray-300 h-8"></div>
            </div>
            <div>
              <p className="text-sm text-gray-700 mb-2"><strong>Imzo:</strong></p>
              <div className="border-b-2 border-gray-300 h-8"></div>
            </div>
            <div>
              <p className="text-sm text-gray-700 mb-2"><strong>Mijoz Tasdig'i:</strong></p>
              <div className="border-b-2 border-gray-300 h-8"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 print:hidden">
        <div className="container mx-auto px-6 text-center text-muted-foreground">
          <p>© 2025 Professional Outsourcing Company | AliBrand CRM - Phase 2 Testing Plan</p>
        </div>
      </footer>

      {/* Print Styles */}
      <style>{`
        @media print {
          .page-break-after {
            page-break-after: always;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

export default Phase2Testing;