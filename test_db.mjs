import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error("Missing supabase credentials in env (VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
    const { data: stores, error: storeError } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform, is_active, api_key_secret_name');

    if (storeError) {
        console.error("Store Error:", storeError);
    } else {
        console.log("Marketplace Stores:", stores);
    }

    const { data, error } = await supabase
        .from('marketplace_returns')
        .select('id, store_name, platform, external_order_id, product_title, return_type, return_reason, return_date')
        // .in('external_order_id', ['54210334785', '54034422145']) 
        .limit(10);

    if (error) {
        console.error("DB Error:", error);
    } else {
        console.log("Specific Yandex Orders:", data);
    }

    // Also check any recent FBO returns
    const { data: fboData, error: fboError } = await supabase
        .from('marketplace_returns')
        .select('id, store_name, platform, external_order_id, product_title, return_type, return_reason, return_date')
        .ilike('return_type', '%fbo%')
        .order('return_date', { ascending: false })
        .limit(5);

    if (fboError) {
        console.error("DB Error (FBO):", fboError);
    } else {
        console.log("Recent FBO returns:", fboData);
    }
}

check();
