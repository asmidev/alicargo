import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { 
  FileText, 
  Download, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Package,
  TrendingUp,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  ShieldAlert
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

interface DailySummary {
  date: string;
  totalSessions: number;
  totalItems: number;
  okCount: number;
  defectiveCount: number;
  missingCount: number;
  defectRate: number;
  boxes: string[];
}

export default function VerificationReports() {
  const { t } = useTranslation();
  const { isChiefManager, isChinaManager, isChinaStaff, isLoading: roleLoading } = useUserRole();
  
  // Role-based access control - only China staff and Chief Manager
  const canAccess = isChiefManager || isChinaManager || isChinaStaff;
  
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // Access denied check
  if (!roleLoading && !canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('vrpt_no_access')}</h2>
        <p className="text-muted-foreground">{t('vrpt_no_access_msg')}</p>
      </div>
    );
  }

  // Fetch verification sessions with details
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['verification-reports', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);

      // Note: `verification_sessions.verified_by` has no FK to `profiles`,
      // so we fetch profiles in a second query to avoid PostgREST embed errors.
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('verification_sessions')
        .select(
          `id, box_id, status, ok_count, defective_count, missing_count, total_items, verified_count, completed_at, created_at, verified_by,
           boxes!verification_sessions_box_id_fkey(box_number, location)`
        )
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      const verifierIds = Array.from(
        new Set((sessionsData ?? []).map((s) => s.verified_by).filter(Boolean))
      ) as string[];

      let verifierMap: Record<string, string> = {};
      if (verifierIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', verifierIds);

        if (profilesError) throw profilesError;

        verifierMap = (profilesData ?? []).reduce(
          (acc: Record<string, string>, p) => {
            if (p.id) acc[p.id] = p.full_name ?? '';
            return acc;
          },
          {}
        );
      }

      return (sessionsData ?? []).map((s) => ({
        ...s,
        verifier_full_name: s.verified_by ? verifierMap[s.verified_by] ?? null : null,
      }));
    },
    retry: 1,
    staleTime: 60000, // 1 minute cache
    gcTime: 300000, // 5 minute garbage collection
  });

  // Fetch defect categories breakdown
  const { data: defectBreakdown } = useQuery({
    queryKey: ['defect-breakdown', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);

      const { data, error } = await supabase
        .from('verification_items')
        .select('defect_type, status')
        .eq('status', 'defective')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;

      // Group by defect type
      const breakdown: Record<string, number> = {};
      data?.forEach(item => {
        const type = item.defect_type || 'Noma\'lum';
        breakdown[type] = (breakdown[type] || 0) + 1;
      });

      return breakdown;
    },
    staleTime: 60000, // 1 minute cache
    gcTime: 300000, // 5 minute garbage collection
  });

  // Calculate daily summaries
  const dailySummaries: DailySummary[] = sessions ? 
    Object.entries(
      sessions.reduce((acc: Record<string, any>, session) => {
        const date = format(new Date(session.created_at || ''), 'yyyy-MM-dd');
        if (!acc[date]) {
          acc[date] = {
            date,
            totalSessions: 0,
            totalItems: 0,
            okCount: 0,
            defectiveCount: 0,
            missingCount: 0,
            boxes: [],
          };
        }
        acc[date].totalSessions++;
        acc[date].totalItems += session.total_items || 0;
        acc[date].okCount += session.ok_count || 0;
        acc[date].defectiveCount += session.defective_count || 0;
        acc[date].missingCount += session.missing_count || 0;
        if ((session as any).boxes?.box_number) {
          acc[date].boxes.push((session as any).boxes.box_number);
        }
        return acc;
      }, {})
    ).map(([_, summary]) => ({
      ...summary,
      defectRate: summary.totalItems > 0 
        ? ((summary.defectiveCount + summary.missingCount) / summary.totalItems * 100).toFixed(1)
        : 0,
    })).sort((a, b) => b.date.localeCompare(a.date)) : [];

  // Calculate totals
  const totals = dailySummaries.reduce(
    (acc, day) => ({
      sessions: acc.sessions + day.totalSessions,
      items: acc.items + day.totalItems,
      ok: acc.ok + day.okCount,
      defective: acc.defective + day.defectiveCount,
      missing: acc.missing + day.missingCount,
    }),
    { sessions: 0, items: 0, ok: 0, defective: 0, missing: 0 }
  );

  const overallDefectRate = totals.items > 0 
    ? ((totals.defective + totals.missing) / totals.items * 100).toFixed(1) 
    : '0';

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Sana', 'Sessiyalar', 'Jami mahsulotlar', 'OK', 'Nuqsonli', 'Yo\'q', 'Nuqson %', 'Qutilar'];
    const rows = dailySummaries.map(day => [
      day.date,
      day.totalSessions,
      day.totalItems,
      day.okCount,
      day.defectiveCount,
      day.missingCount,
      day.defectRate,
      day.boxes.join('; '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `verification-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {t('vrpt_title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('vrpt_subtitle')}
          </p>
        </div>
        <Button 
          onClick={exportToCSV}
          className="gap-2 bg-primary hover:bg-primary/90 min-h-[44px]"
        >
          <Download className="h-4 w-4" />
          {t('vrpt_export_csv')}
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card className="p-4 bg-card border-border">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('vrpt_period')}</span>
          </div>
          
          {/* Start Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[160px] justify-start text-left font-normal min-h-[44px]",
                  !startDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "dd.MM.yyyy") : <span>{t('vrpt_start')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">—</span>

          {/* End Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[160px] justify-start text-left font-normal min-h-[44px]",
                  !endDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "dd.MM.yyyy") : <span>{t('vrpt_end')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-card border-border cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('vrpt_sessions')}</p>
              <p className="text-xl font-bold text-foreground">{totals.sessions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border cursor-pointer hover:shadow-lg hover:border-blue-500/50 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
            <div>
               <p className="text-xs text-muted-foreground">{t('vrpt_total_products')}</p>
              <p className="text-xl font-bold text-foreground">{totals.items}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border cursor-pointer hover:shadow-lg hover:border-green-500/50 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">OK</p>
              <p className="text-xl font-bold text-green-500">{totals.ok}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border cursor-pointer hover:shadow-lg hover:border-yellow-500/50 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
               <p className="text-xs text-muted-foreground">{t('vrpt_defective')}</p>
              <p className="text-xl font-bold text-yellow-500">{totals.defective}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border cursor-pointer hover:shadow-lg hover:border-red-500/50 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('vrpt_defect_percent')}</p>
              <p className="text-xl font-bold text-red-500">{overallDefectRate}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Defect Breakdown */}
      {defectBreakdown && Object.keys(defectBreakdown).length > 0 && (
        <Card className="p-4 sm:p-6 bg-card border-border">
          <h3 className="font-semibold text-foreground mb-4">{t('vrpt_defect_types')}</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(defectBreakdown).map(([type, count]) => (
              <Badge 
                key={type} 
                variant="outline" 
                className="px-3 py-1.5 text-sm border-yellow-500/50 text-yellow-500"
              >
                {type}: {count}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Daily Breakdown */}
      <Card className="p-4 sm:p-6 bg-card border-border">
        <h3 className="font-semibold text-foreground mb-4">{t('vrpt_daily_report')}</h3>
        
        {isLoading ? (
          <LoadingSkeleton count={5} compact />
        ) : dailySummaries.length > 0 ? (
          <div className="space-y-3">
            {dailySummaries.map((day) => (
              <div key={day.date} className="border border-border rounded-lg overflow-hidden">
                <button
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedDate(expandedDate === day.date ? null : day.date)}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="font-medium text-foreground">
                        {format(new Date(day.date), 'dd MMM yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {day.totalSessions} {t('vrpt_sessions').toLowerCase()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-3">
                      <Badge variant="outline" className="border-green-500/50 text-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {day.okCount}
                      </Badge>
                      <Badge variant="outline" className="border-yellow-500/50 text-yellow-500">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {day.defectiveCount}
                      </Badge>
                      <Badge variant="outline" className="border-red-500/50 text-red-500">
                        <XCircle className="h-3 w-3 mr-1" />
                        {day.missingCount}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        Number(day.defectRate) > 5 ? 'text-red-500' : 
                        Number(day.defectRate) > 2 ? 'text-yellow-500' : 'text-green-500'
                      }`}>
                        {day.defectRate}%
                      </p>
                    </div>
                    {expandedDate === day.date ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
                
                {expandedDate === day.date && (
                  <div className="p-4 border-t border-border bg-muted/30">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('vrpt_total_items')}</p>
                        <p className="text-lg font-semibold text-foreground">{day.totalItems}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">OK</p>
                        <p className="text-lg font-semibold text-green-500">{day.okCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('vrpt_defective')}</p>
                        <p className="text-lg font-semibold text-yellow-500">{day.defectiveCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('vrpt_missing')}</p>
                        <p className="text-lg font-semibold text-red-500">{day.missingCount}</p>
                      </div>
                    </div>
                    {day.boxes.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">{t('vrpt_checked_boxes')}</p>
                        <div className="flex flex-wrap gap-2">
                          {day.boxes.map((boxNum, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              <Package className="h-3 w-3 mr-1" />
                              {boxNum}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">{t('vrpt_no_sessions')}</p>
          </div>
        )}
      </Card>

      {/* Recent Sessions Detail */}
      <Card className="p-4 sm:p-6 bg-card border-border">
        <h3 className="font-semibold text-foreground mb-4">{t('vrpt_recent_sessions')}</h3>
        
        {isLoading ? (
          <LoadingSkeleton count={3} compact />
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.slice(0, 10).map((session) => (
              <div 
                key={session.id} 
                className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {(session as any).boxes?.box_number || t('vrpt_unknown_box')}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(session.created_at || ''), 'dd MMM yyyy HH:mm')}
                        {(session as any).verifier_full_name && (
                          <>
                            <span>•</span>
                            <User className="h-3 w-3" />
                            {(session as any).verifier_full_name}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={session.status === 'completed' ? 'default' : 'secondary'}
                      className={session.status === 'completed' ? 'bg-green-500' : ''}
                    >
                      {session.status === 'completed' ? t('vrpt_completed') : t('vrpt_in_progress')}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="text-green-500">{session.ok_count || 0}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-yellow-500">{session.defective_count || 0}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-500">{session.missing_count || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t('vrpt_no_sessions_yet')}</p>
          </div>
        )}
      </Card>
    </div>
  );
}