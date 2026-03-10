import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Users } from 'lucide-react';

interface ListingCompetitorChartProps {
  listingId: string;
  listingPrice: number | null;
  currency: string;
}

export function ListingCompetitorChart({ listingId, listingPrice, currency }: ListingCompetitorChartProps) {
  const { data: competitors, isLoading } = useQuery({
    queryKey: ['listing-competitors', listingId],
    queryFn: async () => {
      // Get competitors for this listing
      const { data: comps, error } = await supabase
        .from('marketplace_competitors')
        .select(`
          id,
          competitor_name,
          competitor_shop_name,
          marketplace_competitor_prices (
            price,
            original_price,
            rating,
            review_count,
            sales_count,
            captured_at
          )
        `)
        .eq('listing_id', listingId)
        .eq('is_active', true);
      if (error) throw error;
      return comps;
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!competitors?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">Raqobatchilar topilmadi</p>
      </div>
    );
  }

  const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));

  // Get latest price for each competitor
  const chartData = competitors.map(c => {
    const prices = (c as any).marketplace_competitor_prices || [];
    const latest = prices.sort((a: any, b: any) => 
      new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
    )[0];
    return {
      name: c.competitor_name?.slice(0, 20) || 'Noma\'lum',
      price: latest?.price || 0,
      rating: latest?.rating,
      reviews: latest?.review_count,
      sales: latest?.sales_count,
      shop: c.competitor_shop_name,
    };
  }).filter(d => d.price > 0);

  const prices = chartData.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length;

  return (
    <div className="space-y-4">
      {/* Price positioning summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Bizning narx</p>
          <p className="text-lg font-bold text-primary">{listingPrice ? fmt(listingPrice) : '-'}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Min narx</p>
          <p className="text-lg font-bold text-emerald-600">{fmt(minPrice)}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">O'rtacha</p>
          <p className="text-lg font-bold">{fmt(avgPrice)}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Max narx</p>
          <p className="text-lg font-bold text-destructive">{fmt(maxPrice)}</p>
        </div>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [fmt(v), 'Narx']} />
              <Bar dataKey="price" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              {listingPrice && (
                <ReferenceLine y={listingPrice} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: 'Bizning narx', fontSize: 10 }} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Competitor details table */}
      <div className="space-y-2">
        {chartData.map((comp, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg border text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{comp.name}</p>
              {comp.shop && <p className="text-xs text-muted-foreground truncate">{comp.shop}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {comp.rating && (
                <Badge variant="outline" className="text-[10px]">⭐ {comp.rating}</Badge>
              )}
              <span className="font-bold">{fmt(comp.price)}</span>
              {listingPrice && (
                <Badge variant={comp.price < listingPrice ? 'destructive' : 'default'} className="text-[10px]">
                  {comp.price < listingPrice ? `${fmt(listingPrice - comp.price)} arzon` : `${fmt(comp.price - listingPrice)} qimmat`}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
