import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon,
  Sparkles, RefreshCw, AlertTriangle, CheckCircle, Lightbulb, Target,
  BarChart3, ArrowUpRight, ArrowDownRight, Loader2, Store, Download,
  Layers, Package, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';

// --- Types ---

interface AIInsight {
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  priority: 'high' | 'medium' | 'low';
}

interface AIRecommendation {
  action: string;
  expectedImpact: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface AIAnalysisResult {
  summary: string;
  insights: AIInsight[];
  recommendations: AIRecommendation[];
  metrics: {
    healthScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    trend: 'improving' | 'stable' | 'declining';
  };
}

interface RawMetrics {
  totalGrossRevenue: number;
  totalCommission: number;
  totalDeliveryFees: number;
  totalNetRevenue: number;
  totalOrders: number;
  totalDelivered: number;
  totalCancelled: number;
  deliveryRate: number;
  cancellationRate: number;
  grossRevenueUSD: number;
  netRevenueUSD: number;
  commissionUSD: number;
  avgCommissionRate: number;
  inventoryValueUZS: number;
  inventoryValueUSD: number;
  totalManualExpenseUSD: number;
  totalManualIncomeUSD: number;
  uzsRate: number;
  storeMetrics: Record<string, any>;
  platformMetrics: Record<string, any>;
  monthlyData: Record<string, { grossRevenue: number; netRevenue: number; commission: number; orders: number; delivered: number }>;
  expenseByCategory: Record<string, number>;
}

interface AnalysisData {
  analysisType: string;
  analysis: AIAnalysisResult;
  rawMetrics: RawMetrics;
  generatedAt: string;
  fromCache?: boolean;
}

// --- Helpers ---

const m = (val: any, fallback = 0): number => {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

const formatUSD = (val: number) =>
  `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const UZUM_COLORS = ['#a855f7', '#7c3aed', '#c084fc', '#9333ea', '#6d28d9', '#e879f9', '#d946ef'];
const YANDEX_COLORS = ['#f59e0b', '#d97706', '#fbbf24', '#92400e', '#b45309', '#fde68a', '#fcd34d'];

type PeriodKey = 'all' | 'this_month' | 'last_month' | 'last_3' | 'last_6';

function getDateRange(period: PeriodKey): { startDate?: string; endDate?: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  if (period === 'all') return {};
  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return { startDate: start, endDate: end };
  }
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const endLM = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    return { startDate: start, endDate: endLM };
  }
  if (period === 'last_3') {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
    return { startDate: start, endDate: end };
  }
  // last_6
  const start = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
  return { startDate: start, endDate: end };
}

// --- PDF Export ---

function exportPDF(data: AnalysisData, t: (k: string) => string) {
  const doc = new jsPDF();
  const analysis = data.analysis;
  const raw = data.rawMetrics;
  let y = 20;

  doc.setFontSize(18);
  doc.text(t('aia_title'), 14, y); y += 10;
  doc.setFontSize(10);
  doc.text(data.generatedAt, 14, y); y += 12;

  doc.setFontSize(14);
  doc.text(`Health Score: ${analysis.metrics.healthScore}/100`, 14, y); y += 8;
  doc.text(`Risk: ${analysis.metrics.riskLevel} | Trend: ${analysis.metrics.trend}`, 14, y); y += 10;

  doc.setFontSize(11);
  doc.text(`${t('aia_revenue')}: ${formatUSD(m(raw?.grossRevenueUSD))}`, 14, y); y += 6;
  doc.text(`${t('aia_store_net')}: ${formatUSD(m(raw?.netRevenueUSD))}`, 14, y); y += 6;
  doc.text(`${t('aia_store_commission')}: ${formatUSD(m(raw?.commissionUSD))} (${m(raw?.avgCommissionRate).toFixed(1)}%)`, 14, y); y += 6;
  doc.text(`${t('aia_delivery_rate')}: ${m(raw?.deliveryRate).toFixed(1)}%`, 14, y); y += 6;
  doc.text(`${t('aia_cancellation_rate')}: ${m(raw?.cancellationRate).toFixed(1)}%`, 14, y); y += 10;

  doc.setFontSize(12);
  doc.text(t('aia_summary'), 14, y); y += 7;
  doc.setFontSize(9);
  const summaryLines = doc.splitTextToSize(analysis.summary, 180);
  doc.text(summaryLines, 14, y); y += summaryLines.length * 4.5 + 6;

  if (y < 250) {
    doc.setFontSize(12);
    doc.text(t('aia_recommendations'), 14, y); y += 7;
    doc.setFontSize(9);
    analysis.recommendations.forEach((rec, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const recLines = doc.splitTextToSize(`${i + 1}. ${rec.action} — ${rec.expectedImpact}`, 175);
      doc.text(recLines, 14, y); y += recLines.length * 4.5 + 3;
    });
  }

  doc.save(`ai-finance-${data.analysisType}-${new Date().toISOString().split('T')[0]}.pdf`);
}

// --- Main Component ---

export default function AIAnalytics() {
  const { hasAnyRole, isLoading: rolesLoading } = useUserRole();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profit');
  const [period, setPeriod] = useState<PeriodKey>('all');

  const canAccess = hasAnyRole(['rahbar', 'bosh_admin', 'moliya_xodimi']);

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const analysisMutation = useMutation({
    mutationFn: async ({ analysisType, forceRefresh }: { analysisType: string; forceRefresh?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('ai-financial-analysis', {
        body: { analysisType, forceRefresh, ...dateRange }
      });
      if (error) throw error;
      return data as AnalysisData;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-analysis', data.analysisType, period], data);
      if (data.fromCache) {
        toast({ title: t('aia_cache_loaded'), description: t('aia_cache_hint') });
      }
    },
    onError: (error: any) => {
      toast({ title: t('aia_error'), description: error.message || t('aia_error_msg'), variant: 'destructive' });
    }
  });

  const { data: profitAnalysis, isLoading: profitLoading } = useQuery({
    queryKey: ['ai-analysis', 'profit', period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-financial-analysis', {
        body: { analysisType: 'profit', ...dateRange }
      });
      if (error) throw error;
      return data as AnalysisData;
    },
    enabled: canAccess,
    staleTime: 1000 * 60 * 30,
  });

  const handleRefresh = (type: string) => {
    analysisMutation.mutate({ analysisType: type, forceRefresh: true });
  };

  // --- Helper renderers ---

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive': return <ArrowUpRight className="h-4 w-4 text-green-500" />;
      case 'negative': return <ArrowDownRight className="h-4 w-4 text-red-500" />;
      default: return <TrendingUp className="h-4 w-4 text-muted-foreground" />;
    }
  };
  const getPriorityColor = (p: string) => {
    if (p === 'high') return 'bg-red-500/20 text-red-600 border-red-500/30';
    if (p === 'medium') return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
    return 'bg-green-500/20 text-green-600 border-green-500/30';
  };
  const getDifficultyColor = (d: string) => {
    if (d === 'easy') return 'bg-green-500/20 text-green-600';
    if (d === 'medium') return 'bg-yellow-500/20 text-yellow-600';
    return 'bg-red-500/20 text-red-600';
  };
  const getHealthScoreColor = (s: number) => s >= 70 ? 'text-green-500' : s >= 40 ? 'text-yellow-500' : 'text-red-500';
  const getRiskBadge = (r: string) => {
    const cls = r === 'low' ? 'bg-green-500/20 text-green-600' : r === 'medium' ? 'bg-yellow-500/20 text-yellow-600' : 'bg-red-500/20 text-red-600';
    return <Badge variant="outline" className={cls}>{t(`aia_risk_${r}`)}</Badge>;
  };
  const getTrendIcon = (tr: string) => {
    if (tr === 'improving') return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (tr === 'declining') return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <BarChart3 className="h-5 w-5 text-muted-foreground" />;
  };
  const getPriorityLabel = (p: string) => t(`aia_priority_${p}`);
  const getDifficultyLabel = (d: string) => t(`aia_difficulty_${d}`);

  const currentAnalysis = activeTab === 'profit' ? profitAnalysis : 
    queryClient.getQueryData<AnalysisData>(['ai-analysis', activeTab, period]);
  const isLoading = activeTab === 'profit' ? profitLoading : analysisMutation.isPending;

  const raw = currentAnalysis?.rawMetrics;
  const revenue = m(raw?.grossRevenueUSD);
  const commission = m(raw?.commissionUSD);
  const manualExpense = m(raw?.totalManualExpenseUSD);
  const totalCost = commission + manualExpense;
  const netRevenue = m(raw?.netRevenueUSD);
  const profit = netRevenue - manualExpense;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const inventory = m(raw?.inventoryValueUSD);

  // Chart data — all useMemo hooks MUST be above the early return
  const monthlyChartData = useMemo(() => {
    if (!raw?.monthlyData) return [];
    return Object.entries(raw.monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([, d]) => d.grossRevenue > 0)
      .map(([month, d]) => ({
        month: month.substring(5),
        grossRevenueUSD: d.grossRevenue / m(raw.uzsRate, 12800),
        netRevenueUSD: d.netRevenue / m(raw.uzsRate, 12800),
        commissionUSD: d.commission / m(raw.uzsRate, 12800),
        orders: d.orders,
      }));
  }, [raw?.monthlyData, raw?.uzsRate]);

  const storeChartData = useMemo(() => {
    if (!raw?.storeMetrics) return [];
    return Object.entries(raw.storeMetrics)
      .map(([name, d]: [string, any]) => ({
        name: d?.name || name,
        revenue: m(d?.grossRevenueUSD),
        net: m(d?.netRevenueUSD),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [raw?.storeMetrics]);

  const expenseChartData = useMemo(() => {
    if (!raw?.expenseByCategory) return [];
    return Object.entries(raw.expenseByCategory)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [raw?.expenseByCategory]);

  const uzumPieData = useMemo(() =>
    Object.entries(raw?.storeMetrics || {})
      .filter(([, d]: [string, any]) => d?.platform === 'uzum' && m(d?.grossRevenueUSD) > 0)
      .map(([name, d]: [string, any]) => ({ name: d?.name || name, value: m(d?.grossRevenueUSD) }))
      .sort((a, b) => b.value - a.value),
    [raw?.storeMetrics]
  );

  const yandexPieData = useMemo(() =>
    Object.entries(raw?.storeMetrics || {})
      .filter(([, d]: [string, any]) => d?.platform === 'yandex' && m(d?.grossRevenueUSD) > 0)
      .map(([name, d]: [string, any]) => ({ name: d?.name || name, value: m(d?.grossRevenueUSD) }))
      .sort((a, b) => b.value - a.value),
    [raw?.storeMetrics]
  );

  const platformData = useMemo(() => {
    if (!raw?.platformMetrics) return [];
    const rate = m(raw.uzsRate, 12800);
    return Object.entries(raw.platformMetrics).map(([platform, d]: [string, any]) => ({
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      grossRevenueUSD: d.grossRevenue / rate,
      netRevenueUSD: d.netRevenue / rate,
      commissionUSD: d.commission / rate,
      commissionRate: d.grossRevenue > 0 ? (d.commission / d.grossRevenue * 100) : 0,
      stores: d.stores,
    }));
  }, [raw?.platformMetrics, raw?.uzsRate]);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t('aia_no_access')}</p>
        </Card>
      </div>
    );
  }

  const periods: { key: PeriodKey; label: string }[] = [
    { key: 'all', label: t('aia_period_all') },
    { key: 'this_month', label: t('aia_period_this_month') },
    { key: 'last_month', label: t('aia_period_last_month') },
    { key: 'last_3', label: t('aia_period_last_3_months') },
    { key: 'last_6', label: t('aia_period_last_6_months') },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('aia_title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('aia_subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {currentAnalysis && (
            <Button variant="outline" size="sm" onClick={() => exportPDF(currentAnalysis, t)} className="min-h-[44px]">
              <Download className="h-4 w-4 mr-2" />
              {t('aia_export_pdf')}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => handleRefresh(activeTab)}
            disabled={analysisMutation.isPending}
            className="min-h-[44px]"
          >
            {analysisMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {t('aia_refresh')}
          </Button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap gap-2">
        {periods.map(p => (
          <Button
            key={p.key}
            variant={period === p.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setPeriod(p.key);
              // Clear cached data and refetch
              queryClient.removeQueries({ queryKey: ['ai-analysis'] });
            }}
            className="min-h-[36px]"
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        if (!queryClient.getQueryData(['ai-analysis', v, period])) {
          analysisMutation.mutate({ analysisType: v });
        }
      }}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="profit" className="gap-2">
            <PieChartIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t('aia_tab_profit')}</span>
          </TabsTrigger>
          <TabsTrigger value="cost_optimization" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">{t('aia_tab_cost')}</span>
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">{t('aia_tab_pricing')}</span>
          </TabsTrigger>
          <TabsTrigger value="trend" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">{t('aia_tab_trend')}</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <Brain className="h-12 w-12 text-primary animate-pulse" />
                <Sparkles className="h-5 w-5 text-yellow-500 absolute -top-1 -right-1 animate-bounce" />
              </div>
              <p className="text-muted-foreground">{t('aia_analyzing')}</p>
            </div>
          ) : currentAnalysis?.analysis ? (
            <div className="grid gap-6 md:grid-cols-3">
              {/* Health Score Card - mobile */}
              <div className="space-y-4 md:hidden order-first">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{t('aia_health')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className={cn("text-4xl font-bold", getHealthScoreColor(currentAnalysis.analysis.metrics.healthScore))}>
                        {currentAnalysis.analysis.metrics.healthScore}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">100 {t('aia_out_of')}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">{t('aia_revenue')}</span>
                        <span className="font-medium text-green-600">{formatUSD(revenue)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">{t('aia_cost')}</span>
                        <span className="font-medium text-red-600">{formatUSD(totalCost)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">{t('aia_profit')}</span>
                        <span className={cn("font-medium", profit >= 0 ? 'text-green-600' : 'text-red-600')}>{formatUSD(profit)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">{t('aia_delivery_rate')}</span>
                        <span className="font-medium text-green-600">{m(raw?.deliveryRate).toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Summary Card */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        {t('aia_summary')}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRiskBadge(currentAnalysis.analysis.metrics.riskLevel)}
                      {getTrendIcon(currentAnalysis.analysis.metrics.trend)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground mb-6">{currentAnalysis.analysis.summary}</p>
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      {t('aia_findings')}
                    </h4>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2 pr-4">
                        {currentAnalysis.analysis.insights.map((insight, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border">
                            <div className="flex items-start gap-2">
                              {getImpactIcon(insight.impact)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-medium text-sm">{insight.title}</span>
                                  <Badge variant="outline" className={cn("text-xs", getPriorityColor(insight.priority))}>
                                    {getPriorityLabel(insight.priority)}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{insight.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              {/* Health Score + Key Metrics - Desktop */}
              <div className="space-y-6 hidden md:block">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{t('aia_health')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className={cn("text-5xl font-bold", getHealthScoreColor(currentAnalysis.analysis.metrics.healthScore))}>
                        {currentAnalysis.analysis.metrics.healthScore}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">100 {t('aia_out_of')}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{t('aia_key_metrics')}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('aia_revenue')}</span>
                      <span className="font-medium text-green-600">{formatUSD(revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('aia_cost')}</span>
                      <span className="font-medium text-red-600">{formatUSD(totalCost)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('aia_profit')}</span>
                      <span className={cn("font-medium", profit >= 0 ? 'text-green-600' : 'text-red-600')}>{formatUSD(profit)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('aia_margin')}</span>
                      <span className="font-medium">{margin.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('aia_inventory')}</span>
                      <span className="font-medium">{formatUSD(inventory)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('aia_delivery_rate')}</span>
                      <span className="font-medium text-green-600">{m(raw?.deliveryRate).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('aia_cancellation_rate')}</span>
                      <span className="font-medium text-red-600">{m(raw?.cancellationRate).toFixed(1)}%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue Trend Chart */}
              {monthlyChartData.length > 1 && (
                <Card className="md:col-span-3">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      {t('aia_revenue_trend')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => formatUSD(v)} />
                        <Legend />
                        <Line type="monotone" dataKey="grossRevenueUSD" name={t('aia_gross_revenue')} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="netRevenueUSD" name={t('aia_net_revenue')} stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="commissionUSD" name={t('aia_store_commission')} stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Store Comparison Bar Chart */}
              {storeChartData.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      {t('aia_store_comparison')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(200, storeChartData.length * 45)}>
                      <BarChart data={storeChartData} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} className="text-xs" />
                        <YAxis type="category" dataKey="name" width={75} className="text-xs" />
                        <Tooltip formatter={(v: number) => formatUSD(v)} />
                        <Legend />
                        <Bar dataKey="revenue" name={t('aia_gross_revenue')} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="net" name={t('aia_net_revenue')} fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Uzum Store Revenue Pie Chart */}
              {uzumPieData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieChartIcon className="h-5 w-5" style={{ color: '#a855f7' }} />
                      <span style={{ color: '#a855f7' }}>Uzum</span> do'konlari ulushi
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={uzumPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {uzumPieData.map((_, idx) => (
                            <Cell key={idx} fill={UZUM_COLORS[idx % UZUM_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatUSD(v)} />
                        <Legend formatter={(name: string) => name.length > 16 ? name.slice(0, 16) + '…' : name} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Yandex Store Revenue Pie Chart */}
              {yandexPieData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieChartIcon className="h-5 w-5" style={{ color: '#f59e0b' }} />
                      <span style={{ color: '#f59e0b' }}>Yandex</span> do'konlari ulushi
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={yandexPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {yandexPieData.map((_, idx) => (
                            <Cell key={idx} fill={YANDEX_COLORS[idx % YANDEX_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatUSD(v)} />
                        <Legend formatter={(name: string) => name.length > 16 ? name.slice(0, 16) + '…' : name} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Expense Breakdown Pie */}
              {expenseChartData.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieChartIcon className="h-5 w-5 text-primary" />
                      {t('aia_expense_breakdown')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={expenseChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: $${value}`}>
                          {expenseChartData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `$${v}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieChartIcon className="h-5 w-5 text-primary" />
                      {t('aia_expense_breakdown')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                    {t('aia_no_expense_data')}
                  </CardContent>
                </Card>
              )}

              {/* Platform Comparison */}
              {platformData.length > 0 && (
                <Card className="md:col-span-3">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Layers className="h-5 w-5 text-primary" />
                      {t('aia_platform_comparison')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {platformData.map((plat) => (
                        <div key={plat.platform} className="p-4 rounded-lg border border-border bg-card">
                          <div className="font-semibold text-base mb-3">{plat.platform}</div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('aia_gross_revenue')}</span>
                              <span className="font-medium text-green-600">{formatUSD(plat.grossRevenueUSD)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('aia_net_revenue')}</span>
                              <span className="font-medium">{formatUSD(plat.netRevenueUSD)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('aia_store_commission')}</span>
                              <span className="font-medium">{formatUSD(plat.commissionUSD)} ({plat.commissionRate.toFixed(1)}%)</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('aia_stores_count')}</span>
                              <span className="font-medium">{plat.stores}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Store Breakdown with delivery/cancellation rates */}
              {raw?.storeMetrics && Object.keys(raw.storeMetrics).length > 0 && (
                <Card className="md:col-span-3">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Store className="h-5 w-5 text-primary" />
                      {t('aia_store_performance')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(raw.storeMetrics).map(([storeName, data]: [string, any]) => {
                        const storeRevenue = m(data?.grossRevenueUSD);
                        const storeNet = m(data?.netRevenueUSD);
                        const storeCommRate = m(data?.commissionRate);
                        const storeDelivRate = m(data?.deliveryRate);
                        const storeCancelRate = m(data?.cancellationRate);
                        const displayName = data?.name || storeName;
                        return (
                          <div key={storeName} className="p-3 rounded-lg border border-border bg-card">
                            <div className="font-medium text-sm mb-2 truncate">{displayName}</div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('aia_store_revenue')}</span>
                                <span className="text-green-600 font-medium">{formatUSD(storeRevenue)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('aia_store_net')}</span>
                                <span className="font-medium">{formatUSD(storeNet)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('aia_store_commission')}</span>
                                <span className="font-medium">{storeCommRate.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('aia_store_orders')}</span>
                                <span className="font-medium">{m(data?.orders)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> {t('aia_delivery_rate')}</span>
                                <span className="font-medium text-green-600">{storeDelivRate.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3" /> {t('aia_cancellation_rate')}</span>
                                <span className="font-medium text-red-600">{storeCancelRate.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              <Card className="md:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    {t('aia_recommendations')}
                  </CardTitle>
                  <CardDescription>{t('aia_recommendations_desc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {currentAnalysis.analysis.recommendations.map((rec, idx) => (
                      <div key={idx} className="p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", getDifficultyColor(rec.difficulty))}>
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm mb-1">{rec.action}</p>
                            <p className="text-xs text-muted-foreground mb-2">{rec.expectedImpact}</p>
                            <Badge variant="outline" className={cn("text-xs", getDifficultyColor(rec.difficulty))}>
                              {getDifficultyLabel(rec.difficulty)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">{t('aia_not_analyzed')}</p>
              <Button onClick={() => analysisMutation.mutate({ analysisType: activeTab })}>
                <Sparkles className="h-4 w-4 mr-2" />
                {t('aia_start')}
              </Button>
            </Card>
          )}
        </div>
      </Tabs>
    </div>
  );
}
