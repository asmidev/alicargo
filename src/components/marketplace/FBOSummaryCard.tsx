import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, 
  Truck, 
  RotateCcw, 
  AlertTriangle,
  RefreshCw,
  Calendar,
  Store,
  ShoppingCart,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { FBOSummary } from '@/hooks/useFBOData';

interface FBOSummaryCardProps {
  data: FBOSummary;
  onViewDetails?: () => void;
}

export function FBOSummaryCard({ data, onViewDetails }: FBOSummaryCardProps) {
  const { t } = useTranslation();
  const { totals, isLoading, error, refetch, isAggregated } = data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
            <Package className="h-4 w-4" />
            {t('mp_fbo_status')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 dark:from-destructive/20 dark:to-destructive/10 border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t('mp_fbo_error')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive mb-2">
            {t('mp_fbo_load_error')}
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="h-3 w-3" />
            {t('mp_retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasActivity = totals.totalInvoices > 0 || totals.totalReturns > 0 || totals.totalOrders > 0;

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
            <Package className="h-4 w-4" />
            {isAggregated ? t('mp_fbo_all_uzum') : t('mp_fbo_status')}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasActivity ? (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              {t('mp_fbo_no_activity')}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {/* Orders */}
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{totals.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">{t('mp_fbo_orders_label')}</p>
                </div>
              </div>

              {/* Invoices (Supply) */}
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{totals.totalInvoices}</p>
                  <p className="text-xs text-muted-foreground">{t('mp_invoices')}</p>
                </div>
              </div>

              {/* Returns */}
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{totals.totalReturns}</p>
                  <p className="text-xs text-muted-foreground">{t('mp_returns')}</p>
                </div>
              </div>

              {/* Profit */}
              {totals.totalProfit > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(totals.totalProfit)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('mp_profit_3m')}</p>
                  </div>
                </div>
              )}
            </div>

            {totals.defectedCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('mp_defective', { count: totals.defectedCount })}
              </Badge>
            )}

            {isAggregated && totals.storeCount && totals.storeCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                <Store className="h-3 w-3" />
                <span className="truncate">
                  {totals.storeNames?.slice(0, 2).join(', ')}
                  {totals.storeNames && totals.storeNames.length > 2 && ` +${totals.storeNames.length - 2}`}
                </span>
              </div>
            )}

            {totals.lastDeliveryDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                <Calendar className="h-3 w-3" />
                <span>{t('mp_last_delivery')}: {format(new Date(totals.lastDeliveryDate), 'dd.MM.yyyy')}</span>
              </div>
            )}

            {onViewDetails && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onViewDetails}
                className="w-full mt-2"
              >
                {t('mp_details')}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
