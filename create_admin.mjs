import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr;
try {
  envStr = fs.readFileSync('.env', 'utf-8');
} catch (e) {
  console.error(".env faylni o'qishda xato. Iltimos tekshiring.");
  process.exit(1);
}

const envVars = {};
envStr.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Xato: VITE_SUPABASE_URL yoki SUPABASE_SERVICE_ROLE_KEY .env faylda topilmadi.");
  console.log("Topilgan o'zgaruvchilar:", Object.keys(envVars));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const email = 'skillhub1@gmail.com'; 
  const password = '12345678'; 

  console.log(`\nYangi foydalanuvchi yaratilmoqda: ${email}...`);

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (userError) {
    if (userError.message.includes('already registered')) {
      console.log('Foydalanuvchi allaqachon mavjud.');
    } else {
      console.error("Foydalanuvchi yaratishda xato:", userError);
      return;
    }
  } else {
    console.log('Foydalanuvchi muvaffaqiyatli yaratildi (auth.users)');
  }

  const { data: users, error: findError } = await supabase.auth.admin.listUsers();
  
  if (findError) {
    console.error("Foydalanuvchilarni olishda xato:", findError);
    return;
  }

  const user = users.users.find(u => u.email === email);

  if (!user) {
    console.error("Foydalanuvchi topilmadi.");
    return;
  }

  console.log(`\nFoydalanuvchiga 'bosh_admin' roli berilmoqda...`);

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .upsert({ user_id: user.id, role: 'bosh_admin' });

  if (roleError) {
    console.error("Role berishda xato:", roleError);
  } else {
    console.log("Muvaffaqiyatli! Endi dasturga quyidagi ma'lumotlar bilan kira olasiz:");
    console.log(`Email: ${email}`);
    console.log(`Parol: ${password}\n`);
  }
}

createAdmin();
