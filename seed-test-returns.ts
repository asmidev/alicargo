import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseId = process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const items = [
  { barcode: '1000055260762', name: 'Atir uchun flakon, sprey-purkagich, 5 ml (Rang: Ametist)', price: 9900 },
  { barcode: '1000055260779', name: 'Atir uchun flakon, sprey-purkagich, 5 ml (Rang: Qizil)', price: 9900 },
  { barcode: '1000055260755', name: 'Atir uchun flakon, sprey-purkagich, 5 ml (Rang: Muz)', price: 9900 },
  { barcode: '1000063737269', name: 'BIOAQUA kosmetik tungi yuz maskalari to\'plami, 20 dona', price: 100000 },
  { barcode: '1000079778342', name: 'GOYARD kardo\'lder — kartalar va kupyuralar uchun', price: 500000 },
  { barcode: '1000062716375', name: 'Yumshoq tukli soya cho\'tkasi', price: 70000 },
  { barcode: '1000054906722', name: 'Xalqaro pasport uchun g\'ilof (Rang: Alvon)', price: 55000 },
  { barcode: '1000068556159', name: 'Xalqaro pasport uchun g\'ilof (Rang: Yashil)', price: 99000 },
  { barcode: '1000068556128', name: 'Xalqaro pasport uchun g\'ilof (Rang: Jigarrang)', price: 99000 },
  { barcode: '1000068556166', name: 'Xalqaro pasport uchun g\'ilof (Rang: Pushti)', price: 99000 },
  { barcode: '1000068556142', name: 'Xalqaro pasport uchun g\'ilof (Rang: Och ko\'k)', price: 99000 },
  { barcode: '1000068556135', name: 'Xalqaro pasport uchun g\'ilof (Rang: Qora)', price: 99000 },
  { barcode: '1000063735528', name: 'Simsiz Bluetooth quloqchinlar Air 31', price: 60000 },
];

async function run() {
  console.log("Seeding test items...");

  // 1. Get a random category to attach these products to
  const { data: categories } = await supabase.from('categories_hierarchy').select('id, name').limit(1);
  const category_id = categories?.[0]?.id || null;
  const categoryName = categories?.[0]?.name || 'Test Category';

  if (!category_id) {
     console.log("Diqqat! Kategoriya topilmadi bazadan. Boshqa errorlar chiqishi mumkin.");
  }

  for (const item of items) {
    // Check if product already exists
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('barcode', item.barcode)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[SKIP] Product already exists: ${item.barcode} - ${item.name}`);
      // Asosiy tovari bor ekan, variantlari bormi tekshirib uni ham yaratamiz
      const prodId = existing[0].id;
      const { data: exVar } = await supabase.from('product_variants').select('id').eq('sku', item.barcode).limit(1);
      if(!exVar || exVar.length === 0){
          await supabase.from('product_variants').insert({
             product_id: prodId,
             sku: item.barcode,
             stock_quantity: 10,
             cost_price: item.price
          });
          console.log(`[ADD] Variant created for existing product: ${item.barcode}`);
      }
      continue;
    }

    // Insert Product
    const { data: prodData, error: prodErr } = await supabase
      .from('products')
      .insert({
        uuid: crypto.randomUUID(),
        name: item.name,
        barcode: item.barcode,
        price: item.price * 2, // Sotuv narxi 2 barobar qimmat
        cost_price: item.price,
        category: categoryName,
        category_id: category_id, 
        marketplace_ready: true
      })
      .select('id')
      .single();

    if (prodErr || !prodData) {
      console.error(`[ERROR] Failed to insert product ${item.barcode}:`, prodErr);
      continue;
    }

    // Insert Variant
    const { error: varErr } = await supabase
      .from('product_variants')
      .insert({
        product_id: prodData.id,
        sku: item.barcode, // Sku sifatida barcode o'zini saqlaymiz test uchun, skaner ham sku ni o'qiydi asosan
        stock_quantity: 50, // Test uchun 50 ta soni berib qoyamiz
        cost_price: item.price,
      });

    if (varErr) {
      console.error(`[ERROR] Failed to insert variant for ${item.barcode}:`, varErr);
    } else {
      console.log(`[SUCCESS] Seeded: ${item.name} (${item.barcode})`);
    }
  }

  console.log("Seeding completed successfully. You can now test the file scanner!");
}

run();
