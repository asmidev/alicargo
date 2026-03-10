import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, 
  Box, 
  Truck, 
  DollarSign, 
  CheckSquare, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchAllRows } from '@/lib/fetchAllRows';

interface AliAILiveContextProps {
  userRoles: string[];
  conversationTopics?: string[];
}

export function AliAILiveContext({ userRoles, conversationTopics = [] }: AliAILiveContextProps) {
  const { t } = useTranslation();
  const canViewProducts = userRoles.some(r => ['rahbar', 'bosh_admin', 'xitoy_manager', 'xitoy_packer', 'uz_manager'].includes(r));
  const canViewBoxes = userRoles.some(r => ['rahbar', 'bosh_admin', 'xitoy_manager', 'xitoy_packer', 'uz_manager', 'uz_receiver'].includes(r));
  const canViewFinance = userRoles.some(r => ['rahbar', 'bosh_admin', 'moliya_xodimi'].includes(r));
  const canViewTasks = userRoles.length > 0;

  // Fetch context-aware stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['ali-ai-live-context', conversationTopics],
    queryFn: async () => {
      const results: any = {};

      if (canViewProducts) {
        const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
        results.products = count || 0;
      }

      if (canViewBoxes) {
        const { data: boxes } = await supabase
          .from('boxes')
          .select('status')
          .in('status', ['packing', 'in_transit', 'arrived']);
        
        results.boxes = {
          total: boxes?.length || 0,
          inTransit: boxes?.filter(b => b.status === 'in_transit').length || 0,
        };
      }

      if (canViewFinance) {
        const transactions = await fetchAllRows(
          supabase
            .from('finance_transactions')
            .select('amount, transaction_type')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        );
        
        const income = transactions?.filter(t => t.transaction_type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const expense = transactions?.filter(t => t.transaction_type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        
        results.finance = { income, expense, net: income - expense };
      }

      if (canViewTasks) {
        const { count: pendingTasks } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .in('status', ['todo', 'in_progress']);
        
        const { count: overdueTasks } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .lt('due_date', new Date().toISOString())
          .not('status', 'in', '("done","cancelled")');
        
        results.tasks = { pending: pendingTasks || 0, overdue: overdueTasks || 0 };
      }

      const { count: alertCount } = await supabase
        .from('stock_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('is_resolved', false);
      results.alerts = alertCount || 0;

      return results;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-6 w-24 flex-shrink-0" />
        ))}
      </div>
    );
  }

  const items = [];

  if (canViewProducts && stats?.products !== undefined) {
    items.push({
      icon: Package,
      label: t('ai_products_label'),
      value: stats.products,
      color: 'text-blue-500',
    });
  }

  if (canViewBoxes && stats?.boxes) {
    items.push({
      icon: Truck,
      label: t('ai_in_transit'),
      value: stats.boxes.inTransit,
      color: 'text-orange-500',
    });
  }

  if (canViewFinance && stats?.finance) {
    items.push({
      icon: stats.finance.net >= 0 ? TrendingUp : TrendingDown,
      label: t('ai_7days'),
      value: `$${Math.abs(stats.finance.net).toLocaleString()}`,
      color: stats.finance.net >= 0 ? 'text-green-500' : 'text-red-500',
      isPositive: stats.finance.net >= 0,
    });
  }

  if (canViewTasks && stats?.tasks) {
    if (stats.tasks.overdue > 0) {
      items.push({
        icon: AlertTriangle,
        label: t('ai_arrived'),
        value: stats.tasks.overdue,
        color: 'text-red-500',
        isAlert: true,
      });
    } else {
      items.push({
        icon: CheckSquare,
        label: t('ai_tasks_label'),
        value: stats.tasks.pending,
        color: 'text-purple-500',
      });
    }
  }

  if (stats?.alerts > 0) {
    items.push({
      icon: AlertTriangle,
      label: t('ai_alerts'),
      value: stats.alerts,
      color: 'text-destructive',
      isAlert: true,
    });
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      <Activity className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      {items.map((item, idx) => (
        <Badge
          key={idx}
          variant={item.isAlert ? "destructive" : "secondary"}
          className={cn(
            "text-[10px] h-5 px-1.5 flex-shrink-0 gap-0.5",
            !item.isAlert && "bg-muted/80"
          )}
        >
          <item.icon className={cn("h-2.5 w-2.5", item.color)} />
          <span className="font-medium">{item.value}</span>
          <span className="opacity-70">{item.label}</span>
        </Badge>
      ))}
    </div>
  );
}
