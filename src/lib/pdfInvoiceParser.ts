export interface ParsedInvoice {
  invoiceNumber: string;
  senderName: string;
  pickupPoint: string;
  invoiceDate: string;
  acceptedOrders: string[];
  notAcceptedOrders: string[];
  isProductReceipt: boolean;
  productItems: Array<{ artikul: string; quantity: number; name: string }>;
}

export async function parsePdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

export function parseInvoiceData(text: string): ParsedInvoice {
  // PDF bo'shliq muammosini hal qilish: pdfjs-dist harflarni ajratib chiqarishi mumkin
  // "A S L 1 2 4 2 - F L A K O N" -> "ASL1242-FLAKON"
  let normalizedText = text;
  
  // 1-qadam: "A S L" -> "ASL" (bo'shliqli ASL prefiksni yopishtirish)
  normalizedText = normalizedText.replace(/A\s+S\s+L/gi, 'ASL');
  
  // 2-qadam: ASL dan keyin kelgan bo'shliqlarni ketma-ket olib tashlash
  normalizedText = normalizedText.replace(
    /ASL((?:\s*[\w\u0400-\u04FF-])+)/gi,
    (match) => match.replace(/\s+/g, '')
  );
  
  // Agar normallashtirilgan matnda ASL kodlar topilsa, uni ishlatish
  const workingText = /ASL[\w\u0400-\u04FF]{3,}/i.test(normalizedText) ? normalizedText : text;

  // Invoice number — multiple fallback patterns for different Uzum PDF formats
  const invoiceMatch = 
    workingText.match(/[Нн]акладная\s+.*?[№#]\s*(\d+)/i) ||
    workingText.match(/[Пп]ри[её]м\s+товаров\s+[№#]\s*(\d+)/i) ||
    workingText.match(/FBS\s+заказов\s+[№#]?\s*(\d+)/i) ||
    workingText.match(/передач[уи]\s+.*?[№#]\s*(\d+)/i) ||
    workingText.match(/[№#]\s*(\d{4,})/);
  const invoiceNumber = invoiceMatch ? invoiceMatch[1] : '';
  
  // Sender name — flexible spacing/punctuation
  const senderMatch = 
    workingText.match(/[Оо]тправитель\s*:?\s*(.+?)(?:\s+[№#]|\s+договор|\s+Пункт|\n|$)/i);
  const senderName = senderMatch ? senderMatch[1].trim() : '';
  
  // Date
  const dateMatch = workingText.match(/(\d{2}\.\d{2}\.\d{4})/);
  const invoiceDate = dateMatch ? dateMatch[1] : '';
  
  // Pickup point — flexible spacing
  const pickupMatch = 
    workingText.match(/[Пп]ункт\s+приема\s*:?\s*(.+?)(?:\s{3,}|\n|$)/i);
  const pickupPoint = pickupMatch ? pickupMatch[1].trim() : '';

  // Detect "Приём товаров" format
  const isProductReceipt = /при[её]м\s*товаров/i.test(workingText) 
    || (/ASL[\w\u0400-\u04FF][\w\u0400-\u04FF\d-]*/i.test(workingText) && /\d+\s*шт/i.test(workingText));

  if (isProductReceipt) {
    // 1-bosqich: Barcha artikullarni topish
    const artikulRegex = /ASL[\w\u0400-\u04FF][\w\u0400-\u04FF\d-]*/gi;
    const artikulMatches: string[] = [];
    let m;
    while ((m = artikulRegex.exec(workingText)) !== null) {
      artikulMatches.push(m[0].replace(/\s+/g, '').toUpperCase());
    }

    // 2-bosqich: Barcha miqdorlarni topish (N шт formatida)
    const qtyRegex = /(\d+)\s*шт/gi;
    const qtyMatches: number[] = [];
    while ((m = qtyRegex.exec(workingText)) !== null) {
      const qty = parseInt(m[1], 10);
      if (qty > 0) {
        qtyMatches.push(qty);
      }
    }

    // "Итого" satridagi umumiy miqdorni olib tashlash
    if (qtyMatches.length > artikulMatches.length) {
      const totalCandidate = qtyMatches[qtyMatches.length - 1];
      const sumWithout = qtyMatches.slice(0, -1).reduce((s, q) => s + q, 0);
      if (totalCandidate === sumWithout) {
        qtyMatches.pop();
      }
    }

    // 3-bosqich: Juftlashtirish (tartib bo'yicha 1:1)
    const productItems: Array<{ artikul: string; quantity: number; name: string }> = [];
    const count = Math.min(artikulMatches.length, qtyMatches.length);
    for (let i = 0; i < count; i++) {
      productItems.push({
        artikul: artikulMatches[i],
        quantity: qtyMatches[i],
        name: artikulMatches[i],
      });
    }

    console.log('[Product Receipt] Extracted artikuls:', artikulMatches);
    console.log('[Product Receipt] Extracted quantities:', qtyMatches);
    console.log('[Product Receipt] Paired items:', productItems);

    return { invoiceNumber, senderName, pickupPoint, invoiceDate, 
             acceptedOrders: [], notAcceptedOrders: [], isProductReceipt, productItems };
  }
  
  // Split by "Не принятые заказы" to separate accepted from not accepted
  const notAcceptedSplit = workingText.split(/Не\s*принятые\s*заказы/i);
  const acceptedSection = notAcceptedSplit[0] || '';
  const notAcceptedSection = notAcceptedSplit[1] || '';
  
  // Extract 7-10 digit order numbers (covers various Uzum formats)
  const extractOrders = (section: string): string[] => {
    const matches = section.match(/\b(\d{7,10})\b/g);
    return matches ? [...new Set(matches)] : [];
  };
  
  // Remove invoice number + date digits + header metadata from order lists
  const dateDigits = (invoiceDate.match(/\d+/g) || []);
  const contractMatch = workingText.match(/договора\s*:?\s*(\d{5,})/i);
  const innMatch = workingText.match(/ИНН\s*:?\s*(\d{5,})/i);
  const pinfMatch = workingText.match(/ПИНФЛ\s*:?\s*(\d{5,})/i);
  const okedMatch = workingText.match(/ОКЭД\s*:?\s*(\d{4,})/i);
  const phoneMatches = workingText.match(/\+?\d{10,}/g) || [];
  
  const filterOut = new Set([
    invoiceNumber,
    ...dateDigits,
    ...(contractMatch ? [contractMatch[1]] : []),
    ...(innMatch ? [innMatch[1]] : []),
    ...(pinfMatch ? [pinfMatch[1]] : []),
    ...(okedMatch ? [okedMatch[1]] : []),
    ...phoneMatches.map(p => p.replace(/\D/g, '')),
  ]);
  const acceptedOrders = extractOrders(acceptedSection).filter(o => !filterOut.has(o));
  const notAcceptedOrders = extractOrders(notAcceptedSection).filter(o => !filterOut.has(o));
  
  return { invoiceNumber, senderName, pickupPoint, invoiceDate, acceptedOrders, notAcceptedOrders, isProductReceipt: false, productItems: [] };
}
