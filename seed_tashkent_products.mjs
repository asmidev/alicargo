/* eslint-disable no-console */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedTashkent() {
  console.log('🚀 Starting Tashkent Warehouse Seeding (20 Products)...');

  try {
    // 1. Get Categories
    const { data: categories, error: catError } = await supabase
      .from('categories_hierarchy')
      .select('id, name')
      .limit(5);

    if (catError) throw catError;
    if (!categories || categories.length === 0) {
      console.log('⚠️ No categories found. Please run seed_database_all.mjs first.');
      return;
    }

    const productNames = [
      'Samsung Galaxy S24 Ultra', 'Sony WH-1000XM5 Headphones', 'Mechanical Keyboard K3',
      'Electric Kettle 2L', 'Air Purifier Pro', 'Smart LED Bulb E27',
      'Cotton T-Shirt Blue', 'Yoga Mat Non-Slip', 'Coffee Maker Espresso',
      'Bluetooth Speaker Mini', 'Wireless Mouse G305', 'Laptop Stand Aluminum',
      'Table Lamp LED', 'Desk Organizer', 'USB-C Hub 7-in-1',
      'Power Bank 20000mAh', 'Gaming Headset 7.1', 'Backpack 15.6 inch',
      'Water Bottle 750ml', 'Smartphone Tripod'
    ];

    const VALID_CREATOR = '6ff2e5be-e1d6-4b02-8076-43ac9a470bd1';

    const productsToInsert = productNames.map((name, index) => ({
      uuid: crypto.randomUUID(),
      name: name,
      category_id: categories[index % categories.length].id,
      tashkent_manual_stock: Math.floor(Math.random() * 50) + 10,
      status: 'active',
      source: 'manual',
      created_by: VALID_CREATOR,
      price: 15 + index,
      cost_price: 10 + index,
      purchase_currency: 'USD'
    }));

    console.log(`📦 Re-inserting ${productsToInsert.length} products with valid metadata...`);
    
    // First, delete old ones to avoid duplicates (clean start)
    await supabase.from('products').delete().in('name', productNames);

    const { data: insertedProducts, error: prodError } = await supabase
      .from('products')
      .insert(productsToInsert)
      .select();

    if (prodError) throw prodError;
    console.log(`✅ Seeded ${insertedProducts.length} products with manual stock.`);

    // 2. Add some specific product_items for a few products to test tracked inventory
    console.log('🔧 Adding some tracked items (product_items)...');
    const itemsToInsert = [];
    
    // Add 5 items for the first 3 products
    for (let i = 0; i < 3; i++) {
      const product = insertedProducts[i];
      for (let j = 0; j < 5; j++) {
        itemsToInsert.push({
          item_uuid: crypto.randomUUID(),
          product_id: product.id,
          status: 'in_tashkent',
          location: 'uzbekistan',
          unit_cost: 10 + j,
          unit_cost_currency: 'USD'
        });
      }
    }

    const { error: itemError } = await supabase
      .from('product_items')
      .insert(itemsToInsert);

    if (itemError) throw itemError;
    console.log(`✅ Seeded ${itemsToInsert.length} tracked items in Tashkent.`);

    console.log('✨ Tashkent Seeding Completed Successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  }
}

seedTashkent();
