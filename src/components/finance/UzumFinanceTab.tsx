import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFBOData } from '@/hooks/useFBOData';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { 
  RefreshCw, 
  Loader2, 
  Store, 
  TrendingUp, 
  DollarSign,
  Package,
  Percent,
  BarChart3,
  Calendar,
  RotateCcw
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

const formatCurrency = (amount: number, currency: string = 'UZS'): string => {
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${amount.toLocaleString('uz-UZ')} so'm`;
};

export function UzumFinanceTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStore, setSelectedStore] = useState<string>('all');

  const { data: stores } = useQuery({
    queryKey: ['uzum-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform, is_active')
        .eq('platform', 'uzum')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as MarketplaceStore[];
    },
  });

  const fboData = useFBOData(
    selectedStore !== 'all' ? selectedStore : null,
    selectedStore === 'all' ? stores : undefined
  );

  const { data: financeSummaries, isLoading } = useQuery({
    queryKey: ['uzum-finance-summary', selectedStore],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_finance_summary')
        .select('*')
        .order('period_date', { ascending: false })
        .limit(60);

      if (selectedStore !== 'all') {
        query = query.eq('store_id', selectedStore);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const uzumStoreIds = stores?.map(s => s.id) || [];
      return data?.filter(s => uzumStoreIds.includes(s.store_id)) || [];
    },
    enabled: !!stores?.length,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const uzumStoreIds = stores?.map(s => s.id) || [];
      const results = [];
      
      for (const storeId of uzumStoreIds) {
        const { data, error } = await supabase.functions.invoke('uzum-finance', {
          body: { store_id: storeId, action: 'sync_finance' },
        });
        if (!error) results.push(data);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uzum-finance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['fbo-summary'] });
      toast({
        title: t('fin_sync_done'),
        description: t('fin_sync_updated', { name: 'Uzum' }),
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

  const storeStats = stores?.map(store => {
    const storeSummaries = financeSummaries?.filter(s => s.store_id === store.id) || [];
    
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
    };
  }).filter(s => s.totalRevenue > 0 || selectedStore === s.store.id) || [];

  const overallTotals = {
    grossRevenue: storeStats.reduce((sum, s) => sum + s.totalRevenue, 0),
    netRevenue: storeStats.reduce((sum, s) => sum + s.totalNet, 0),
    commission: storeStats.reduce((sum, s) => sum + s.totalCommission, 0),
    delivered: storeStats.reduce((sum, s) => sum + s.totalDelivered, 0),
    usdEquivalent: storeStats.reduce((sum, s) => sum + s.totalUSD, 0),
  };

  const fboTotals = {
    revenue: fboData.totals.totalRevenue || 0,
    commission: fboData.totals.totalCommission || 0,
    profit: fboData.totals.totalProfit || 0,
    orders: fboData.totals.totalOrders || 0,
  };

  const feeBreakdown = [
    { name: t('fin_commission'), value: financeSummaries?.reduce((sum, s) => sum + (s.commission_total || 0), 0) || 0 },
    { name: t('fin_fee_delivery'), value: financeSummaries?.reduce((sum, s) => sum + (s.delivery_fees || 0), 0) || 0 },
    { name: t('fin_fee_storage'), value: financeSummaries?.reduce((sum, s) => sum + (s.storage_fees || 0), 0) || 0 },
    { name: t('fin_fee_return'), value: financeSummaries?.reduce((sum, s) => sum + (s.return_fees || 0), 0) || 0 },
  ].filter(f => f.value > 0);

  const trendData = financeSummaries
    ?.slice(0, 30)
    .reverse()
    .map(s => ({
      date: new Date(s.period_date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' }),
      revenue: s.gross_revenue || 0,
      net: s.net_revenue || 0,
    })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Store className="h-5 w-5 text-purple-500" />
            {t('fin_uzum_title')}
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

          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="gap-2"
            variant="outline"
          >
            {syncMutation.isPending ? (
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
              <p className="text-lg font-bold">{formatCurrency(overallTotals.grossRevenue + fboTotals.revenue)}</p>
              <p className="text-xs text-muted-foreground">${(overallTotals.usdEquivalent).toFixed(2)}</p>
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
              <p className="text-lg font-bold">{formatCurrency(overallTotals.netRevenue + fboTotals.profit)}</p>
              <p className="text-xs text-green-500">
                {(overallTotals.grossRevenue + fboTotals.revenue) > 0 
                  ? t('fin_margin', { percent: (((overallTotals.netRevenue + fboTotals.profit) / (overallTotals.grossRevenue + fboTotals.revenue)) * 100).toFixed(1) })
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
              <p className="text-lg font-bold">{formatCurrency(overallTotals.commission + fboTotals.commission)}</p>
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
              <p className="text-lg font-bold">{(overallTotals.delivered + fboTotals.orders).toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <RotateCcw className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_returns')}</p>
              <p className="text-lg font-bold">{fboData.totals.totalReturns}</p>
              <p className="text-xs text-red-500">{fboData.totals.defectedCount} {t('fin_defect')}</p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <LoadingSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6 bg-card border-border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Store className="h-5 w-5" />
              {t('fin_revenue_by_stores')}
            </h3>

            {storeStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('fin_no_data_found')}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {storeStats.map(({ store, totalRevenue, totalNet, totalDelivered, commissionRate }) => (
                  <div 
                    key={store.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-10 rounded-full bg-purple-500" />
                      <div>
                        <p className="font-medium text-sm">{store.name}</p>
                        <p className="text-xs text-muted-foreground">{totalDelivered} {t('fin_orders_count')}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(totalRevenue)}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-500">{t('fin_net_label')}: {formatCurrency(totalNet)}</span>
                        <span className="text-red-500">-{commissionRate.toFixed(1)}%</span>
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
              {t('fin_fee_breakdown')}
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
      )}

      {trendData.length > 0 && (
        <Card className="p-6 bg-card border-border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('fin_revenue_trend')}
          </h3>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorUzumRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
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
                  stroke="hsl(142 71% 45%)" 
                  fillOpacity={1} 
                  fill="url(#colorUzumRevenue)" 
                  name={t('fin_revenue_label')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
