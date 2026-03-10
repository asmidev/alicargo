import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import {
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  BarChart3
} from 'lucide-react';
import { format, subDays, differenceInDays, isAfter, parseISO } from 'date-fns';
import { uz, ru, enUS, zhCN } from 'date-fns/locale';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  due_date: string | null;
  completed_at: string | null;
  location: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const STATUS_COLORS: Record<string, string> = {
  todo: 'hsl(var(--muted-foreground))',
  in_progress: 'hsl(var(--chart-2))',
  review: 'hsl(var(--chart-3))',
  done: 'hsl(var(--chart-1))',
  cancelled: 'hsl(var(--destructive))'
};

export function TaskAnalytics() {
  const { t, i18n } = useTranslation();
  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');

  const getLocale = () => {
    switch (i18n.language) {
      case 'uz': return uz;
      case 'ru': return ru;
      case 'zh': return zhCN;
      default: return enUS;
    }
  };

  // Fetch all tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-analytics', dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange));
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Task[];
    }
  });

  // Fetch profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name');
      if (error) throw error;
      return data as Profile[];
    }
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach(p => {
      map[p.id] = p.full_name || p.id;
    });
    return map;
  }, [profiles]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const overdue = tasks.filter(t => 
      t.due_date && 
      t.status !== 'done' && 
      t.status !== 'cancelled' &&
      isAfter(new Date(), parseISO(t.due_date))
    ).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, overdue, completionRate };
  }, [tasks]);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: t(status),
      value: count,
      status
    }));
  }, [tasks, t]);

  // Priority distribution
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => {
      counts[t.priority] = (counts[t.priority] || 0) + 1;
    });
    return Object.entries(counts).map(([priority, count]) => ({
      name: t(priority),
      value: count
    }));
  }, [tasks, t]);

  // Daily completion trend
  const trendData = useMemo(() => {
    const days = parseInt(dateRange);
    const data: { date: string; created: number; completed: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const displayDate = format(date, 'dd MMM', { locale: getLocale() });
      
      const created = tasks.filter(t => 
        format(parseISO(t.created_at), 'yyyy-MM-dd') === dateStr
      ).length;
      
      const completed = tasks.filter(t => 
        t.completed_at && format(parseISO(t.completed_at), 'yyyy-MM-dd') === dateStr
      ).length;
      
      data.push({ date: displayDate, created, completed });
    }
    
    return data;
  }, [tasks, dateRange, i18n.language]);

  // Team productivity
  const teamProductivity = useMemo(() => {
    const userStats: Record<string, { assigned: number; completed: number; overdue: number }> = {};
    
    tasks.forEach(task => {
      if (task.assigned_to) {
        if (!userStats[task.assigned_to]) {
          userStats[task.assigned_to] = { assigned: 0, completed: 0, overdue: 0 };
        }
        userStats[task.assigned_to].assigned++;
        
        if (task.status === 'done') {
          userStats[task.assigned_to].completed++;
        }
        
        if (task.due_date && 
            task.status !== 'done' && 
            task.status !== 'cancelled' &&
            isAfter(new Date(), parseISO(task.due_date))) {
          userStats[task.assigned_to].overdue++;
        }
      }
    });

    return Object.entries(userStats)
      .map(([userId, stats]) => ({
        userId,
        name: profileMap[userId] || userId,
        ...stats,
        completionRate: stats.assigned > 0 ? Math.round((stats.completed / stats.assigned) * 100) : 0
      }))
      .sort((a, b) => b.completionRate - a.completionRate);
  }, [tasks, profileMap]);

  // Overdue tasks analysis
  const overdueAnalysis = useMemo(() => {
    return tasks
      .filter(task => 
        task.due_date && 
        task.status !== 'done' && 
        task.status !== 'cancelled' &&
        isAfter(new Date(), parseISO(task.due_date))
      )
      .map(task => ({
        ...task,
        daysOverdue: differenceInDays(new Date(), parseISO(task.due_date!)),
        assigneeName: task.assigned_to ? profileMap[task.assigned_to] : t('unassigned')
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [tasks, profileMap, t]);

  // Location distribution
  const locationData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(task => {
      const loc = task.location || 'unknown';
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return Object.entries(counts).map(([location, count]) => ({
      name: t(location),
      value: count
    }));
  }, [tasks, t]);

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(20);
    doc.text(t('task_analytics'), pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`${t('period')}: ${t('last_n_days', { days: dateRange })}`, 20, 35);
    doc.text(`${t('generated')}: ${format(new Date(), 'PPP', { locale: getLocale() })}`, 20, 42);
    
    doc.setFontSize(14);
    doc.text(t('summary'), 20, 55);
    
    doc.setFontSize(11);
    doc.text(`${t('total_tasks')}: ${stats.total}`, 25, 65);
    doc.text(`${t('completed')}: ${stats.completed}`, 25, 72);
    doc.text(`${t('in_progress')}: ${stats.inProgress}`, 25, 79);
    doc.text(`${t('overdue')}: ${stats.overdue}`, 25, 86);
    doc.text(`${t('completion_rate')}: ${stats.completionRate}%`, 25, 93);
    
    doc.setFontSize(14);
    doc.text(t('team_productivity'), 20, 110);
    
    let yPos = 120;
    teamProductivity.slice(0, 10).forEach((member, idx) => {
      doc.setFontSize(10);
      doc.text(
        `${idx + 1}. ${member.name}: ${member.completed}/${member.assigned} (${member.completionRate}%)`,
        25,
        yPos
      );
      yPos += 7;
    });
    
    doc.save(`task-analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Export to Excel
  const exportToExcel = () => {
    const summaryData = [
      [t('task_analytics')],
      [],
      [t('period'), t('last_n_days', { days: dateRange })],
      [t('generated'), format(new Date(), 'PPP', { locale: getLocale() })],
      [],
      [t('summary')],
      [t('total_tasks'), stats.total],
      [t('completed'), stats.completed],
      [t('in_progress'), stats.inProgress],
      [t('overdue'), stats.overdue],
      [t('completion_rate'), `${stats.completionRate}%`]
    ];

    const teamData = [
      [],
      [t('team_productivity')],
      [t('name'), t('assigned'), t('completed'), t('overdue'), t('completion_rate')],
      ...teamProductivity.map(m => [m.name, m.assigned, m.completed, m.overdue, `${m.completionRate}%`])
    ];

    const overdueData = [
      [],
      [t('overdue_tasks')],
      [t('title'), t('assigned_to'), t('due_date'), t('days_overdue'), t('priority')],
      ...overdueAnalysis.map(task => [
        task.title,
        task.assigneeName,
        task.due_date ? format(parseISO(task.due_date), 'PP', { locale: getLocale() }) : '',
        task.daysOverdue,
        task.priority
      ])
    ];

    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.aoa_to_sheet([...summaryData, ...teamData]);
    XLSX.utils.book_append_sheet(wb, ws1, t('summary'));
    
    const ws2 = XLSX.utils.aoa_to_sheet(overdueData);
    XLSX.utils.book_append_sheet(wb, ws2, t('overdue_tasks'));

    const ws3 = XLSX.utils.json_to_sheet(tasks.map(task => ({
      [t('title')]: task.title,
      [t('status')]: task.status,
      [t('priority')]: task.priority,
      [t('assigned_to')]: task.assigned_to ? profileMap[task.assigned_to] : '',
      [t('due_date')]: task.due_date || '',
      [t('created_at')]: task.created_at,
      [t('completed_at')]: task.completed_at || ''
    })));
    XLSX.utils.book_append_sheet(wb, ws3, t('all_tasks'));
    
    XLSX.writeFile(wb, `task-analytics-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('task_analytics')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('task_analytics_description')}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as '7' | '30' | '90')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t('last_7_days')}</SelectItem>
              <SelectItem value="30">{t('last_30_days')}</SelectItem>
              <SelectItem value="90">{t('last_90_days')}</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <FileText className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('total_tasks')}</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('completed')}</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('overdue')}</p>
                <p className="text-2xl font-bold text-destructive">{stats.overdue}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('completion_rate')}</p>
                <p className="text-2xl font-bold">{stats.completionRate}%</p>
              </div>
              {stats.completionRate >= 70 ? (
                <TrendingUp className="h-8 w-8 text-green-500/50" />
              ) : (
                <TrendingDown className="h-8 w-8 text-orange-500/50" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
          <TabsTrigger value="productivity">{t('team_productivity')}</TabsTrigger>
          <TabsTrigger value="overdue">{t('overdue_analysis')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Task Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('task_trend')}</CardTitle>
                <CardDescription>{t('created_vs_completed')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="created" 
                        name={t('created')}
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="completed" 
                        name={t('completed')}
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('status_distribution')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {statusData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('priority_distribution')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Location Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('location_distribution')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={locationData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Team Productivity Tab */}
        <TabsContent value="productivity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('team_productivity')}
              </CardTitle>
              <CardDescription>{t('team_productivity_description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {teamProductivity.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('no_data')}</p>
              ) : (
                <div className="space-y-4">
                  {teamProductivity.map((member, idx) => (
                    <div key={member.userId} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.name}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{t('assigned')}: {member.assigned}</span>
                          <span className="text-green-600">{t('completed')}: {member.completed}</span>
                          {member.overdue > 0 && (
                            <span className="text-destructive">{t('overdue')}: {member.overdue}</span>
                          )}
                        </div>
                      </div>
                      <div className="w-32">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{t('completion_rate')}</span>
                          <span className="text-sm font-medium">{member.completionRate}%</span>
                        </div>
                        <Progress value={member.completionRate} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overdue Analysis Tab */}
        <TabsContent value="overdue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-destructive" />
                {t('overdue_analysis')}
              </CardTitle>
              <CardDescription>
                {t('overdue_tasks_count', { count: overdueAnalysis.length })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overdueAnalysis.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  <p className="text-muted-foreground">{t('no_overdue_tasks')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overdueAnalysis.map(task => (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{task.assigneeName}</span>
                          <span>•</span>
                          <span>{t('due')}: {format(parseISO(task.due_date!), 'PP', { locale: getLocale() })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={task.priority === 'urgent' ? 'destructive' : 'secondary'}>
                          {t(task.priority)}
                        </Badge>
                        <Badge variant="destructive">
                          {task.daysOverdue} {t('days_late')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}