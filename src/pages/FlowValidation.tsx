import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from "docx";
import { saveAs } from "file-saver";

export default function FlowValidation() {
  const { t } = useTranslation();

  const handleDownloadWord = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Cover Page
          new Paragraph({
            text: "AliBrand CRM",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: "Ish Jarayoni Tekshirish Hujjati",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Workflow Validation Document",
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: "Faza 2 - Ish Jarayonlarini Baholash",
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "Phase 2 - Workflow Evaluation",
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: "Versiya 1.0 | 2025",
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 },
          }),

          // Table of Contents
          new Paragraph({
            text: "Mundarija / Table of Contents",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({ text: "1. Kirish / Introduction" }),
          new Paragraph({ text: "2. Xarid Qarorlari va Buyurtma Jarayoni" }),
          new Paragraph({ text: "3. Xitoyda Qadoqlash va QR Generatsiya" }),
          new Paragraph({ text: "4. AbuSaxiy Excel Import Jarayoni" }),
          new Paragraph({ text: "5. O'zbekistonda QR Skan va Tasdiqlash" }),
          new Paragraph({ text: "6. Marketplace Sinxronlash va Sotish" }),
          new Paragraph({ text: "7. Moliya va Ko'p To'lov Tizimi" }),
          new Paragraph({ text: "8. Investor Hisobotlari" }),
          new Paragraph({ text: "9. End-to-End Tracking (UUID/QR)" }),
          new Paragraph({ text: "10. Xatoliklarni Boshqarish" }),
          new Paragraph({ text: "11. Umumiy Baholash va Xulosalar", spacing: { after: 400 } }),

          // Introduction
          new Paragraph({
            text: "1. Kirish / Introduction",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "Maqsad / Purpose",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            text: "Ushbu hujjat AliBrand CRM tizimining barcha ish jarayonlarini (BPMN diagrammalari) tekshirish va baholash uchun mo'ljallangan. Har bir jarayon qadamlari to'g'ri tartibda joylashganmi, keraksiz yoki kamlik bosqichlar bormi, yoki jarayonni yaxshilash zarurmi - bularni aniqlash uchun foydalaniladi.",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "This document is designed to validate and evaluate all AliBrand CRM workflows (BPMN diagrams). It helps identify whether process steps are in correct order, if there are unnecessary or missing steps, and if process improvements are needed.",
                italics: true,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: "Qanday Foydalanish / How to Use",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({ text: "✓ Har bir jarayon bo'limi uchun savollarga javob bering" }),
          new Paragraph({ text: "✓ 'Ha' / 'Yo'q' / 'Qisman' variantlarini belgilang" }),
          new Paragraph({ text: "✓ Izohlar bo'limida o'zgartirishlar taklif qiling" }),
          new Paragraph({ text: "✓ Umumiy baholash bo'limida xulosalar chiqaring", spacing: { after: 400 } }),

          // Workflow Sections
          ...createWorkflowSection(
            "2. Xarid Qarorlari va Buyurtma Jarayoni",
            "Purchase Decision & Ordering Process",
            [
              "Manager mahsulot xarid qilish qarorini qabul qilish jarayoni to'g'ri tartibdami?",
              "Xitoy sotuvchiga buyurtma yuborish mexanizmi aniqmi?",
              "Mahsulot UUID generatsiyasi va tizimga qo'shilishi mantiqan to'g'ri joylashtirilganmi?",
              "AI tavsiyalari (Faza 6+) uchun joy qoldirilganmi?"
            ]
          ),

          ...createWorkflowSection(
            "3. Xitoyda Qadoqlash va QR Generatsiya",
            "China Packing + QR Generation + Verification",
            [
              "Mahsulotlar Xitoy omboriga kelishi va qadoqlashga tayyorgarlik jarayoni aniqmi?",
              "Box yaratish va mahsulotlarni qo'shish mexanizmi to'g'ri ishlayaptimi?",
              "100% tekshirish majburiyati (nuqsonli mahsulotlar Xitoydan chiqmasligi) to'g'ri ko'rsatilganmi?",
              "QR kod avtomatik generatsiyasi va to'liq ma'lumot (mahsulot turlari, miqdor, UUID) saqlanishi aniqmi?",
              "QR kodni chop etish va yopish jarayoni mantiqan tugallangan holatdami?"
            ]
          ),

          ...createWorkflowSection(
            "4. AbuSaxiy Excel Import Jarayoni",
            "AbuSaxiy Excel Import via Telegram Bot",
            [
              "AbuSaxiy Telegram bot orqali Excel fayl yuborish jarayoni aniqmi?",
              "Tizim Excel faylni parsing qilish va mahsulotlarni aniqlash mexanizmi mantiqan to'g'rimi?",
              "Shipment statusini avtomatik yangilash ('In Transit', 'Arrived') jarayoni aniqmi?",
              "Xatolik hollari (noto'g'ri format, UUID mos kelmasa) to'g'ri ko'rib chiqiladimi?"
            ]
          ),

          ...createWorkflowSection(
            "5. O'zbekistonda QR Skan va Tasdiqlash",
            "Uzbekistan QR Scan + Manual Confirmation",
            [
              "QR skanlash jarayoni oddiy va tushunarli ko'rsatilganmi?",
              "Tizim kutilayotgan mahsulotlar ro'yxatini to'g'ri ko'rsatadimi?",
              "Xodim qo'lda miqdor va sifatni tekshirish imkoniyati aniqmi?",
              "Brak yoki yetishmayotgan mahsulotlarni belgilash mexanizmi to'g'rimi?",
              "Status avtomatik 'Arrived in Uzbekistan' ga o'zgarishi mantiqan to'g'ri joylashtirilganmi?"
            ]
          ),

          ...createWorkflowSection(
            "6. Marketplace Sinxronlash va Sotish",
            "Marketplace Sync & Sales",
            [
              "Marketplace API'lari bilan integratsiya (Uzum, Yandex, Instagram/Telegram) aniq ko'rsatilganmi?",
              "Mahsulotlarni avtomatik sinxronlash jarayoni mantiqan to'g'rimi?",
              "Status faqat yetkazib berilgandan keyin 'Sold' ga o'zgarishi to'g'ri ko'rsatilganmi?",
              "Zaxira darajasini kuzatish mexanizmi aniqmi?"
            ]
          ),

          ...createWorkflowSection(
            "7. Moliya va Ko'p To'lov Tizimi",
            "Finance & Multi-Payment",
            [
              "Xarajatlar va daromadlarni kuzatish jarayoni aniqmi?",
              "Ko'p to'lov variantlari (naqd, plastik, bank o'tkazmasi) to'g'ri ko'rsatilganmi?",
              "Foyda va zarar hisob-kitoblari mantiqan to'g'rimi?",
              "Investorlar uchun hisobotlar yaratish mexanizmi aniqmi?"
            ]
          ),

          ...createWorkflowSection(
            "8. Investor Hisobotlari",
            "Investor Reporting",
            [
              "Investor faqat o'z moliyaviy hisobotlarini ko'ra olishi to'g'ri ko'rsatilganmi?",
              "Hisobotlarda foyda, zarar, dividendlar aniq aks ettirilganmi?",
              "Read-only kirish cheklovi to'g'ri ko'rsatilganmi?",
              "PDF export funktsiyasi mavjudmi?"
            ]
          ),

          ...createWorkflowSection(
            "9. End-to-End Tracking (UUID/QR)",
            "End-to-End Tracking",
            [
              "Har bir mahsulot va box uchun UUID/QR unikal identifikatorlari mavjudmi?",
              "Tracking timeline barcha bosqichlarni (Xitoy → Transit → O'zbekiston → Sotildi) ko'rsatadimi?",
              "Real-time yangilanishlar to'g'ri ishlayaptimi?",
              "Rahbar uchun to'liq shaffoflik ta'minlanganmi?"
            ]
          ),

          ...createWorkflowSection(
            "10. Xatoliklarni Boshqarish",
            "Error Handling",
            [
              "Transportda shikastlangan mahsulotlar uchun da'vo jarayoni aniqmi?",
              "AbuSaxiy mas'uliyati to'g'ri ko'rsatilganmi?",
              "Xatolik hollari (noto'g'ri UUID, QR skan xatosi) to'g'ri ko'rib chiqiladimi?",
              "Log va audit trail mavjudmi?"
            ]
          ),

          // Overall Evaluation
          new Paragraph({
            text: "11. Umumiy Baholash va Xulosalar",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "Umumiy Baholash Savollari",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({ text: "☐ Barcha jarayonlar mantiqan to'g'ri va ketma-ket joylashtirilganmi?" }),
          new Paragraph({ text: "☐ Keraksiz yoki takrorlanuvchi qadamlar bormi?" }),
          new Paragraph({ text: "☐ Qaysidir muhim bosqichlar tushib qolganmi?" }),
          new Paragraph({ text: "☐ 12 ta rol (Rahbar, Bosh admin, Xitoy filiali xodimi, etc.) uchun jarayonlar aniq ajratilganmi?" }),
          new Paragraph({ text: "☐ AI tavsiyalari va video aniqlash (Faza 5-6) uchun o'rin qoldirilganmi?" }),
          new Paragraph({ text: "☐ Xavfsizlik va ruxsatlar (RLS policies) to'g'ri ko'rsatilganmi?", spacing: { after: 400 } }),

          new Paragraph({
            text: "Yakuniy Xulosa va Tasdiq / Final Conclusion & Approval",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            text: "[Bu yerga umumiy xulosangizni yozing: Barcha jarayonlar tasdiqlangan yoki o'zgartirishlar kerak]",
            spacing: { after: 200 },
          }),
          new Paragraph({ text: "________________________________", spacing: { before: 400 } }),
          new Paragraph({ text: "Tasdiqlagan / Approved by: _______________________" }),
          new Paragraph({ text: "Sana / Date: _______________________" }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "AliBrand_Flow_Validation.docx");
  };

  function createWorkflowSection(title: string, subtitle: string, questions: string[]) {
    return [
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: subtitle,
            italics: true,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: "Jarayon Qadamlari Tekshiruvi",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
      ...questions.map((q, idx) => 
        new Paragraph({
          text: `${idx + 1}. ${q}`,
          spacing: { after: 100 },
          bullet: { level: 0 },
        })
      ),
      new Paragraph({
        text: "☐ Ha  ☐ Yo'q  ☐ Qisman",
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: "Izohlar va Takliflar:",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      }),
      new Paragraph({
        text: "[Bu yerga izohlaringizni yozing]",
        spacing: { after: 400 },
      }),
    ];
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Download Button */}
      <div className="fixed top-4 right-4 z-50">
        <Button onClick={handleDownloadWord} className="gap-2">
          <FileDown className="w-4 h-4" />
          Word faylni yuklab olish
        </Button>
      </div>

      {/* Document Content */}
      <div className="max-w-5xl mx-auto p-8 space-y-12">
        {/* Cover Page */}
        <div className="min-h-screen flex flex-col items-center justify-center text-center space-y-8 page-break-after">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-primary">AliBrand CRM</h1>
            <h2 className="text-3xl font-semibold text-foreground">
              Ish Jarayoni Tekshirish Hujjati
            </h2>
            <p className="text-xl text-muted-foreground">
              Workflow Validation Document
            </p>
          </div>
          <div className="space-y-2 text-muted-foreground">
            <p className="text-lg">Faza 2 - Ish Jarayonlarini Baholash</p>
            <p className="text-lg">Phase 2 - Workflow Evaluation</p>
            <p className="text-sm mt-8">Versiya 1.0 | 2025</p>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            Mundarija / Table of Contents
          </h2>
          <div className="space-y-3 text-lg">
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>1. Kirish / Introduction</span>
              <span className="text-muted-foreground">3</span>
            </div>
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>2. Xarid Qarorlari va Buyurtma Jarayoni</span>
              <span className="text-muted-foreground">4</span>
            </div>
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>3. Xitoyda Qadoqlash va QR Generatsiya</span>
              <span className="text-muted-foreground">5</span>
            </div>
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>4. AbuSaxiy Excel Import Jarayoni</span>
              <span className="text-muted-foreground">6</span>
            </div>
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>5. O'zbekistonda QR Skan va Tasdiqlash</span>
              <span className="text-muted-foreground">7</span>
            </div>
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>6. Marketplace Sinxronlash va Sotish</span>
              <span className="text-muted-foreground">8</span>
            </div>
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>7. Moliya va Ko'p To'lov Tizimi</span>
              <span className="text-muted-foreground">9</span>
            </div>
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>8. Investor Hisobotlari</span>
              <span className="text-muted-foreground">10</span>
            </div>
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>9. End-to-End Tracking (UUID/QR)</span>
              <span className="text-muted-foreground">11</span>
            </div>
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>10. Xatoliklarni Boshqarish</span>
              <span className="text-muted-foreground">12</span>
            </div>
            <div className="flex justify-between hover:text-primary transition-colors cursor-pointer">
              <span>11. Umumiy Baholash va Xulosalar</span>
              <span className="text-muted-foreground">13</span>
            </div>
          </div>
        </div>

        {/* Introduction */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            1. Kirish / Introduction
          </h2>
          <div className="space-y-4 text-foreground">
            <h3 className="text-xl font-semibold">Maqsad / Purpose</h3>
            <p className="leading-relaxed">
              Ushbu hujjat AliBrand CRM tizimining barcha ish jarayonlarini (BPMN diagrammalari) 
              tekshirish va baholash uchun mo'ljallangan. Har bir jarayon qadamlari to'g'ri 
              tartibda joylashganmi, keraksiz yoki kamlik bosqichlar bormi, yoki jarayonni 
              yaxshilash zarurmi - bularni aniqlash uchun foydalaniladi.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              This document is designed to validate and evaluate all AliBrand CRM workflows 
              (BPMN diagrams). It helps identify whether process steps are in correct order, 
              if there are unnecessary or missing steps, and if process improvements are needed.
            </p>

            <h3 className="text-xl font-semibold mt-6">Qanday Foydalanish / How to Use</h3>
            <div className="space-y-2">
              <p>✓ Har bir jarayon bo'limi uchun savollarga javob bering</p>
              <p>✓ "Ha" / "Yo'q" / "Qisman" variantlarini belgilang</p>
              <p>✓ Izohlar bo'limida o'zgartirishlar taklif qiling</p>
              <p>✓ Umumiy baholash bo'limida xulosalar chiqaring</p>
            </div>
          </div>
        </div>

        {/* Workflow 1: Purchase Decision */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            2. Xarid Qarorlari va Buyurtma Jarayoni
          </h2>
          <p className="text-muted-foreground">Purchase Decision & Ordering Process</p>

          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Jarayon Qadamlari Tekshiruvi</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p1-q1-yes" className="mt-1" />
                    <label htmlFor="p1-q1-yes">Ha</label>
                    <input type="checkbox" id="p1-q1-no" className="mt-1" />
                    <label htmlFor="p1-q1-no">Yo'q</label>
                    <input type="checkbox" id="p1-q1-partial" className="mt-1" />
                    <label htmlFor="p1-q1-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>1.1:</strong> Manager mahsulot xarid qilish qarorini qabul qilish jarayoni to'g'ri tartibdami?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p1-q2-yes" className="mt-1" />
                    <label htmlFor="p1-q2-yes">Ha</label>
                    <input type="checkbox" id="p1-q2-no" className="mt-1" />
                    <label htmlFor="p1-q2-no">Yo'q</label>
                    <input type="checkbox" id="p1-q2-partial" className="mt-1" />
                    <label htmlFor="p1-q2-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>1.2:</strong> Xitoy sotuvchiga buyurtma yuborish mexanizmi aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p1-q3-yes" className="mt-1" />
                    <label htmlFor="p1-q3-yes">Ha</label>
                    <input type="checkbox" id="p1-q3-no" className="mt-1" />
                    <label htmlFor="p1-q3-no">Yo'q</label>
                    <input type="checkbox" id="p1-q3-partial" className="mt-1" />
                    <label htmlFor="p1-q3-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>1.3:</strong> Mahsulot UUID generatsiyasi va tizimga qo'shilishi mantiqan to'g'ri joylashtirilganmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p1-q4-yes" className="mt-1" />
                    <label htmlFor="p1-q4-yes">Ha</label>
                    <input type="checkbox" id="p1-q4-no" className="mt-1" />
                    <label htmlFor="p1-q4-no">Yo'q</label>
                    <input type="checkbox" id="p1-q4-partial" className="mt-1" />
                    <label htmlFor="p1-q4-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>1.4:</strong> AI tavsiyalari (Faza 6+) uchun joy qoldirilganmi?
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="font-semibold">Izohlar va Takliflar:</label>
                <textarea 
                  className="w-full h-24 p-3 bg-background border border-border rounded-md"
                  placeholder="Bu jarayonda qanday o'zgartirishlar kerak? Qaysi qadamlar keraksiz yoki kamlik?"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow 2: China Packing */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            3. Xitoyda Qadoqlash va QR Generatsiya
          </h2>
          <p className="text-muted-foreground">China Packing + QR Generation + Verification</p>

          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Jarayon Qadamlari Tekshiruvi</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p2-q1-yes" className="mt-1" />
                    <label htmlFor="p2-q1-yes">Ha</label>
                    <input type="checkbox" id="p2-q1-no" className="mt-1" />
                    <label htmlFor="p2-q1-no">Yo'q</label>
                    <input type="checkbox" id="p2-q1-partial" className="mt-1" />
                    <label htmlFor="p2-q1-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>2.1:</strong> Mahsulotlar Xitoy omboriga kelishi va qadoqlashga tayyorgarlik jarayoni aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p2-q2-yes" className="mt-1" />
                    <label htmlFor="p2-q2-yes">Ha</label>
                    <input type="checkbox" id="p2-q2-no" className="mt-1" />
                    <label htmlFor="p2-q2-no">Yo'q</label>
                    <input type="checkbox" id="p2-q2-partial" className="mt-1" />
                    <label htmlFor="p2-q2-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>2.2:</strong> Box yaratish va mahsulotlarni qo'shish mexanizmi to'g'ri ishlayaptimi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p2-q3-yes" className="mt-1" />
                    <label htmlFor="p2-q3-yes">Ha</label>
                    <input type="checkbox" id="p2-q3-no" className="mt-1" />
                    <label htmlFor="p2-q3-no">Yo'q</label>
                    <input type="checkbox" id="p2-q3-partial" className="mt-1" />
                    <label htmlFor="p2-q3-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>2.3:</strong> 100% tekshirish majburiyati (nuqsonli mahsulotlar Xitoydan chiqmasligi) to'g'ri ko'rsatilganmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p2-q4-yes" className="mt-1" />
                    <label htmlFor="p2-q4-yes">Ha</label>
                    <input type="checkbox" id="p2-q4-no" className="mt-1" />
                    <label htmlFor="p2-q4-no">Yo'q</label>
                    <input type="checkbox" id="p2-q4-partial" className="mt-1" />
                    <label htmlFor="p2-q4-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>2.4:</strong> QR kod avtomatik generatsiyasi va to'liq ma'lumot (mahsulot turlari, miqdor, UUID) saqlanishi aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p2-q5-yes" className="mt-1" />
                    <label htmlFor="p2-q5-yes">Ha</label>
                    <input type="checkbox" id="p2-q5-no" className="mt-1" />
                    <label htmlFor="p2-q5-no">Yo'q</label>
                    <input type="checkbox" id="p2-q5-partial" className="mt-1" />
                    <label htmlFor="p2-q5-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>2.5:</strong> QR kodni chop etish va yopish jarayoni mantiqan tugallangan holatdami?
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="font-semibold">Izohlar va Takliflar:</label>
                <textarea 
                  className="w-full h-24 p-3 bg-background border border-border rounded-md"
                  placeholder="Bu jarayonda qanday o'zgartirishlar kerak? Qaysi qadamlar keraksiz yoki kamlik?"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow 3: Excel Import */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            4. AbuSaxiy Excel Import Jarayoni
          </h2>
          <p className="text-muted-foreground">AbuSaxiy Excel Import via Telegram Bot</p>

          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Jarayon Qadamlari Tekshiruvi</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p3-q1-yes" className="mt-1" />
                    <label htmlFor="p3-q1-yes">Ha</label>
                    <input type="checkbox" id="p3-q1-no" className="mt-1" />
                    <label htmlFor="p3-q1-no">Yo'q</label>
                    <input type="checkbox" id="p3-q1-partial" className="mt-1" />
                    <label htmlFor="p3-q1-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>3.1:</strong> AbuSaxiy Telegram bot orqali Excel fayl yuborish jarayoni aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p3-q2-yes" className="mt-1" />
                    <label htmlFor="p3-q2-yes">Ha</label>
                    <input type="checkbox" id="p3-q2-no" className="mt-1" />
                    <label htmlFor="p3-q2-no">Yo'q</label>
                    <input type="checkbox" id="p3-q2-partial" className="mt-1" />
                    <label htmlFor="p3-q2-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>3.2:</strong> Tizim Excel faylni parsing qilish va mahsulotlarni aniqlash mexanizmi mantiqan to'g'rimi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p3-q3-yes" className="mt-1" />
                    <label htmlFor="p3-q3-yes">Ha</label>
                    <input type="checkbox" id="p3-q3-no" className="mt-1" />
                    <label htmlFor="p3-q3-no">Yo'q</label>
                    <input type="checkbox" id="p3-q3-partial" className="mt-1" />
                    <label htmlFor="p3-q3-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>3.3:</strong> Shipment statusini avtomatik yangilash ("In Transit", "Arrived") jarayoni aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p3-q4-yes" className="mt-1" />
                    <label htmlFor="p3-q4-yes">Ha</label>
                    <input type="checkbox" id="p3-q4-no" className="mt-1" />
                    <label htmlFor="p3-q4-no">Yo'q</label>
                    <input type="checkbox" id="p3-q4-partial" className="mt-1" />
                    <label htmlFor="p3-q4-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>3.4:</strong> Xatoliklar loglarini saqlash va hisob-kitob qilish mexanizmi mavjudmi?
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="font-semibold">Izohlar va Takliflar:</label>
                <textarea 
                  className="w-full h-24 p-3 bg-background border border-border rounded-md"
                  placeholder="Bu jarayonda qanday o'zgartirishlar kerak? Qaysi qadamlar keraksiz yoki kamlik?"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow 4: Uzbekistan QR Scan */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            5. O'zbekistonda QR Skan va Tasdiqlash
          </h2>
          <p className="text-muted-foreground">Uzbekistan QR Scan + Manual Confirmation</p>

          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Jarayon Qadamlari Tekshiruvi</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p4-q1-yes" className="mt-1" />
                    <label htmlFor="p4-q1-yes">Ha</label>
                    <input type="checkbox" id="p4-q1-no" className="mt-1" />
                    <label htmlFor="p4-q1-no">Yo'q</label>
                    <input type="checkbox" id="p4-q1-partial" className="mt-1" />
                    <label htmlFor="p4-q1-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>4.1:</strong> O'zbekiston xodimi QR kodni skanerlash va kutilgan tarkib ko'rsatilishi aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p4-q2-yes" className="mt-1" />
                    <label htmlFor="p4-q2-yes">Ha</label>
                    <input type="checkbox" id="p4-q2-no" className="mt-1" />
                    <label htmlFor="p4-q2-no">Yo'q</label>
                    <input type="checkbox" id="p4-q2-partial" className="mt-1" />
                    <label htmlFor="p4-q2-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>4.2:</strong> Xodim qo'lda miqdor va sifat tekshirish mexanizmi mantiqan to'g'rimi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p4-q3-yes" className="mt-1" />
                    <label htmlFor="p4-q3-yes">Ha</label>
                    <input type="checkbox" id="p4-q3-no" className="mt-1" />
                    <label htmlFor="p4-q3-no">Yo'q</label>
                    <input type="checkbox" id="p4-q3-partial" className="mt-1" />
                    <label htmlFor="p4-q3-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>4.3:</strong> Yetishmayapti/Brak mahsulotlarni belgilash funksiyasi mantiqan aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p4-q4-yes" className="mt-1" />
                    <label htmlFor="p4-q4-yes">Ha</label>
                    <input type="checkbox" id="p4-q4-no" className="mt-1" />
                    <label htmlFor="p4-q4-no">Yo'q</label>
                    <input type="checkbox" id="p4-q4-partial" className="mt-1" />
                    <label htmlFor="p4-q4-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>4.4:</strong> Tasdiqlashdan keyin statusni "Arrived in Uzbekistan"ga o'zgartirish avtomatikmi?
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="font-semibold">Izohlar va Takliflar:</label>
                <textarea 
                  className="w-full h-24 p-3 bg-background border border-border rounded-md"
                  placeholder="Bu jarayonda qanday o'zgartirishlar kerak? Qaysi qadamlar keraksiz yoki kamlik?"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow 5: Marketplace Sync */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            6. Marketplace Sinxronlash va Sotish
          </h2>
          <p className="text-muted-foreground">Marketplace Sync & Sales</p>

          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Jarayon Qadamlari Tekshiruvi</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p5-q1-yes" className="mt-1" />
                    <label htmlFor="p5-q1-yes">Ha</label>
                    <input type="checkbox" id="p5-q1-no" className="mt-1" />
                    <label htmlFor="p5-q1-no">Yo'q</label>
                    <input type="checkbox" id="p5-q1-partial" className="mt-1" />
                    <label htmlFor="p5-q1-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>5.1:</strong> Mahsulotlarni marketplacelarga (Uzum, Yandex, Instagram/Telegram) sinxronlash mexanizmi aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p5-q2-yes" className="mt-1" />
                    <label htmlFor="p5-q2-yes">Ha</label>
                    <input type="checkbox" id="p5-q2-no" className="mt-1" />
                    <label htmlFor="p5-q2-no">Yo'q</label>
                    <input type="checkbox" id="p5-q2-partial" className="mt-1" />
                    <label htmlFor="p5-q2-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>5.2:</strong> Real-time stock va order sinxronizatsiyasi mantiqan to'g'ri ishlayaptimi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p5-q3-yes" className="mt-1" />
                    <label htmlFor="p5-q3-yes">Ha</label>
                    <input type="checkbox" id="p5-q3-no" className="mt-1" />
                    <label htmlFor="p5-q3-no">Yo'q</label>
                    <input type="checkbox" id="p5-q3-partial" className="mt-1" />
                    <label htmlFor="p5-q3-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>5.3:</strong> Mahsulot faqat mijozga yetkazilgandan keyin "Sold" deb belgilanishi mantiqan aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p5-q4-yes" className="mt-1" />
                    <label htmlFor="p5-q4-yes">Ha</label>
                    <input type="checkbox" id="p5-q4-no" className="mt-1" />
                    <label htmlFor="p5-q4-no">Yo'q</label>
                    <input type="checkbox" id="p5-q4-partial" className="mt-1" />
                    <label htmlFor="p5-q4-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>5.4:</strong> Marketplaceda sotish narxlarini boshqarish va yangilash mexanizmi mavjudmi?
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="font-semibold">Izohlar va Takliflar:</label>
                <textarea 
                  className="w-full h-24 p-3 bg-background border border-border rounded-md"
                  placeholder="Bu jarayonda qanday o'zgartirishlar kerak? Qaysi qadamlar keraksiz yoki kamlik?"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow 6: Finance */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            7. Moliya va Ko'p To'lov Tizimi
          </h2>
          <p className="text-muted-foreground">Finance & Multi-Payment System</p>

          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Jarayon Qadamlari Tekshiruvi</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p6-q1-yes" className="mt-1" />
                    <label htmlFor="p6-q1-yes">Ha</label>
                    <input type="checkbox" id="p6-q1-no" className="mt-1" />
                    <label htmlFor="p6-q1-no">Yo'q</label>
                    <input type="checkbox" id="p6-q1-partial" className="mt-1" />
                    <label htmlFor="p6-q1-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>6.1:</strong> Xarajatlar (mahsulot narxi, jo'natish, bojxona) tracking mexanizmi to'g'rimi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p6-q2-yes" className="mt-1" />
                    <label htmlFor="p6-q2-yes">Ha</label>
                    <input type="checkbox" id="p6-q2-no" className="mt-1" />
                    <label htmlFor="p6-q2-no">Yo'q</label>
                    <input type="checkbox" id="p6-q2-partial" className="mt-1" />
                    <label htmlFor="p6-q2-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>6.2:</strong> Daromad va foyda-zarar hisob-kitoblari mantiqan aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p6-q3-yes" className="mt-1" />
                    <label htmlFor="p6-q3-yes">Ha</label>
                    <input type="checkbox" id="p6-q3-no" className="mt-1" />
                    <label htmlFor="p6-q3-no">Yo'q</label>
                    <input type="checkbox" id="p6-q3-partial" className="mt-1" />
                    <label htmlFor="p6-q3-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>6.3:</strong> Ko'p to'lov usullari (naqd, karta, bank o'tkazmasi) qo'llab-quvvatlash mexanizmi mavjudmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p6-q4-yes" className="mt-1" />
                    <label htmlFor="p6-q4-yes">Ha</label>
                    <input type="checkbox" id="p6-q4-no" className="mt-1" />
                    <label htmlFor="p6-q4-no">Yo'q</label>
                    <input type="checkbox" id="p6-q4-partial" className="mt-1" />
                    <label htmlFor="p6-q4-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>6.4:</strong> Moliya hisobotlarini yaratish va eksport qilish jarayoni aniqmi?
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="font-semibold">Izohlar va Takliflar:</label>
                <textarea 
                  className="w-full h-24 p-3 bg-background border border-border rounded-md"
                  placeholder="Bu jarayonda qanday o'zgartirishlar kerak? Qaysi qadamlar keraksiz yoki kamlik?"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow 7: Investor Reports */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            8. Investor Hisobotlari
          </h2>
          <p className="text-muted-foreground">Investor Reporting (Limited Access)</p>

          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Jarayon Qadamlari Tekshiruvi</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p7-q1-yes" className="mt-1" />
                    <label htmlFor="p7-q1-yes">Ha</label>
                    <input type="checkbox" id="p7-q1-no" className="mt-1" />
                    <label htmlFor="p7-q1-no">Yo'q</label>
                    <input type="checkbox" id="p7-q1-partial" className="mt-1" />
                    <label htmlFor="p7-q1-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>7.1:</strong> Investor faqat o'zining moliyaviy hisobotlarini ko'rish imkoniyati aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p7-q2-yes" className="mt-1" />
                    <label htmlFor="p7-q2-yes">Ha</label>
                    <input type="checkbox" id="p7-q2-no" className="mt-1" />
                    <label htmlFor="p7-q2-no">Yo'q</label>
                    <input type="checkbox" id="p7-q2-partial" className="mt-1" />
                    <label htmlFor="p7-q2-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>7.2:</strong> Read-only (faqat ko'rish) cheklov mexanizmi mantiqan to'g'rimi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p7-q3-yes" className="mt-1" />
                    <label htmlFor="p7-q3-yes">Ha</label>
                    <input type="checkbox" id="p7-q3-no" className="mt-1" />
                    <label htmlFor="p7-q3-no">Yo'q</label>
                    <input type="checkbox" id="p7-q3-partial" className="mt-1" />
                    <label htmlFor="p7-q3-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>7.3:</strong> Investitsiya miqdori, foyda, ROI (foiz) ko'rsatgichlari aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p7-q4-yes" className="mt-1" />
                    <label htmlFor="p7-q4-yes">Ha</label>
                    <input type="checkbox" id="p7-q4-no" className="mt-1" />
                    <label htmlFor="p7-q4-no">Yo'q</label>
                    <input type="checkbox" id="p7-q4-partial" className="mt-1" />
                    <label htmlFor="p7-q4-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>7.4:</strong> Investor hisobotlarini PDF sifatida eksport qilish mexanizmi mavjudmi?
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="font-semibold">Izohlar va Takliflar:</label>
                <textarea 
                  className="w-full h-24 p-3 bg-background border border-border rounded-md"
                  placeholder="Bu jarayonda qanday o'zgartirishlar kerak? Qaysi qadamlar keraksiz yoki kamlik?"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow 8: End-to-End Tracking */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            9. End-to-End Tracking (UUID/QR)
          </h2>
          <p className="text-muted-foreground">Complete Product Lifecycle Tracking</p>

          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Jarayon Qadamlari Tekshiruvi</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p8-q1-yes" className="mt-1" />
                    <label htmlFor="p8-q1-yes">Ha</label>
                    <input type="checkbox" id="p8-q1-no" className="mt-1" />
                    <label htmlFor="p8-q1-no">Yo'q</label>
                    <input type="checkbox" id="p8-q1-partial" className="mt-1" />
                    <label htmlFor="p8-q1-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>8.1:</strong> Har bir mahsulot uchun noyob UUID generatsiyasi mexanizmi to'g'rimi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p8-q2-yes" className="mt-1" />
                    <label htmlFor="p8-q2-yes">Ha</label>
                    <input type="checkbox" id="p8-q2-no" className="mt-1" />
                    <label htmlFor="p8-q2-no">Yo'q</label>
                    <input type="checkbox" id="p8-q2-partial" className="mt-1" />
                    <label htmlFor="p8-q2-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>8.2:</strong> Mahsulotning butun hayotiy siklini (Xitoy → transit → O'zbekiston → sotilgan) kuzatish mantiqan aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p8-q3-yes" className="mt-1" />
                    <label htmlFor="p8-q3-yes">Ha</label>
                    <input type="checkbox" id="p8-q3-no" className="mt-1" />
                    <label htmlFor="p8-q3-no">Yo'q</label>
                    <input type="checkbox" id="p8-q3-partial" className="mt-1" />
                    <label htmlFor="p8-q3-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>8.3:</strong> Real-time timeline va statuslarni ko'rsatish UI mexanizmi to'g'rimi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p8-q4-yes" className="mt-1" />
                    <label htmlFor="p8-q4-yes">Ha</label>
                    <input type="checkbox" id="p8-q4-no" className="mt-1" />
                    <label htmlFor="p8-q4-no">Yo'q</label>
                    <input type="checkbox" id="p8-q4-partial" className="mt-1" />
                    <label htmlFor="p8-q4-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>8.4:</strong> Rahbar uchun to'liq shaffoflik (har bir mahsulotni kuzatish) mantiqan mavjudmi?
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="font-semibold">Izohlar va Takliflar:</label>
                <textarea 
                  className="w-full h-24 p-3 bg-background border border-border rounded-md"
                  placeholder="Bu jarayonda qanday o'zgartirishlar kerak? Qaysi qadamlar keraksiz yoki kamlik?"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow 9: Error Handling */}
        <div className="space-y-6 page-break-after">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            10. Xatoliklarni Boshqarish
          </h2>
          <p className="text-muted-foreground">Error Handling & Damaged Product Claims</p>

          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Jarayon Qadamlari Tekshiruvi</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p9-q1-yes" className="mt-1" />
                    <label htmlFor="p9-q1-yes">Ha</label>
                    <input type="checkbox" id="p9-q1-no" className="mt-1" />
                    <label htmlFor="p9-q1-no">Yo'q</label>
                    <input type="checkbox" id="p9-q1-partial" className="mt-1" />
                    <label htmlFor="p9-q1-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>9.1:</strong> Mahsulot transitda shikastlangan taqdirda AbuSaxiyga da'vo (claim) yuborish mexanizmi aniqmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p9-q2-yes" className="mt-1" />
                    <label htmlFor="p9-q2-yes">Ha</label>
                    <input type="checkbox" id="p9-q2-no" className="mt-1" />
                    <label htmlFor="p9-q2-no">Yo'q</label>
                    <input type="checkbox" id="p9-q2-partial" className="mt-1" />
                    <label htmlFor="p9-q2-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>9.2:</strong> Xitoyda nuqsonli mahsulotlar chiqmasligini ta'minlash (100% tekshirish) mantiqan to'g'ri ko'rsatilganmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p9-q3-yes" className="mt-1" />
                    <label htmlFor="p9-q3-yes">Ha</label>
                    <input type="checkbox" id="p9-q3-no" className="mt-1" />
                    <label htmlFor="p9-q3-no">Yo'q</label>
                    <input type="checkbox" id="p9-q3-partial" className="mt-1" />
                    <label htmlFor="p9-q3-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>9.3:</strong> Xato loglarini saqlash va tahlil qilish mexanizmi mavjudmi?
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex gap-2 min-w-[200px]">
                    <input type="checkbox" id="p9-q4-yes" className="mt-1" />
                    <label htmlFor="p9-q4-yes">Ha</label>
                    <input type="checkbox" id="p9-q4-no" className="mt-1" />
                    <label htmlFor="p9-q4-no">Yo'q</label>
                    <input type="checkbox" id="p9-q4-partial" className="mt-1" />
                    <label htmlFor="p9-q4-partial">Qisman</label>
                  </div>
                  <p className="flex-1">
                    <strong>9.4:</strong> Shikastlangan mahsulotlarni almashtirish yoki qaytarish jarayoni aniqmi?
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="font-semibold">Izohlar va Takliflar:</label>
                <textarea 
                  className="w-full h-24 p-3 bg-background border border-border rounded-md"
                  placeholder="Bu jarayonda qanday o'zgartirishlar kerak? Qaysi qadamlar keraksiz yoki kamlik?"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Evaluation */}
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-primary border-b-2 border-primary pb-2">
            11. Umumiy Baholash va Xulosalar
          </h2>
          <p className="text-muted-foreground">Overall Evaluation & Conclusions</p>

          <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Umumiy Savollar</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="font-semibold block mb-2">
                    1. Eng katta muammoli yoki noaniq jarayon qaysi?
                  </label>
                  <textarea 
                    className="w-full h-24 p-3 bg-background border border-border rounded-md"
                    placeholder="Qaysi jarayon eng ko'p o'zgartirishlarni talab qiladi?"
                  ></textarea>
                </div>

                <div>
                  <label className="font-semibold block mb-2">
                    2. Qaysi jarayonlar butunlay keraksiz yoki ortiqcha?
                  </label>
                  <textarea 
                    className="w-full h-24 p-3 bg-background border border-border rounded-md"
                    placeholder="Qaysi qadamlarni olib tashlash mumkin?"
                  ></textarea>
                </div>

                <div>
                  <label className="font-semibold block mb-2">
                    3. Qaysi jarayonlarda qadamlar kamlik?
                  </label>
                  <textarea 
                    className="w-full h-24 p-3 bg-background border border-border rounded-md"
                    placeholder="Qaysi jarayonlarga qo'shimcha qadamlar kerak?"
                  ></textarea>
                </div>

                <div>
                  <label className="font-semibold block mb-2">
                    4. Jarayonlar orasidagi ulanishlar (flow transitions) mantiqan to'g'rimi?
                  </label>
                  <textarea 
                    className="w-full h-24 p-3 bg-background border border-border rounded-md"
                    placeholder="Bitta jarayondan ikkinchisiga o'tish to'g'ri ishlayaptimi?"
                  ></textarea>
                </div>

                <div>
                  <label className="font-semibold block mb-2">
                    5. Priority bo'yicha eng muhim 3 ta o'zgartirish:
                  </label>
                  <textarea 
                    className="w-full h-32 p-3 bg-background border border-border rounded-md"
                    placeholder="1. ...\n2. ...\n3. ..."
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Yakuniy Xulosa / Final Conclusion</h3>
              <textarea 
                className="w-full h-40 p-3 bg-background border border-border rounded-md"
                placeholder="Umumiy baholash: Barcha jarayonlar to'g'ri ishlayaptimi? Qanday umumiy o'zgartirishlar tavsiya etiladi?"
              ></textarea>
            </div>

            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-xl font-semibold">Tasdiqlash / Approval</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="approval" className="w-5 h-5" />
                  <label htmlFor="approval" className="text-lg">
                    Barcha jarayonlar ko'rib chiqildi va baholandi
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block mb-2">Tekshiruvchi / Reviewer:</label>
                    <input 
                      type="text" 
                      className="w-full p-2 bg-background border border-border rounded-md"
                      placeholder="Ism va lavozim"
                    />
                  </div>
                  <div>
                    <label className="block mb-2">Sana / Date:</label>
                    <input 
                      type="date" 
                      className="w-full p-2 bg-background border border-border rounded-md"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { 
            background: white;
            margin: 0;
            padding: 0;
          }
          .page-break-after {
            page-break-after: always;
          }
          .print\\:hidden {
            display: none !important;
          }
          input[type="checkbox"],
          input[type="text"],
          input[type="date"],
          textarea {
            border: 1px solid #000;
          }
        }
      `}</style>
    </div>
  );
}
