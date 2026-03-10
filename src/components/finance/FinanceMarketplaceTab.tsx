import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { useToast } from '@/hooks/use-toast';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { 
  RefreshCw, 
  Loader2, 
  Store, 
  TrendingUp,
  BarChart3,
  DollarSign,
  Package,
  Percent,
  Calendar
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface MarketplaceStore {
  id: string;
  name: string;
  platform: string;
  is_active: boolean;
}

interface FinanceSummary {
  id: string;
  store_id: string;
  period_date: string;
  period_type: string;
  gross_revenue: number;
  net_revenue: number;
  commission_total: number;
  delivery_fees: number;
  storage_fees: number;
  return_fees: number;
  other_fees: number;
  orders_count: number;
  delivered_count: number;
  cancelled_count: number;
  returned_count: number;
  items_sold: number;
  currency: string;
  usd_equivalent: number;
  synced_at: string;
}

const PLATFORM_COLORS = {
  uzum: 'hsl(var(--chart-1))',
  yandex: 'hsl(var(--chart-2))',
};

const FEE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// Use global currency context instead of local formatCurrency

export function FinanceMarketplaceTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatMoney } = useFinanceCurrency();
  const queryClient = useQueryClient();
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const formatCurrency = (amount: number, _currency?: string) => formatMoney(amount);

  const { data: stores } = useQuery({
    queryKey: ['marketplace-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform, is_active')
        .eq('is_active', true)
        .order('platform', { ascending: true });
      if (error) throw error;
      return data as MarketplaceStore[];
    },
  });

  const { data: financeSummaries, isLoading } = useQuery({
    queryKey: ['marketplace-finance-summary', platformFilter],
    queryFn: async () => {
      return await fetchAllRows(
        supabase
          .from('marketplace_finance_summary')
          .select('*')
          .eq('period_type', 'daily')
          .order('period_date', { ascending: false })
      ) as FinanceSummary[];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-marketplace-finance', {
        body: { action: 'sync_all' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-finance-summary'] });
      toast({
        title: t('fin_sync_done'),
        description: t('fin_sync_all_done', { count: data.synced, revenue: formatCurrency(data.total_revenue || 0) }),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('fin_sync_error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const filteredSummaries = financeSummaries?.filter(summary => {
    if (platformFilter === 'all') return true;
    const store = stores?.find(s => s.id === summary.store_id);
    return store?.platform === platformFilter;
  }) || [];

  const storeStats = stores?.map(store => {
    const storeSummaries = filteredSummaries.filter(s => s.store_id === store.id);
    const latestSummary = storeSummaries[0];
    
    const totalRevenue = storeSummaries.reduce((sum, s) => sum + (s.gross_revenue || 0), 0);
    const totalNet = storeSummaries.reduce((sum, s) => sum + (s.net_revenue || 0), 0);
    const totalCommission = storeSummaries.reduce((sum, s) => sum + (s.commission_total || 0), 0);
    const totalDelivered = storeSummaries.reduce((sum, s) => sum + (s.delivered_count || 0), 0);
    const totalUSD = storeSummaries.reduce((sum, s) => sum + (s.usd_equivalent || 0), 0);

    return {
      store,
      totalRevenue,
      totalNet,
      totalCommission,
      totalDelivered,
      totalUSD,
      commissionRate: totalRevenue > 0 ? (totalCommission / totalRevenue) * 100 : 0,
      latestSummary,
    };
  }).filter(s => s.totalRevenue > 0) || [];

  const overallTotals = {
    grossRevenue: storeStats.reduce((sum, s) => sum + s.totalRevenue, 0),
    netRevenue: storeStats.reduce((sum, s) => sum + s.totalNet, 0),
    commission: storeStats.reduce((sum, s) => sum + s.totalCommission, 0),
    delivered: storeStats.reduce((sum, s) => sum + s.totalDelivered, 0),
    usdEquivalent: storeStats.reduce((sum, s) => sum + s.totalUSD, 0),
  };

  const feeBreakdown = [
    { name: t('fin_commission'), value: filteredSummaries.reduce((sum, s) => sum + (s.commission_total || 0), 0) },
    { name: t('fin_fee_delivery'), value: filteredSummaries.reduce((sum, s) => sum + (s.delivery_fees || 0), 0) },
    { name: t('fin_fee_storage'), value: filteredSummaries.reduce((sum, s) => sum + (s.storage_fees || 0), 0) },
    { name: t('fin_fee_return'), value: filteredSummaries.reduce((sum, s) => sum + (s.return_fees || 0), 0) },
    { name: t('fin_fee_other'), value: filteredSummaries.reduce((sum, s) => sum + (s.other_fees || 0), 0) },
  ].filter(f => f.value > 0);

  const trendData = filteredSummaries
    .slice(0, 30)
    .reverse()
    .map(s => ({
      date: new Date(s.period_date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' }),
      revenue: s.gross_revenue || 0,
      net: s.net_revenue || 0,
      commission: s.commission_total || 0,
    }));

  const uzumStores = stores?.filter(s => s.platform === 'uzum').length || 0;
  const yandexStores = stores?.filter(s => s.platform === 'yandex').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('mp_platform')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('fin_platform_all')} ({uzumStores + yandexStores})</SelectItem>
              <SelectItem value="uzum">Uzum ({uzumStores})</SelectItem>
              <SelectItem value="yandex">Yandex ({yandexStores})</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="outline" className="h-9 px-3 flex items-center text-sm">
            {t('fin_period_daily')}
          </Badge>
        </div>

        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="gap-2"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t('fin_sync')}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_total_income_label')}</p>
              <p className="text-lg font-bold">{formatCurrency(overallTotals.grossRevenue)}</p>
              <p className="text-xs text-muted-foreground">${overallTotals.usdEquivalent.toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_net_profit')}</p>
              <p className="text-lg font-bold">{formatCurrency(overallTotals.netRevenue)}</p>
              <p className="text-xs text-green-500">
                {overallTotals.grossRevenue > 0 
                  ? t('fin_margin', { percent: ((overallTotals.netRevenue / overallTotals.grossRevenue) * 100).toFixed(1) })
                  : t('fin_margin', { percent: '0' })}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Percent className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_commission')}</p>
              <p className="text-lg font-bold">{formatCurrency(overallTotals.commission)}</p>
              <p className="text-xs text-red-500">
                {overallTotals.grossRevenue > 0 
                  ? `${((overallTotals.commission / overallTotals.grossRevenue) * 100).toFixed(1)}%` 
                  : '0%'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_delivered')}</p>
              <p className="text-lg font-bold">{overallTotals.delivered.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{t('fin_order_count')}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 bg-card border-border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Store className="h-5 w-5" />
            {t('fin_stores_revenue')}
          </h3>

          {isLoading ? (
            <LoadingSkeleton count={3} compact />
          ) : storeStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('fin_no_data_found')}</p>
              <p className="text-xs">{t('fin_press_refresh')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {storeStats.map(({ store, totalRevenue, totalNet, totalCommission, totalDelivered, commissionRate }) => (
                <div 
                  key={store.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-2 h-10 rounded-full"
                      style={{ backgroundColor: PLATFORM_COLORS[store.platform as keyof typeof PLATFORM_COLORS] }}
                    />
                    <div>
                      <p className="font-medium text-sm">{store.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {store.platform} • {totalDelivered} {t('fin_orders_count')}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(totalRevenue)}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-500">
                        {t('fin_net_label')}: {formatCurrency(totalNet)}
                      </span>
                      <span className="text-red-500">
                        -{commissionRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 bg-card border-border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Percent className="h-5 w-5" />
            {t('fin_expenses_composition')}
          </h3>

          {feeBreakdown.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">{t('fin_no_data_available')}</p>
            </div>
          ) : (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={feeBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {feeBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={FEE_COLORS[index % FEE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))' 
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-4">
                {feeBreakdown.map((fee, index) => (
                  <div key={fee.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: FEE_COLORS[index % FEE_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{fee.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(fee.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {trendData.length > 0 && (
        <Card className="p-6 bg-card border-border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('fin_revenue_trend_30')}
          </h3>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--chart-1))"
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name={t('fin_total_revenue_label')}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="hsl(var(--chart-2))"
                  fillOpacity={1}
                  fill="url(#colorNet)"
                  name={t('fin_net_profit')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
