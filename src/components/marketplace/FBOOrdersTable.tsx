import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { FBOOrder } from '@/hooks/useFBOData';
import { useIsMobile } from '@/hooks/use-mobile';

interface FBOOrdersTableProps {
  orders: FBOOrder[];
  isLoading: boolean;
  isAggregated?: boolean;
}

export function FBOOrdersTable({ orders, isLoading, isAggregated }: FBOOrdersTableProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShoppingCart className="h-4 w-4" />
          {t('mp_fbo_orders_loading')}
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{t('mp_fbo_no_orders')}</p>
        <p className="text-xs">{t('mp_last_3m')}</p>
      </div>
    );
  }

  const totals = orders.reduce((acc, order) => ({
    items: acc.items + order.amount,
    revenue: acc.revenue + (order.sellerPrice * order.amount),
    commission: acc.commission + order.commission,
    profit: acc.profit + order.sellerProfit,
  }), { items: 0, revenue: 0, commission: 0, profit: 0 });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShoppingCart className="h-4 w-4 text-primary" />
          {t('mp_fbo_orders')} ({orders.length})
          <span className="text-xs text-muted-foreground">({t('mp_last_3m')})</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span className="text-muted-foreground">{t('mp_fbo_profit')}:</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totals.profit)} so'm
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-muted-foreground">{t('mp_fbo_orders_label')}</p>
          <p className="font-bold text-lg">{orders.length}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-muted-foreground">{t('mp_fbo_revenue')}</p>
          <p className="font-bold text-lg text-blue-600 dark:text-blue-400">{formatCurrency(totals.revenue)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-muted-foreground">{t('mp_fbo_commission')}</p>
          <p className="font-bold text-lg text-amber-600 dark:text-amber-400">{formatCurrency(totals.commission)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-muted-foreground">{t('mp_fbo_profit')}</p>
          <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.profit)}</p>
        </div>
      </div>

      {isMobile ? (
        <div className="space-y-2 max-h-[400px] overflow-auto">
          {orders.map((order, idx) => (
            <div key={`${order.orderId}-${order.orderItemId}-${idx}`} className="border rounded-lg p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm line-clamp-2">{order.productTitle}</p>
                  {order.skuTitle && <p className="text-xs text-muted-foreground truncate">{order.skuTitle}</p>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {order.dateIssued ? format(new Date(order.dateIssued), 'dd.MM') : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>{order.amount} {t('mp_pcs')} × {formatCurrency(order.sellerPrice)}</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(order.sellerProfit)}</span>
              </div>
              {isAggregated && order.storeName && (
                <Badge variant="outline" className="text-xs">{order.storeName}</Badge>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('mp_fbo_product')}</TableHead>
                {isAggregated && <TableHead>{t('mp_fbo_store')}</TableHead>}
                <TableHead className="text-right">{t('mp_fbo_qty')}</TableHead>
                <TableHead className="text-right">{t('mp_fbo_price')}</TableHead>
                <TableHead className="text-right">{t('mp_fbo_commission')}</TableHead>
                <TableHead className="text-right">{t('mp_fbo_profit')}</TableHead>
                <TableHead>{t('mp_fbo_date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order, idx) => (
                <TableRow key={`${order.orderId}-${order.orderItemId}-${idx}`}>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="font-medium truncate">{order.productTitle}</p>
                      {order.skuTitle && <p className="text-xs text-muted-foreground truncate">{order.skuTitle}</p>}
                    </div>
                  </TableCell>
                  {isAggregated && (
                    <TableCell><Badge variant="outline" className="text-xs">{order.storeName || 'N/A'}</Badge></TableCell>
                  )}
                  <TableCell className="text-right font-medium">{order.amount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(order.sellerPrice)}</TableCell>
                  <TableCell className="text-right text-amber-600 dark:text-amber-400">{formatCurrency(order.commission)}</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(order.sellerProfit)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.dateIssued ? format(new Date(order.dateIssued), 'dd.MM.yyyy') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}