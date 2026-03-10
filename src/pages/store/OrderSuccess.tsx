import { useParams, Link, useSearchParams } from 'react-router-dom';
import { formatPrice } from '@/hooks/useStoreProducts';
import { Button } from '@/components/ui/button';
import { CheckCircle, Phone, Search, Copy, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';

interface OrderData { order_number: string; items: any[]; delivery_fee: number; discount_amount?: number; promo_code?: string; total_amount: number; payment_type?: string; }

export default function StoreOrderSuccess() {
  const { t } = useTranslation();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [cardCopied, setCardCopied] = useState(false);

  const { data: activeCard } = useQuery({
    queryKey: ['payment-card-success'],
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

  useEffect(() => {
    const stored = sessionStorage.getItem(`order_${orderId}`);
    if (stored) { try { setOrder(JSON.parse(stored)); } catch {} }
  }, [orderId]);

  if (!order) {
    return (
      <div className="px-4 py-20 text-center">
        <CheckCircle className="w-20 h-20 mx-auto text-primary mb-4" />
        <h1 className="text-2xl font-extrabold mb-2">{t('sf_order_accepted')}</h1>
        <p className="text-muted-foreground mb-6">{t('sf_operator_will_call')}</p>
        <Link to="/"><Button variant="outline">{t('sf_back_to_home')}</Button></Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-10 max-w-lg mx-auto text-center">
      <CheckCircle className="w-20 h-20 mx-auto text-primary mb-4" />
      <h1 className="text-2xl font-extrabold mb-2">To'lov tekshirilmoqda</h1>
      <p className="text-muted-foreground mb-2">{t('sf_order_number')}: <span className="font-mono font-bold text-primary">{order.order_number}</span></p>



      <div className="bg-card rounded-xl border border-border/50 p-4 text-left space-y-2 mb-6">
        {(order.items || []).map((item: any, i: number) => (
          <div key={i} className="flex justify-between text-sm"><span>{item.quantity}x {item.name}</span><span>{formatPrice(item.price * item.quantity)}</span></div>
        ))}
        {order.discount_amount && order.discount_amount > 0 && (
          <div className="flex justify-between text-sm text-primary"><span>Chegirma {order.promo_code ? `(${order.promo_code})` : ''}</span><span>-{formatPrice(order.discount_amount)}</span></div>
        )}
        {order.delivery_fee > 0 && (<div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('sf_delivery')}</span><span>{formatPrice(order.delivery_fee)}</span></div>)}
        <div className="flex justify-between font-bold pt-2 border-t border-border/50"><span>{t('sf_total')}</span><span className="text-primary">{formatPrice(order.total_amount)}</span></div>
      </div>

      {order.payment_type === 'card' && activeCard && (
        <div className="bg-card rounded-xl border border-primary/20 p-4 mb-4 space-y-2">
          <p className="text-sm font-medium text-center text-muted-foreground">Quyidagi kartaga pul o'tkazing:</p>
          <div className="flex items-center justify-center gap-3">
            <p className="font-mono font-bold text-lg tracking-wider">{activeCard.card_number}</p>
            <Button variant="ghost" size="sm" onClick={copyCardNumber} className="gap-1">
              {cardCopied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground text-center">{activeCard.card_holder} ({activeCard.bank_name})</p>
        </div>
      )}

      <div className="bg-card rounded-xl border border-primary/20 p-4 mb-6 glow-gold-sm">
        <div className="flex items-center justify-center gap-2 text-primary font-medium"><Phone className="w-4 h-4" />To'lov tekshirilgach operator aloqaga chiqadi</div>
      </div>

      <div className="flex gap-3 justify-center">
        <Link to="/"><Button variant="outline" className="gap-2">{t('sf_back_to_home')}</Button></Link>
        <Link to="/track"><Button variant="outline" className="gap-2"><Search className="w-4 h-4" />{t('sf_track_order')}</Button></Link>
      </div>
    </div>
  );
}

