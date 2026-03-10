import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

const uzumStores = [
    { name: 'ALI BRAND MARKET', shop_id: '49052', api_key_secret_name: 'UZUM_API_KEY_49052' },
    { name: 'Atlas Market', shop_id: '69508', api_key_secret_name: 'UZUM_API_KEY_69508' },
    { name: 'Uzum China Market', shop_id: '69555', api_key_secret_name: 'UZUM_API_KEY_69555' },
    { name: 'Xit market', shop_id: '70010', api_key_secret_name: 'UZUM_API_KEY_70010' },
    { name: 'Atlas.Market', shop_id: '88409', api_key_secret_name: 'UZUM_API_KEY_88409' },
    { name: 'BM Store', shop_id: '89165', api_key_secret_name: 'UZUM_API_KEY_89165' },
    { name: 'BM_store', shop_id: '92638', api_key_secret_name: 'UZUM_API_KEY_92638' },
    { name: 'Alibrand.Market', shop_id: '92815', api_key_secret_name: 'UZUM_API_KEY_92815' }
].map(s => ({ ...s, platform: 'uzum', is_active: true }));

const yandexStores = [
    { name: 'AliBrand.Market', campaign_id: '148843590', fulfillment_type: 'fby', api_key_secret_name: 'YANDEX_API_KEY_216469176' },
    { name: 'Atlas Market', campaign_id: '148987777', fulfillment_type: 'fbs', api_key_secret_name: 'YANDEX_API_KEY_216469176' },
    { name: 'BM.Store 2', campaign_id: '148916383', fulfillment_type: 'fbs', api_key_secret_name: 'YANDEX_API_KEY_216515645' },
    { name: 'BM.Store 3', campaign_id: '148939239', fulfillment_type: 'fby', api_key_secret_name: 'YANDEX_API_KEY_216515645' }
].map(s => ({ ...s, platform: 'yandex', is_active: true }));

async function seed() {
    console.log("Seeding Uzum Stores...");
    const { error: uzumError } = await supabase.from('marketplace_stores').insert(uzumStores);
    if (uzumError) console.error("Uzum Error:", uzumError);
    else console.log("Uzum Stores seeded.");

    console.log("Seeding Yandex Stores...");
    const { error: yandexError } = await supabase.from('marketplace_stores').insert(yandexStores);
    if (yandexError) console.error("Yandex Error:", yandexError);
    else console.log("Yandex Stores seeded.");
}

seed();
