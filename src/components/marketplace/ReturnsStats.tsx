import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart3, PieChart as PieIcon, Store } from 'lucide-react';

export function ReturnsStats() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  const { data: stores = [] } = useQuery({
    queryKey: ['marketplace-stores-list'],
    queryFn: async () => {
      const { data } = await supabase.from('marketplace_stores').select('id, name, platform').eq('is_active', true).order('name');
      return data || [];
    },
  });

  const { data: analysis, isLoading } = useQuery({
    queryKey: ['returns-stats', selectedStoreId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('uzum-returns', {
        body: { store_id: selectedStoreId, days: 30 },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStoreId,
    staleTime: 5 * 60 * 1000,
  });

  const weekdayData = analysis?.weekday_analysis || [];
  const metrics = analysis?.metrics;

  const pieData = metrics ? [
    { name: 'Yetkazilgan', value: metrics.delivered_orders, color: 'hsl(var(--primary))' },
    { name: 'Qaytarilgan', value: metrics.returned_orders, color: 'hsl(0 84% 60%)' },
    { name: 'Bekor qilingan', value: metrics.cancelled_orders, color: 'hsl(38 92% 50%)' },
    { name: 'Kutilmoqda', value: metrics.pending_orders, color: 'hsl(var(--muted-foreground))' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Store selector */}
      <div className="max-w-xs">
        <label className="text-sm font-medium text-muted-foreground mb-1 block">Do'kon</label>
        <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
          <SelectTrigger><SelectValue placeholder="Do'konni tanlang" /></SelectTrigger>
          <SelectContent>
            {stores.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name} ({s.platform})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedStoreId && (
        <Card className="p-12 text-center">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">Statistikani ko'rish uchun do'konni tanlang</p>
        </Card>
      )}

      {isLoading && <Skeleton className="h-64 rounded-lg" />}

      {analysis && !isLoading && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Weekly bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Haftalik qaytarish trendi
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weekdayData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={weekdayData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="orders" name="Buyurtmalar" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="returns" name="Qaytarishlar" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cancels" name="Bekor qilingan" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">Ma'lumot yo'q</p>
              )}
            </CardContent>
          </Card>

          {/* Pie chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieIcon className="h-4 w-4" /> Buyurtmalar holati
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">Ma'lumot yo'q</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
