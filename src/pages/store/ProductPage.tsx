import { useParams, Link } from 'react-router-dom';
import { useStoreProduct, formatPrice, getProductImage } from '@/hooks/useStoreProducts';
import { useCart } from '@/hooks/useCart';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyImage } from '@/components/ui/lazy-image';
import { QuickBuyDialog } from '@/components/store/QuickBuyDialog';
import { RelatedProducts } from '@/components/store/RelatedProducts';
import { ShoppingCart, Minus, Plus, ArrowLeft, Truck, Shield, RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export default function StoreProductPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: product, isLoading } = useStoreProduct(id);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  // Auto-select first variant when product loads
  useEffect(() => {
    if (product?.variants && product.variants.length > 0 && !selectedVariant) {
      setSelectedVariant(product.variants[0].id);
    }
  }, [product]);

  const productImage = product?.main_image_url || undefined;
  const productUrl = product ? `${window.location.origin}/product/${product.id}` : undefined;

  useDocumentMeta({
    title: product?.name,
    description: product?.store_description || (product?.name ? `${product.name} — AliBrand.uz` : undefined),
    image: productImage,
    url: productUrl,
    type: 'product',
  });

  if (isLoading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-4"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-10 w-1/3" /><Skeleton className="h-12 w-full" /></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-lg text-muted-foreground mb-4">{t('sf_product_not_found')}</p>
        <Link to="/catalog"><Button variant="outline">{t('sf_back_to_catalog')}</Button></Link>
      </div>
    );
  }

  const images = [product.main_image_url, ...(product.gallery || [])].filter(Boolean) as string[];
  const uniqueImages = [...new Set(images)];
  if (uniqueImages.length === 0) uniqueImages.push('/placeholder.svg');

  const variant = product.variants?.find(v => v.id === selectedVariant);
  const variantLabel = variant ? (variant.variant_attributes ? Object.values(variant.variant_attributes).join(' / ') : variant.sku) : undefined;
  const displayPrice = variant?.selling_price || variant?.price || product.selling_price;
  const variantStock = variant?.stock_quantity || 0;
  const maxStock = variantStock > 0 ? variantStock : (product.tashkent_manual_stock || 0);
  const inStock = maxStock > 0;

  const handleAddToCart = () => {
    if (!displayPrice) { toast.error(t('sf_price_not_set')); return; }
    addItem({ productId: product.id, variantId: selectedVariant || undefined, name: product.name, variantName: variantLabel, price: displayPrice, quantity, image: uniqueImages[0], maxStock });
    toast.success(t('sf_added_to_cart'));
  };

  return (
    <div className="px-4 py-4 pb-28 md:pb-4">
      <nav className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
        <Link to="/catalog" className="flex items-center gap-1 hover:text-primary transition-colors"><ArrowLeft className="w-4 h-4" /> {t('sf_catalog')}</Link>
        <span className="text-primary/50">›</span>
        <span className="text-foreground line-clamp-1">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
        <div className="space-y-3">
          <div className="aspect-square bg-muted/20 rounded-xl overflow-hidden border border-border/50">
            <LazyImage src={uniqueImages[selectedImage]} alt={product.name} aspectRatio="square" className="rounded-xl" />
          </div>
          {uniqueImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {uniqueImages.map((img, i) => (
                <button key={i} onClick={() => setSelectedImage(i)} className={cn("w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all", selectedImage === i ? "border-primary glow-gold-sm" : "border-border/50 hover:border-muted-foreground/30")}>
                  <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <h1 className="text-2xl font-extrabold text-foreground">{product.name}</h1>
          <div className="text-3xl font-bold text-primary">{displayPrice ? formatPrice(displayPrice) : t('sf_price_not_set', 'Narx ko\'rsatilmagan')}</div>
          <div className={cn("text-sm font-medium", inStock ? "text-primary" : "text-destructive")}>
            {inStock ? `✓ ${t('sf_in_stock')} (${maxStock} ${t('sf_pcs')})` : `✕ ${t('sf_out_of_stock')}`}
          </div>

          {product.variants && product.variants.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('sf_select_variant')}</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map(v => {
                  const label = v.variant_attributes ? Object.values(v.variant_attributes).join(' / ') : v.sku;
                  return (
                    <Button key={v.id} variant={selectedVariant === v.id ? 'default' : 'outline'} size="sm" className={cn(selectedVariant === v.id && "gradient-gold-purple text-white border-0")} onClick={() => { setSelectedVariant(v.id); setQuantity(1); }}>
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {inStock && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('sf_quantity')}</h3>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="w-10 h-10 border-border/50" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="w-4 h-4" /></Button>
                <span className="text-lg font-semibold w-10 text-center">{quantity}</span>
                <Button variant="outline" size="icon" className="w-10 h-10 border-border/50" onClick={() => setQuantity(Math.min(maxStock, quantity + 1))}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {inStock && (
            <div className="flex gap-3 pt-2">
              <Button size="lg" className="flex-1 gap-2 text-base gradient-gold-purple text-white font-bold border-0 hover:opacity-90 glow-gold-sm" disabled={!displayPrice} onClick={handleAddToCart}>
                <ShoppingCart className="w-5 h-5" /> {displayPrice ? t('sf_add_to_cart') : t('sf_price_not_set', 'Narx ko\'rsatilmagan')}
              </Button>
              {displayPrice && <QuickBuyDialog productId={product.id} productName={product.name} price={displayPrice} quantity={quantity} image={uniqueImages[0]} variantId={selectedVariant || undefined} variantName={variantLabel} maxStock={maxStock} />}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50">
            <div className="flex flex-col items-center text-center gap-1.5"><Truck className="w-5 h-5 text-primary" /><span className="text-xs text-muted-foreground">{t('sf_fast_delivery')}</span></div>
            <div className="flex flex-col items-center text-center gap-1.5"><Shield className="w-5 h-5 text-primary" /><span className="text-xs text-muted-foreground">{t('sf_quality_guarantee')}</span></div>
            <div className="flex flex-col items-center text-center gap-1.5"><RotateCcw className="w-5 h-5 text-primary" /><span className="text-xs text-muted-foreground">{t('sf_returnable')}</span></div>
          </div>

          {product.store_description && (
            <div className="pt-4 border-t border-border/50">
              <h3 className="font-semibold mb-2">{t('sf_description')}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{product.store_description}</p>
            </div>
          )}
        </div>
      </div>

      <RelatedProducts currentProductId={product.id} categoryId={product.store_category_id} />

      {inStock && (
        <div className="fixed bottom-0 left-0 right-0 z-50 store-glass border-t border-border/50 p-3 flex items-center gap-3 md:hidden safe-area-pb">
          <div className="flex-1">
            <p className="text-lg font-bold text-primary">{displayPrice ? formatPrice(displayPrice * quantity) : t('sf_price_not_set', 'Narx ko\'rsatilmagan')}</p>
            <p className="text-xs text-muted-foreground">{quantity} {t('sf_pcs')}</p>
          </div>
          <Button size="lg" className="gap-2 gradient-gold-purple text-white font-bold border-0" disabled={!displayPrice} onClick={handleAddToCart}>
            <ShoppingCart className="w-5 h-5" /> {displayPrice ? t('sf_to_cart') : t('sf_price_not_set', 'Narx ko\'rsatilmagan')}
          </Button>
        </div>
      )}
    </div>
  );
}
