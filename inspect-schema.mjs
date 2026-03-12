import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectSchema() {
  console.log('Checking basic tables...');
  const tables = ['product_items', 'transactions', 'marketplace_sales', 'marketplace_returns', 'products', 'product_variants', 'defect_claims'];
  for(let t of tables) {
     const { data, error } = await supabase.from(t).select('*').limit(1);
     console.log(`Table ${t}:`, error ? error.message : Object.keys(data[0] || {}).join(', '));
  }
}
inspectSchema().catch(console.error);
