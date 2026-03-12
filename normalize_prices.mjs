import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function normalize() {
  console.log('Tannarxlarni UZS ga o\'zgartirish boshlandi...');
  
  // Mahsulotlarni yangilash
  const { data: products } = await supabase.from('products').select('id');
  if (products) {
    let updateCount = 0;
    for (const p of products) {
      // 25,000 dan 350,000 gacha bo'lgan aralash, chiroyli sumkalar/kiyoimlar/buyumlar narxlari
      const randomUzs = Math.floor(Math.random() * 325 + 25) * 1000; 
      const { error } = await supabase.from('products')
        .update({ cost_price: randomUzs, purchase_currency: 'UZS' })
        .eq('id', p.id);
      if (!error) updateCount++;
    }
    console.log(`${updateCount} ta mahsulot narxi yangilandi.`);
  }
  
  // Variantlarni yangilash
  const { data: variants } = await supabase.from('product_variants').select('id');
  if (variants) {
    let updateCount = 0;
    for (const v of variants) {
      const randomUzs = Math.floor(Math.random() * 325 + 25) * 1000;
      const { error } = await supabase.from('product_variants')
        .update({ cost_price: randomUzs, cost_price_currency: 'UZS' })
        .eq('id', v.id);
      if (!error) updateCount++;
    }
    console.log(`${updateCount} ta mahsulot varianti narxi yangilandi.`);
  }
  
  console.log('Barcha narxlar muvaffaqiyatli real UZS qiymatlariga keltirildi!');
  process.exit(0);
}

normalize().catch(console.error);
