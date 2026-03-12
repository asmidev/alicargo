import Tesseract from 'tesseract.js';
import { parsePdfText } from './pdfInvoiceParser';
import { toast } from 'sonner';

export interface ScannedItemResult {
  barcode: string;
  quantity: number;
}

export interface ParseDocumentResult {
  items: ScannedItemResult[];
  platform?: 'uzum' | 'yandex';
  orderType?: 'fbo' | 'fbs';
  storeId?: string;
  rawText?: string; // Tahlil qilish uchun
}

export async function parseDocumentForReturns(
  file: File, 
  stores?: { id: string; name: string }[]
): Promise<ParseDocumentResult> {
  let text = '';
  
  if (file.type === 'application/pdf') {
    try {
      console.log("PDF fayl o'qilmoqda...");
      text = await parsePdfText(file);
      
      if (!text || text.trim().length < 5) {
        toast.info("Bu skaner qilingan rasmli PDF bo'lishi mumkin. OCR yordamida rasm o'qishga harakat qilinmoqda...");
        console.log("PDF matnsiz ekan. Uni rasmga aylantirib OCR dan o'tkazamiz...");
        
        // PDF ni rasm formatiga aylantirish (pdfjs yordamida Canvasga chizamiz)
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        // Birinchi saxifa asosan ko'proq ma'lumot beradi. O'qishni osonlashtirish uchun 1 chi bet ishlatiladi.
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 3.5 }); // Yuqori Sifat (3.5x HD) rasm OCR ga uzatamiz
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context!,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Canvasdan rasm linki olamiz
        const dataUrl = canvas.toDataURL('image/png');
        
        // Uni Tesseract ga tushuramiz
        const result = await Tesseract.recognize(
          dataUrl,
          'rus+eng',
          { logger: m => console.log("PDF OCR Progress:", m) }
        );
        
        text = result.data.text;
        console.log("PDF OCR tugadi, o'qildi:", text.length, "bayt");
      }
    } catch (e: any) {
      toast.error("PDF faylni o'qishda xatolik: " + e.message);
      throw e;
    }
  } else if (file.type.startsWith('image/')) {
    try {
      console.log("OCR jarayoni boshlanmoqda. Rasm hajmi:", file.size, "bayt. Turi:", file.type);
      toast.info("OCR dvigateli ishga tushmoqda, kuting...");
      
      // Fayldan vaqtincha URL yaratamiz
      const imageUrl = URL.createObjectURL(file);
      
      const result = await Tesseract.recognize(
        imageUrl,
        'rus+eng',
        { logger: m => console.log("Tesseract Progress:", m) }
      );
      
      text = result.data.text;
      URL.revokeObjectURL(imageUrl); // Xotirani tozalash
    } catch (e: any) {
      toast.error("Rasmni o'qishda xatolik yuz berdi: " + e.message);
      throw e;
    }
  } else {
    throw new Error("Faqat PDF va Rasm turlari (jpg, png) qabul qilinadi.");
  }

  // Konsolga chiqarib qo'yamiz qaysi matn o'qilganligini tekshirish uchun
  console.log("=== Hujjatdan o'qilgan matn ===");
  console.log(text);
  console.log("================================");

  // 1. Metadata ni aniqlash (Platform, Store, FBO/FBS)
  const meta: Partial<ParseDocumentResult> = {};
  
  const upperText = text.toUpperCase();
  
  // Platformani topish
  if (upperText.includes('UZUM') || upperText.includes('УЗУМ')) {
    meta.platform = 'uzum';
  } else if (upperText.includes('YANDEX') || upperText.includes('ЯНДЕКС') || upperText.includes('MARKET')) {
    meta.platform = 'yandex';
  }

  // FBO / FBS ni topish
  // Uzum FBS hujjatlarida asosan: "Отправление", "Клиента", "Передачу Заказов", "FBS" so'zlari bo'ladi
  // Uzum FBO hujjatlarida asosan: "Возврат товаров комитенту", "со склада", "FBO" so'zlari bo'ladi
  if (upperText.includes('FBS') || upperText.includes('КЛИЕНТА') || upperText.includes('ПЕРЕДАЧУ') || upperText.includes('ЗАКАЗОВ') || upperText.includes('ОТПРАВЛЕНИ')) {
    meta.orderType = 'fbs';
  } else if (upperText.includes('FBO') || upperText.includes('СКЛАДА') || upperText.includes('ВОЗВРАТ ТОВАРОВ') || upperText.includes('КОМИТЕНТУ')) {
    meta.orderType = 'fbo';
  }

  // Do'konni topish
  if (stores && stores.length > 0) {
    for (const store of stores) {
      // Do'kon nomini yoki biriktirilgan raqamlarini (INN) izlaydi
      // Agar do'kon nomi uzum market formalarida YTT GULI kabi kelsa uni ham qidiramiz
      const storeName = store.name.toUpperCase().trim();
      const normalizeStoreName = storeName.replace(/ИП\s+|ООО\s+|YTT\s+/i, '').trim();
      
      if (upperText.includes(storeName) || (normalizeStoreName.length > 3 && upperText.includes(normalizeStoreName))) {
         meta.storeId = store.id;
         break;
      }
    }
  }

  // 2. Shtrix kod va miqdorlarni ajratish
  const items = extractReturnItemsFromText(text);
  
  return {
    items,
    ...meta,
    rawText: text
  };
}

function extractReturnItemsFromText(text: string): ScannedItemResult[] {
  const results: ScannedItemResult[] = [];
  
  // O'zgaruvchilarni tozalaymiz (masalan agar shtrix kod orasida bo'shliq qolib ketgan bo'lsa)
  // 100 005 526 076 2 -> OCR hatosi
  // Biroq hamma sonlarni birlashtirib bo'lmaydi, chunki miqdor (qty) ham raqam
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Shtrix-kod odatda 12-14 xonali son bo'ladi.
    // Tesseract oraliqqa bo'shliq yoki tire qo'yib yuborishi mumkin. 
    // Faqat uzluksiz raqamlarni qidiramiz (eng kamida 7 talik raqamdan oshgani shtrix kod bo'lish ehtimoli bor, ayniqsa 100...)
    
    // 1. Asl qatordan aniq 10-14 raqamli shtrixni qidirish (atrofida boshqa past/baland raqam bo'lmasligi kerak)
    let rawBarcodeMatch = line.match(/(?<!\d)(\d{10,14})(?!\d)/);
    let rawBarcode = rawBarcodeMatch ? rawBarcodeMatch[1] : null;

    if (!rawBarcode) {
      // 2. Extimol Tesseract kelib chiqish xatosi (O ni 0 o'qish, G ni 1 va h.k) bo'lishi mumkin
      const words = line.split(/\s+/);
      for (const w of words) {
        const cleanW = w.replace(/[-_]/g, '');
        // Agar so'zda kamida 6 ta son bo'lsa va jami uzunlik 10-16 gacha bo'lsa, u buzilgan shtrix kod bo'lishi mumkin
        if (cleanW.length >= 10 && cleanW.length <= 16 && (cleanW.match(/\d/g) || []).length >= 5) {
           let fixed = cleanW
              .replace(/[oOОоQ]/g, '0') // Letter O to Zero
              .replace(/[iIlL|!\/]/g, '1') // Lines to One
              .replace(/[zZ]/g, '2')
              .replace(/[sS]/g, '5')
              .replace(/[bB]/g, '8')
              .replace(/[D]/g, '0');
              
           // Boshlanishdagi OCR xatolik, masalan G0006 -> 100006
           if (fixed.startsWith('G') && fixed.length >= 12) {
              fixed = '1' + fixed.substring(1);
           }
           
           // Raqam bo'lmagan qolgan barcha narsani o'chiramiz
           fixed = fixed.replace(/[^0-9]/g, '');
           
           if (fixed.length >= 10 && fixed.length <= 14) {
              const exactFixedMatch = fixed.match(/(?<!\d)(\d{10,14})(?!\d)/);
              if (exactFixedMatch) {
                 rawBarcode = exactFixedMatch[1];
                 break;
              }
           }
        }
      }
    }

    if (!rawBarcode) continue;
    
    // Uzum barcode lar asosan 13 xonali 1000... biladi. Agar Tesseract 1 raqamini o'qimay 12-11 raqamli 000 qilgan bo'lsa uni ta'mirlaymiz
    if (rawBarcode.length === 12 && rawBarcode.startsWith('00')) {
       rawBarcode = '1' + rawBarcode;
    } else if (rawBarcode.length === 11 && rawBarcode.startsWith('000')) {
       rawBarcode = '10' + rawBarcode;
    }
    
    // Qolgan raqamlardan miqdorni topamiz
    // Bilib olishning eng yaxshi usuli: Shtrix-kod raqamini olib tashlab, oxiriga berilgan qisqa raqam
    const withoutBarcode = line.replace(rawBarcode, '');
    const numbers: string[] = withoutBarcode.match(/\b\d+\b/g) || [];
    
    let quantity = 1;

    // Soni (Kol-vo) odatda oxirgi ehtimolga yaqin kichik raqamlar bo'ladi
    // Masalan: 1  Atir   1000005...   2  19800
    // Shunda numbers = ['1', '2', '19800']
    const qtyCandidates = numbers.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0 && n < 10000);
    
    if (qtyCandidates.length > 0) {
      // Agar hujjat ro'yxat tartibida kelsa 1, 2, 3.. bo'lishi mumkin eng birinchi tartib raqami, oxiridagi summa.
      // Ehtimoli bo'yicha e'lon qilamiz: Odatda miqdor qisqa bo'lib o'rta/oxirlarda keladi
      // Birorta kichik son olinadi, summalar millionlarga ketib qoladi.
      
      // Oddiy qoida: agar miqdor qatorida bir nechta son kelsa, eng birinchidan eskirganini olish emas, 2-xatini ham ko'rish:
      if (qtyCandidates.length >= 2) {
         // Agar tartib raqami kelsa uni o'tkazib yuboramiz (masalan 1 yoki 2)
         // qtyCandidates dan tartib raqamini ajratish qiyin, shuning uchun agar sum bilan kelsa, oradagisini olamiz
         // Sodda yo'l, massiv oxiridan bitta oldingisi yoki oxirgisi miqdor bo'ladi
         // Masalan [1 (tartib), 2 (qty), 19800 (sum)]
         // yoki [2 (qty), 19800 (sum)]
         
         const candidate = qtyCandidates.find(c => c > 0 && c < 500); // Vozvrat 500 donadan oshishi nodir, tartib raqamiga o'xshaydi
         if (candidate) {
            quantity = candidate;
         }
      } else {
         if (qtyCandidates[0] < 500) quantity = qtyCandidates[0];
      }
    }
    
    results.push({ barcode: rawBarcode, quantity });
  }

  // Duplicate mapping resolving (Bir xil shtrix kodlar bir necha marta o'qilsa ularni jamlash)
  const uniqueMap = new Map<string, number>();
  results.forEach(item => {
    uniqueMap.set(item.barcode, (uniqueMap.get(item.barcode) || 0) + item.quantity);
  });
  
  const finalItems = Array.from(uniqueMap.entries()).map(([barcode, quantity]) => ({ barcode, quantity }));
  console.log("Topilgan itemlar:", finalItems);
  return finalItems;
}
