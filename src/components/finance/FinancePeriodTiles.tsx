import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { TrendingUp, TrendingDown, ShoppingCart, Percent } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function getDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getTashkentDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + 5 * 60 * 60 * 1000);
}

interface TileData {
  revenue: number;
  expenses: number;
  net: number;
  orders: number;
  margin: number;
}

const COMPLETED_STATUSES = ['delivered', 'COMPLETED', 'DELIVERED'];

function usePeriodData(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['finance-period-tile', startDate, endDate],
    queryFn: async () => {
      const periodStart = startDate + 'T00:00:00+05:00';
      const periodEnd = endDate + 'T23:59:59+05:00';

      // Query marketplace_orders with fetchAllRows to bypass 1000-row limit
      const [orders, txns, rateRes] = await Promise.all([
        fetchAllRows(
          supabase
            .from('marketplace_orders')
            .select('total_amount, commission')
            .in('fulfillment_status', COMPLETED_STATUSES)
            .gte('delivered_at', periodStart)
            .lte('delivered_at', periodEnd)
        ),
        fetchAllRows(
          supabase
            .from('finance_transactions')
            .select('transaction_type, amount, currency')
            .eq('transaction_type', 'expense')
            .gte('created_at', periodStart)
            .lte('created_at', periodEnd)
        ),
        supabase
          .from('exchange_rates_history')
          .select('rates')
          .order('fetched_at', { ascending: false })
          .limit(1)
          .single(),
      ]);

      const rows = orders || [];
      const revenue = rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
      const commission = rows.reduce((s, r) => s + (Number(r.commission) || 0), 0);
      const netRevenue = revenue - commission;
      const orderCount = rows.length;

      const liveUsdToUzs = (rateRes.data?.rates as any)?.UZS || 12800;
      const liveCnyToUzs = liveUsdToUzs / ((rateRes.data?.rates as any)?.CNY || 7.25);

      const expenses = (txns || []).reduce((s, t) => {
        let amountUZS = Number(t.amount) || 0;
        if (t.currency === 'USD') amountUZS *= liveUsdToUzs;
        else if (t.currency === 'CNY') amountUZS *= liveCnyToUzs;
        return s + amountUZS;
      }, 0);

      const net = netRevenue - expenses;
      const margin = revenue > 0 ? (net / revenue) * 100 : 0;

      return { revenue, expenses, net, orders: orderCount, margin } as TileData;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

function PeriodTile({ label, data, isLoading }: { label: string; data?: TileData; isLoading: boolean }) {
  const { formatMoney } = useFinanceCurrency();

  if (isLoading) {
    return (
      <Card className="p-4 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </Card>
    );
  }

  const d = data || { revenue: 0, expenses: 0, net: 0, orders: 0, margin: 0 };

  return (
    <Card className="p-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-green-500" />
        <span className="text-sm text-green-600 font-medium">{formatMoney(d.revenue)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
        <span className="text-sm text-red-500 font-medium">-{formatMoney(d.expenses)}</span>
      </div>
      <div className={`text-base font-bold ${d.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
        {formatMoney(d.net)}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ShoppingCart className="h-3 w-3" /> {d.orders}
        </span>
        <span className="flex items-center gap-1">
          <Percent className="h-3 w-3" /> {d.margin.toFixed(1)}%
        </span>
      </div>
    </Card>
  );
}

export function FinancePeriodTiles() {
  const { t } = useTranslation();
  const tashkent = getTashkentDate();

  const todayStr = getDateStr(tashkent);
  const yesterday = new Date(tashkent);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getDateStr(yesterday);

  const mtdStart = new Date(tashkent.getFullYear(), tashkent.getMonth(), 1);
  const mtdStartStr = getDateStr(mtdStart);

  const lastMonthEnd = new Date(tashkent.getFullYear(), tashkent.getMonth(), 0);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
  const lastMonthStartStr = getDateStr(lastMonthStart);
  const lastMonthEndStr = getDateStr(lastMonthEnd);

  const today = usePeriodData(todayStr, todayStr);
  const yesterdayQ = usePeriodData(yesterdayStr, yesterdayStr);
  const mtd = usePeriodData(mtdStartStr, todayStr);
  const lastMonth = usePeriodData(lastMonthStartStr, lastMonthEndStr);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <PeriodTile label={t('fin_tile_today') || 'Bugun'} data={today.data} isLoading={today.isLoading} />
      <PeriodTile label={t('fin_tile_yesterday') || 'Kecha'} data={yesterdayQ.data} isLoading={yesterdayQ.isLoading} />
      <PeriodTile label={t('fin_tile_mtd') || 'Oy boshidan'} data={mtd.data} isLoading={mtd.isLoading} />
      <PeriodTile label={t('fin_tile_last_month') || "O'tgan oy"} data={lastMonth.data} isLoading={lastMonth.isLoading} />
    </div>
  );
}
