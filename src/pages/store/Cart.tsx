import { Link } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/hooks/useStoreProducts';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { STORE } from '@/lib/storeConfig';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function StoreCartPage() {
  const { t } = useTranslation();
  useDocumentMeta({ title: t('sf_cart'), description: 'AliBrand.uz — ' + t('sf_cart') });
  const { items, updateQuantity, removeItem, total, count, isEmpty } = useCart();

  if (isEmpty) {
    return (
      <div className="px-4 py-20 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('sf_cart_empty')}</h2>
        <p className="text-muted-foreground mb-6">{t('sf_cart_empty_desc')}</p>
        <Link to="/catalog">
          <Button className="gap-2 gradient-gold-purple text-white font-bold border-0">
            <ArrowLeft className="w-4 h-4" /> {t('sf_go_to_catalog')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-6">{t('sf_cart')}</h1>
      <div className="space-y-3 mb-6">
        {items.map(item => {
          const key = item.variantId || item.productId;
          return (
            <div key={key} className="flex gap-3 p-3 bg-card rounded-xl border border-border/50">
              <img src={item.image || '/placeholder.svg'} alt={item.name} className="w-20 h-20 rounded-lg object-cover bg-muted/30 shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium line-clamp-2">{item.name}</h3>
                {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                <p className="text-base font-bold mt-1 text-primary">{formatPrice(item.price)}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="w-7 h-7 border-border/50" onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}><Minus className="w-3 h-3" /></Button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="w-7 h-7 border-border/50" onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}><Plus className="w-3 h-3" /></Button>
                  </div>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => removeItem(item.productId, item.variantId)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="bg-card rounded-xl border border-primary/20 p-4 space-y-3 glow-gold-sm">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('sf_products')} ({count} dona)</span>
          <span className="font-medium">{formatPrice(total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Yetkazib berish</span>
          <span className="font-medium">{formatPrice(STORE.deliveryFee)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-border/50">
          <span>{t('sf_total')}</span>
          <span className="text-primary">{formatPrice(total + STORE.deliveryFee)}</span>
        </div>
        <Link to="/checkout" className="block">
          <Button size="lg" className="w-full text-base gradient-gold-purple text-white font-bold border-0 hover:opacity-90">{t('sf_order_now')}</Button>
        </Link>
      </div>
    </div>
  );
}
