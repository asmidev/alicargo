/* eslint-disable no-console */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('🚀 Starting Comprehensive Seed...');

  try {
    // 1. Marketplace Stores
    console.log('📦 Seeding Marketplace Stores...');
    const { data: stores, error: storesError } = await supabase.from('marketplace_stores').insert([
      { name: 'Uzum Market', is_active: true, platform: 'uzum', api_key_secret_name: 'UZUM_API_KEY' },
      { name: 'Yandex Market', is_active: true, platform: 'yandex', api_key_secret_name: 'YANDEX_API_KEY' },
      { name: 'ZoodMall', is_active: true, platform: 'uzum', api_key_secret_name: 'ZOOD_API_KEY' },
      { name: 'Olcha.uz', is_active: true, platform: 'uzum', api_key_secret_name: 'OLCHA_API_KEY' }
    ]).select();
    
    // If it fails due to existing names (duplicate key), just fetch them
    if (storesError && storesError.code === '23505') {
       console.log('⚠️ Stores already exist, fetching them...');
       const { data: existingStores, error: fetchError } = await supabase.from('marketplace_stores').select();
       if (fetchError) throw fetchError;
       console.log(`✅ Retrieved ${existingStores.length} existing stores.`);
    } else if (storesError) {
       throw storesError;
    } else {
       console.log(`✅ Seeded ${stores.length} new stores.`);
    }

    // 2. Defect Categories
    console.log('🛠️ Seeding Defect Categories...');
    const { data: defectCats, error: defectError } = await supabase.from('defect_categories').upsert([
      { name: 'Broken', name_uz: 'Siniq', name_ru: 'Сломано', name_en: 'Broken', icon: 'wrench', is_active: true, sort_order: 1 },
      { name: 'Missing Item', name_uz: 'Yo\'qolgan', name_ru: 'Некомплект', name_en: 'Missing Item', icon: 'package-search', is_active: true, sort_order: 2 },
      { name: 'Wrong Product', name_uz: 'Noto\'g\'ri mahsulot', name_ru: 'Не тот товар', name_en: 'Wrong Product', icon: 'alert-triangle', is_active: true, sort_order: 3 },
      { name: 'Damaged Packaging', name_uz: 'Qadoq shikastlangan', name_ru: 'Повреждена упаковка', name_en: 'Damaged Packaging', icon: 'package', is_active: true, sort_order: 4 }
    ], { onConflict: 'name' }).select();
    if (defectError) throw defectError;
    console.log(`✅ Seeded ${defectCats.length} defect categories.`);

    // 3. Categories Hierarchy
    console.log('📂 Seeding Categories Hierarchy...');
    const { data: categories, error: catError } = await supabase.from('categories_hierarchy').insert([
      { name: 'Electronics', slug: 'electronics', level: 0, is_active: true },
      { name: 'Home & Garden', slug: 'home-garden', level: 0, is_active: true },
      { name: 'Apparel', slug: 'apparel', level: 0, is_active: true }
    ]).select();
    
    let finalCategories = categories;
    if (catError && catError.code === '23505') {
       const { data: existingCats } = await supabase.from('categories_hierarchy').select();
       finalCategories = existingCats;
    } else if (catError) throw catError;
    console.log(`✅ Seeded ${finalCategories.length} categories.`);

    // 4. Products
    console.log('📱 Seeding Products...');
    const electronics = finalCategories.find(c => c.slug === 'electronics');
    const { data: products, error: prodError } = await supabase.from('products').insert([
      { uuid: crypto.randomUUID(), name: 'iPhone 15 Pro', category_id: electronics?.id },
      { uuid: crypto.randomUUID(), name: 'Xiaomi 14', category_id: electronics?.id },
      { uuid: crypto.randomUUID(), name: 'MacBook Air M3', category_id: electronics?.id }
    ]).select();

    let finalProducts = products;
    if (prodError && prodError.code === '23505') {
       const { data: existingProds } = await supabase.from('products').select();
       finalProducts = existingProds;
    } else if (prodError) throw prodError;
    console.log(`✅ Seeded ${finalProducts.length} products.`);

    // 5. Product Variants
    console.log('🎨 Seeding Product Variants...');
    const iphone = finalProducts.find(p => p.name === 'iPhone 15 Pro');
    const xiaomi = finalProducts.find(p => p.name === 'Xiaomi 14');
    
    if (iphone && xiaomi) {
      const { data: variants, error: varError } = await supabase.from('product_variants').insert([
        { product_id: iphone.id, sku: 'IP15P-128-BLK', price: 999, stock_quantity: 10 },
        { product_id: iphone.id, sku: 'IP15P-256-BLU', price: 1099, stock_quantity: 5 },
        { product_id: xiaomi.id, sku: 'X14-256-GRY', price: 799, stock_quantity: 15 }
      ]).select();
      
      if (varError && varError.code !== '23505') throw varError;
      console.log('✅ Seeded variants.');
    }

    // 6. Boxes (Logistics)
    console.log('📦 Seeding Boxes...');
    const { data: boxes, error: boxError } = await supabase.from('boxes').upsert([
      { box_number: 'BOX-001', status: 'arrived', weight_kg: 10.5, volume_m3: 0.1 },
      { box_number: 'BOX-002', status: 'in_transit', weight_kg: 5.2, volume_m3: 0.05 },
      { box_number: 'BOX-003', status: 'pending', weight_kg: 8.0, volume_m3: 0.08 }
    ], { onConflict: 'box_number' }).select();
    if (boxError) throw boxError;
    console.log(`✅ Seeded ${boxes.length} boxes.`);

    console.log('✨ Seed Finalized Successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
  }
}

seed();
