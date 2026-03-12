import { createWorker } from 'tesseract.js';
import * as path from 'path';
import * as fs from 'fs';

async function scan() {
  console.log("Starting Tesseract test...");
  
  // O'zgartirish: CDN o'rniga oddiy default worker ishlatamiz Local testi uchun. Browserda CDN ishlashi mumkin. Node muhitida local ishlaydi.
  const worker = await createWorker('rus+eng');
  
  // Qidiramiz qanaqa rasmlar bor
  const desktop = 'C:\\Users\\asmi\\Desktop';
  const joyMain = 'C:\\Users\\asmi\\Desktop\\alicargo-joy-main';
  
  let targetImg = '';
  
  // We don't have the user's uploaded image path directly, 
  // but if they sent an image, they might have downloaded it to desktop or project folder.
  const files = fs.readdirSync(desktop);
  for(const f of files) {
     if(f.includes('.png') || f.includes('.jpg') || f.includes('.jpeg')) {
        console.log("Found image: ", f);
        targetImg = path.join(desktop, f);
        break;
     }
  }

  if (!targetImg) {
      console.log("Rasm topilmadi. Desktopda rasm bormi?");
      await worker.terminate();
      return;
  }
  
  console.log(`Reading image: ${targetImg}`);
  const result = await worker.recognize(targetImg);
  
  const text = result.data.text;
  console.log("=== O'qilgan matn ===");
  console.log(text);
  
  fs.writeFileSync('ocr_output.txt', text);
  console.log("Saqlandi -> ocr_output.txt");

  await worker.terminate();
}

scan().catch(console.error);
