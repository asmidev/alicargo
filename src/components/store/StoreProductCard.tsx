import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImage } from '@/components/ui/lazy-image';
import { type StoreProduct, getProductImage, formatPrice } from '@/hooks/useStoreProducts';
import { useCart } from '@/hooks/useCart';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface StoreProductCardProps {
  product: StoreProduct;
}

export function StoreProductCard({ product }: StoreProductCardProps) {
  const { t } = useTranslation();
  const { addItem } = useCart();
  const image = getProductImage(product);
  const price = product.selling_price;
  const inStock = (product.tashkent_manual_stock || 0) > 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock || !price) return;
    addItem({
      productId: product.id,
      name: product.name,
      price,
      quantity: 1,
      image,
      maxStock: product.tashkent_manual_stock || 1,
    });
    toast.success(t('sf_added_to_cart'));
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex flex-col bg-card rounded-xl border border-border/50 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover-glow-gold"
    >
      <div className="relative overflow-hidden">
        {image === '/placeholder.svg' ? (
          <div className="aspect-square bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <span className="text-4xl font-bold text-primary/40">{product.name.charAt(0).toUpperCase()}</span>
          </div>
        ) : (
          <LazyImage src={image} alt={product.name} aspectRatio="square" className="bg-muted/30 group-hover:scale-105 transition-transform duration-500" />
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <span className="text-sm font-semibold text-muted-foreground">{t('sf_out_of_stock')}</span>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-2 flex-1">{product.name}</h3>
        <div className="flex items-end justify-between gap-2">
          <div>
            {price ? (
              <p className="text-base font-bold text-primary">{formatPrice(price)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('sf_price_not_set')}</p>
            )}
          </div>
          {inStock && price && (
            <Button size="icon" variant="outline" className="w-9 h-9 shrink-0 border-primary/30 text-primary hover:gradient-gold-purple hover:text-white hover:border-transparent transition-all" onClick={handleAddToCart}>
              <ShoppingCart className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Link>
  );
}
