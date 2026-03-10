import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MermaidDiagram from "@/components/MermaidDiagram";

const BPMN = () => {
  const diagrams = [
    {
      id: "purchase-decision",
      title: "1. Xarid Qarorlari va Xitoydan Buyurtma",
      description: "AliBrand rahbariyati mahsulot tanlash, xarid qarorlari va Xitoy sotuvchilariga buyurtma berish jarayoni",
      mermaid: `graph TB
    Start([AliBrand Rahbariyat: Bozor tahlili]) --> Decision{Mahsulot tanlash}
    Decision --> |AI tavsiya kelajak| ProductSelect[Mahsulot va miqdor aniqlash]
    ProductSelect --> CostCalc[Xarid narxi hisoblash]
    CostCalc --> BudgetCheck{Byudjet tasdiqi}
    BudgetCheck --> |Tasdiqlandi| OrderCreate[Buyurtma yaratish CRM]
    BudgetCheck --> |Rad etildi| Decision
    OrderCreate --> ChinaOrder[Xitoy sotuvchiga buyurtma]
    ChinaOrder --> PaymentSend[To'lov jo'natish]
    PaymentSend --> OrderConfirm[Sotuvchi tasdiq]
    OrderConfirm --> WaitDelivery[Xitoy omboriga yetkazish kutish]
    WaitDelivery --> End([Jo'natish tayyor])
    
    style Start fill:#4f46e5,color:#fff
    style End fill:#10b981,color:#fff
    style Decision fill:#f59e0b
    style BudgetCheck fill:#f59e0b`
    },
    {
      id: "china-packing",
      title: "2. Xitoy Ombori: Qadoqlash va Avtomatik QR Generatsiya",
      description: "Mahsulotlarni qabul qilish, qutilarga joylashtirish, avtomatik QR kod yaratish va 100% tekshiruv jarayoni",
      mermaid: `graph TB
    Start([Mahsulot Xitoy omborga keldi]) --> ReceiveCheck[Xodim: Mahsulot qabul]
    ReceiveCheck --> CountVerify{Miqdor tekshiruv}
    CountVerify --> |To'g'ri| CRMEntry[CRM ga kiritish]
    CountVerify --> |Xato| ReportIssue[Sotuvchiga ariza]
    ReportIssue --> ReceiveCheck
    CRMEntry --> QualityCheck[100% Sifat tekshiruv MUHIM!]
    QualityCheck --> |Nuqson bor| DefectMark[Brak belgilash]
    QualityCheck --> |Yaxshi| BoxPacking[Qutiga joylashtirish]
    DefectMark --> ReturnProcess[Sotuvchiga qaytarish]
    BoxPacking --> ProductList[Mahsulot ro'yxati tayyorlash]
    ProductList --> AutoQRGen[Sistema: Avtomatik QR generatsiya]
    AutoQRGen --> QRData{QR data: UUID, Products, Quantities}
    QRData --> PrintQR[QR chop etish]
    PrintQR --> AttachQR[QR ni qutiga yopish]
    AttachQR --> SealBox[Qutini muhrlab yopish]
    SealBox --> WarehouseStore[Omborga joylashtirish]
    WarehouseStore --> End([Jo'natishga tayyor])
    
    style Start fill:#4f46e5,color:#fff
    style End fill:#10b981,color:#fff
    style QualityCheck fill:#ef4444,color:#fff
    style AutoQRGen fill:#8b5cf6,color:#fff`
    },
    {
      id: "abusaxiy-excel",
      title: "3. AbuSaxiy Excel Import va Status Yangilash",
      description: "AbuSaxiy Telegram bot orqali Excel fayl import qilish va jo'natma statusini avtomatik yangilash",
      mermaid: `graph TB
    Start([AbuSaxiy: Jo'natma qabul]) --> TelegramBot[Telegram bot: Excel yuborish]
    TelegramBot --> FileReceive[Sistema: Excel fayl qabul]
    FileReceive --> ParseExcel{Excel parsing}
    ParseExcel --> |Muvaffaqiyatli| ExtractData[Ma'lumot olish: shipment, boxes, status]
    ParseExcel --> |Xato| ErrorLog[Xato log yozish]
    ErrorLog --> NotifyManager[Manager ga bildirishnoma]
    NotifyManager --> ManualReview[Qo'lda ko'rib chiqish]
    ExtractData --> MatchBoxes[QR/Box nomerlarni topish]
    MatchBoxes --> UpdateStatus[Status yangilash: In Transit]
    UpdateStatus --> LogImport[Import log saqlash]
    LogImport --> NotifyUz[O'zbekiston fililaiga bildirishnoma]
    NotifyUz --> RealTimeSync[Real-time dashboard yangilash]
    RealTimeSync --> End([Status yangilandi])
    
    style Start fill:#4f46e5,color:#fff
    style End fill:#10b981,color:#fff
    style ParseExcel fill:#f59e0b
    style UpdateStatus fill:#8b5cf6,color:#fff`
    },
    {
      id: "uzbekistan-arrival",
      title: "4. O'zbekistonda Qabul: QR Skan va Qo'lda Tekshiruv",
      description: "Quti kelganda QR skanlash, kutilgan contentni ko'rish va qo'lda miqdor/sifat tekshiruv",
      mermaid: `graph TB
    Start([Quti O'zbekistonga keldi]) --> ScanQR[Xodim: QR kodni skanlash]
    ScanQR --> ShowExpected[Sistema: Kutilgan contentni ko'rsatish]
    ShowExpected --> CheckList[Xodim: Qo'lda tekshiruv]
    CheckList --> QuantityCheck{Miqdor to'g'rimi?}
    QuantityCheck --> |Ha| QualityCheck{Sifat yaxshimi?}
    QuantityCheck --> |Yo'q| MarkMissing[Yetishmaydi belgilash]
    QualityCheck --> |Ha| ConfirmAll[Barchasini tasdiqlash]
    QualityCheck --> |Yo'q| MarkDefect[Brak belgilash + foto]
    MarkMissing --> DefectReport[Nuqson hisoboti yaratish]
    MarkDefect --> DefectReport
    DefectReport --> ClaimAbuSaxiy{AbuSaxiy ga da'vo}
    ConfirmAll --> UpdateArrived[Status: Arrived in Uzbekistan]
    ClaimAbuSaxiy --> UpdateArrived
    UpdateArrived --> InventoryAdd[Inventory ga qo'shish]
    InventoryAdd --> NotifyManager[Manager ga hisobot]
    NotifyManager --> End([Qabul yakunlandi])
    
    style Start fill:#4f46e5,color:#fff
    style End fill:#10b981,color:#fff
    style QuantityCheck fill:#f59e0b
    style QualityCheck fill:#f59e0b
    style MarkDefect fill:#ef4444,color:#fff`
    },
    {
      id: "marketplace-sync",
      title: "5. Marketplace API Integratsiya va Sinxronizatsiya",
      description: "Uzum, Yandex, Instagram, Telegram bilan real-time stok va buyurtmalar sinxronizatsiyasi",
      mermaid: `graph TB
    Start([Mahsulot inventory ga qo'shildi]) --> StockUpdate[Stock level o'zgardi]
    StockUpdate --> MPSync{Marketplace sinxronizatsiya}
    MPSync --> UzumAPI[Uzum API: stok yangilash]
    MPSync --> YandexAPI[Yandex Market API]
    MPSync --> InstagramAPI[Instagram Shop API]
    MPSync --> TelegramBot[Telegram Bot channel]
    
    UzumAPI --> CheckSuccess{API response}
    YandexAPI --> CheckSuccess
    InstagramAPI --> CheckSuccess
    TelegramBot --> CheckSuccess
    
    CheckSuccess --> |Success| LogSync[Sync log yozish]
    CheckSuccess --> |Failed| RetryQueue[Retry queue ga qo'yish]
    RetryQueue --> AlertManager[Manager ga ogohlantirish]
    
    LogSync --> ListenOrders[Buyurtmalar eshitish]
    ListenOrders --> OrderReceive{Yangi buyurtma}
    OrderReceive --> CreateOrder[CRM'da buyurtma yaratish]
    CreateOrder --> AllocateStock[Stokdan ajratish]
    AllocateStock --> UpdateMP[Marketplace'da yangilash]
    UpdateMP --> PrepareDelivery[Yetkazishga tayyorlash]
    PrepareDelivery --> End([Buyurtma tayyor])
    
    style Start fill:#4f46e5,color:#fff
    style End fill:#10b981,color:#fff
    style MPSync fill:#8b5cf6,color:#fff
    style OrderReceive fill:#f59e0b`
    },
    {
      id: "financial-tracking",
      title: "6. Moliyaviy Kuzatuv va Foyda Hisoblash",
      description: "Xarid, logistika, komissiya xarajatlari va foyda/zarar hisoblash jarayoni",
      mermaid: `graph TB
    Start([Mahsulot xarid]) --> ChinaCost[Xitoy narxi kiritish]
    ChinaCost --> ShippingCost[AbuSaxiy yetkazib berish]
    ShippingCost --> CustomsCost[Bojxona to'lovlar]
    CustomsCost --> TotalCost[Jami xarajat]
    
    TotalCost --> SalePrice[Sotuv narxi]
    SalePrice --> MPCommission[Marketplace komissiya]
    MPCommission --> Revenue[Toza daromad]
    
    Revenue --> ProfitCalc{Foyda/Zarar}
    ProfitCalc --> |Foyda| InvestorSplit[Investorlarga taqsimlash]
    ProfitCalc --> |Zarar| LossReport[Zarar hisoboti]
    
    InvestorSplit --> CalculateShare[Har bir investor ulushi]
    CalculateShare --> UpdateDividend[Dividend hisoblash]
    UpdateDividend --> PaymentSchedule[To'lov jadvali]
    PaymentSchedule --> InvestorNotify[Investor ga bildirishnoma]
    InvestorNotify --> End([Moliya yangilandi])
    
    style Start fill:#4f46e5,color:#fff
    style End fill:#10b981,color:#fff
    style ProfitCalc fill:#f59e0b
    style InvestorSplit fill:#8b5cf6,color:#fff`
    },
    {
      id: "investor-report",
      title: "7. Investor Dashboard: Cheklangan Shaxsiy Hisobotlar",
      description: "Investorlar faqat o'z moliyaviy ma'lumotlarini ko'rish - to'liq tizimga kirish yo'q",
      mermaid: `graph TB
    Start([Investor: Login]) --> AuthCheck{Rol tekshiruv}
    AuthCheck --> |investor| InvestorDash[Shaxsiy dashboard]
    AuthCheck --> |boshqa| AccessDenied[Kirish rad etildi]
    
    InvestorDash --> ViewInvestment[O'z investitsiyasini ko'rish]
    ViewInvestment --> ShareInfo[Ulush foizi ko'rsatish]
    ShareInfo --> ProfitLoss[Foyda/Zarar summary]
    ProfitLoss --> DividendHistory[Dividend tarixi]
    DividendHistory --> DownloadReport[PDF hisobot yuklab olish]
    
    InvestorDash --> |Boshqa ma'lumot| RestrictedAccess[Cheklanish: faqat o'z hisoboti]
    
    DownloadReport --> End([Hisobot yuklab olindi])
    AccessDenied --> End
    RestrictedAccess --> End
    
    style Start fill:#4f46e5,color:#fff
    style End fill:#10b981,color:#fff
    style RestrictedAccess fill:#ef4444,color:#fff
    style InvestorDash fill:#8b5cf6,color:#fff`
    },
    {
      id: "defect-handling",
      title: "8. Nuqson va Xatoliklar Boshqaruvi",
      description: "Shikastlangan/yo'qolgan mahsulotlarni aniqlash, ariza berish va qaytarish jarayoni",
      mermaid: `graph TB
    Start([Nuqson aniqlandi]) --> DefectType{Nuqson turi}
    DefectType --> |Xitoyda| ChinaDefect[Xitoy sifat xatosi]
    DefectType --> |Transitda| TransitDefect[Transport shikasti - AbuSaxiy]
    DefectType --> |O'zbekistonda| UzDefect[Qabul xatosi]
    
    ChinaDefect --> ChinaReturn[Xitoy sotuvchiga qaytarish]
    TransitDefect --> AbuSaxiyClaim[AbuSaxiy'ga da'vo]
    UzDefect --> InternalReview[Ichki tekshiruv]
    
    ChinaReturn --> RefundRequest[Pul qaytarish so'rash]
    AbuSaxiyClaim --> InsuranceClaim[Sug'urta da'vosi]
    InternalReview --> ResponsibleFind[Mas'ul topish]
    
    RefundRequest --> Compensation{Kompensatsiya}
    InsuranceClaim --> Compensation
    ResponsibleFind --> Compensation
    
    Compensation --> |To'liq| FullRefund[100% qaytarish]
    Compensation --> |Qisman| PartialRefund[Qisman kompensatsiya]
    Compensation --> |Rad| NoRefund[Kompensatsiya yo'q]
    
    FullRefund --> UpdateFinance[Moliya yangilash]
    PartialRefund --> UpdateFinance
    NoRefund --> LossRecord[Zarar yozish]
    
    UpdateFinance --> End([Hal qilindi])
    LossRecord --> End
    
    style Start fill:#ef4444,color:#fff
    style End fill:#10b981,color:#fff
    style DefectType fill:#f59e0b
    style Compensation fill:#8b5cf6,color:#fff`
    },
    {
      id: "ai-video-future",
      title: "9. AI Video Tekshiruv Sistema (Kelajak Bosqich 6+)",
      description: "Video orqali mahsulot shikastlanishi va yo'qolishini avtomatik aniqlash - AI vision",
      mermaid: `graph TB
    Start([Quti ochiladi]) --> VideoRecord[Video yozish]
    VideoRecord --> UploadVideo[Videoni tizimga yuklash]
    UploadVideo --> AIVision[AI Vision API: tahlil]
    
    AIVision --> DetectObjects[Mahsulotlarni aniqlash]
    DetectObjects --> CountItems[Miqdorni hisoblash]
    CountItems --> CompareExpected{Kutilgan bilan solishtirish}
    
    CompareExpected --> |To'liq| AllGood[Hammasi joyida]
    CompareExpected --> |Kam| Missing[Yetishmaydi aniqlash]
    CompareExpected --> |Ko'p| ExtraItems[Ortiqcha mavjud]
    
    Missing --> DefectDetect[Shikast aniqlash AI]
    ExtraItems --> LogDiscrepancy[Farqni log qilish]
    
    DefectDetect --> ConfidenceScore{AI ishonch darajasi}
    ConfidenceScore --> |>90%| AutoReport[Avtomatik hisobot yaratish]
    ConfidenceScore --> |<90%| HumanReview[Inson tekshiruvi kerak]
    
    AllGood --> AutoConfirm[Avtomatik tasdiqlash]
    AutoReport --> NotifyManager[Manager ga xabar]
    HumanReview --> ManualCheck[Qo'lda tekshiruv]
    
    AutoConfirm --> End([Qabul yakunlandi])
    NotifyManager --> End
    ManualCheck --> End
    LogDiscrepancy --> End
    
    style Start fill:#4f46e5,color:#fff
    style End fill:#10b981,color:#fff
    style AIVision fill:#8b5cf6,color:#fff
    style ConfidenceScore fill:#f59e0b`
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
                <h1 className="text-2xl font-bold">BPMN 2.0 Diagrammalari</h1>
                <p className="text-muted-foreground text-sm">9 ta professional biznes jarayon diagrammasi</p>
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-4">To'liq BPMN 2.0 Standart Diagrammalar</h2>
          <p className="text-muted-foreground text-lg mb-6">
            Har bir diagram to'g'ri ishchi oqimni ko'rsatadi, xatolik holatlari va qaror nuqtalari bilan.
            Barcha diagrammalar Mermaid.js formatida yaratilgan va SVG export mumkin.
          </p>
        </div>

        <div className="grid gap-8">
          {diagrams.map((diagram, index) => (
            <Card key={index} className="overflow-hidden hover:shadow-[var(--shadow-elegant)] transition-shadow">
              <div className="p-6 border-b bg-gradient-to-r from-primary/5 to-accent/5">
                <h3 className="text-xl font-bold mb-2">{diagram.title}</h3>
                <p className="text-muted-foreground">{diagram.description}</p>
              </div>
              
              {/* Mermaid Diagram */}
              <div className="p-6 bg-background">
                <div className="bg-card p-6 rounded-lg border">
                  <MermaidDiagram chart={diagram.mermaid} className="min-h-[200px]" />
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
                      Mermaid Code (kopiya qilish uchun)
                    </summary>
                    <pre className="mt-2 p-4 bg-muted/20 rounded text-xs overflow-x-auto">
                      <code>{diagram.mermaid}</code>
                    </pre>
                  </details>
                </div>
              </div>

              <div className="p-6 bg-muted/30">
                <Tabs defaultValue="uzbek" className="w-full">
                  <TabsList>
                    <TabsTrigger value="uzbek">O'zbek</TabsTrigger>
                    <TabsTrigger value="russian">Русский</TabsTrigger>
                    <TabsTrigger value="english">English</TabsTrigger>
                  </TabsList>
                  <TabsContent value="uzbek" className="mt-4">
                    <div className="prose prose-sm max-w-none">
                      <h4 className="font-semibold mb-2">Jarayon Tafsilotlari:</h4>
                      <ul className="space-y-2 text-muted-foreground">
                        <li>✓ Har bir bosqich aniq belgilangan</li>
                        <li>✓ Rol va mas'uliyatlar aniqlangan</li>
                        <li>✓ Avtomatlashtirish nuqtalari ko'rsatilgan</li>
                        <li>✓ Xatolik holatlarini boshqarish mexanizmlari</li>
                      </ul>
                    </div>
                  </TabsContent>
                  <TabsContent value="russian" className="mt-4">
                    <div className="prose prose-sm max-w-none">
                      <h4 className="font-semibold mb-2">Детали Процесса:</h4>
                      <ul className="space-y-2 text-muted-foreground">
                        <li>✓ Каждый этап четко определен</li>
                        <li>✓ Роли и обязанности определены</li>
                        <li>✓ Точки автоматизации показаны</li>
                        <li>✓ Механизмы обработки ошибок</li>
                      </ul>
                    </div>
                  </TabsContent>
                  <TabsContent value="english" className="mt-4">
                    <div className="prose prose-sm max-w-none">
                      <h4 className="font-semibold mb-2">Process Details:</h4>
                      <ul className="space-y-2 text-muted-foreground">
                        <li>✓ Each stage clearly defined</li>
                        <li>✓ Roles and responsibilities identified</li>
                        <li>✓ Automation points shown</li>
                        <li>✓ Error handling mechanisms</li>
                      </ul>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </Card>
          ))}
        </div>

      </section>
    </div>
  );
};

export default BPMN;