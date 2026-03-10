import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { useToast } from '@/hooks/use-toast';
import { useFBOData } from '@/hooks/useFBOData';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RefreshCw, Loader2, Store, TrendingUp, DollarSign,
  Package, Percent, BarChart3, Calendar, Users, Wallet
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { useStoreDistribution } from '@/hooks/useStoreDistribution';
import { Skeleton } from '@/components/ui/skeleton';
import { YATTThresholdAlert } from './YATTThresholdAlert';

interface StoreFinanceCardProps {
  storeId: string;
  storeName: string;
  platform: 'uzum' | 'yandex';
}

const FEE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const PLATFORM_COLORS = { uzum: 'text-purple-500', yandex: 'text-yellow-500' };

const PERIOD_OPTIONS_KEYS = [
  { value: '7', label: 'fin_7_days' },
  { value: '30', label: 'fin_30_days' },
  { value: '90', label: 'fin_90_days' },
  { value: '365', label: 'fin_1_year' },
  { value: 'all', label: 'fin_all_period' },
];

export function StoreFinanceCard({ storeId, storeName, platform }: StoreFinanceCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState('30');
  const { formatMoney, convertFromUZS } = useFinanceCurrency();
  const { calculateDistribution, getDistributionForStore, distributionsLoading } = useStoreDistribution();

  const { data: financeSummaries, isLoading } = useQuery({
    queryKey: ['store-finance-summary', storeId],
    queryFn: async () => {
      return await fetchAllRows(
        supabase
          .from('marketplace_finance_summary')
          .select('*')
          .eq('store_id', storeId)
          .order('period_date', { ascending: false })
      );
    },
  });

  const fboData = useFBOData(platform === 'uzum' ? storeId : null, undefined);

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (platform !== 'uzum') return { success: true };
      const { data, error } = await supabase.functions.invoke('uzum-finance', {
        body: { store_id: storeId, action: 'sync_finance' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-finance-summary', storeId] });
      queryClient.invalidateQueries({ queryKey: ['fbo-summary'] });
      toast({ title: t('toast_sync_done'), description: t('toast_store_updated', { name: storeName }) });
    },
    onError: (error: Error) => {
      toast({ title: t('toast_error'), description: error.message, variant: 'destructive' });
    },
  });

  // Period filter
  const cutoffDate = period === 'all' ? null : new Date(Date.now() - Number(period) * 86400000);
  const filtered = cutoffDate
    ? (financeSummaries || []).filter(s => new Date(s.period_date) >= cutoffDate)
    : (financeSummaries || []);

  const totals = filtered.reduce((acc, s) => ({
    grossRevenue: acc.grossRevenue + (s.gross_revenue || 0),
    netRevenue: acc.netRevenue + (s.net_revenue || 0),
    commission: acc.commission + (s.commission_total || 0),
    deliveryFees: acc.deliveryFees + (s.delivery_fees || 0),
    storageFees: acc.storageFees + (s.storage_fees || 0),
    returnFees: acc.returnFees + (s.return_fees || 0),
    delivered: acc.delivered + (s.delivered_count || 0),
    returned: acc.returned + (s.returned_count || 0),
  }), { grossRevenue: 0, netRevenue: 0, commission: 0, deliveryFees: 0, storageFees: 0, returnFees: 0, delivered: 0, returned: 0 });

  // Filter FBO orders by date (same cutoff logic as marketplace summary)
  const filteredFBOOrders = cutoffDate
    ? fboData.orders.filter(o => o.dateIssued && new Date(o.dateIssued) >= cutoffDate)
    : fboData.orders;
  const filteredFBOReturns = cutoffDate
    ? fboData.returns.filter(r => r.createdAt && new Date(r.createdAt) >= cutoffDate)
    : fboData.returns;

  const fboTotals = {
    totalRevenue: filteredFBOOrders.reduce((s, o) => s + (o.sellerPrice * o.amount), 0),
    totalCommission: filteredFBOOrders.reduce((s, o) => s + o.commission, 0),
    totalProfit: filteredFBOOrders.reduce((s, o) => s + o.sellerProfit, 0),
    totalOrders: filteredFBOOrders.length,
    totalReturns: filteredFBOReturns.length,
  };

  // Always combine FBO with marketplace summary for all periods
  const combinedTotals = {
    grossRevenue: totals.grossRevenue + fboTotals.totalRevenue,
    netRevenue: totals.netRevenue + fboTotals.totalProfit,
    commission: totals.commission + fboTotals.totalCommission,
    orders: totals.delivered + fboTotals.totalOrders,
    returns: totals.returned + fboTotals.totalReturns,
  };

  const profitMargin = combinedTotals.grossRevenue > 0 
    ? (combinedTotals.netRevenue / combinedTotals.grossRevenue) * 100 : 0;

  const feeBreakdown = [
    { name: t('fin_commission_label'), value: totals.commission },
    { name: t('fin_delivery_fee'), value: totals.deliveryFees },
    { name: t('fin_storage_fee'), value: totals.storageFees },
    { name: t('fin_return_fee'), value: totals.returnFees },
  ].filter(f => f.value > 0);

  const trendData = filtered
    .slice(0, 14)
    .reverse()
    .map(s => ({
      date: new Date(s.period_date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' }),
      revenue: s.gross_revenue || 0,
      net: s.net_revenue || 0,
    }));

  const platformColor = platform === 'uzum' ? 'hsl(270 60% 50%)' : 'hsl(45 100% 50%)';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${platform === 'uzum' ? 'bg-purple-500/10' : 'bg-yellow-500/10'}`}>
            <Store className={`h-5 w-5 ${PLATFORM_COLORS[platform]}`} />
          </div>
          <div>
            <h3 className="font-semibold">{storeName}</h3>
            <p className="text-xs text-muted-foreground capitalize">{platform}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS_KEYS.map(o => (
                <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} size="sm" variant="outline" className="gap-2">
            {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3 bg-card border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_gross_revenue')}</p>
              <p className="text-sm font-bold">{formatMoney(combinedTotals.grossRevenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 bg-card border-border">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_net_profit')}</p>
              <p className={`text-sm font-bold ${combinedTotals.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(combinedTotals.netRevenue)}
              </p>
              <p className="text-xs text-muted-foreground">{profitMargin.toFixed(1)}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 bg-card border-border">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_commission_label')}</p>
              <p className="text-sm font-bold">{formatMoney(combinedTotals.commission)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 bg-card border-border">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_orders_label')}</p>
              <p className="text-sm font-bold">{combinedTotals.orders.toLocaleString()}</p>
              <p className="text-xs text-red-500">{combinedTotals.returns} {t('fin_returns_count')}</p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <LoadingSkeleton count={3} compact />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {trendData.length > 0 && (
            <Card className="lg:col-span-2 p-4 bg-card border-border">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('fin_revenue_trend')}
              </h4>
              <div className={isMobile ? 'h-[140px]' : 'h-[180px]'}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id={`color-${storeId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={platformColor} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={platformColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} tickFormatter={(value) => {
                      const converted = convertFromUZS(value);
                      return `${(converted / 1000000).toFixed(0)}M`;
                    }} />
                    <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="revenue" stroke={platformColor} fillOpacity={1} fill={`url(#color-${storeId})`} name={t('fin_revenue_label')} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-4 bg-card border-border">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('fin_expenses_label')}
            </h4>
            {feeBreakdown.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <p className="text-xs">{t('fin_no_data_found')}</p>
              </div>
            ) : (
              <>
                <div className={isMobile ? 'h-[100px]' : 'h-[120px]'}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={feeBreakdown} cx="50%" cy="50%" innerRadius={isMobile ? 20 : 30} outerRadius={isMobile ? 40 : 50} paddingAngle={2} dataKey="value">
                        {feeBreakdown.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={FEE_COLORS[index % FEE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 mt-2">
                  {feeBreakdown.slice(0, 4).map((fee, index) => (
                    <div key={fee.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: FEE_COLORS[index % FEE_COLORS.length] }} />
                        <span className="text-muted-foreground">{fee.name}</span>
                      </div>
                      <span className="font-medium">{formatMoney(fee.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Profit Distribution */}
      {(() => {
        if (distributionsLoading) {
          return (
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          );
        }
        const dist = getDistributionForStore(storeId);
        if (!dist) return null;
        const { boshMenejerShare, investorShare, ownerShare, boshMenejerPct, investorPct } = calculateDistribution(storeId, combinedTotals.netRevenue);
        return (
          <Card className="p-4 bg-card border-border">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('fin_distribution')}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">BM ulushi ({boshMenejerPct}%)</span>
                <span className="text-red-500">-{formatMoney(boshMenejerShare)}</span>
              </div>
              {investorPct > 0 && (
                <div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Wallet className="h-3 w-3" /> {t('fin_investor_share')} ({investorPct}%)
                    </span>
                    <span className="text-red-500">-{formatMoney(investorShare)}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{t('fin_cost_not_included')}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>{t('fin_owner_share')}</span>
                <span className={ownerShare >= 0 ? 'text-green-600' : 'text-red-600'}>{formatMoney(ownerShare)}</span>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* YATT Tax Threshold Alert */}
      <YATTThresholdAlert storeId={storeId} storeName={storeName} />
    </div>
  );
}
