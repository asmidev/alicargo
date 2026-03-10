import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, TrendingDown, Package, AlertTriangle, DollarSign, CheckCircle, RotateCcw, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function ReturnsAIAnalysis() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [days, setDays] = useState(30);

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ['marketplace-stores-list'],
    queryFn: async () => {
      const { data } = await supabase.from('marketplace_stores').select('id, name, platform').eq('is_active', true).order('name');
      return data || [];
    },
  });

  // Fetch AI analysis
  const { data: analysis, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['returns-ai-analysis', selectedStoreId, days],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('uzum-returns', {
        body: { store_id: selectedStoreId, days },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStoreId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Do'kon</label>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger><SelectValue placeholder="Do'konni tanlang" /></SelectTrigger>
            <SelectContent>
              {stores.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} <span className="text-muted-foreground ml-1">({s.platform})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Davr</label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 kun</SelectItem>
              <SelectItem value="14">14 kun</SelectItem>
              <SelectItem value="30">30 kun</SelectItem>
              <SelectItem value="60">60 kun</SelectItem>
              <SelectItem value="90">90 kun</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => refetch()} disabled={!selectedStoreId || isFetching} variant="outline">
          <Brain className="h-4 w-4 mr-2" />
          {isFetching ? 'Tahlil qilmoqda...' : 'AI Tahlil'}
        </Button>
      </div>

      {!selectedStoreId && (
        <Card className="p-12 text-center">
          <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">Do'konni tanlang va AI tahlilni boshlang</p>
        </Card>
      )}

      {isLoading && selectedStoreId && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      )}

      {analysis && !isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={Package} label="Jami buyurtmalar" value={analysis.metrics?.total_orders || 0} />
            <KPICard icon={TrendingDown} label="Qaytarish %" value={`${analysis.metrics?.return_rate || 0}%`} variant={analysis.metrics?.return_rate > 10 ? 'destructive' : 'default'} />
            <KPICard icon={DollarSign} label="Yo'qotilgan daromad" value={`${(analysis.metrics?.lost_revenue || 0).toLocaleString()} UZS`} variant="warning" />
            <KPICard icon={CheckCircle} label="Muvaffaqiyat %" value={`${analysis.metrics?.success_rate || 0}%`} variant="success" />
          </div>

          {/* Resolution Stats */}
          {analysis.resolution_stats && analysis.resolution_stats.total > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Qaytarish hal qilish statistikasi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <StatItem label="Jami" value={analysis.resolution_stats.total} />
                  <StatItem label="Qayta jo'natilgan" value={analysis.resolution_stats.resend} color="text-blue-500" />
                  <StatItem label="Rad etilgan" value={analysis.resolution_stats.rejected} color="text-destructive" />
                  <StatItem label="Do'konda sotilgan" value={analysis.resolution_stats.sell_local} color="text-emerald-500" />
                  <StatItem label="O'rtacha vaqt" value={`${analysis.resolution_stats.avg_resolution_hours} soat`} icon={<Clock className="h-3 w-3" />} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Insights */}
          {analysis.ai_insights && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" /> AI Tavsiyalar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none [&>h1]:text-lg [&>h2]:text-base [&>h3]:text-sm [&>ul]:my-2 [&>ol]:my-2 [&>p]:my-1.5">
                  <ReactMarkdown>{analysis.ai_insights}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Problematic Products */}
          {analysis.problematic_products?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Muammoli mahsulotlar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Mahsulot</th>
                        <th className="pb-2 pr-4 text-right">Buyurtma</th>
                        <th className="pb-2 pr-4 text-right">Qaytarish</th>
                        <th className="pb-2 pr-4 text-right">%</th>
                        <th className="pb-2 text-right">Yo'qotish</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.problematic_products.map((p: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-4 max-w-[200px] truncate">{p.product_name}</td>
                          <td className="py-2 pr-4 text-right">{p.total_ordered}</td>
                          <td className="py-2 pr-4 text-right text-destructive">{p.returned + p.cancelled}</td>
                          <td className="py-2 pr-4 text-right">
                            <Badge variant={p.return_rate > 20 ? 'destructive' : 'secondary'} className="text-xs">
                              {p.return_rate.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="py-2 text-right text-muted-foreground">{p.lost_value.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, variant = 'default' }: { icon: any; label: string; value: string | number; variant?: string }) {
  const colorMap: Record<string, string> = {
    destructive: 'text-destructive',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
    default: 'text-foreground',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${colorMap[variant] || 'text-muted-foreground'}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-lg font-bold ${colorMap[variant]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatItem({ label, value, color, icon }: { label: string; value: string | number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color || 'text-foreground'} flex items-center justify-center gap-1`}>
        {icon} {value}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
