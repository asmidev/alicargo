import { useState } from 'react';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/hooks/useStoreProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Package, CheckCircle, Truck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface TrackedOrder {
  order_number: string;
  status: string;
  total_amount: number;
  delivery_type: string;
  created_at: string;
  items_count: number;
}

const STATUS_STEPS = ['new', 'confirmed', 'preparing', 'delivering', 'delivered'];

export default function TrackOrder() {
  const { t } = useTranslation();
  useDocumentMeta({ title: t('sf_track_order'), description: t('sf_track_order_desc') });

  const [phone, setPhone] = useState('+998');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null);
  const [searched, setSearched] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 13) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('track-order', {
        body: { phone: phone.trim() },
      });
      if (error) throw error;
      setOrders(data?.orders || []);
    } catch (err) {
      console.error(err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      new: t('sf_track_status_new'),
      confirmed: t('sf_track_status_confirmed'),
      preparing: t('sf_track_status_preparing'),
      delivering: t('sf_track_status_delivering'),
      delivered: t('sf_track_status_delivered'),
      cancelled: t('sf_track_status_cancelled'),
    };
    return map[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return CheckCircle;
      case 'delivering': return Truck;
      case 'preparing': return Package;
      default: return Clock;
    }
  };

  return (
    <div className="px-4 py-10 max-w-2xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-2">{t('sf_track_order')}</h1>
      <p className="text-muted-foreground mb-8">{t('sf_track_order_desc')}</p>

      <form onSubmit={handleTrack} className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            className="pl-10 bg-muted/30 border-border/50"
          />
        </div>
        <Button type="submit" className="gap-2 gradient-gold-purple text-white font-bold border-0" disabled={loading || phone.length < 13}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {t('sf_track_btn')}
        </Button>
      </form>

      {searched && !loading && orders && orders.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-40" />
          <p className="text-lg mb-1">{t('sf_track_no_orders')}</p>
          <p className="text-sm">{t('sf_track_no_orders_desc')}</p>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => {
            const StatusIcon = getStatusIcon(order.status);
            const stepIndex = STATUS_STEPS.indexOf(order.status);
            const isCancelled = order.status === 'cancelled';

            return (
              <div key={order.order_number} className="bg-card rounded-xl border border-border/50 p-5 hover-glow-gold transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-mono font-bold text-primary text-lg">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                    isCancelled ? "bg-destructive/10 text-destructive" : 
                    order.status === 'delivered' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {getStatusLabel(order.status)}
                  </div>
                </div>

                {/* Status progress */}
                {!isCancelled && (
                  <div className="flex items-center gap-1 mb-4">
                    {STATUS_STEPS.map((step, i) => (
                      <div key={step} className={cn(
                        "flex-1 h-1.5 rounded-full transition-all",
                        i <= stepIndex ? "gradient-gold-purple" : "bg-muted"
                      )} />
                    ))}
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{order.items_count} {t('sf_products').toLowerCase()} · {order.delivery_type === 'delivery' ? t('sf_delivery') : t('sf_pickup')}</span>
                  <span className="font-bold text-primary">{formatPrice(order.total_amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
