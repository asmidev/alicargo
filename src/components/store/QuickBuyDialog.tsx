import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/hooks/useStoreProducts';
import { STORE } from '@/lib/storeConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Zap, Loader2, Truck, Store, Banknote, CreditCard, Building2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface QuickBuyDialogProps {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  image?: string;
  variantId?: string;
  variantName?: string;
  maxStock: number;
}

export function QuickBuyDialog({
  productId, productName, price, quantity, image, variantId, variantName, maxStock
}: QuickBuyDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+998');
  const [address, setAddress] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [copied, setCopied] = useState(false);

  const productTotal = price * quantity;
  const deliveryFee = deliveryType === 'delivery' ? STORE.deliveryFee : 0;
  const total = productTotal + deliveryFee;

  const { data: activeCard } = useQuery({
    queryKey: ['active-payment-card'],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_cards')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: open && paymentType === 'card',
  });

  const copyCard = async () => {
    if (!activeCard?.card_number) return;
    await navigator.clipboard.writeText(activeCard.card_number);
    setCopied(true);
    toast.success('Karta raqami nusxalandi');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.length < 13) {
      toast.error(t('sf_fill_name_phone'));
      return;
    }
    if (deliveryType === 'delivery' && !address.trim()) {
      toast.error("Manzilni kiriting");
      return;
    }

    setLoading(true);
    try {
      const { data: stockCheck } = await supabase
        .from('products')
        .select('tashkent_manual_stock')
        .eq('id', productId)
        .single();

      if (!stockCheck || (stockCheck.tashkent_manual_stock || 0) < quantity) {
        toast.error(t('sf_not_enough_stock'));
        setLoading(false);
        return;
      }

      const orderItems = [{
        productId, variantId: variantId || null, name: productName,
        variantName: variantName || null, quantity, price, image: image || null,
      }];

      const paymentLabels: Record<string, string> = { cash: 'cash', card: 'card', transfer: 'transfer' };

      const { data, error } = await supabase
        .from('store_orders')
        .insert({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_address: deliveryType === 'delivery' ? address.trim() : null,
          delivery_type: deliveryType,
          payment_type: paymentLabels[paymentType],
          items: orderItems,
          subtotal: productTotal,
          delivery_fee: deliveryFee,
          total_amount: total,
          notes: t('sf_quick_order'),
        } as any)
        .select('id, order_number')
        .single();

      if (error) throw error;

      supabase.functions.invoke('send-telegram-alert', {
        body: {
          event_type: 'new_store_order',
          data: {
            order_number: data.order_number || data.id.slice(0, 8),
            customer_name: name.trim(),
            customer_phone: phone.trim(),
            total,
            items_count: 1,
            delivery_type: deliveryType,
            payment_type: paymentLabels[paymentType],
          },
          target_roles: ['rahbar', 'bosh_admin', 'uz_manager']
        }
      }).catch(console.error);

      sessionStorage.setItem(`order_${data.id}`, JSON.stringify({
        order_number: data.order_number, items: orderItems,
        delivery_fee: deliveryFee, total_amount: total,
        payment_type: paymentLabels[paymentType],
      }));

      setOpen(false);
      navigate(`/order-success/${data.id}`);
    } catch (err) {
      console.error(err);
      toast.error(t('sf_order_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
          <Zap className="w-5 h-5" />
          {t('sf_quick_order')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('sf_quick_order')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product info */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            {image && image !== '/placeholder.svg' && (
              <img src={image} alt="" className="w-14 h-14 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{productName}</p>
              {variantName && <p className="text-xs text-muted-foreground">{variantName}</p>}
              <p className="text-sm">{quantity} × {formatPrice(price)}</p>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="space-y-2 p-3 bg-muted/20 rounded-lg border border-border/40">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tovar narxi</span>
              <span>{formatPrice(productTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Yetkazib berish</span>
              <span>{deliveryType === 'pickup' ? "Bepul" : formatPrice(deliveryFee)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Jami</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>
          </div>

          {/* Customer info */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="qb-name">{t('sf_your_name')} *</Label>
              <Input id="qb-name" value={name} onChange={e => setName(e.target.value)} placeholder={t('sf_enter_name')} required autoFocus className="bg-muted/30 border-border/50" />
            </div>
            <div>
              <Label htmlFor="qb-phone">{t('sf_phone')} *</Label>
              <Input id="qb-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998 90 123 45 67" required className="bg-muted/30 border-border/50" />
            </div>
          </div>

          {/* Delivery type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Yetkazib berish usuli</Label>
            <RadioGroup value={deliveryType} onValueChange={(v) => setDeliveryType(v as 'delivery' | 'pickup')} className="grid grid-cols-2 gap-2">
              <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${deliveryType === 'delivery' ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/20'}`}>
                <RadioGroupItem value="delivery" />
                <Truck className="w-4 h-4" />
                <span className="text-sm">Yetkazish</span>
              </label>
              <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${deliveryType === 'pickup' ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/20'}`}>
                <RadioGroupItem value="pickup" />
                <Store className="w-4 h-4" />
                <span className="text-sm">Olib ketish</span>
              </label>
            </RadioGroup>
          </div>

          {/* Address (only for delivery) */}
          {deliveryType === 'delivery' && (
            <div>
              <Label htmlFor="qb-address">Manzil *</Label>
              <Input id="qb-address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Tuman, ko'cha, uy raqami" required className="bg-muted/30 border-border/50" />
            </div>
          )}

          {/* Payment type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">To'lov usuli</Label>
            <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as 'cash' | 'card' | 'transfer')} className="grid grid-cols-3 gap-2">
              <label className={`flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${paymentType === 'cash' ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/20'}`}>
                <RadioGroupItem value="cash" className="sr-only" />
                <Banknote className="w-5 h-5" />
                <span className="text-xs">Naqd</span>
              </label>
              <label className={`flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${paymentType === 'card' ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/20'}`}>
                <RadioGroupItem value="card" className="sr-only" />
                <CreditCard className="w-5 h-5" />
                <span className="text-xs">Karta</span>
              </label>
              <label className={`flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${paymentType === 'transfer' ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/20'}`}>
                <RadioGroupItem value="transfer" className="sr-only" />
                <Building2 className="w-5 h-5" />
                <span className="text-xs">O'tkazma</span>
              </label>
            </RadioGroup>
          </div>

          {/* Card info when card selected */}
          {paymentType === 'card' && activeCard && (
            <div className="p-3 bg-muted/30 rounded-lg border border-primary/30 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Karta ma'lumotlari</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-sm tracking-wider">{activeCard.card_number}</p>
                  <p className="text-xs text-muted-foreground">{activeCard.card_holder} • {activeCard.bank_name}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={copyCard} className="h-8 w-8">
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{t('sf_operator_will_call')}</p>

          <Button type="submit" className="w-full gap-2 gradient-gold-purple text-white font-bold border-0" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Buyurtma berish — {formatPrice(total)}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
