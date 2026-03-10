import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Package, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface StockAlertPanelProps {
  alerts: any[];
}

const alertConfig = (t: (key: string) => string) => ({
  low_stock: { 
    label: t('sa_low_stock'), 
    color: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
    icon: TrendingDown 
  },
  out_of_stock: { 
    label: t('sa_out_of_stock'), 
    color: 'bg-red-500/20 text-red-600 border-red-500/30',
    icon: AlertTriangle 
  },
  overstock: { 
    label: t('sa_overstock'), 
    color: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
    icon: Package 
  },
  reorder: { 
    label: t('sa_reorder'), 
    color: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
    icon: Package 
  },
});

export function StockAlertPanel({ alerts }: StockAlertPanelProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const configs = alertConfig(t);

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('stock_alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      toast.success(t('sa_resolved'));
    },
    onError: () => {
      toast.error('Xatolik yuz berdi');
    },
  });

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-medium mb-2">{t('sa_no_alerts')}</h3>
          <p className="text-muted-foreground">{t('sa_all_sufficient')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => {
        const config = configs[alert.alert_type as keyof typeof configs];
        const Icon = config?.icon || AlertTriangle;
        
        return (
          <Card key={alert.id} className="border-l-4 border-l-destructive">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${config?.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{alert.product?.name || 'Mahsulot'}</h4>
                      <Badge variant="outline" className={config?.color}>
                        {config?.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('sa_current')}: <span className="font-medium">{alert.current_stock}</span> | 
                      {t('sa_threshold')}: <span className="font-medium">{alert.threshold}</span>
                    </p>
                    {alert.warehouse && (
                      <p className="text-sm text-muted-foreground">
                        Ombor: {alert.warehouse.name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(alert.created_at), 'dd.MM.yyyy HH:mm')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resolveMutation.mutate(alert.id)}
                  disabled={resolveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {t('sa_resolve')}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}