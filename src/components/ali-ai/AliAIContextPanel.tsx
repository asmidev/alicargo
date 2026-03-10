import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, 
  Box, 
  Truck, 
  DollarSign, 
  CheckSquare, 
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { fetchAllRows } from '@/lib/fetchAllRows';

interface AliAIContextPanelProps {
  userRoles: string[];
}

export function AliAIContextPanel({ userRoles }: AliAIContextPanelProps) {
  const { t } = useTranslation();
  const canViewProducts = userRoles.some(r => ['rahbar', 'bosh_admin', 'xitoy_manager', 'xitoy_packer', 'uz_manager'].includes(r));
  const canViewBoxes = userRoles.some(r => ['rahbar', 'bosh_admin', 'xitoy_manager', 'xitoy_packer', 'uz_manager', 'uz_receiver'].includes(r));
  const canViewFinance = userRoles.some(r => ['rahbar', 'bosh_admin', 'moliya_xodimi'].includes(r));
  const canViewTasks = userRoles.length > 0;

  // Fetch quick stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['ali-ai-context-stats'],
    queryFn: async () => {
      const results: any = {};

      if (canViewProducts) {
        const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
        results.products = count || 0;
      }

      if (canViewBoxes) {
        const { data: boxes } = await supabase.from('boxes').select('status');
        results.boxes = {
          total: boxes?.length || 0,
          packing: boxes?.filter(b => b.status === 'packing').length || 0,
          inTransit: boxes?.filter(b => b.status === 'in_transit').length || 0,
          arrived: boxes?.filter(b => b.status === 'arrived').length || 0,
        };
      }

      if (canViewFinance) {
        const transactions = await fetchAllRows(
          supabase
            .from('finance_transactions')
            .select('amount, transaction_type')
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        );
        
        const income = transactions?.filter(t => t.transaction_type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const expense = transactions?.filter(t => t.transaction_type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        
        results.finance = { income, expense, balance: income - expense };
      }

      if (canViewTasks) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('status')
          .neq('status', 'done');
        
        results.tasks = {
          pending: tasks?.filter(t => t.status === 'todo').length || 0,
          inProgress: tasks?.filter(t => t.status === 'in_progress').length || 0,
        };
      }

      const { data: alerts } = await supabase
        .from('stock_alerts')
        .select('id')
        .eq('is_resolved', false);
      results.alerts = alerts?.length || 0;

      return results;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="w-72 flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('ai_system_status')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-72 flex-shrink-0 hidden lg:block">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          {t('ai_system_status')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-3 pr-2">
            {canViewProducts && stats?.products !== undefined && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-blue-500" />
                  {t('ai_products_label')}
                </div>
                <p className="text-2xl font-bold">{stats.products}</p>
                <p className="text-xs text-muted-foreground">{t('ai_total_products')}</p>
              </div>
            )}

            {canViewBoxes && stats?.boxes && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Box className="h-4 w-4 text-orange-500" />
                  {t('ai_boxes_label')}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">{t('ai_packing')}</p>
                    <p className="font-semibold">{stats.boxes.packing}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('ai_in_transit')}</p>
                    <p className="font-semibold">{stats.boxes.inTransit}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('ai_arrived')}</p>
                    <p className="font-semibold">{stats.boxes.arrived}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('ai_total')}</p>
                    <p className="font-semibold">{stats.boxes.total}</p>
                  </div>
                </div>
              </div>
            )}

            {canViewFinance && stats?.finance && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  {t('ai_finance_30d')}
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('ai_income')}</span>
                    <span className="text-green-600 font-medium">
                      +${stats.finance.income.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('ai_expense')}</span>
                    <span className="text-red-600 font-medium">
                      -${stats.finance.expense.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="font-medium">{t('ai_balance')}</span>
                    <span className={stats.finance.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {stats.finance.balance >= 0 ? '+' : ''}${stats.finance.balance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {canViewTasks && stats?.tasks && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckSquare className="h-4 w-4 text-purple-500" />
                  {t('ai_tasks_label')}
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    {t('ai_waiting')}: {stats.tasks.pending}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {t('ai_in_progress')}: {stats.tasks.inProgress}
                  </Badge>
                </div>
              </div>
            )}

            {stats?.alerts > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {t('ai_alerts')}
                </div>
                <p className="text-xs">
                  {stats.alerts} {t('ai_active_alerts')}
                </p>
              </div>
            )}

            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">{t('ai_your_role')}:</p>
              <div className="flex flex-wrap gap-1">
                {userRoles.map(role => (
                  <Badge key={role} variant="secondary" className="text-xs">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
