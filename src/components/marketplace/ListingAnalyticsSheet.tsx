import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Package, ShoppingCart, Users, Brain, TrendingUp, BarChart3, Store } from 'lucide-react';
import { ListingOrdersTable } from './ListingOrdersTable';
import { ListingCompetitorChart } from './ListingCompetitorChart';
import { ListingAIAnalysis } from './ListingAIAnalysis';
import { ListingCrossStoreTab } from './ListingCrossStoreTab';
import { ListingVariantsTab } from './ListingVariantsTab';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

interface ListingAnalyticsSheetProps {
  listing: {
    id: string;
    store_id: string;
    product_id?: string | null;
    title: string | null;
    external_sku: string;
    external_product_id?: string | null;
    fulfillment_type: string | null;
    price: number | null;
    currency: string;
    stock: number;
    status: string;
    commission_rate?: number | null;
    cost_price?: number | null;
    compare_price?: number | null;
    image_url?: string | null;
    category_title?: string | null;
    marketplace_stores: { name: string; platform: string };
    products: { name: string; main_image_url: string | null } | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectListing?: (listing: any) => void;
}

export function ListingAnalyticsSheet({ listing, open, onOpenChange, onSelectListing }: ListingAnalyticsSheetProps) {
  // Fetch orders by SKU using the database function
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['listing-orders', listing?.id, listing?.store_id, listing?.external_sku],
    queryFn: async () => {
      if (!listing) return [];
      const { data, error } = await supabase.rpc('get_orders_by_sku', {
        p_store_id: listing.store_id,
        p_sku: listing.external_sku,
        p_product_id: listing.external_product_id || null,
      } as any);
      if (error) throw error;
      return data || [];
    },
    enabled: !!listing && open,
  });

  // Fetch forecasts
  const { data: forecasts = [] } = useQuery({
    queryKey: ['listing-forecasts', listing?.id],
    queryFn: async () => {
      if (!listing) return [];
      const { data, error } = await supabase
        .from('marketplace_forecasts')
        .select('*')
        .eq('listing_id', listing.id)
        .order('forecast_date', { ascending: true })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!listing && open,
  });

  // Fetch sibling count for cross-store tab
  const { data: siblingCount = 0 } = useQuery({
    queryKey: ['listing-sibling-count', listing?.product_id],
    queryFn: async () => {
      if (!listing?.product_id) return 0;
      const { count, error } = await supabase
        .from('marketplace_listings')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', listing.product_id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!listing?.product_id && open,
  });

  if (!listing) return null;

  const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));
  const imgSrc = (listing as any).image_url || listing.products?.main_image_url;
  const displayName = listing.title || listing.products?.name || 'Nomsiz';

  // Compute order stats
  const deliveredOrders = orders.filter((o: any) => o.fulfillment_status === 'delivered' || o.status === 'delivered');
  const cancelledOrders = orders.filter((o: any) => o.fulfillment_status === 'cancelled' || o.status === 'cancelled');
  const totalRevenue = deliveredOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
  let totalCommission = deliveredOrders.reduce((s: number, o: any) => s + (o.commission || 0), 0);

  // Guard against historically inflated database commissions (where an absolute UZS value was processed as percentage)
  if (totalRevenue > 0 && totalCommission > totalRevenue * 0.45) {
    let safeRate = listing.commission_rate || 20;
    if (safeRate > 100 && listing.price > 0) safeRate = (safeRate / listing.price) * 100;
    if (safeRate > 50 || safeRate === 0) safeRate = 20;
    totalCommission = totalRevenue * (safeRate / 100);
  }

  const avgOrderValue = deliveredOrders.length ? totalRevenue / deliveredOrders.length : 0;
  const deliveryRate = orders.length ? (deliveredOrders.length / orders.length * 100) : 0;
  const cancelRate = orders.length ? (cancelledOrders.length / orders.length * 100) : 0;

  let commissionRate = totalRevenue > 0 ? (totalCommission / totalRevenue * 100) : (listing.commission_rate || 0);
  if (commissionRate > 100 && listing.price > 0) commissionRate = (commissionRate / listing.price) * 100;
  if (commissionRate > 50 || commissionRate === 0) commissionRate = 20;
  const profitMargin = listing.cost_price && listing.price
    ? ((listing.price - listing.cost_price) / listing.price * 100)
    : null;

  // Revenue by day for chart (last 30 days) — use delivered_at when available, fallback to ordered_at
  const revenueByDay: Record<string, number> = {};
  const last30 = Array.from({ length: 30 }, (_, i) => format(subDays(new Date(), 29 - i), 'yyyy-MM-dd'));
  last30.forEach(d => { revenueByDay[d] = 0; });
  deliveredOrders.forEach((o: any) => {
    const dateStr = o.delivered_at || o.ordered_at;
    if (dateStr) {
      const day = format(parseISO(dateStr), 'yyyy-MM-dd');
      if (revenueByDay[day] !== undefined) {
        revenueByDay[day] += (o.total_amount || 0);
      }
    }
  });
  const chartData = last30.map(d => ({ date: format(parseISO(d), 'dd.MM'), revenue: revenueByDay[d] }));

  const platformClass = listing.marketplace_stores.platform === 'uzum'
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start gap-3">
            {imgSrc ? (
              <img src={imgSrc} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base leading-tight line-clamp-2">{displayName}</SheetTitle>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <Badge variant="secondary" className={cn('text-[10px]', platformClass)}>
                  {listing.marketplace_stores.platform.toUpperCase()}
                </Badge>
                <span className="text-xs">{listing.marketplace_stores.name}</span>
                <span className="text-xs">•</span>
                <span className="font-mono text-xs">{listing.external_sku}</span>
                {listing.fulfillment_type && (
                  <Badge variant="outline" className={cn("text-[10px]",
                    listing.fulfillment_type.toLowerCase() === 'fbs' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200',
                    listing.fulfillment_type.toLowerCase() === 'fbu' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-purple-200',
                    listing.fulfillment_type.toLowerCase() === 'fby' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200',
                  )}>{listing.fulfillment_type.toUpperCase()}</Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue={listing.product_id && siblingCount > 1 ? "variants" : "overview"} className="mt-4">
          <TabsList className={cn("w-full grid",
            listing.product_id && siblingCount > 1 ? "grid-cols-6" : listing.product_id ? "grid-cols-5" : siblingCount > 1 ? "grid-cols-5" : "grid-cols-4"
          )}>
            <TabsTrigger value="overview" className="text-xs gap-1">
              <BarChart3 className="h-3 w-3" />
              Umumiy
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs gap-1">
              <ShoppingCart className="h-3 w-3" />
              Buyurtmalar
            </TabsTrigger>
            {listing.product_id && (
              <TabsTrigger value="variants" className="text-xs gap-1">
                <Package className="h-3 w-3" />
                Variantlar
              </TabsTrigger>
            )}
            <TabsTrigger value="competitors" className="text-xs gap-1">
              <Users className="h-3 w-3" />
              Raqobat
            </TabsTrigger>
            {siblingCount > 1 && (
              <TabsTrigger value="cross-store" className="text-xs gap-1">
                <Store className="h-3 w-3" />
                Do'konlar
              </TabsTrigger>
            )}
            <TabsTrigger value="ai" className="text-xs gap-1">
              <Brain className="h-3 w-3" />
              AI
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Buyurtmalar" value={orders.length.toString()} icon={<ShoppingCart className="h-4 w-4" />} />
              <MetricCard label="Daromad" value={fmt(totalRevenue)} subtext={listing.currency} icon={<TrendingUp className="h-4 w-4" />} />
              <MetricCard label="Zaxira" value={listing.stock.toString()}
                className={listing.stock === 0 ? 'border-destructive/50' : listing.stock < 5 ? 'border-amber-500/50' : ''} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Yetkazish %" value={`${deliveryRate.toFixed(0)}%`} className={deliveryRate > 60 ? '' : 'border-amber-500/50'} />
              <MetricCard label="Bekor %" value={`${cancelRate.toFixed(0)}%`} className={cancelRate < 30 ? '' : 'border-destructive/50'} />
              <MetricCard label="O'rtacha" value={fmt(avgOrderValue)} subtext={listing.currency} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Komissiya" value={`${commissionRate.toFixed(1)}%`} />
              {profitMargin !== null && (
                <MetricCard label="Foyda margin" value={`${profitMargin.toFixed(0)}%`} className={profitMargin > 20 ? '' : 'border-amber-500/50'} />
              )}
              <MetricCard label="Narx" value={fmt(listing.price || 0)} subtext={listing.currency} />
            </div>

            {/* Revenue trend chart */}
            {chartData.some(d => d.revenue > 0) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Daromad trendi (30 kun)</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={4} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v > 999999 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [fmt(v) + ` ${listing.currency}`, 'Daromad']} />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Forecasts */}
            {forecasts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">AI Prognoz</p>
                <div className="space-y-1">
                  {forecasts.slice(0, 5).map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between text-sm p-2 rounded border">
                      <span>{f.forecast_date}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{fmt(f.predicted_value)}</span>
                        {f.confidence && (
                          <Badge variant="outline" className="text-[10px]">{(f.confidence * 100).toFixed(0)}%</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-4">
            <ListingOrdersTable
              orders={orders as any[]}
              isLoading={ordersLoading}
              sku={listing.external_sku}
              currency={listing.currency}
            />
          </TabsContent>

          {/* Competitors Tab */}
          <TabsContent value="competitors" className="mt-4">
            <ListingCompetitorChart
              listingId={listing.id}
              listingPrice={listing.price}
              currency={listing.currency}
            />
          </TabsContent>

          {/* Variants Tab */}
          {listing.product_id && (
            <TabsContent value="variants" className="mt-4">
              <ListingVariantsTab
                currentListingId={listing.id}
                productId={listing.product_id}
                storeId={listing.store_id}
                onSelectListing={onSelectListing}
              />
            </TabsContent>
          )}

          {/* Cross-Store Tab */}
          {siblingCount > 1 && listing.product_id && (
            <TabsContent value="cross-store" className="mt-4">
              <ListingCrossStoreTab
                currentListingId={listing.id}
                productId={listing.product_id}
                currentCurrency={listing.currency}
              />
            </TabsContent>
          )}

          {/* AI Tab */}
          <TabsContent value="ai" className="mt-4">
            <ListingAIAnalysis listingId={listing.id} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function MetricCard({ label, value, subtext, icon, className }: {
  label: string; value: string; subtext?: string; icon?: React.ReactNode; className?: string
}) {
  return (
    <div className={cn("rounded-lg border p-3 text-center", className)}>
      {icon && <div className="flex justify-center mb-1 text-muted-foreground">{icon}</div>}
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
      {subtext && <p className="text-[10px] text-muted-foreground">{subtext}</p>}
    </div>
  );
}
