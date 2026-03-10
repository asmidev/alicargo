import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_id?: string;
  user_ids?: string[];
  role?: string;
  title: string;
  body?: string;
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    console.log('Received notification request:', payload);

    // Determine target users
    let targetUserIds: string[] = [];

    if (payload.user_id) {
      targetUserIds = [payload.user_id];
    } else if (payload.user_ids) {
      targetUserIds = payload.user_ids;
    } else if (payload.role) {
      // Get all users with this role
      const { data: roleUsers, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', payload.role);
      
      if (roleError) {
        console.error('Error fetching role users:', roleError);
        throw roleError;
      }
      targetUserIds = roleUsers?.map(r => r.user_id) || [];
    }

    if (targetUserIds.length === 0) {
      console.log('No target users found');
      return new Response(
        JSON.stringify({ success: false, message: 'No target users found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending notifications to ${targetUserIds.length} users`);

    // Create notification logs for all target users
    const notificationLogs = targetUserIds.map(userId => ({
      user_id: userId,
      title: payload.title,
      body: payload.body || null,
      event_type: payload.event_type,
      entity_type: payload.entity_type || null,
      entity_id: payload.entity_id || null,
      metadata: payload.metadata || {}
    }));

    const { error: logError } = await supabase
      .from('notification_logs')
      .insert(notificationLogs);

    if (logError) {
      console.error('Error creating notification logs:', logError);
      throw logError;
    }

    // Get push subscriptions for target users
    const { data: subscriptions, error: subError } = await supabase
      .from('notification_subscriptions')
      .select('*')
      .in('user_id', targetUserIds)
      .eq('is_active', true);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`Found ${subscriptions?.length || 0} push subscriptions`);

    // Note: Actual push notification sending would require web-push library
    // and VAPID keys. For now, we log and rely on realtime updates.
    // In production, you would implement web-push here.

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified_users: targetUserIds.length,
        push_subscriptions: subscriptions?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-notification:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
