import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, 
  Clock, 
  Zap, 
  TrendingUp,
  Database 
} from 'lucide-react';
import { format, subDays } from 'date-fns';

export function AliAIUsageStats() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['ali-ai-usage-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      // Get usage logs
      const { data: logs, error } = await supabase
        .from('ali_ai_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get conversation count
      const { count: conversationCount } = await supabase
        .from('ali_ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Calculate stats
      const totalQuestions = logs?.length || 0;
      const avgResponseTime = logs?.length 
        ? Math.round(logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / logs.length)
        : 0;
      const totalTokensInput = logs?.reduce((sum, l) => sum + (l.tokens_input || 0), 0) || 0;
      const totalTokensOutput = logs?.reduce((sum, l) => sum + (l.tokens_output || 0), 0) || 0;

      // Most accessed data scopes
      const scopeCounts: Record<string, number> = {};
      logs?.forEach(l => {
        (l.data_scopes_accessed || []).forEach((scope: string) => {
          scopeCounts[scope] = (scopeCounts[scope] || 0) + 1;
        });
      });
      const topScopes = Object.entries(scopeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      return {
        totalQuestions,
        conversationCount: conversationCount || 0,
        avgResponseTime,
        totalTokensInput,
        totalTokensOutput,
        topScopes,
        recentActivity: logs?.slice(0, 5) || [],
      };
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t('ai_7days')}</p>
              <p className="text-lg font-bold">{stats.totalQuestions}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t('ai_avg_response')}</p>
              <p className="text-lg font-bold">{(stats.avgResponseTime / 1000).toFixed(1)}s</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tokens Used */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <p className="text-xs font-medium">{t('ai_tokens_used')}</p>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('ai_input')}:</span>
          <span className="font-medium">{stats.totalTokensInput.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('ai_output')}:</span>
          <span className="font-medium">{stats.totalTokensOutput.toLocaleString()}</span>
        </div>
      </Card>

      {/* Top Data Scopes */}
      {stats.topScopes.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-blue-500" />
            <p className="text-xs font-medium">{t('ai_top_data')}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {stats.topScopes.map(([scope, count]) => (
              <Badge key={scope} variant="secondary" className="text-xs">
                {scope} ({count})
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Conversations */}
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          <div>
            <p className="text-xs text-muted-foreground">{t('ai_total_conversations')}</p>
            <p className="text-lg font-bold">{stats.conversationCount}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
