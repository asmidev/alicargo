import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { 
  RefreshCw, 
  Loader2, 
  Store, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Package,
  Percent,
  BarChart3,
  Calendar
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface MarketplaceStore {
  id: string;
  name: string;
  platform: string;
  is_active: boolean;
}

const FEE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const formatCurrency = (amount: number, currency: string = 'RUB'): string => {
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${amount.toLocaleString('ru-RU')} ₽`;
};

export function YandexFinanceTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [periodDays, setPeriodDays] = useState<string>('30');

  // Fetch Yandex stores
  const { data: stores } = useQuery({
    queryKey: ['yandex-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform, is_active')
        .eq('platform', 'yandex')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as MarketplaceStore[];
    },
  });

  // Fetch Yandex finance data
  const { data: financeData, isLoading, refetch } = useQuery({
    queryKey: ['yandex-finance', selectedStore, periodDays],
    queryFn: async () => {
      const storesToFetch = selectedStore === 'all' ? stores : stores?.filter(s => s.id === selectedStore);
      const results = [];
      
      for (const store of storesToFetch || []) {
        try {
          const { data, error } = await supabase.functions.invoke('yandex-finance', {
            body: { store_id: store.id, days: parseInt(periodDays) },
          });
          if (!error && data?.success) {
            results.push({ ...data, storeId: store.id, storeName: store.name });
          }
        } catch (e) {
          console.error(`Error fetching Yandex finance for ${store.name}:`, e);
        }
      }
      
      return results;
    },
    enabled: !!stores?.length,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      await refetch();
      return true;
    },
    onSuccess: () => {
      toast({
        title: t('fin_synced'),
        description: t('fin_sync_done_label'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('fin_sync_error_label'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Aggregate totals
  const aggregatedTotals = financeData?.reduce((acc, store) => {
    const summary = store.summary || {};
    return {
      totalOrders: acc.totalOrders + (summary.total_orders || 0),
      totalItems: acc.totalItems + (summary.total_items || 0),
      totalRevenue: acc.totalRevenue + (summary.total_revenue || 0),
      totalCommissions: acc.totalCommissions + (summary.total_commissions || 0),
      totalDeliveryFees: acc.totalDeliveryFees + (summary.total_delivery_fees || 0) + (summary.total_item_delivery_fees || 0),
      totalPayments: acc.totalPayments + (summary.total_payments || 0),
      netProfit: acc.netProfit + (summary.net_profit || 0),
    };
  }, { 
    totalOrders: 0, 
    totalItems: 0, 
    totalRevenue: 0, 
    totalCommissions: 0, 
    totalDeliveryFees: 0,
    totalPayments: 0, 
    netProfit: 0 
  }) || { totalOrders: 0, totalItems: 0, totalRevenue: 0, totalCommissions: 0, totalDeliveryFees: 0, totalPayments: 0, netProfit: 0 };

  // Commission breakdown from first store with data
  const commissionBreakdown = financeData?.[0]?.breakdown?.by_commission_type || {};
  const feeBreakdown = Object.entries(commissionBreakdown).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value: value as number,
  })).filter(f => f.value > 0);

  // Store stats
  const storeStats = financeData?.map(data => ({
    storeId: data.storeId,
    storeName: data.storeName,
    revenue: data.summary?.total_revenue || 0,
    netProfit: data.summary?.net_profit || 0,
    orders: data.summary?.total_orders || 0,
    commissionRate: data.summary?.commission_rate_percent || 0,
  })) || [];

  const profitMargin = aggregatedTotals.totalRevenue > 0 
    ? (aggregatedTotals.netProfit / aggregatedTotals.totalRevenue) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Store className="h-5 w-5 text-yellow-500" />
            {t('fin_yandex_title')}
          </h3>
          <p className="text-sm text-muted-foreground">{stores?.length || 0} {t('fin_active_stores', { count: stores?.length || 0 }).replace(/^\d+\s*/, '')}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('fin_select_store')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('fin_all_stores')}</SelectItem>
              {stores?.map(store => (
                <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={periodDays} onValueChange={setPeriodDays}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t('fin_7_days')}</SelectItem>
              <SelectItem value="30">{t('fin_30_days')}</SelectItem>
              <SelectItem value="60">60 {t('days')}</SelectItem>
              <SelectItem value="90">{t('fin_90_days')}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || isLoading}
            className="gap-2"
            variant="outline"
          >
            {(syncMutation.isPending || isLoading) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t('fin_refresh')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_total_income_label')}</p>
              <p className="text-lg font-bold">{formatCurrency(aggregatedTotals.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">{aggregatedTotals.totalItems} {t('pcs')}</p>
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
              <p className={`text-lg font-bold ${aggregatedTotals.netProfit >= 0 ? '' : 'text-red-500'}`}>
                {formatCurrency(aggregatedTotals.netProfit)}
              </p>
              <p className="text-xs text-green-500">{t('fin_margin', { percent: profitMargin.toFixed(1) })}</p>
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
              <p className="text-lg font-bold">{formatCurrency(aggregatedTotals.totalCommissions)}</p>
              <p className="text-xs text-red-500">
                {aggregatedTotals.totalRevenue > 0 
                  ? `${((aggregatedTotals.totalCommissions / aggregatedTotals.totalRevenue) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_delivery_fees', { defaultValue: 'Yetkazib berish' })}</p>
              <p className="text-lg font-bold">{formatCurrency(aggregatedTotals.totalDeliveryFees)}</p>
              <p className="text-xs text-orange-500">
                {aggregatedTotals.totalRevenue > 0 
                  ? `${((aggregatedTotals.totalDeliveryFees / aggregatedTotals.totalRevenue) * 100).toFixed(1)}%`
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
              <p className="text-xs text-muted-foreground">{t('fin_orders')}</p>
              <p className="text-lg font-bold">{aggregatedTotals.totalOrders.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{t('fin_last_n_days', { days: periodDays })}</p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <LoadingSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Store Performance */}
          <Card className="lg:col-span-2 p-6 bg-card border-border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Store className="h-5 w-5" />
              {t('fin_stores_by')}
            </h3>

            {storeStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('fin_no_data_found')}</p>
                <p className="text-xs">{t('fin_press_refresh')}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {storeStats.map((stat) => (
                  <div 
                    key={stat.storeId} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-10 rounded-full bg-yellow-500" />
                      <div>
                        <p className="font-medium text-sm">{stat.storeName}</p>
                        <p className="text-xs text-muted-foreground">{stat.orders} {t('fin_orders_count')}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(stat.revenue)}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-500">{t('fin_net_label')}: {formatCurrency(stat.netProfit)}</span>
                        <span className="text-red-500">-{stat.commissionRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Fee Breakdown */}
          <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Percent className="h-5 w-5" />
              {t('fin_commission_structure')}
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
                  {feeBreakdown.slice(0, 6).map((fee, index) => (
                    <div key={fee.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: FEE_COLORS[index % FEE_COLORS.length] }}
                        />
                        <span className="text-muted-foreground capitalize truncate max-w-[100px]">
                          {fee.name}
                        </span>
                      </div>
                      <span className="font-medium">{formatCurrency(fee.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
