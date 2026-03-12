import fs from 'fs';

const ocrText = `Bosepar 1083p0B REMATONTY. i) atlas ARIES Te | ОМИ ||
6640907 2026-02-09 15:05: 15-000664070;
03266981 Yunusova Umida Anvarovna 998977472336
ип 000 «UZUM MARKET
Республика Узбекистан, г. Ташкент, Юнусабадский район, Ц-6, yn. Насырова, 70.
г. Ташкент, Сергелийский район, массив Старый Сергели, ул. Нилуфар, д 77/7
С Закупочная| Сумма
В SKU товара Описание товара Штрих-код ‘цена (сум) с (сум)
3 ИТТ
ABDU98-ATR- Atir uchun flakon, sprey-purkagich, 5 ml
1 | АМЕТИС (Rang: Ametist) 1000055260762 9900 19800
ATR! Atir uchun flakon, sprey-purkagich, 5 ml
|| АВРИ9В-АТ-КРАСН| (Rang: zi) LULL | 9900 | 2 | 19800
eet Atir uchun flakon, sprey-purkagich, 5 ml
3] АВОЧЭВ-АТЕ-ЛЕДЯН (Rang: Muz) 1000055260755 92900 18800
AABDU98-BIOAQUA- | BIOAQUA kosmetik tungi yuz maskalari
i 20 tal to'plami, 20 dona (soni : 20 ta) 000063737269 100900 100000.
ABDU9B- GOYARD kardo'lder — kartalar va : у
KARTAGOYARD- kupyuralar uchun, sovg'a qutisi bilan 500000 1000000
3ENEH- - + (Rang: Yashil) ё pdb
В ABDU9B-KIST1 Yumshogq tukli soya cho'tkasi 70000 490000
AABDU98-PASPORT- | Xalqaro pasport uchun g'ilof (Rang: ||
7 | АЛЫЙ Alvon) 1000054906722 2 110000
ABDU98-PASPORT- | Xalqaro pasport uchun g'ilof (Rang: |
|| ЗЕЛЕН Yashil) 1000068556159 99000 99000
ABDU9B-PASPORT- | Ха!даго pasport uchun g'ilof (Rang: | |
В KOPUYH Jigarrang) 1000068556128 99000 99000
||
AABDU98-PASPORT- | Ха!даго pasport uchun д'0! (Rang: |
| РОЗОВ Pushti G00068536166 99000 990000
ABDU9B-PASPORT- | Xalqaro pasport uchun g'ilof (Rang: Och
"| свЕтсин kok) 000088550142 89000 297000
ABDU98-PASPORT- =
ЧЕРН Ха!даго pasport uchun g'ilof (Rang: Qora) 99000 +] 297000
Simsiz Bluetooth qulogchinlar Air 31, | ||| |
AABDU98-RANGNAU- Ве ian |
я mikrofon va shovginni kamaytirish bilan 60000 60000
| БЕЛЫЙ (Rang: О9) 1000063735528
[scanned with |
| CamScanner`;

export function extractReturnItemsFromText(text: string) {
  const results: { barcode: string; quantity: number }[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    let rawBarcodeMatch = line.match(/(?:\b|\s|^)(\d{10,14})(?:\b|\s|$)/);
    let rawBarcode = rawBarcodeMatch ? rawBarcodeMatch[1] : null;

    if (!rawBarcode) {
      const words = line.split(/\s+/);
      for (const w of words) {
        const cleanW = w.replace(/[-_]/g, '');
        if (cleanW.length >= 10 && cleanW.length <= 16 && (cleanW.match(/\d/g) || []).length >= 5) {
           let fixed = cleanW
              .replace(/[oOОоQ]/g, '0') // Letter O to Zero
              .replace(/[iIlL|!\\/]/g, '1') // Lines to One
              .replace(/[zZ]/g, '2')
              .replace(/[sS]/g, '5')
              .replace(/[bB]/g, '8')
              .replace(/[D]/g, '0');
              
           if (fixed.startsWith('G') && fixed.length >= 12) {
              fixed = '1' + fixed.substring(1);
           }
           
           fixed = fixed.replace(/[^0-9]/g, '');
           
           if (fixed.length >= 10 && fixed.length <= 14) {
              rawBarcode = fixed;
              break;
           }
        }
      }
    }

    if (!rawBarcode) {
       console.log("[SKIPPED LINE] No barcode found in:", line);
       continue;
    }
    
    if (rawBarcode.length === 12 && rawBarcode.startsWith('00')) {
       rawBarcode = '1' + rawBarcode;
    } else if (rawBarcode.length === 11 && rawBarcode.startsWith('000')) {
       rawBarcode = '10' + rawBarcode;
    }
    
    const withoutBarcode = line.replace(rawBarcode, '');
    const numbers: string[] = withoutBarcode.match(/\b\d+\b/g) || [];
    
    let quantity = 1;

    const qtyCandidates = numbers.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0 && n < 10000);
    
    if (qtyCandidates.length > 0) {
      if (qtyCandidates.length >= 2) {
         const candidate = qtyCandidates.find(c => c > 0 && c < 500);
         if (candidate) {
            quantity = candidate;
         }
      } else {
         if (qtyCandidates[0] < 500) quantity = qtyCandidates[0];
      }
    }
    
    console.log(`[MATCHED] Barcode: ${rawBarcode}, Qty: ${quantity} from line:`, line.substring(0, 50));
    results.push({ barcode: rawBarcode, quantity });
  }

  const uniqueMap = new Map<string, number>();
  results.forEach(item => {
    uniqueMap.set(item.barcode, (uniqueMap.get(item.barcode) || 0) + item.quantity);
  });
  
  const finalItems = Array.from(uniqueMap.entries()).map(([barcode, quantity]) => ({ barcode, quantity }));
  console.log("\\n--- FINAL EXTRACTED ITEMS (" + finalItems.length + ") ---");
  console.log(finalItems);
  return finalItems;
}

extractReturnItemsFromText(ocrText);
