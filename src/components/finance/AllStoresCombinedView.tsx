import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Card } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  TrendingUp, DollarSign, Package, Percent, BarChart3, Calendar, Store,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

interface AllStoresCombinedViewProps {
  platform: 'uzum' | 'yandex';
  stores: { id: string; name: string }[];
}

const FEE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const PERIOD_OPTIONS = [
  { value: '7', label: 'fin_7_days' },
  { value: '30', label: 'fin_30_days' },
  { value: '90', label: 'fin_90_days' },
  { value: '365', label: 'fin_1_year' },
  { value: 'all', label: 'fin_all_period' },
];

export function AllStoresCombinedView({ platform, stores }: AllStoresCombinedViewProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { formatMoney, convertFromUZS } = useFinanceCurrency();
  const storeIds = stores.map((s) => s.id);
  const storeNameMap = Object.fromEntries(stores.map((s) => [s.id, s.name]));
  const [period, setPeriod] = useState('30');

  const { data: summaries, isLoading } = useQuery({
    queryKey: ['all-stores-finance-summary', platform, storeIds],
    queryFn: async () => {
      return await fetchAllRows(
        supabase
          .from('marketplace_finance_summary')
          .select('*')
          .in('store_id', storeIds)
          .order('period_date', { ascending: false })
      );
    },
    enabled: storeIds.length > 0,
  });

  if (isLoading) return <LoadingSkeleton count={4} compact />;

  const cutoffDate = period === 'all' ? null : new Date(Date.now() - Number(period) * 86400000);
  const filtered = cutoffDate
    ? (summaries || []).filter(s => new Date(s.period_date) >= cutoffDate)
    : (summaries || []);

  const totals = filtered.reduce(
    (acc, s) => ({
      grossRevenue: acc.grossRevenue + (s.gross_revenue || 0),
      netRevenue: acc.netRevenue + (s.net_revenue || 0),
      commission: acc.commission + (s.commission_total || 0),
      deliveryFees: acc.deliveryFees + (s.delivery_fees || 0),
      storageFees: acc.storageFees + (s.storage_fees || 0),
      returnFees: acc.returnFees + (s.return_fees || 0),
      delivered: acc.delivered + (s.delivered_count || 0),
      returned: acc.returned + (s.returned_count || 0),
    }),
    { grossRevenue: 0, netRevenue: 0, commission: 0, deliveryFees: 0, storageFees: 0, returnFees: 0, delivered: 0, returned: 0 }
  );

  const profitMargin = totals.grossRevenue > 0 ? (totals.netRevenue / totals.grossRevenue) * 100 : 0;

  const dateMap = new Map<string, { revenue: number; net: number }>();
  filtered.forEach((s) => {
    const d = s.period_date;
    const existing = dateMap.get(d) || { revenue: 0, net: 0 };
    dateMap.set(d, { revenue: existing.revenue + (s.gross_revenue || 0), net: existing.net + (s.net_revenue || 0) });
  });
  const trendData = Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, vals]) => ({ date: new Date(date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' }), revenue: vals.revenue, net: vals.net }));

  const feeBreakdown = [
    { name: t('fin_commission_label'), value: totals.commission },
    { name: t('fin_delivery_fee'), value: totals.deliveryFees },
    { name: t('fin_storage_fee'), value: totals.storageFees },
    { name: t('fin_return_fee'), value: totals.returnFees },
  ].filter((f) => f.value > 0);

  const storeBreakdown = storeIds.map((sid) => {
    const storeSummaries = filtered.filter((s) => s.store_id === sid);
    const gross = storeSummaries.reduce((a, s) => a + (s.gross_revenue || 0), 0);
    const net = storeSummaries.reduce((a, s) => a + (s.net_revenue || 0), 0);
    const orders = storeSummaries.reduce((a, s) => a + (s.delivered_count || 0), 0);
    const commission = storeSummaries.reduce((a, s) => a + (s.commission_total || 0), 0);
    return { name: storeNameMap[sid] || sid, grossRevenue: gross, netRevenue: net, orders, commission, share: totals.grossRevenue > 0 ? (gross / totals.grossRevenue) * 100 : 0 };
  }).sort((a, b) => b.grossRevenue - a.grossRevenue);

  const platformColor = platform === 'uzum' ? 'hsl(270 60% 50%)' : 'hsl(45 100% 50%)';
  const platformLabel = platform === 'uzum' ? 'Uzum' : 'Yandex';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${platform === 'uzum' ? 'bg-purple-500/10' : 'bg-yellow-500/10'}`}>
            <Store className={`h-5 w-5 ${platform === 'uzum' ? 'text-purple-500' : 'text-yellow-500'}`} />
          </div>
          <div>
            <h3 className="font-semibold">{platformLabel} {t('fin_overall_finance')}</h3>
            <p className="text-xs text-muted-foreground">{stores.length} {t('fin_stores_combined')}</p>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3 bg-card border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_gross_revenue')}</p>
              <p className="text-sm font-bold">{formatMoney(totals.grossRevenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 bg-card border-border">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_net_profit')}</p>
              <p className={`text-sm font-bold ${totals.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(totals.netRevenue)}
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
              <p className="text-sm font-bold">{formatMoney(totals.commission)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 bg-card border-border">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">{t('fin_orders_label')}</p>
              <p className="text-sm font-bold">{totals.delivered.toLocaleString()}</p>
              <p className="text-xs text-red-500">{totals.returned} {t('fin_returns_count')}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {trendData.length > 0 && (
          <Card className="lg:col-span-2 p-4 bg-card border-border">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('fin_overall_revenue_trend')}
            </h4>
            <div className={isMobile ? 'h-[140px]' : 'h-[180px]'}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id={`color-all-${platform}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={platformColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={platformColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} tickFormatter={(value) => {
                    const converted = convertFromUZS(value);
                    return `${(converted / 1000000).toFixed(0)}M`;
                  }} />
                  <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="revenue" stroke={platformColor} fillOpacity={1} fill={`url(#color-all-${platform})`} name={t('fin_revenue_label')} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card className="p-4 bg-card border-border">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('fin_expense_breakdown')}
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
                {feeBreakdown.map((fee, index) => (
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

      <Card className="p-4 bg-card border-border">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Store className="h-4 w-4" />
          {t('fin_stores_comparison')}
        </h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fin_store_label')}</TableHead>
              <TableHead className="text-right">{t('fin_revenue_label')}</TableHead>
              <TableHead className="text-right">{t('fin_net_profit')}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('fin_commission_label')}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t('fin_orders_label')}</TableHead>
              <TableHead className="text-right">{t('fin_share_label')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {storeBreakdown.map((store) => (
              <TableRow key={store.name}>
                <TableCell className="font-medium">{store.name}</TableCell>
                <TableCell className="text-right text-xs">{formatMoney(store.grossRevenue)}</TableCell>
                <TableCell className={`text-right text-xs ${store.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatMoney(store.netRevenue)}
                </TableCell>
                <TableCell className="text-right text-xs hidden sm:table-cell">{formatMoney(store.commission)}</TableCell>
                <TableCell className="text-right text-xs hidden sm:table-cell">{store.orders.toLocaleString()}</TableCell>
                <TableCell className="text-right text-xs font-medium">{store.share.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
