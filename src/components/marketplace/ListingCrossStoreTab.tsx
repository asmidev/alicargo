import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Store, TrendingUp, TrendingDown, ArrowUpDown, Crown, AlertTriangle, Unlink } from 'lucide-react';
import { toast } from 'sonner';

interface SiblingListing {
  id: string;
  store_id: string;
  external_sku: string;
  external_product_id: string | null;
  fulfillment_type: string | null;
  title: string | null;
  price: number | null;
  currency: string;
  stock: number;
  status: string;
  marketplace_stores: { name: string; platform: string };
}

interface ListingCrossStoreTabProps {
  currentListingId: string;
  productId: string;
  currentCurrency: string;
}

export function ListingCrossStoreTab({ currentListingId, productId, currentCurrency }: ListingCrossStoreTabProps) {
  const queryClient = useQueryClient();

  const unlinkMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from('marketplace_listings')
        .update({ product_id: null, linked_at: null, link_strategy: null })
        .eq('id', listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing muvaffaqiyatli ajratildi");
      queryClient.invalidateQueries({ queryKey: ['listing-siblings', productId] });
    },
    onError: () => {
      toast.error("Ajratishda xatolik yuz berdi");
    },
  });

  const { data: siblings = [], isLoading } = useQuery({
    queryKey: ['listing-siblings', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('id, store_id, external_sku, external_product_id, fulfillment_type, title, price, currency, stock, status, marketplace_stores(name, platform)')
        .eq('product_id', productId)
        .in('status', ['active', 'inactive']);
      if (error) throw error;
      const result = (data || []) as unknown as SiblingListing[];
      // Issue #4: Cap siblings at 20 to prevent mis-linked products from flooding UI
      return result.slice(0, 20);
    },
    enabled: !!productId,
  });

  // Fetch order counts for each sibling
  const { data: orderCounts = {} } = useQuery({
    queryKey: ['listing-siblings-orders', productId, siblings.map(s => s.id).join(',')],
    queryFn: async () => {
      const counts: Record<string, { orders: number; revenue: number }> = {};
      await Promise.all(
        siblings.map(async (s) => {
          const { data } = await supabase.rpc('get_orders_by_sku', {
            p_store_id: s.store_id,
            p_sku: s.external_sku,
            p_product_id: s.external_product_id || null,
          } as any);
          const orders = data || [];
          const delivered = orders.filter((o: any) => o.fulfillment_status === 'delivered' || o.status === 'delivered');
          counts[s.id] = {
            orders: orders.length,
            revenue: delivered.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0),
          };
        })
      );
      return counts;
    },
    enabled: siblings.length > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (siblings.length <= 1) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Store className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Bu mahsulot faqat bitta do'konda mavjud</p>
      </div>
    );
  }

  // Issue #4: Warn about excessive siblings (mis-linked products)
  const hasExcessiveSiblings = siblings.length >= 20;

  const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));
  const prices = siblings.filter(s => s.price && s.price > 0).map(s => s.price!);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const totalStock = siblings.reduce((s, l) => s + l.stock, 0);
  const priceDiffPct = minPrice > 0 ? Math.round(((maxPrice - minPrice) / minPrice) * 100) : 0;

  // Determine best performer by revenue
  const bestId = Object.entries(orderCounts).sort((a, b) => b[1].revenue - a[1].revenue)[0]?.[0];

  const platformClass = (platform: string) =>
    platform === 'uzum'
      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Do'konlar</p>
          <p className="text-lg font-bold">{siblings.length}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Jami zaxira</p>
          <p className="text-lg font-bold">{fmt(totalStock)}</p>
        </div>
        <div className={cn("rounded-lg border p-3 text-center", priceDiffPct > 20 ? 'border-amber-500/50' : '')}>
          <p className="text-xs text-muted-foreground">Narx diapazoni</p>
          <p className="text-sm font-bold">{fmt(minPrice)} – {fmt(maxPrice)}</p>
          {priceDiffPct > 0 && (
            <p className={cn("text-[10px]", priceDiffPct > 20 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
              <ArrowUpDown className="inline h-3 w-3 mr-0.5" />{priceDiffPct}% farq
            </p>
          )}
        </div>
      </div>

      {/* Excessive siblings warning */}
      {hasExcessiveSiblings && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              20+ listing topildi — mahsulot noto'g'ri bog'langan bo'lishi mumkin. Faqat birinchi 20 tasi ko'rsatilmoqda.
            </p>
          </div>
        </div>
      )}

      {/* Price warning */}
      {priceDiffPct > 30 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Narx farqi {priceDiffPct}% — do'konlar orasida narxni muvofiqlashtirish tavsiya etiladi
          </p>
        </div>
      )}

      {/* Comparison table */}
      <div className="space-y-2">
        {siblings.map((s) => {
          const isCurrent = s.id === currentListingId;
          const stats = orderCounts[s.id];
          const isBest = s.id === bestId && (stats?.revenue || 0) > 0;

          return (
            <div
              key={s.id}
              className={cn(
                "rounded-lg border p-3 space-y-2",
                isCurrent && 'ring-2 ring-primary/30 bg-primary/5'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className={cn('text-[10px] shrink-0', platformClass(s.marketplace_stores.platform))}>
                    {s.marketplace_stores.platform.toUpperCase()}
                  </Badge>
                  <span className="text-sm font-medium truncate">{s.marketplace_stores.name}</span>
                  {s.fulfillment_type && (
                    <Badge variant="outline" className="text-[10px] shrink-0">{s.fulfillment_type.toUpperCase()}</Badge>
                  )}
                  {isCurrent && <Badge variant="default" className="text-[10px] shrink-0">Joriy</Badge>}
                  {isBest && (
                    <Badge className="text-[10px] bg-amber-500 text-white shrink-0">
                      <Crown className="h-3 w-3 mr-0.5" />Top
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground">Narx</p>
                  <p className={cn("text-sm font-semibold", s.price === maxPrice && siblings.length > 1 ? 'text-amber-600 dark:text-amber-400' : s.price === minPrice && siblings.length > 1 ? 'text-emerald-600 dark:text-emerald-400' : '')}>
                    {s.price ? fmt(s.price) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Zaxira</p>
                  <p className={cn("text-sm font-semibold", s.stock === 0 ? 'text-destructive' : s.stock < 5 ? 'text-amber-600' : '')}>
                    {s.stock}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Buyurtmalar</p>
                  <p className="text-sm font-semibold">{stats?.orders ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Daromad</p>
                  <p className="text-sm font-semibold">{stats ? fmt(stats.revenue) : '—'}</p>
                </div>
              </div>

              {/* Unlink button for non-current listings */}
              {!isCurrent && (
                <div className="flex justify-end pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground hover:text-destructive gap-1"
                    onClick={() => unlinkMutation.mutate(s.id)}
                    disabled={unlinkMutation.isPending}
                  >
                    <Unlink className="h-3 w-3" />
                    Noto'g'ri bog'langan?
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
