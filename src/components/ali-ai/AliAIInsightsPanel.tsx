import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Bell,
  X,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  Package,
  DollarSign,
  ClipboardList,
  Truck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Insight {
  id: string;
  insight_type: 'alert' | 'trend' | 'prediction' | 'suggestion' | 'digest';
  severity: 'info' | 'warning' | 'critical';
  category: string;
  title: string;
  description: string;
  data: Record<string, any>;
  action_url?: string;
  action_label?: string;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

const CATEGORY_ICONS: Record<string, typeof Package> = {
  shipments: Truck,
  inventory: Package,
  tasks: ClipboardList,
  finance: DollarSign,
  claims: AlertCircle,
};

const TYPE_ICONS: Record<string, typeof Bell> = {
  alert: AlertTriangle,
  trend: TrendingUp,
  prediction: Lightbulb,
  suggestion: Lightbulb,
  digest: Bell,
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

interface AliAIInsightsPanelProps {
  compact?: boolean;
}

export function AliAIInsightsPanel({ compact = false }: AliAIInsightsPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch insights
  const { data: insights, isLoading } = useQuery({
    queryKey: ['ali-ai-insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ali_ai_insights')
        .select('*')
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Insight[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (insightId: string) => {
      const { error } = await supabase
        .from('ali_ai_insights')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ali-ai-insights'] });
    },
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (insightId: string) => {
      const { error } = await supabase
        .from('ali_ai_insights')
        .update({ is_dismissed: true })
        .eq('id', insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ali-ai-insights'] });
      toast.success(t('ai_alert_hidden'));
    },
  });

  // Refresh insights from worker
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ali-ai-insights-worker`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast.success(t('ai_n_insights', { count: result.saved_insights }));
        queryClient.invalidateQueries({ queryKey: ['ali-ai-insights'] });
      }
    } catch (error) {
      toast.error(t('ai_refresh_error'));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleInsightClick = (insight: Insight) => {
    if (!insight.is_read) {
      markReadMutation.mutate(insight.id);
    }
    if (insight.action_url) {
      navigate(insight.action_url);
    }
  };

  const unreadCount = insights?.filter((i) => !i.is_read).length || 0;
  const criticalCount = insights?.filter((i) => i.severity === 'critical').length || 0;

  if (isLoading) {
    return (
      <Card className={compact ? "" : "h-full"}>
        <CardHeader className={compact ? "py-2 px-3" : "pb-2"}>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className={compact ? "px-3 pb-2" : ""}>
          <Skeleton className={compact ? "h-16 w-full" : "h-20 w-full"} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={compact ? "" : "h-full flex flex-col"}>
      <CardHeader className={compact ? "py-2 px-3" : "pb-2 flex-shrink-0"}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            {t('ai_insights')}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className={compact ? "px-3 pb-2 pt-0" : "flex-1 overflow-hidden p-2"}>
        {compact ? (
          // Compact view - expandable
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full justify-between h-6 px-1 text-[10px]"
            >
              <span className="text-muted-foreground">
                {!insights || insights.length === 0 
                  ? t('ai_no_alerts') 
                  : t('ai_n_analysis', { count: insights.length })}
              </span>
              {insights && insights.length > 0 && (
                isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
              )}
            </Button>
            
            {criticalCount > 0 && !isExpanded && (
              <div className="flex items-center gap-1 text-destructive px-1">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-[10px] font-medium">{t('ai_n_critical', { count: criticalCount })}</span>
              </div>
            )}
            
            {isExpanded && insights && insights.length > 0 && (
              <ScrollArea className="h-40 mt-1">
                <div className="space-y-1">
                  {insights.slice(0, 5).map((insight) => {
                    const TypeIcon = TYPE_ICONS[insight.insight_type] || Bell;
                    return (
                      <div
                        key={insight.id}
                        className={`p-1.5 rounded-md border cursor-pointer text-[10px] ${
                          SEVERITY_COLORS[insight.severity]
                        }`}
                        onClick={() => handleInsightClick(insight)}
                      >
                        <div className="flex items-start gap-1">
                          <TypeIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{insight.title}</p>
                            <p className="opacity-70 line-clamp-1">{insight.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          // Full view
          <ScrollArea className="h-full">
            {!insights || insights.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">{t('ai_no_alerts')}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {insights.slice(0, 5).map((insight) => {
                  const TypeIcon = TYPE_ICONS[insight.insight_type] || Bell;
                  const CategoryIcon = CATEGORY_ICONS[insight.category] || Package;

                  return (
                    <div
                      key={insight.id}
                      className={`p-2 rounded-md border cursor-pointer transition-all hover:shadow-sm text-xs ${
                        SEVERITY_COLORS[insight.severity]
                      } ${!insight.is_read ? 'ring-1 ring-primary/20' : 'opacity-80'}`}
                      onClick={() => handleInsightClick(insight)}
                    >
                      <div className="flex items-start gap-1.5">
                        <TypeIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-[11px]">{insight.title}</p>
                          <p className="text-[10px] opacity-80 line-clamp-1 mt-0.5">
                            {insight.description}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissMutation.mutate(insight.id);
                          }}
                        >
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
