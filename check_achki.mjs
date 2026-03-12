import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: prod } = await supabase.from('products').select('*').ilike('name', '%Achki%');
  console.log('Product:', prod);
  if (prod && prod.length > 0) {
    const { data: items } = await supabase.from('product_items').select('*').eq('product_id', prod[0].id);
    let totalUnit = 0;
    let totalDom = 0;
    let totalIntl = 0;
    for (const it of items) {
      totalUnit += (it.unit_cost || 0);
      totalDom += (it.domestic_shipping_cost || 0);
      totalIntl += (it.international_shipping_cost || 0);
    }
    console.log('Items avg cost:', items.length ? totalUnit / items.length : 0, 'length:', items.length);
    console.log('Items avg dom cost:', items.length ? totalDom / items.length : 0);
    console.log('Items avg intl cost:', items.length ? totalIntl / items.length : 0);
  }
}
check();
