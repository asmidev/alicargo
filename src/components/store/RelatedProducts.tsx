import { useStoreProducts } from '@/hooks/useStoreProducts';
import { StoreProductCard } from '@/components/store/StoreProductCard';
import { useTranslation } from 'react-i18next';

interface RelatedProductsProps {
  currentProductId: string;
  categoryId?: string | null;
}

export function RelatedProducts({ currentProductId, categoryId }: RelatedProductsProps) {
  const { t } = useTranslation();
  const { data: result } = useStoreProducts({
    categoryId: categoryId || undefined,
    limit: 8,
    sortBy: 'popular',
  });

  const related = result?.products?.filter(p => p.id !== currentProductId).slice(0, 4);
  if (!related || related.length === 0) return null;

  return (
    <section className="mt-10 pt-6 border-t border-border/50">
      <h2 className="text-xl font-bold text-foreground mb-4">{t('sf_related_products')}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {related.map(product => (
          <StoreProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
