import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env variables (assuming they are in .env or we can parse them from .env.local)
const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL="?(.*?)"?$/m)?.[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_PUBLISHABLE_KEY="?(.*?)"?$/m)?.[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPhantomItems() {
  const { data, error } = await supabase
    .from('product_items')
    .select('*, products(name)')
    .is('box_id', null)
    .in('status', ['pending', 'arrived'])
    .in('location', ['china', 'uzbekistan']);

  if (error) {
    console.error('Error fetching items:', error);
    return;
  }

  const grouped = {};
  data.forEach(item => {
    const name = item.products?.name || 'Unknown';
    if (!grouped[name]) {
      grouped[name] = 0;
    }
    grouped[name]++;
  });

  console.log('Orphaned Packable Items Count per Product:');
  console.log(grouped);
}

checkPhantomItems();
