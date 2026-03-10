import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/hooks/useStoreProducts';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Loader2, Tag, CheckCircle, XCircle, CreditCard, Copy, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { STORE } from '@/lib/storeConfig';
import { useTranslation } from 'react-i18next';

export default function StoreCheckout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, total, clear, isEmpty } = useCart();
  const [loading, setLoading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  useDocumentMeta({ title: t('sf_checkout'), description: 'AliBrand.uz — ' + t('sf_checkout') });

  const [form, setForm] = useState({
    name: '', phone: '+998', address: '',
    delivery: 'delivery' as 'delivery' | 'pickup',
    payment: 'card' as 'card',
    notes: '',
  });

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount_type: string; discount_value: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [cardCopied, setCardCopied] = useState(false);
  const [customerCard, setCustomerCard] = useState('');

  // Fetch active payment card
  const { data: activeCard } = useQuery({
    queryKey: ['payment-card-checkout'],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_cards')
        .select('card_number, card_holder, bank_name')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
  });

  const copyCardNumber = () => {
    if (activeCard) {
      navigator.clipboard.writeText(activeCard.card_number.replace(/\s/g, ''));
      setCardCopied(true);
      setTimeout(() => setCardCopied(false), 2000);
    }
  };

  if (isEmpty) {
    return (
      <div className="px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">{t('sf_cart_empty')}</p>
        <Link to="/catalog"><Button className="gradient-gold-purple text-white font-bold border-0">{t('sf_back_to_catalog')}</Button></Link>
      </div>
    );
  }

  const deliveryFee = form.delivery === 'delivery' ? STORE.deliveryFee : 0;

  // Calculate discount
  let discountAmount = 0;
  if (promoApplied) {
    if (promoApplied.discount_type === 'percent') {
      discountAmount = Math.round(total * promoApplied.discount_value / 100);
    } else {
      discountAmount = Math.min(promoApplied.discount_value, total);
    }
  }

  const grandTotal = total - discountAmount + deliveryFee;

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) { setPromoError('Promo kod topilmadi'); setPromoLoading(false); return; }
      if (data.max_uses && data.used_count >= data.max_uses) { setPromoError('Promo kod tugagan'); setPromoLoading(false); return; }
      if (data.min_order_amount && total < data.min_order_amount) {
        setPromoError(`Minimal buyurtma: ${formatPrice(data.min_order_amount)}`);
        setPromoLoading(false);
        return;
      }

      setPromoApplied({ code: data.code, discount_type: data.discount_type, discount_value: Number(data.discount_value) });
      toast.success('Promo kod qo\'llandi!');
    } catch {
      setPromoError('Xatolik yuz berdi');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoApplied(null);
    setPromoInput('');
    setPromoError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.phone.length < 13) { toast.error(t('sf_fill_name_phone')); return; }
    if (form.delivery === 'delivery' && !form.address.trim()) { toast.error(t('sf_enter_address')); return; }
    setShowPaymentDialog(true);
  };

  const confirmOrder = async () => {
    setLoading(true);
    try {
      const productIds = items.map(i => i.productId);
      const { data: stockData } = await supabase.from('products').select('id, name, tashkent_manual_stock').in('id', productIds);
      const outOfStock = items.filter(item => { const prod = stockData?.find(p => p.id === item.productId); return !prod || (prod.tashkent_manual_stock || 0) < item.quantity; });
      if (outOfStock.length > 0) { toast.error(`"${outOfStock[0].name}" ${t('sf_not_enough_stock')}`); setLoading(false); setShowPaymentDialog(false); return; }

      const orderItems = items.map(item => ({ product_id: item.productId, variant_id: item.variantId || null, name: item.name, variant_name: item.variantName || null, quantity: item.quantity, price: item.price, image: item.image || null }));

      const { data, error } = await supabase.from('store_orders').insert({
        customer_name: form.name.trim(), customer_phone: form.phone.trim(),
        customer_address: form.delivery === 'delivery' ? form.address.trim() : null,
        delivery_type: form.delivery, payment_type: form.payment,
        items: orderItems, subtotal: total, delivery_fee: deliveryFee, total_amount: grandTotal,
        notes: form.notes.trim() || null,
        promo_code: promoApplied?.code || null,
        discount_amount: discountAmount || 0,
        paynet_status: null,
        status: 'pending_payment',
        customer_card_number: customerCard.trim() || null,
      } as any).select('id, order_number').single();

      if (error) throw error;

      if (promoApplied) {
        const { data: pc } = await supabase.from('promo_codes').select('id, used_count').eq('code', promoApplied.code).maybeSingle();
        if (pc) {
          await supabase.from('promo_codes').update({ used_count: (pc.used_count || 0) + 1 } as any).eq('id', pc.id);
        }
      }

      supabase.functions.invoke('send-telegram-alert', {
        body: { event_type: 'new_store_order', data: { order_number: data.order_number || data.id.slice(0, 8), customer_name: form.name.trim(), customer_phone: form.phone.trim(), total: grandTotal, items_count: items.length, delivery_type: form.delivery, payment_type: form.payment, address: form.delivery === 'delivery' ? form.address.trim() : null }, target_roles: ['rahbar', 'bosh_admin', 'uz_manager'] }
      }).catch(console.error);

      sessionStorage.setItem(`order_${data.id}`, JSON.stringify({ order_number: data.order_number, items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })), delivery_fee: deliveryFee, discount_amount: discountAmount, promo_code: promoApplied?.code, total_amount: grandTotal, payment_type: form.payment }));

      clear();
      navigate(`/order-success/${data.id}`);
    } catch (err) { console.error('Order error:', err); toast.error(t('sf_order_error')); } finally { setLoading(false); }
  };


  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <Link to="/cart" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('sf_back_to_cart')}
      </Link>
      <h1 className="text-2xl font-extrabold mb-6">{t('sf_checkout')}</h1>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="bg-card rounded-xl border border-border/50 p-4 space-y-4">
          <h2 className="font-semibold">{t('sf_contact_info')}</h2>
          <div><Label htmlFor="name">{t('sf_your_name')} *</Label><Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('sf_enter_name')} className="bg-muted/30 border-border/50" /></div>
          <div><Label htmlFor="phone">{t('sf_phone')} *</Label><Input id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+998 90 123 45 67" className="bg-muted/30 border-border/50" /></div>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 space-y-4">
          <h2 className="font-semibold">{t('sf_delivery')}</h2>
          <RadioGroup value={form.delivery} onValueChange={(v) => setForm(f => ({ ...f, delivery: v as any }))}>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
              <RadioGroupItem value="delivery" id="delivery" />
              <Label htmlFor="delivery" className="flex-1 cursor-pointer"><span className="font-medium">{t('sf_delivery_option')}</span><span className="text-sm text-muted-foreground ml-2">{formatPrice(STORE.deliveryFee)}</span></Label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
              <RadioGroupItem value="pickup" id="pickup" />
              <Label htmlFor="pickup" className="flex-1 cursor-pointer"><span className="font-medium">{t('sf_pickup')}</span><span className="text-sm text-muted-foreground ml-2">{t('sf_free')}</span></Label>
            </div>
          </RadioGroup>
          {form.delivery === 'delivery' && (
            <div><Label htmlFor="address">{t('sf_address')} *</Label><Input id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t('sf_address_placeholder')} className="bg-muted/30 border-border/50" /></div>
          )}
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 space-y-4">
          <h2 className="font-semibold">{t('sf_payment_method')}</h2>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="font-medium">Karta orqali (oldindan to'lov)</span>
          </div>
        </div>

        {/* Promo Code */}
        <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Tag className="w-4 h-4" /> Promo kod</h2>
          {promoApplied ? (
            <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span className="font-mono font-bold">{promoApplied.code}</span>
                <span className="text-sm text-muted-foreground">
                  ({promoApplied.discount_type === 'percent' ? `${promoApplied.discount_value}%` : formatPrice(promoApplied.discount_value)})
                </span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={handleRemovePromo}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={promoInput}
                onChange={e => { setPromoInput(e.target.value); setPromoError(''); }}
                placeholder="Promo kodni kiriting"
                className="bg-muted/30 border-border/50 uppercase"
              />
              <Button type="button" variant="outline" onClick={handleApplyPromo} disabled={promoLoading || !promoInput.trim()}>
                {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Qo\'llash'}
              </Button>
            </div>
          )}
          {promoError && <p className="text-sm text-destructive">{promoError}</p>}
        </div>

        <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
          <Label htmlFor="notes">{t('sf_notes')}</Label>
          <Textarea id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('sf_notes_placeholder')} rows={2} className="bg-muted/30 border-border/50" />
        </div>
        <div className="bg-card rounded-xl border border-primary/20 p-4 space-y-2 glow-gold-sm">
          <h2 className="font-semibold mb-3">{t('sf_order_summary')}</h2>
          {items.map(item => (<div key={item.variantId || item.productId} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.quantity}x {item.name}</span><span>{formatPrice(item.price * item.quantity)}</span></div>))}
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-primary"><span>Chegirma ({promoApplied?.code})</span><span>-{formatPrice(discountAmount)}</span></div>
          )}
          {deliveryFee > 0 && (<div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('sf_delivery')}</span><span>{formatPrice(deliveryFee)}</span></div>)}
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-border/50"><span>{t('sf_total')}</span><span className="text-primary">{formatPrice(grandTotal)}</span></div>
        </div>
        <Button type="submit" size="lg" className="w-full text-base gradient-gold-purple text-white font-bold border-0 hover:opacity-90 glow-gold-sm" disabled={loading}>
          {t('sf_confirm_order')}
        </Button>
      </form>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              To'lov
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activeCard ? (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Quyidagi kartaga pul o'tkazing:</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono font-bold text-xl tracking-wider">{activeCard.card_number}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={copyCardNumber} className="gap-1">
                    {cardCopied ? <><Check className="w-4 h-4 text-primary" /> Nusxalandi</> : <><Copy className="w-4 h-4" /> Nusxalash</>}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{activeCard.card_holder} ({activeCard.bank_name})</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Karta ma'lumotlari yuklanmadi</p>
            )}
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border border-border/50">
              <span className="font-medium">Jami to'lov:</span>
              <span className="text-xl font-bold text-primary">{formatPrice(grandTotal)}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerCard">Sizning karta raqamingiz *</Label>
              <Input
                id="customerCard"
                value={customerCard}
                onChange={e => setCustomerCard(e.target.value.replace(/[^\d\s]/g, '').slice(0, 19))}
                placeholder="8600 0000 0000 0000"
                className="bg-muted/30 border-border/50 font-mono tracking-wider"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">Pul o'tkazgan kartangiz raqamini kiriting</p>
            </div>
            <Button
              onClick={confirmOrder}
              size="lg"
              className="w-full text-base gradient-gold-purple text-white font-bold border-0 hover:opacity-90 glow-gold-sm"
              disabled={loading || customerCard.replace(/\s/g, '').length < 16}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              To'lovni amalga oshirdim ✓
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
