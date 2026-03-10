import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

interface AlertPayload {
  event_type: 'box_sealed' | 'shipment_departed' | 'box_arrived' | 'defect_found' | 'daily_summary' | 'verification_complete' | 'new_message' | 'task_assigned' | 'task_due_soon' | 'task_overdue' | 'price_gap_alert' | 'new_marketplace_order' | 'low_marketplace_stock' | 'sync_failed' | 'marketplace_daily_digest' | 'new_store_order';
  data: Record<string, unknown>;
  target_roles?: string[];
  target_user_id?: string;
}

const eventEmojis: Record<string, string> = {
  box_sealed: '📦',
  shipment_departed: '🚚',
  box_arrived: '✅',
  defect_found: '⚠️',
  daily_summary: '📊',
  verification_complete: '✔️',
  new_message: '💬',
  task_assigned: '📋',
  task_due_soon: '⏰',
  task_overdue: '🚨',
  price_gap_alert: '💰',
  new_marketplace_order: '🛒',
  low_marketplace_stock: '📉',
  sync_failed: '🔴',
  marketplace_daily_digest: '📈',
  new_store_order: '🛍️'
};

async function sendTelegramMessage(chatId: string, text: string) {
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
      parse_mode: 'HTML'
    })
  });

  return response.json();
}

function formatAlertMessage(eventType: string, data: Record<string, unknown>): string {
  const emoji = eventEmojis[eventType] || '📢';
  
  switch (eventType) {
    case 'box_sealed':
      return `${emoji} <b>Quti muhrlandi</b>\n\n` +
        `Quti: ${data.box_number}\n` +
        `Mahsulotlar: ${data.item_count || '-'} ta\n` +
        `Muhrlagan: ${data.sealed_by || '-'}`;

    case 'shipment_departed':
      return `${emoji} <b>Jo'natma yo'lga chiqdi</b>\n\n` +
        `Jo'natma: ${data.shipment_number}\n` +
        `Qutilar: ${data.box_count} ta\n` +
        `Tashuvchi: ${data.carrier || 'AbuSaxiy'}`;

    case 'box_arrived':
      return `${emoji} <b>Quti yetib keldi</b>\n\n` +
        `Quti: ${data.box_number}\n` +
        `Jo'natma: ${data.shipment_number || '-'}`;

    case 'defect_found':
      return `${emoji} <b>Nuqson topildi!</b>\n\n` +
        `Quti: ${data.box_number}\n` +
        `Mahsulot: ${data.product_name || '-'}\n` +
        `Nuqson turi: ${data.defect_type || 'Noma\'lum'}\n` +
        `Rasmlar: ${data.photo_count || 0} ta`;

    case 'verification_complete':
      return `${emoji} <b>Tekshiruv yakunlandi</b>\n\n` +
        `Quti: ${data.box_number}\n` +
        `✅ Yaxshi: ${data.ok_count || 0} ta\n` +
        `⚠️ Nuqsonli: ${data.defect_count || 0} ta\n` +
        `❌ Yetishmaydi: ${data.missing_count || 0} ta`;

    case 'daily_summary':
      return `${emoji} <b>Kunlik hisobot</b>\n\n` +
        `📦 Yangi qutilar: ${data.new_boxes || 0}\n` +
        `🚚 Jo'natmalar: ${data.shipments || 0}\n` +
        `✅ Yetib keldi: ${data.arrived || 0}\n` +
        `⚠️ Nuqsonlar: ${data.defects || 0}`;

    case 'new_message':
      return `${emoji} <b>Yangi xabar</b>\n\n` +
        `👤 ${data.sender_name || 'Foydalanuvchi'}\n` +
        `📝 ${data.content}\n` +
        `📍 #${data.channel || 'general'}`;

    case 'task_assigned':
      return `${emoji} <b>Sizga vazifa tayinlandi</b>\n\n` +
        `📋 ${data.task_title}\n` +
        `👤 Tayinlagan: ${data.assigned_by || '-'}\n` +
        `📍 Joylashuv: ${data.location || '-'}\n` +
        `🎯 Muhimlik: ${data.priority || 'medium'}\n` +
        `📅 Muddat: ${data.due_date || 'Belgilanmagan'}`;

    case 'task_due_soon':
      return `${emoji} <b>Vazifa muddati yaqinlashmoqda</b>\n\n` +
        `📋 ${data.task_title}\n` +
        `📅 Muddat: ${data.due_date}\n` +
        `⏳ Qoldi: ${data.time_remaining || '24 soat'}`;

    case 'task_overdue':
      return `${emoji} <b>Vazifa muddati o'tib ketdi!</b>\n\n` +
        `📋 ${data.task_title}\n` +
        `📅 Muddat: ${data.due_date}\n` +
        `⚠️ Kechikish: ${data.overdue_by || '-'}`;

    case 'price_gap_alert':
      const gapSign = (data.price_gap_percent as number) > 0 ? '+' : '';
      return `${emoji} <b>Raqobatdan qolish ogohlantirisнi!</b>\n\n` +
        `📦 Mahsulot: ${data.product_name}\n` +
        `💵 Biz: ${Number(data.our_price).toLocaleString()} so'm\n` +
        `🏪 ${data.competitor_name}: ${Number(data.competitor_price).toLocaleString()} so'm\n` +
        `📊 Farq: ${gapSign}${data.price_gap_percent}%\n` +
        (data.suggested_price ? `\n💡 <b>Tavsiya:</b> ${Number(data.suggested_price).toLocaleString()} so'm` : '');

    case 'new_marketplace_order':
      return `${emoji} <b>YANGI BUYURTMA</b>\n\n` +
        `🏪 Platform: ${data.platform || '-'}\n` +
        `🏬 Do'kon: ${data.store_name || '-'}\n` +
        `📋 Buyurtma: #${data.order_number || '-'}\n` +
        `👤 Mijoz: ${data.customer_name || '-'}\n` +
        `💰 Summa: ${data.total ? Number(data.total).toLocaleString() : '-'} so'm\n` +
        `📦 Mahsulotlar: ${data.items_count || 0} ta`;

    case 'low_marketplace_stock':
      return `${emoji} <b>STOCK PAST</b>\n\n` +
        `📦 Mahsulot: ${data.product_name || '-'}\n` +
        `🏪 Platform: ${data.platform || '-'}\n` +
        `🏬 Do'kon: ${data.store_name || '-'}\n` +
        `⚠️ Qoldi: ${data.current_stock || 0} ta\n` +
        `📊 Threshold: ${data.threshold || 5} ta\n\n` +
        `<i>Stock qo'shishni unutmang!</i>`;

    case 'sync_failed':
      return `${emoji} <b>SYNC XATOLIK</b>\n\n` +
        `🏪 Platform: ${data.platform || '-'}\n` +
        `🏬 Do'kon: ${data.store_name || '-'}\n` +
        `🔄 Sync turi: ${data.sync_type || '-'}\n` +
        `📦 Mahsulot: ${data.product_name || '-'}\n` +
        `❌ Xatolik: ${data.error || 'Noma\'lum'}\n` +
        `🔁 Urinishlar: ${data.attempts || 0}/3\n\n` +
        `<i>Loglarni tekshiring!</i>`;

    case 'new_store_order':
      return `${emoji} <b>YANGI SAYT BUYURTMA</b>\n\n` +
        `📋 Buyurtma: #${data.order_number || '-'}\n` +
        `👤 Mijoz: ${data.customer_name || '-'}\n` +
        `📞 Tel: ${data.customer_phone || '-'}\n` +
        `💰 Summa: ${data.total ? Number(data.total).toLocaleString() : '-'} so'm\n` +
        `📦 Mahsulotlar: ${data.items_count || 0} ta\n` +
        `🚚 Yetkazish: ${data.delivery_type === 'delivery' ? 'Yetkazib berish' : 'Olib ketish'}\n` +
        (data.address ? `📍 Manzil: ${data.address}\n` : '') +
        `\n<i>CRM dan tasdiqlang!</i>`;

    default:
      return `${emoji} <b>Bildirishnoma</b>\n\n${JSON.stringify(data)}`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Allow both authenticated users (via Authorization header) and internal calls (DB triggers use anon key)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: AlertPayload = await req.json();
    console.log('Received alert request:', payload);

    // Determine notification type filter
    const notifyFieldMap: Record<string, string> = {
      box_sealed: 'notify_shipments',
      shipment_departed: 'notify_shipments',
      box_arrived: 'notify_arrivals',
      defect_found: 'notify_defects',
      verification_complete: 'notify_defects',
      daily_summary: 'notify_daily_summary',
      new_message: 'notify_messages',
      task_assigned: 'notify_tasks',
      task_due_soon: 'notify_tasks',
      task_overdue: 'notify_tasks',
      price_gap_alert: 'notify_daily_summary',
      new_marketplace_order: 'notify_marketplace_orders',
      low_marketplace_stock: 'notify_low_stock',
      sync_failed: 'notify_daily_summary',
      marketplace_daily_digest: 'notify_daily_summary',
      new_store_order: 'notify_marketplace_orders'
    };
    
    const notifyField = notifyFieldMap[payload.event_type] || 'notify_shipments';

    // Build query for telegram users - use try/catch in case column doesn't exist
    let telegramUsers: Array<{ telegram_chat_id: string; user_id: string | null }> = [];
    
    try {
      const query = supabase
        .from('telegram_users')
        .select('telegram_chat_id, user_id')
        .eq('is_verified', true);
      
      // Only filter by notify field if it's not new_message (column might not exist yet)
      const { data, error: fetchError } = notifyField === 'notify_messages' 
        ? await query
        : await query.eq(notifyField, true);

      if (fetchError) {
        console.error('Error fetching telegram users:', fetchError);
        throw fetchError;
      }
      
      telegramUsers = data || [];
    } catch (err) {
      console.error('Failed to fetch telegram users, trying without filter:', err);
      // Fallback: get all verified users
      const { data } = await supabase
        .from('telegram_users')
        .select('telegram_chat_id, user_id')
        .eq('is_verified', true);
      telegramUsers = data || [];
    }

    // Filter by specific user if provided
    if (payload.target_user_id) {
      telegramUsers = telegramUsers.filter(u => u.user_id === payload.target_user_id);
    }

    // If target_roles specified, filter by role
    let filteredUsers = telegramUsers;
    if (payload.target_roles && payload.target_roles.length > 0 && !payload.target_user_id) {
      const { data: roleUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', payload.target_roles);

      const roleUserIds = new Set(roleUsers?.map(r => r.user_id) || []);
      filteredUsers = filteredUsers.filter(u => u.user_id && roleUserIds.has(u.user_id));
    }

    // For new_message events, exclude the sender from notifications
    if (payload.event_type === 'new_message' && payload.data.sender_id) {
      filteredUsers = filteredUsers.filter(u => u.user_id !== payload.data.sender_id);
    }

    console.log(`Sending alerts to ${filteredUsers.length} telegram users`);

    // Format and send message
    const message = formatAlertMessage(payload.event_type, payload.data);
    
    const results = await Promise.all(
      filteredUsers.map(user => sendTelegramMessage(user.telegram_chat_id, message))
    );

    const successCount = results.filter(r => r?.ok).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount,
        total: filteredUsers.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-telegram-alert:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});