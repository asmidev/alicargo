import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Link2, 
  Unlink, 
  Check, 
  Copy, 
  ExternalLink,
  Bell,
  Package,
  Truck,
  AlertTriangle,
  Calendar,
  MessagesSquare,
  ClipboardList,
  ShoppingCart,
  TrendingDown,
  Store
} from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';

const BOT_USERNAME = 'crm_logistics_bot';

export default function TelegramSettings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [verificationCode, setVerificationCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const { data: telegramUser, isLoading } = useQuery({
    queryKey: ['telegram-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('telegram_users')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const verifyLink = useMutation({
    mutationFn: async (code: string) => {
      const { data: pending, error: findError } = await supabase
        .from('telegram_users')
        .select('*')
        .eq('verification_code', code.toUpperCase())
        .eq('is_verified', false)
        .single();
      if (findError || !pending) {
        throw new Error(t('tg_invalid_code'));
      }
      const { error: updateError } = await supabase
        .from('telegram_users')
        .update({ user_id: user?.id, is_verified: true, verification_code: null })
        .eq('id', pending.id);
      if (updateError) throw updateError;
      return pending;
    },
    onSuccess: () => {
      toast.success(t('tg_linked_success'));
      queryClient.invalidateQueries({ queryKey: ['telegram-user'] });
      setVerificationCode('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const unlinkTelegram = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('telegram_users')
        .delete()
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('tg_unlinked'));
      queryClient.invalidateQueries({ queryKey: ['telegram-user'] });
    }
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<typeof telegramUser>) => {
      const { error } = await supabase
        .from('telegram_users')
        .update(settings)
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('tg_settings_saved'));
      queryClient.invalidateQueries({ queryKey: ['telegram-user'] });
    }
  });

  const copyBotLink = () => {
    navigator.clipboard.writeText(`https://t.me/${BOT_USERNAME}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success(t('tg_link_copied'));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  const notificationItems = [
    { key: 'notify_shipments', icon: Truck, color: 'text-orange-500', label: t('tg_shipments'), desc: t('tg_shipments_desc'), field: 'notify_shipments' as const },
    { key: 'notify_arrivals', icon: Package, color: 'text-green-500', label: t('tg_arrivals'), desc: t('tg_arrivals_desc'), field: 'notify_arrivals' as const },
    { key: 'notify_defects', icon: AlertTriangle, color: 'text-red-500', label: t('tg_defects'), desc: t('tg_defects_desc'), field: 'notify_defects' as const },
    { key: 'notify_daily', icon: Calendar, color: 'text-blue-500', label: t('tg_daily_summary'), desc: t('tg_daily_summary_desc'), field: 'notify_daily_summary' as const },
  ];

  const extendedNotificationItems = [
    { key: 'notify_messages', icon: MessagesSquare, color: 'text-purple-500', label: t('tg_messages'), desc: t('tg_messages_desc'), field: 'notify_messages' },
    { key: 'notify_tasks', icon: ClipboardList, color: 'text-indigo-500', label: t('tg_tasks'), desc: t('tg_tasks_desc'), field: 'notify_tasks' },
  ];

  const marketplaceNotificationItems = [
    { key: 'notify_orders', icon: ShoppingCart, color: 'text-green-600', label: t('tg_new_orders'), desc: t('tg_new_orders_desc'), field: 'notify_marketplace_orders' },
    { key: 'notify_low_stock', icon: TrendingDown, color: 'text-amber-500', label: t('tg_low_stock'), desc: t('tg_low_stock_desc'), field: 'notify_low_stock' },
  ];

  const botCommands = [
    { cmd: '/start', desc: t('tg_cmd_start') },
    { cmd: '/status', desc: t('tg_cmd_status') },
    { cmd: '/today', desc: t('tg_cmd_today') },
    { cmd: '/settings', desc: t('tg_cmd_settings') },
    { cmd: '/unlink', desc: t('tg_cmd_unlink') },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-[#0088cc]" />
          {t('tg_title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('tg_subtitle')}</p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t('tg_connection_status')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {telegramUser?.is_verified ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="bg-green-500">
                  <Check className="h-3 w-3 mr-1" />
                  {t('tg_connected')}
                </Badge>
                <span className="text-muted-foreground">
                  @{telegramUser.telegram_username || t('tg_user')}
                </span>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => unlinkTelegram.mutate()}
                disabled={unlinkTelegram.isPending}
              >
                <Unlink className="h-4 w-4 mr-2" />
                {t('tg_disconnect')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{t('tg_not_connected')}</Badge>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium">{t('tg_link_instructions')}</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>{t('tg_step1')}</li>
                  <li>{t('tg_step2')}</li>
                  <li>{t('tg_step3')}</li>
                </ol>

                <Button variant="outline" className="w-full justify-between" onClick={copyBotLink}>
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-[#0088cc]" />
                    t.me/{BOT_USERNAME}
                  </span>
                  {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>

                <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full bg-[#0088cc] hover:bg-[#0077b5]">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t('tg_open_bot')}
                  </Button>
                </a>
              </div>

              <div className="pt-4 border-t">
                <Label htmlFor="code">{t('tg_verification_code')}</Label>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <Input
                    id="code"
                    placeholder="ABC123"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="font-mono text-lg tracking-wider uppercase"
                  />
                  <Button 
                    onClick={() => verifyLink.mutate(verificationCode)}
                    disabled={verificationCode.length < 6 || verifyLink.isPending}
                    className="min-h-[44px] sm:min-h-0"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {t('tg_verify')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      {telegramUser?.is_verified && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('tg_notification_settings')}
            </CardTitle>
            <CardDescription>{t('tg_choose_notifications')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notificationItems.map(({ key, icon: Icon, color, label, desc, field }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch
                  checked={telegramUser[field] as boolean}
                  onCheckedChange={(checked) => updateSettings.mutate({ [field]: checked })}
                />
              </div>
            ))}

            {extendedNotificationItems.map(({ key, icon: Icon, color, label, desc, field }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch
                  checked={(telegramUser as Record<string, unknown>)[field] !== false}
                  onCheckedChange={(checked) => updateSettings.mutate({ [field]: checked } as Record<string, unknown>)}
                />
              </div>
            ))}

            {/* Marketplace section */}
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-4">
                <Store className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t('tg_marketplace')}</span>
              </div>
            </div>

            {marketplaceNotificationItems.map(({ key, icon: Icon, color, label, desc, field }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch
                  checked={(telegramUser as Record<string, unknown>)[field] !== false}
                  onCheckedChange={(checked) => updateSettings.mutate({ [field]: checked } as Record<string, unknown>)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bot Commands */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tg_bot_commands')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {botCommands.map(({ cmd, desc }) => (
              <div key={cmd} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <code className="bg-muted px-2 py-1 rounded text-xs w-fit">{cmd}</code>
                <span className="text-muted-foreground text-xs sm:text-sm">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
