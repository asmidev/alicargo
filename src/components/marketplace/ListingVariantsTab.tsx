import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Package, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ListingVariantsTabProps {
  currentListingId: string;
  productId: string;
  storeId: string;
  onSelectListing?: (listing: any) => void;
}

interface VariantListing {
  id: string;
  external_sku: string;
  image_url: string | null;
  title: string | null;
  price: number | null;
  currency: string;
  stock: number;
  status: string;
  fulfillment_type: string | null;
  store_id: string;
  external_product_id: string | null;
  product_id: string | null;
  commission_rate: number | null;
  cost_price: number | null;
  compare_price: number | null;
  category_title: string | null;
  marketplace_stores: { name: string; platform: string };
  products: { name: string; main_image_url: string | null } | null;
}

export function ListingVariantsTab({ currentListingId, productId, storeId, onSelectListing }: ListingVariantsTabProps) {
  const { t } = useTranslation();

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['listing-variants', productId, storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('id, external_sku, external_product_id, image_url, title, price, currency, stock, status, fulfillment_type, store_id, product_id, commission_rate, cost_price, compare_price, category_title, marketplace_stores(name, platform), products(name, main_image_url)')
        .eq('product_id', productId)
        .eq('store_id', storeId)
        .in('status', ['active', 'inactive'])
        .order('external_sku');
      if (error) throw error;
      return (data || []) as unknown as VariantListing[];
    },
    enabled: !!productId,
  });

  // Group by external_sku
  const grouped = variants.reduce<Record<string, VariantListing[]>>((acc, v) => {
    const key = v.external_sku;
    if (!acc[key]) acc[key] = [];
    acc[key].push(v);
    return acc;
  }, {});

  const skuGroups = Object.entries(grouped);
  const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (skuGroups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
        {t('mpl_variants_empty')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        {skuGroups.length} {skuGroups.length === 1 ? 'variant' : 'ta variant'}
      </p>
      {skuGroups.map(([sku, items]) => {
        const primary = items[0];
        const isCurrent = items.some(i => i.id === currentListingId);
        const imgSrc = primary.image_url || primary.products?.main_image_url;

        return (
          <div
            key={sku}
            className={cn(
              "rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm",
              isCurrent
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "hover:border-primary/30"
            )}
            onClick={() => {
              if (!isCurrent && onSelectListing) {
                // Pick the first item in this group to switch to
                const target = items[0];
                onSelectListing({
                  ...target,
                  marketplace_stores: target.marketplace_stores,
                  products: target.products,
                });
              }
            }}
          >
            <div className="flex items-start gap-3">
              {/* Thumbnail */}
              {imgSrc ? (
                <img src={imgSrc} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{sku}</span>
                  {isCurrent && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">
                      {t('mpl_variant_current')}
                    </Badge>
                  )}
                  {primary.status === 'active' ? (
                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>

                {primary.title && (
                  <p className="text-sm line-clamp-1 mb-1">{primary.title}</p>
                )}

                {/* Fulfillment sub-rows */}
                <div className="space-y-1">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-xs">
                      {item.fulfillment_type && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {item.fulfillment_type.toUpperCase()}
                        </Badge>
                      )}
                      <span className="text-muted-foreground">{item.marketplace_stores.name}</span>
                      <span className="ml-auto font-medium">{fmt(item.price || 0)} {item.currency}</span>
                      <span className={cn(
                        "font-medium",
                        item.stock === 0 ? 'text-destructive' : item.stock < 5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      )}>
                        {item.stock} {t('mpl_stock')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
