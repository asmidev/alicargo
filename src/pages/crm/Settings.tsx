import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Settings as SettingsIcon, Bell, Globe, Info, ChevronRight, Download, MessageCircle,
  Image, Loader2, Plus, Trash2, Tag, Percent, DollarSign, RefreshCw, Database, CreditCard, Check
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { MobileHeader } from '@/components/mobile/navigation/MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { InstallCard } from '@/components/crm/InstallCard';
import { LanguageSwitcher } from '@/components/crm/LanguageSwitcher';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';

export default function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // === Mirror Images ===
  const [mirroring, setMirroring] = useState(false);

  // === Full Re-sync ===
  const [resyncing, setResyncing] = useState(false);
  const [resyncLog, setResyncLog] = useState<string[]>([]);
  const [resyncProgress, setResyncProgress] = useState(0);

  const addLog = useCallback((msg: string) => {
    setResyncLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleFullResync = async () => {
    if (resyncing) return;
    if (!confirm('Bu barcha marketplace ma\'lumotlarini yanvar 2026 dan qayta sinxronlaydi. Davom etasizmi?')) return;

    setResyncing(true);
    setResyncLog([]);
    setResyncProgress(0);

    try {
      // Step 1: Get stores
      addLog('Do\'konlar ro\'yxati olinmoqda...');
      const { data: storesData } = await supabase.functions.invoke('full-resync', {
        body: { phase: 'list_stores' },
      });
      const stores = storesData?.stores || [];
      addLog(`${stores.length} ta faol do'kon topildi`);

      // Step 2: Clean derived data
      addLog('Eski hisob-kitob ma\'lumotlari tozalanmoqda...');
      setResyncProgress(5);
      const { data: cleanData } = await supabase.functions.invoke('full-resync', {
        body: { phase: 'clean' },
      });
      addLog(`Tozalandi: ${cleanData?.deleted?.finance_summary || 0} moliya, ${cleanData?.deleted?.auto_transactions || 0} tranzaksiya, ${cleanData?.deleted?.returns || 0} qaytarish`);

      // Step 3: Sync orders for each store
      const orderStepSize = 70 / Math.max(stores.length, 1);
      for (let i = 0; i < stores.length; i++) {
        const store = stores[i];
        addLog(`Buyurtmalar sinxronlanmoqda: ${store.name} (${store.platform})...`);
        setResyncProgress(10 + i * orderStepSize);

        try {
          const { data: syncData } = await supabase.functions.invoke('full-resync', {
            body: { phase: 'sync_orders', store_id: store.id, startDate: '2026-01-01' },
          });
          const synced = syncData?.totalSynced || syncData?.result?.synced || 0;
          addLog(`✓ ${store.name}: ${synced} buyurtma sinxronlandi`);
        } catch (err: any) {
          addLog(`✗ ${store.name}: ${err.message}`);
        }
      }

      // Step 4: Sync returns for Yandex stores
      const yandexStores = stores.filter((s: any) => s.platform === 'yandex');
      for (const store of yandexStores) {
        addLog(`Qaytarishlar sinxronlanmoqda: ${store.name}...`);
        try {
          await supabase.functions.invoke('full-resync', {
            body: { phase: 'sync_returns', store_id: store.id, startDate: '2026-01-01' },
          });
          addLog(`✓ ${store.name}: qaytarishlar sinxronlandi`);
        } catch (err: any) {
          addLog(`✗ ${store.name} qaytarishlar: ${err.message}`);
        }
      }

      // Step 5: Recalculate finance summaries
      addLog('Moliya xulosalari qayta hisoblanmoqda...');
      setResyncProgress(85);
      try {
        const { data: finData } = await supabase.functions.invoke('full-resync', {
          body: { phase: 'sync_finance', startDate: '2026-01-01' },
        });
        const totalDays = finData?.result?.total_days_synced || 0;
        addLog(`✓ Moliya: ${totalDays} kun sinxronlandi`);
      } catch (err: any) {
        addLog(`✗ Moliya sinxronlash: ${err.message}`);
      }

      setResyncProgress(100);
      addLog('✅ To\'liq sinxronizatsiya yakunlandi!');
      toast.success('To\'liq sinxronizatsiya yakunlandi');
      queryClient.invalidateQueries();
    } catch (err: any) {
      addLog(`❌ Xatolik: ${err.message}`);
      toast.error('Sinxronizatsiyada xatolik yuz berdi');
    } finally {
      setResyncing(false);
    }
  };

  const handleMirrorImages = async () => {
    setMirroring(true);
    try {
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .like('main_image_url', '%images.uzum.uz%')
        .eq('status', 'active');

      if (!products || products.length === 0) {
        toast.info('Barcha rasmlar allaqachon lokal saqlangan');
        setMirroring(false);
        return;
      }

      const batchSize = 20;
      let processed = 0;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize).map(p => p.id);
        await supabase.functions.invoke('mirror-product-images', { body: { product_ids: batch } });
        processed += batch.length;
        toast.info(`Rasmlar nusxalanmoqda: ${processed}/${products.length}`);
      }
      toast.success(`${products.length} ta mahsulot rasmi lokal saqlandi`);
    } catch (err) {
      console.error(err);
      toast.error('Rasmlarni nusxalashda xatolik');
    } finally {
      setMirroring(false);
    }
  };

  // === Promo Codes ===
  const [newPromo, setNewPromo] = useState({ code: '', discount_type: 'percent' as 'percent' | 'fixed', discount_value: '', min_order_amount: '', max_uses: '' });

  const { data: promoCodes, isLoading: loadingPromos } = useQuery({
    queryKey: ['promo-codes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createPromo = useMutation({
    mutationFn: async () => {
      if (!newPromo.code.trim() || !newPromo.discount_value) { throw new Error('Kodni va qiymatni kiriting'); }
      const { error } = await supabase.from('promo_codes').insert({
        code: newPromo.code.trim().toUpperCase(),
        discount_type: newPromo.discount_type,
        discount_value: Number(newPromo.discount_value),
        min_order_amount: newPromo.min_order_amount ? Number(newPromo.min_order_amount) : 0,
        max_uses: newPromo.max_uses ? Number(newPromo.max_uses) : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Promo kod yaratildi');
      setNewPromo({ code: '', discount_type: 'percent', discount_value: '', min_order_amount: '', max_uses: '' });
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePromo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promo_codes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("O'chirildi");
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // === Payment Card ===
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [cardForm, setCardForm] = useState({ card_number: '', card_holder: '', bank_name: 'Uzcard' });

  const { data: activeCard, isLoading: loadingCard } = useQuery({
    queryKey: ['payment-card-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_cards')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveCard = useMutation({
    mutationFn: async () => {
      if (!cardForm.card_number.trim() || !cardForm.card_holder.trim()) throw new Error('Karta raqami va egasini kiriting');
      // Deactivate old cards
      await supabase.from('payment_cards').update({ is_active: false } as any).eq('is_active', true);
      // Insert new
      const { error } = await supabase.from('payment_cards').insert({
        card_number: cardForm.card_number.trim(),
        card_holder: cardForm.card_holder.trim().toUpperCase(),
        bank_name: cardForm.bank_name,
        is_active: true,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Karta saqlandi');
      setCardForm({ card_number: '', card_holder: '', bank_name: 'Uzcard' });
      queryClient.invalidateQueries({ queryKey: ['payment-card-active'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const settingsLinks = [
    { icon: MessageCircle, title: t('settings_telegram_title'), description: t('settings_telegram_desc'), href: '/crm/telegram-settings' },
  ];

  return (
    <div className="space-y-6">
      <MobileHeader title={t('settings.title', 'Settings')} showBack />

      {!isMobile && (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><SettingsIcon className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">{t('settings.title', 'Settings')}</h1>
            <p className="text-muted-foreground">{t('settings.subtitle', 'Manage your app preferences')}</p>
          </div>
        </div>
      )}

      {/* App Installation */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.appInstallation', 'App Installation')}</h2>
        </div>
        <InstallCard />
      </section>

      <Separator />

      {/* Language */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.language', 'Language')}</h2>
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('settings.appLanguage', 'App Language')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.languageDescription', 'Choose your preferred language')}</p>
              </div>
              <LanguageSwitcher />
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Maintenance */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Texnik xizmat</h2>
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Rasmlarni lokal saqlash</p>
                <p className="text-sm text-muted-foreground">Uzum CDN rasmlarini lokal storage'ga nusxalash</p>
              </div>
              <Button onClick={handleMirrorImages} disabled={mirroring} variant="outline" size="sm">
                {mirroring ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Nusxalanmoqda...</> : <><Image className="w-4 h-4 mr-2" /> Mirror Images</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Full Re-sync */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">To'liq sinxronizatsiya</h2>
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Yanvar 2026 dan qayta sinxronlash</p>
                <p className="text-sm text-muted-foreground">Barcha buyurtmalar, komissiyalar, moliya va qaytarishlar qayta yuklanadi</p>
              </div>
              <Button onClick={handleFullResync} disabled={resyncing} variant="destructive" size="sm">
                {resyncing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sinxronlanmoqda...</> : <><RefreshCw className="w-4 h-4 mr-2" /> Qayta sinxronlash</>}
              </Button>
            </div>
            {resyncing && <Progress value={resyncProgress} className="h-2" />}
            {resyncLog.length > 0 && (
              <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto text-xs font-mono space-y-0.5">
                {resyncLog.map((log, i) => (
                  <div key={i} className={log.includes('✗') || log.includes('❌') ? 'text-destructive' : log.includes('✓') || log.includes('✅') ? 'text-green-600' : 'text-muted-foreground'}>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Promo Codes */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Promo kodlar</h2>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Yangi promo kod</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kod</Label>
                <Input value={newPromo.code} onChange={e => setNewPromo(p => ({ ...p, code: e.target.value }))} placeholder="SALE20" className="uppercase" />
              </div>
              <div>
                <Label>Tur</Label>
                <Select value={newPromo.discount_type} onValueChange={v => setNewPromo(p => ({ ...p, discount_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Foiz (%)</SelectItem>
                    <SelectItem value="fixed">Aniq summa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Qiymat</Label>
                <Input type="number" value={newPromo.discount_value} onChange={e => setNewPromo(p => ({ ...p, discount_value: e.target.value }))} placeholder={newPromo.discount_type === 'percent' ? '20' : '50000'} />
              </div>
              <div>
                <Label>Min buyurtma</Label>
                <Input type="number" value={newPromo.min_order_amount} onChange={e => setNewPromo(p => ({ ...p, min_order_amount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label>Max ishlatish</Label>
                <Input type="number" value={newPromo.max_uses} onChange={e => setNewPromo(p => ({ ...p, max_uses: e.target.value }))} placeholder="∞" />
              </div>
            </div>
            <Button onClick={() => createPromo.mutate()} disabled={createPromo.isPending} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Yaratish
            </Button>
          </CardContent>
        </Card>

        {promoCodes && promoCodes.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>Chegirma</TableHead>
                    <TableHead>Ishlatilgan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoCodes.map((pc: any) => (
                    <TableRow key={pc.id}>
                      <TableCell className="font-mono font-bold">{pc.code}</TableCell>
                      <TableCell>
                        {pc.discount_type === 'percent' ? <><Percent className="w-3 h-3 inline mr-1" />{pc.discount_value}%</> : <>{Number(pc.discount_value).toLocaleString()} so'm</>}
                      </TableCell>
                      <TableCell>{pc.used_count}{pc.max_uses ? `/${pc.max_uses}` : ''}</TableCell>
                      <TableCell>
                        <Badge variant={pc.is_active ? 'default' : 'secondary'}>{pc.is_active ? 'Faol' : 'Nofaol'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deletePromo.mutate(pc.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator />

      {/* Payment Card - only for admin */}
      {isAdmin && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">To'lov kartasi</h2>
          </div>

          {activeCard && (
            <Card className="border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Check className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="font-mono font-bold text-lg tracking-wider">{activeCard.card_number}</p>
                    <p className="text-sm text-muted-foreground">{activeCard.card_holder} ({activeCard.bank_name})</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{activeCard ? 'Kartani o\'zgartirish' : 'Yangi karta qo\'shish'}</CardTitle>
              <CardDescription className="text-xs">Mijozlar checkout sahifasida shu karta raqamini ko'radi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Karta raqami</Label>
                <Input value={cardForm.card_number} onChange={e => setCardForm(p => ({ ...p, card_number: e.target.value }))} placeholder="8600 1234 5678 9012" />
              </div>
              <div>
                <Label>Karta egasi</Label>
                <Input value={cardForm.card_holder} onChange={e => setCardForm(p => ({ ...p, card_holder: e.target.value }))} placeholder="ABDUMANNON ALIYEV" className="uppercase" />
              </div>
              <div>
                <Label>Bank / tizim</Label>
                <Select value={cardForm.bank_name} onValueChange={v => setCardForm(p => ({ ...p, bank_name: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Uzcard">Uzcard</SelectItem>
                    <SelectItem value="Humo">Humo</SelectItem>
                    <SelectItem value="Visa">Visa</SelectItem>
                    <SelectItem value="Mastercard">Mastercard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => saveCard.mutate()} disabled={saveCard.isPending} className="w-full">
                {saveCard.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Saqlash
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      <Separator />

      {/* Notifications */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.notifications', 'Notifications')}</h2>
        </div>
        <div className="space-y-2">
          {settingsLinks.map((link) => (
            <Card key={link.href} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(link.href)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted"><link.icon className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <p className="font-medium">{link.title}</p>
                    <p className="text-sm text-muted-foreground">{link.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* About */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.about', 'About')}</h2>
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">AliBrand CRM</p>
                <p className="text-sm text-muted-foreground">{t('settings.version', 'Version')} 1.0.0</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>© 2024 AliBrand</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
