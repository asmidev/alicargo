import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingCart, 
  TrendingUp,
  Package,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';

const USD_TO_UZS = 12800;

interface DirectSale {
  id: string;
  product_id: string;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  price_usd: number | null;
  payment_method: string | null;
  customer_name: string | null;
  receipt_number: string | null;
  created_at: string;
}

export function FinanceSalesTab() {
  const { t } = useTranslation();
  const { formatMoney } = useFinanceCurrency();
  const [periodDays, setPeriodDays] = useState(30);
  
  const dateRange = {
    start: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
    end: new Date()
  };

  const { data: directSales = [], isLoading: loadingDirect } = useQuery({
    queryKey: ['finance-direct-sales', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('direct_sales')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DirectSale[];
    },
  });

  const toUZS = (amount: number, currency: string) => {
    if (currency === 'UZS') return amount;
    if (currency === 'USD') return amount * USD_TO_UZS;
    return amount; 
  };

  const directTotalUZS = directSales.reduce((sum, sale) => sum + toUZS(sale.total_price, sale.currency), 0);

  const getPaymentMethodLabel = (method: string | null) => {
    switch(method) {
      case 'cash': return t('fin_pay_cash');
      case 'card': return t('fin_pay_card');
      case 'transfer': return t('fin_pay_transfer');
      default: return t('fin_pay_other');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {[7, 30, 90, 365].map(d => (
          <button
            key={d}
            onClick={() => setPeriodDays(d)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              periodDays === d 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {d === 365 ? t('fin_one_year') : `${d} ${t('days')}`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('fin_direct_sales')}</p>
                <p className="text-2xl font-bold text-green-600">{formatMoney(directTotalUZS)}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-green-500 opacity-80" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{directSales.length} {t('fin_sales_pcs')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t('fin_direct_sales')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDirect ? (
            <LoadingSkeleton count={3} compact />
          ) : directSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>{t('noData')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {directSales.map((sale) => (
                  <Card key={sale.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm sm:text-base">{sale.product_name || t('fin_sales_product')}</span>
                            <Badge variant="outline">{sale.quantity} {t('pcs')}</Badge>
                          </div>
                          {sale.customer_name && (
                            <p className="text-sm text-muted-foreground">
                              {t('fin_sales_customer')}: {sale.customer_name}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(sale.created_at), 'dd MMM yyyy, HH:mm', { locale: uz })}
                          </div>
                        </div>
                        <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                          <div className="text-base sm:text-lg font-bold text-green-600">
                            {formatMoney(toUZS(sale.total_price, sale.currency))}
                          </div>
                          <Badge variant="secondary" className="sm:mt-1">
                            {getPaymentMethodLabel(sale.payment_method)}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
