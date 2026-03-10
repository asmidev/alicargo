import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  MessageSquare, 
  Clock, 
  Zap, 
  TrendingUp,
  Brain,
  Calendar,
  Target,
} from 'lucide-react';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function AliAIAnalyticsDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['ali-ai-analytics', user?.id, timeRange],
    queryFn: async () => {
      if (!user?.id) return null;

      const days = timeRange === '7d' ? 7 : 30;
      const startDate = subDays(new Date(), days).toISOString();

      // Get usage logs
      const { data: logs } = await supabase
        .from('ali_ai_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

      // Get conversations
      const { data: conversations } = await supabase
        .from('ali_ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate);

      // Daily usage trend
      const dailyUsage: Record<string, { queries: number; tokens: number; avgTime: number; count: number }> = {};
      const dateRange = eachDayOfInterval({
        start: subDays(new Date(), days),
        end: new Date(),
      });
      
      dateRange.forEach(date => {
        const key = format(date, 'MM/dd');
        dailyUsage[key] = { queries: 0, tokens: 0, avgTime: 0, count: 0 };
      });

      logs?.forEach(log => {
        const date = format(new Date(log.created_at || ''), 'MM/dd');
        if (dailyUsage[date]) {
          dailyUsage[date].queries++;
          dailyUsage[date].tokens += (log.tokens_input || 0) + (log.tokens_output || 0);
          dailyUsage[date].avgTime += log.response_time_ms || 0;
          dailyUsage[date].count++;
        }
      });

      const dailyData = Object.entries(dailyUsage).map(([date, data]) => ({
        date,
        queries: data.queries,
        tokens: data.tokens,
        avgTime: data.count > 0 ? Math.round(data.avgTime / data.count / 1000) : 0,
      }));

      // Topic distribution
      const topicCounts: Record<string, number> = {};
      logs?.forEach(log => {
        (log.data_scopes_accessed || []).forEach((scope: string) => {
          topicCounts[scope] = (topicCounts[scope] || 0) + 1;
        });
      });

      const topicData = Object.entries(topicCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      // Complexity distribution
      const complexityCounts: Record<string, number> = { simple: 0, medium: 0, complex: 0 };
      logs?.forEach(log => {
        const complexity = log.query_complexity || 'simple';
        complexityCounts[complexity] = (complexityCounts[complexity] || 0) + 1;
      });

      const complexityData = [
        { name: 'Oddiy', value: complexityCounts.simple, color: '#10b981' },
        { name: "O'rtacha", value: complexityCounts.medium, color: '#f59e0b' },
        { name: 'Murakkab', value: complexityCounts.complex, color: '#ef4444' },
      ].filter(d => d.value > 0);

      // Calculate summary stats
      const totalQueries = logs?.length || 0;
      const totalTokens = logs?.reduce((sum, l) => sum + (l.tokens_input || 0) + (l.tokens_output || 0), 0) || 0;
      const avgResponseTime = logs?.length 
        ? Math.round(logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / logs.length / 1000)
        : 0;
      const totalConversations = conversations?.length || 0;

      // Peak hours
      const hourCounts: Record<number, number> = {};
      logs?.forEach(log => {
        const hour = new Date(log.created_at || '').getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      
      const peakHour = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])[0];

      return {
        totalQueries,
        totalTokens,
        avgResponseTime,
        totalConversations,
        dailyData,
        topicData,
        complexityData,
        peakHour: peakHour ? parseInt(peakHour[0]) : null,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Savollar</p>
              <p className="text-lg font-bold">{analytics.totalQueries}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Suhbatlar</p>
              <p className="text-lg font-bold">{analytics.totalConversations}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Zap className="h-4 w-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tokenlar</p>
              <p className="text-lg font-bold">{(analytics.totalTokens / 1000).toFixed(1)}K</p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">O'rt. vaqt</p>
              <p className="text-lg font-bold">{analytics.avgResponseTime}s</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="usage" className="text-xs">
            <BarChart3 className="h-3 w-3 mr-1" />
            Foydalanish
          </TabsTrigger>
          <TabsTrigger value="topics" className="text-xs">
            <Brain className="h-3 w-3 mr-1" />
            Mavzular
          </TabsTrigger>
          <TabsTrigger value="complexity" className="text-xs">
            <Target className="h-3 w-3 mr-1" />
            Murakkablik
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usage">
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Kunlik foydalanish</CardTitle>
                <div className="flex gap-1">
                  <Badge 
                    variant={timeRange === '7d' ? 'default' : 'outline'}
                    className="text-xs cursor-pointer"
                    onClick={() => setTimeRange('7d')}
                  >
                    7 kun
                  </Badge>
                  <Badge 
                    variant={timeRange === '30d' ? 'default' : 'outline'}
                    className="text-xs cursor-pointer"
                    onClick={() => setTimeRange('30d')}
                  >
                    30 kun
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-48 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ fontSize: 12 }}
                    formatter={(value: number, name: string) => [
                      value, 
                      name === 'queries' ? 'Savollar' : name === 'tokens' ? 'Tokenlar' : "O'rt. vaqt (s)"
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="queries" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topics">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">So'ralgan mavzular</CardTitle>
            </CardHeader>
            <CardContent className="h-48 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.topicData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fontSize: 10 }}
                    width={80}
                  />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complexity">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Savol murakkabligi</CardTitle>
            </CardHeader>
            <CardContent className="h-48 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.complexityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {analytics.complexityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Peak Hour */}
      {analytics.peakHour !== null && (
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">
              Eng faol vaqt: <span className="font-medium text-foreground">{analytics.peakHour}:00 - {analytics.peakHour + 1}:00</span>
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
