import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Card } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, TrendingUp } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';

const MONTHLY_THRESHOLD = 83_000_000;
const ANNUAL_THRESHOLD = 1_000_000_000;
const COMPLETED_STATUSES = ['delivered', 'COMPLETED', 'DELIVERED'];

interface YATTThresholdAlertProps {
  storeId: string;
  storeName: string;
}

export function YATTThresholdAlert({ storeId, storeName }: YATTThresholdAlertProps) {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { formatMoney } = useFinanceCurrency();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const { data } = useQuery({
    queryKey: ['yatt-threshold', storeId, now.getFullYear(), now.getMonth()],
    queryFn: async () => {
      const [monthRows, yearRows] = await Promise.all([
        fetchAllRows(
          supabase
            .from('marketplace_orders')
            .select('total_amount')
            .eq('store_id', storeId)
            .in('fulfillment_status', COMPLETED_STATUSES)
            .gte('delivered_at', monthStart)
        ),
        fetchAllRows(
          supabase
            .from('marketplace_orders')
            .select('total_amount')
            .eq('store_id', storeId)
            .in('fulfillment_status', COMPLETED_STATUSES)
            .gte('delivered_at', yearStart)
        ),
      ]);
      const monthly = monthRows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
      const annual = yearRows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
      return { monthly, annual };
    },
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  if (!isAdmin || !data) return null;

  const monthExceeded = data.monthly >= MONTHLY_THRESHOLD;
  const yearExceeded = data.annual >= ANNUAL_THRESHOLD;

  if (!monthExceeded && !yearExceeded) return null;

  return (
    <Alert className="border-red-500/50 bg-red-500/5">
      <ShieldAlert className="h-5 w-5 text-red-500" />
      <AlertTitle className="text-red-600 font-bold flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        {t('yatt_change_needed', 'YATT o\'zgartirish kerak!')}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-1 text-sm">
        <p className="font-medium">{storeName}</p>
        {monthExceeded && (
          <div className="flex items-center gap-2 text-red-600">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{t('yatt_monthly', 'Oylik aylanma')}: <strong>{formatMoney(data.monthly)}</strong> / {formatMoney(MONTHLY_THRESHOLD)}</span>
          </div>
        )}
        {yearExceeded && (
          <div className="flex items-center gap-2 text-red-600">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{t('yatt_annual', 'Yillik aylanma')}: <strong>{formatMoney(data.annual)}</strong> / {formatMoney(ANNUAL_THRESHOLD)}</span>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
