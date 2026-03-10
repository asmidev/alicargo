import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      username?: string;
      first_name: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
  };
}

async function sendTelegramMessage(chatId: number | string, text: string, options?: {
  parse_mode?: string;
  reply_markup?: Record<string, unknown>;
}) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('Telegram bot token not configured, skipping message');
    return null;
  }

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
      reply_markup: options?.reply_markup
    })
  });

  return response.json();
}

function generateVerificationCode(): string {
  // Use cryptographically secure random generation
  return crypto.randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle empty body (health check or invalid request)
    const body = await req.text();
    if (!body) {
      console.log('Empty request body received');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let update: TelegramUpdate;
    try {
      update = JSON.parse(body);
    } catch {
      console.log('Invalid JSON received:', body);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('Received Telegram update:', JSON.stringify(update));

    if (!update.message?.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const username = update.message.from.username;
    const firstName = update.message.from.first_name;

    // Handle /start command
    if (text === '/start') {
      const code = generateVerificationCode();
      
      // Check if chat already exists
      const { data: existing } = await supabase
        .from('telegram_users')
        .select('*')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (existing?.is_verified) {
        await sendTelegramMessage(chatId, 
          `✅ Sizning akkauntingiz allaqachon ulangan!\n\n` +
          `📊 /status - Hozirgi holat\n` +
          `📋 /today - Bugungi hisobot\n` +
          `⚙️ /settings - Sozlamalar\n` +
          `❓ /help - Barcha buyruqlar`
        );
      } else {
        // Create or update pending verification
        await supabase.from('telegram_users').upsert({
          telegram_chat_id: chatId.toString(),
          telegram_username: username,
          verification_code: code,
          is_verified: false
        }, { onConflict: 'telegram_chat_id' });

        await sendTelegramMessage(chatId,
          `🔐 <b>CRM tizimiga xush kelibsiz!</b>\n\n` +
          `Akkauntingizni ulash uchun quyidagi kodni CRM tizimidagi Telegram sozlamalarida kiriting:\n\n` +
          `<code>${code}</code>\n\n` +
          `Yoki CRM tizimida "Telegram ulash" tugmasini bosib, shu chatga qayting.`
        );
      }
    }

    // Handle /help command
    else if (text === '/help') {
      await sendTelegramMessage(chatId,
        `❓ <b>Mavjud buyruqlar</b>\n\n` +
        `📊 /status - Qutilar va jo'natmalar holati\n` +
        `📋 /today - Bugungi hodisalar\n` +
        `📦 /arrived BOX-123 - Qutini yetib keldi deb belgilash\n` +
        `🔍 /eta BOX-123 - Quti ETA ni ko'rish\n` +
        `⚙️ /settings - Bildirishnoma sozlamalari\n` +
        `🔗 /unlink - Telegramni uzish\n\n` +
        `💬 <b>Xabar yuborish</b>\n` +
        `Rahbar va bosh menejerlar oddiy matn yozib jamoa chatiga xabar yuborishlari mumkin.`
      );
    }

    // Handle /arrived command - Quick arrival confirmation
    else if (text.startsWith('/arrived')) {
      const { data: telegramUser } = await supabase
        .from('telegram_users')
        .select('*, user_id')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (!telegramUser?.is_verified || !telegramUser?.user_id) {
        await sendTelegramMessage(chatId, '❌ Avval akkauntingizni ulang. /start buyrug\'ini yuboring.');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if user has permission (uz_manager, uz_receiver, or higher)
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', telegramUser.user_id);

      const allowedRoles = ['rahbar', 'bosh_admin', 'uz_manager', 'uz_receiver', 'uz_quality'];
      const hasPermission = userRoles?.some(r => allowedRoles.includes(r.role));

      if (!hasPermission) {
        await sendTelegramMessage(chatId, '❌ Sizda qutini tasdiqlash huquqi yo\'q.');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const boxNumber = text.replace('/arrived', '').trim().toUpperCase();
      
      if (!boxNumber) {
        // Show list of in-transit boxes
        const { data: inTransitBoxes } = await supabase
          .from('boxes')
          .select('id, box_number, estimated_arrival')
          .eq('status', 'in_transit')
          .order('estimated_arrival', { ascending: true })
          .limit(10);

        if (!inTransitBoxes || inTransitBoxes.length === 0) {
          await sendTelegramMessage(chatId, '📦 Hozir yo\'lda quti yo\'q.');
        } else {
          let message = `📦 <b>Yo'ldagi qutilar</b>\n\n`;
          inTransitBoxes.forEach((box, idx) => {
            const eta = box.estimated_arrival ? new Date(box.estimated_arrival).toLocaleDateString('uz-UZ') : 'Noma\'lum';
            message += `${idx + 1}. <code>${box.box_number}</code> - ETA: ${eta}\n`;
          });
          message += `\n💡 Yetib kelgan qutini belgilash uchun:\n<code>/arrived BOX-12345</code>`;
          await sendTelegramMessage(chatId, message);
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Find box by number
      const { data: box } = await supabase
        .from('boxes')
        .select('id, box_number, status, location')
        .ilike('box_number', `%${boxNumber}%`)
        .maybeSingle();

      if (!box) {
        await sendTelegramMessage(chatId, `❌ "${boxNumber}" raqamli quti topilmadi.`);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (box.status !== 'in_transit') {
        await sendTelegramMessage(chatId, 
          `📦 <b>${box.box_number}</b>\n\n` +
          `Holat: ${box.status === 'arrived' ? '✅ Allaqachon yetib kelgan' : box.status}\n` +
          `Joylashuv: ${box.location}`
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Mark box as arrived using the RPC function
      const { data: result } = await supabase.rpc('mark_box_arrived_on_scan', {
        p_box_id: box.id,
        p_user_id: telegramUser.user_id
      });

      const resultObj = result as { auto_arrived?: boolean; box_number?: string; message?: string } | null;
      
      if (resultObj?.auto_arrived) {
        await sendTelegramMessage(chatId,
          `✅ <b>Quti yetib keldi!</b>\n\n` +
          `📦 ${box.box_number}\n` +
          `📍 Joylashuv: O'zbekiston\n` +
          `⏰ Vaqt: ${new Date().toLocaleString('uz-UZ')}\n\n` +
          `Quti avtomatik "Yetib keldi" deb belgilandi.`
        );
      } else {
        await sendTelegramMessage(chatId, `ℹ️ ${resultObj?.message || 'Xatolik yuz berdi'}`);
      }
    }

    // Handle /eta command - Check box ETA
    else if (text.startsWith('/eta')) {
      const { data: telegramUser } = await supabase
        .from('telegram_users')
        .select('*')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (!telegramUser?.is_verified) {
        await sendTelegramMessage(chatId, '❌ Avval akkauntingizni ulang. /start buyrug\'ini yuboring.');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const boxNumber = text.replace('/eta', '').trim().toUpperCase();

      if (!boxNumber) {
        await sendTelegramMessage(chatId, '💡 Quti ETA ni ko\'rish uchun:\n<code>/eta BOX-12345</code>');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: box } = await supabase
        .from('boxes')
        .select('id, box_number, status, location, estimated_arrival, actual_arrival, days_in_transit')
        .ilike('box_number', `%${boxNumber}%`)
        .maybeSingle();

      if (!box) {
        await sendTelegramMessage(chatId, `❌ "${boxNumber}" raqamli quti topilmadi.`);
      } else {
        let eta = 'Noma\'lum';
        let status = box.status;
        
        if (box.actual_arrival) {
          eta = `✅ ${new Date(box.actual_arrival).toLocaleDateString('uz-UZ')} da yetib kelgan`;
        } else if (box.estimated_arrival) {
          const etaDate = new Date(box.estimated_arrival);
          const today = new Date();
          const daysLeft = Math.ceil((etaDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysLeft < 0) {
            eta = `⚠️ ${Math.abs(daysLeft)} kun kechikmoqda`;
          } else if (daysLeft === 0) {
            eta = '🔔 Bugun yetib kelishi kutilmoqda';
          } else {
            eta = `📅 ${etaDate.toLocaleDateString('uz-UZ')} (${daysLeft} kun qoldi)`;
          }
        }

        await sendTelegramMessage(chatId,
          `📦 <b>${box.box_number}</b>\n\n` +
          `📍 Holat: ${status}\n` +
          `🗺 Joylashuv: ${box.location}\n` +
          `🚚 ETA: ${eta}\n` +
          (box.days_in_transit ? `⏱ Yo'lda: ${box.days_in_transit} kun` : '')
        );
      }
    }

    // Handle /status command
    else if (text === '/status') {
      const { data: telegramUser } = await supabase
        .from('telegram_users')
        .select('*, user_id')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (!telegramUser?.is_verified) {
        await sendTelegramMessage(chatId, '❌ Avval akkauntingizni ulang. /start buyrug\'ini yuboring.');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get shipment stats
      const { data: shipments } = await supabase
        .from('shipments')
        .select('status')
        .in('status', ['pending', 'in_transit']);

      const pending = shipments?.filter(s => s.status === 'pending').length || 0;
      const inTransit = shipments?.filter(s => s.status === 'in_transit').length || 0;

      // Get box stats
      const { data: boxes } = await supabase
        .from('boxes')
        .select('status, location')
        .in('location', ['china', 'transit']);

      const chinaBoxes = boxes?.filter(b => b.location === 'china').length || 0;
      const transitBoxes = boxes?.filter(b => b.location === 'transit').length || 0;

      await sendTelegramMessage(chatId,
        `📊 <b>Hozirgi holat</b>\n\n` +
        `📦 <b>Qutilar:</b>\n` +
        `• Xitoyda: ${chinaBoxes} ta\n` +
        `• Yo'lda: ${transitBoxes} ta\n\n` +
        `🚚 <b>Jo'natmalar:</b>\n` +
        `• Kutilmoqda: ${pending} ta\n` +
        `• Yo'lda: ${inTransit} ta`
      );
    }

    // Handle /today command
    else if (text === '/today') {
      const { data: telegramUser } = await supabase
        .from('telegram_users')
        .select('*')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (!telegramUser?.is_verified) {
        await sendTelegramMessage(chatId, '❌ Avval akkauntingizni ulang. /start buyrug\'ini yuboring.');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Get today's events
      const { data: events } = await supabase
        .from('tracking_events')
        .select('event_type, description')
        .gte('created_at', today)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!events || events.length === 0) {
        await sendTelegramMessage(chatId, '📋 Bugun hech qanday hodisa yo\'q.');
      } else {
        const eventList = events.map(e => `• ${e.description || e.event_type}`).join('\n');
        await sendTelegramMessage(chatId,
          `📋 <b>Bugungi hodisalar</b>\n\n${eventList}`
        );
      }
    }

    // Handle /settings command
    else if (text === '/settings') {
      const { data: telegramUser } = await supabase
        .from('telegram_users')
        .select('*')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (!telegramUser?.is_verified) {
        await sendTelegramMessage(chatId, '❌ Avval akkauntingizni ulang. /start buyrug\'ini yuboring.');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await sendTelegramMessage(chatId,
        `⚙️ <b>Bildirishnoma sozlamalari</b>\n\n` +
        `• Jo'natmalar: ${telegramUser.notify_shipments ? '✅' : '❌'}\n` +
        `• Yetib kelish: ${telegramUser.notify_arrivals ? '✅' : '❌'}\n` +
        `• Nuqsonlar: ${telegramUser.notify_defects ? '✅' : '❌'}\n` +
        `• Kunlik hisobot: ${telegramUser.notify_daily_summary ? '✅' : '❌'}\n` +
        `• Chat xabarlari: ${telegramUser.notify_messages ? '✅' : '❌'}\n\n` +
        `Sozlamalarni o'zgartirish uchun CRM tizimidagi Telegram sahifasiga o'ting.`
      );
    }

    // Handle /unlink command
    else if (text === '/unlink') {
      await supabase
        .from('telegram_users')
        .delete()
        .eq('telegram_chat_id', chatId.toString());

      await sendTelegramMessage(chatId, '✅ Telegram akkauntingiz CRM tizimidan uzildi.');
    }

    // Handle regular text messages from verified rahbar/bosh_admin - send to collaboration chat
    else if (!text.startsWith('/')) {
      const { data: telegramUser } = await supabase
        .from('telegram_users')
        .select('*, user_id')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (!telegramUser?.is_verified || !telegramUser?.user_id) {
        await sendTelegramMessage(chatId, '❌ Avval akkauntingizni ulang. /start buyrug\'ini yuboring.');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if user has rahbar or bosh_admin role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', telegramUser.user_id);

      const allowedRoles = ['rahbar', 'bosh_admin'];
      const hasPermission = userRoles?.some(r => allowedRoles.includes(r.role));

      if (!hasPermission) {
        await sendTelegramMessage(chatId, 
          '❌ Xabar yuborish faqat rahbar va bosh menejerlar uchun mavjud.\n\n' +
          '❓ /help - Barcha buyruqlarni ko\'rish'
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Insert message into team_messages
      const { error: insertError } = await supabase
        .from('team_messages')
        .insert({
          sender_id: telegramUser.user_id,
          content: `📱 [Telegram] ${text}`,
          channel: 'general'
        });

      if (insertError) {
        console.error('Error inserting message:', insertError);
        await sendTelegramMessage(chatId, '❌ Xabar yuborishda xatolik yuz berdi.');
      } else {
        await sendTelegramMessage(chatId, '✅ Xabar jamoa chatiga yuborildi!');
        console.log(`Message from ${username || firstName} sent to team chat: ${text}`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in telegram-bot:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});