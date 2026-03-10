import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export type StatusFilterType = 'completed' | 'pending' | 'rejected';

interface FinanceIncomeByStatusProps {
  periodStart: string;
  periodEnd: string;
  onStatusClick?: (status: StatusFilterType) => void;
}

interface StatusData {
  count: number;
  total: number;
  commission: number;
}

const PENDING_STATUSES = ['pending', 'shipped', 'processing', 'CREATED', 'PACKING', 'DELIVERING', 'PICKUP', 'READY_TO_SHIP', 'SHIPPED'];
const COMPLETED_STATUSES = ['delivered', 'COMPLETED', 'DELIVERED'];
const REJECTED_STATUSES = ['cancelled', 'canceled', 'returned', 'CANCELLED', 'CANCELED', 'RETURNED'];

export function FinanceIncomeByStatus({ periodStart, periodEnd, onStatusClick }: FinanceIncomeByStatusProps) {
  const { formatMoney } = useFinanceCurrency();

  const { data, isLoading } = useQuery({
    queryKey: ['finance-income-by-status', periodStart, periodEnd],
    queryFn: async () => {
      const [completedRows, pendingRows, rejectedRows] = await Promise.all([
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
            .from('marketplace_orders')
            .select('total_amount, commission')
            .in('fulfillment_status', PENDING_STATUSES)
            .gte('ordered_at', periodStart)
            .lte('ordered_at', periodEnd)
        ),
        fetchAllRows(
          supabase
            .from('marketplace_orders')
            .select('total_amount, commission')
            .in('fulfillment_status', REJECTED_STATUSES)
            .gte('ordered_at', periodStart)
            .lte('ordered_at', periodEnd)
        ),
      ]);

      const aggregate = (rows: any[]): StatusData => ({
        count: rows.length,
        total: rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
        commission: rows.reduce((s, r) => s + (Number(r.commission) || 0), 0),
      });

      return {
        completed: aggregate(completedRows),
        pending: aggregate(pendingRows),
        rejected: aggregate(rejectedRows),
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  const completed = data?.completed || { count: 0, total: 0, commission: 0 };
  const pending = data?.pending || { count: 0, total: 0, commission: 0 };
  const rejected = data?.rejected || { count: 0, total: 0, commission: 0 };
  const grandTotal = completed.total + pending.total + rejected.total;

  const cards: { key: StatusFilterType; label: string; sublabel: string; icon: typeof Clock; data: StatusData; color: string; bgColor: string; barColor: string }[] = [
    {
      key: 'pending',
      label: 'Kutilmoqda',
      sublabel: 'Pending',
      icon: Clock,
      data: pending,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      barColor: 'bg-yellow-500',
    },
    {
      key: 'completed',
      label: 'Qabul qilingan',
      sublabel: 'Completed',
      icon: CheckCircle2,
      data: completed,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      barColor: 'bg-green-500',
    },
    {
      key: 'rejected',
      label: 'Rad etilgan',
      sublabel: 'Rejected',
      icon: XCircle,
      data: rejected,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      barColor: 'bg-red-500',
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Daromad holati
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map(({ key, label, sublabel, icon: Icon, data: d, color, bgColor }) => (
          <Card key={key} className={`border-border/50 transition-all ${onStatusClick ? 'cursor-pointer hover:shadow-md hover:border-primary/30 active:scale-[0.98]' : ''}`} onClick={() => onStatusClick?.(key)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${bgColor}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{sublabel}</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {d.count.toLocaleString()}
                </Badge>
              </div>
              <p className={`text-lg font-bold ${color}`}>
                {formatMoney(d.total)}
              </p>
              {d.commission > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Komissiya: {formatMoney(d.commission)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Proportion bar */}
      {grandTotal > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
          {completed.total > 0 && (
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(completed.total / grandTotal) * 100}%` }}
            />
          )}
          {pending.total > 0 && (
            <div
              className="bg-yellow-500 transition-all"
              style={{ width: `${(pending.total / grandTotal) * 100}%` }}
            />
          )}
          {rejected.total > 0 && (
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(rejected.total / grandTotal) * 100}%` }}
            />
          )}
        </div>
      )}
    </div>
  );
}
