import { StoreBanner } from '@/components/store/StoreBanner';
import { StoreCategoryGrid } from '@/components/store/StoreCategoryGrid';
import { StoreProductCard } from '@/components/store/StoreProductCard';
import { useStoreProducts } from '@/hooks/useStoreProducts';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export default function StoreHome() {
  const { t } = useTranslation();
  useDocumentMeta({
    title: t('sf_hero_title') + ' ' + t('sf_hero_highlight'),
    description: "AliBrand.uz — " + t('sf_hero_subtitle'),
    image: window.location.origin + '/pwa-512x512.png',
    url: window.location.origin,
    type: 'website',
  });

  const { data: result, isLoading } = useStoreProducts({ limit: 12, sortBy: 'newest' });
  const products = result?.products;

  return (
    <div className="space-y-10 pb-10">
      <StoreBanner />
      <section className="px-4">
        <h2 className="text-xl font-bold text-foreground mb-4">{t('sf_categories')}</h2>
        <StoreCategoryGrid />
      </section>
      <section className="px-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-foreground">{t('sf_products')}</h2>
          <Link to="/catalog">
            <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary">
              {t('sf_all')} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products?.map(product => (
              <StoreProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
        {!isLoading && (!products || products.length === 0) && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">{t('sf_no_products_yet')}</p>
            <p className="text-sm">{t('sf_coming_soon')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
