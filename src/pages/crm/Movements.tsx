import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { uz } from 'date-fns/locale';
import {
  Activity,
  Package,
  ArrowRightLeft,
  ShoppingBag,
  DollarSign,
  RefreshCw,
  ShieldCheck,
  ListChecks,
  Filter,
  Search,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileActivityCard, MobileCategoryChips } from '@/components/activities';
import { PullToRefresh } from '@/components/mobile';
import {
  UnifiedActivity,
  ActivityCategory,
  ActivityStats,
  transformTrackingEvents,
  transformMovements,
  transformSales,
  transformFinance,
  transformExcelImports,
  transformTasks,
  transformVerificationSessions,
  transformDefectClaims,
  transformStockAlerts,
  combineAndSortActivities,
  filterByCategory,
  filterByLocation,
  filterBySearch,
  // filterByTimeRange removed — now server-side
  calculateStats,
  getActivityBadgeClass,
  getActivityIcon,
  getCategoryLabel,
  getCategoryBadgeClass,
  formatLocationLabel,
  formatAmount,
} from '@/lib/unifiedActivities';

type TimeRange = 'all' | 'today' | 'week' | 'month';

function getDateCutoff(timeFilter: TimeRange): string | null {
  const now = new Date();
  switch (timeFilter) {
    case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case 'week': return subDays(now, 7).toISOString();
    case 'month': return subDays(now, 30).toISOString();
    case 'all': return null;
    default: return null;
  }
}

export default function Movements() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ActivityCategory | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeRange>('week');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(isMobile ? 50 : 100);

  // Reset displayCount when filters change
  const defaultDisplayCount = isMobile ? 50 : 100;
  useEffect(() => {
    setDisplayCount(defaultDisplayCount);
  }, [categoryFilter, locationFilter, timeFilter, defaultDisplayCount]);

  // Fetch all data sources in parallel with server-side date filtering
  
  const { data: allActivities, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['unified-activities', timeFilter],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const dateCutoff = getDateCutoff(timeFilter);

      // Build queries with server-side date filter
      const applyDateFilter = (query: any, dateCol = 'created_at') => {
        if (dateCutoff) return query.gte(dateCol, dateCutoff);
        return query;
      };

      const results = await Promise.allSettled([
        // 0: tracking_events — box join olib tashlandi (FK yo'q)
        fetchAllRows(
          applyDateFilter(
            supabase
              .from('tracking_events')
              .select('*')
              .eq('entity_type', 'box')
              .order('created_at', { ascending: false })
          )
        ),
        // 1: inventory_movements
        fetchAllRows(
          applyDateFilter(
            supabase
              .from('inventory_movements')
              .select(`
                *,
                product:products(name, uuid),
                from_location:warehouse_locations!inventory_movements_from_location_id_fkey(
                  zone, shelf,
                  warehouse:warehouses(name)
                ),
                to_location:warehouse_locations!inventory_movements_to_location_id_fkey(
                  zone, shelf,
                  warehouse:warehouses(name)
                )
              `)
              .order('created_at', { ascending: false })
          )
        ),
        // 2: direct_sales
        fetchAllRows(
          applyDateFilter(
            supabase
              .from('direct_sales')
              .select('*')
              .order('created_at', { ascending: false })
          )
        ),
        // 3: finance_transactions
        fetchAllRows(
          applyDateFilter(
            supabase
              .from('finance_transactions')
              .select('*')
              .neq('reference_type', 'marketplace_order')
              .order('created_at', { ascending: false })
          )
        ),
        // 4: excel_import_logs
        fetchAllRows(
          applyDateFilter(
            supabase
              .from('excel_import_logs')
              .select('*')
              .order('created_at', { ascending: false })
          )
        ),
        // 5: tasks
        fetchAllRows(
          applyDateFilter(
            supabase
              .from('tasks')
              .select('*')
              .order('created_at', { ascending: false })
          )
        ),
        // 6: verification_sessions — explicit FK hint
        fetchAllRows(
          applyDateFilter(
            supabase
              .from('verification_sessions')
              .select('*, box:boxes!verification_sessions_box_id_fkey(box_number)')
              .order('created_at', { ascending: false })
          )
        ),
        // 7: defect_claims
        fetchAllRows(
          applyDateFilter(
            supabase
              .from('defect_claims')
              .select('*, product:products(name), box:boxes(box_number)')
              .order('created_at', { ascending: false })
          )
        ),
        // 8: stock_alerts
        fetchAllRows(
          applyDateFilter(
            supabase
              .from('stock_alerts')
              .select('*, product:products(name)')
              .order('created_at', { ascending: false })
          )
        ),
        // 9: profiles
        supabase
          .from('profiles')
          .select('id, full_name')
      ]);

      // Extract data safely — failed sources return empty arrays
      const sourceNames = [
        'tracking_events', 'inventory_movements', 'direct_sales', 'finance_transactions',
        'excel_imports', 'tasks', 'verification_sessions', 'defect_claims', 'stock_alerts', 'profiles'
      ];
      const failedSources: string[] = [];
      const getData = (r: PromiseSettledResult<any>, label: string) => {
        if (r.status === 'fulfilled') return r.value;
        console.warn(`[Movements] ${label} failed:`, r.reason);
        failedSources.push(label);
        return [];
      };
      const getProfilesData = (r: PromiseSettledResult<any>) => {
        if (r.status === 'fulfilled') return r.value?.data || [];
        console.warn('[Movements] profiles failed:', r.reason);
        failedSources.push('profiles');
        return [];
      };

      const trackingData = getData(results[0], sourceNames[0]);
      const movementsData = getData(results[1], sourceNames[1]);
      const salesData = getData(results[2], sourceNames[2]);
      const financeData = getData(results[3], sourceNames[3]);
      const excelImportsData = getData(results[4], sourceNames[4]);
      const tasksData = getData(results[5], sourceNames[5]);
      const verificationData = getData(results[6], sourceNames[6]);
      const claimsData = getData(results[7], sourceNames[7]);
      const stockAlertsData = getData(results[8], sourceNames[8]);
      const profilesData = getProfilesData(results[9]);

      // Create profile map
      const profileMap = new Map(
        profilesData.map((p: any) => [p.id, p.full_name])
      );

      // Transform all sources
      const trackingActivities = transformTrackingEvents(trackingData as any);
      const movementActivities = transformMovements(movementsData as any);
      const saleActivities = transformSales(salesData as any);
      const financeActivities = transformFinance(financeData as any);
      const excelImportActivities = transformExcelImports(excelImportsData as any);
      const taskActivities = transformTasks(tasksData as any);
      const verificationActivities = transformVerificationSessions(verificationData as any);
      const claimActivities = transformDefectClaims(claimsData as any);
      const stockAlertActivities = transformStockAlerts(stockAlertsData as any);

      // Add creator names
      const addCreatorNames = (activities: UnifiedActivity[]) =>
        activities.map(a => ({
          ...a,
          created_by_name: a.created_by ? (profileMap.get(a.created_by) as string) || null : null,
        }));

      const activities = combineAndSortActivities(
        addCreatorNames(trackingActivities),
        addCreatorNames(movementActivities),
        addCreatorNames(saleActivities),
        addCreatorNames(financeActivities),
        addCreatorNames(excelImportActivities),
        addCreatorNames(taskActivities),
        addCreatorNames(verificationActivities),
        addCreatorNames(claimActivities),
        addCreatorNames(stockAlertActivities),
      );

      return { activities, failedSources };
    },
  });

  // Destructure query result
  const activities = allActivities?.activities;
  const failedSources = allActivities?.failedSources || [];

  // Calculate stats
  const stats: ActivityStats = useMemo(() => {
    if (!activities) return { total: 0, box: 0, product: 0, sale: 0, finance: 0, system: 0, verification: 0, task: 0 };
    return calculateStats(activities);
  }, [activities]);

  // Apply filters (time filter is now server-side, no client filterByTimeRange needed)
  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    let result = activities;
    result = filterByCategory(result, categoryFilter);
    result = filterByLocation(result, locationFilter);
    result = filterBySearch(result, searchTerm);
    return result;
  }, [activities, categoryFilter, locationFilter, searchTerm]);

  const renderIcon = (activity: UnifiedActivity) => {
    const IconComponent = getActivityIcon(activity);
    return <IconComponent className="h-4 w-4" />;
  };

  const hasActiveFilters = categoryFilter !== 'all' || locationFilter !== 'all' || timeFilter !== 'week' || searchTerm.trim() !== '';

  const handleRefresh = async () => {
    await refetch();
  };

  // Stats card config
  const statsCards: { id: ActivityCategory | 'all'; label: string; icon: any; color: string; ringColor: string; count: number }[] = [
    { id: 'all', label: t('total_activities'), icon: Activity, color: 'bg-primary/10 text-primary', ringColor: 'ring-primary', count: stats.total },
    { id: 'box', label: t('category_box'), icon: Package, color: 'bg-blue-500/10 text-blue-600', ringColor: 'ring-blue-500', count: stats.box },
    { id: 'product', label: t('category_product'), icon: ArrowRightLeft, color: 'bg-purple-500/10 text-purple-600', ringColor: 'ring-purple-500', count: stats.product },
    { id: 'sale', label: t('category_sale'), icon: ShoppingBag, color: 'bg-green-500/10 text-green-600', ringColor: 'ring-green-500', count: stats.sale },
    { id: 'finance', label: t('category_finance'), icon: DollarSign, color: 'bg-amber-500/10 text-amber-600', ringColor: 'ring-amber-500', count: stats.finance },
    { id: 'system', label: 'Tizim', icon: RefreshCw, color: 'bg-slate-500/10 text-slate-600', ringColor: 'ring-slate-500', count: stats.system },
    { id: 'verification', label: 'Tekshirish', icon: ShieldCheck, color: 'bg-rose-500/10 text-rose-600', ringColor: 'ring-rose-500', count: stats.verification },
    { id: 'task', label: 'Vazifa', icon: ListChecks, color: 'bg-pink-500/10 text-pink-600', ringColor: 'ring-pink-500', count: stats.task },
  ];

  // Mobile view
  if (isMobile) {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-4 pb-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">{t('system_activities')}</h1>
              <p className="text-xs text-muted-foreground">{t('system_activities_description')}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {failedSources.length > 0 && (
            <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                {failedSources.length} ta manba yuklanmadi
              </AlertDescription>
            </Alert>
          )}

          <MobileCategoryChips
            stats={stats}
            activeCategory={categoryFilter}
            onCategoryChange={setCategoryFilter}
          />

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search_activities')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-between text-xs h-8"
                >
                  <span className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5" />
                    {t('filters')}
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                        {(categoryFilter !== 'all' ? 1 : 0) + (locationFilter !== 'all' ? 1 : 0) + (timeFilter !== 'week' ? 1 : 0)}
                      </Badge>
                    )}
                  </span>
                  {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t('location')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allLocations')}</SelectItem>
                    <SelectItem value="china">{t('china')}</SelectItem>
                    <SelectItem value="transit">{t('transit')}</SelectItem>
                    <SelectItem value="uzbekistan">{t('uzbekistan')}</SelectItem>
                    <SelectItem value="Toshkent">Toshkent</SelectItem>
                    <SelectItem value="Moliya">Moliya</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeRange)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t('time')} />
                  </SelectTrigger>
                  <SelectContent>
                <SelectItem value="all">Barcha vaqt</SelectItem>
                    <SelectItem value="today">{t('today')}</SelectItem>
                    <SelectItem value="week">{t('thisWeek')}</SelectItem>
                    <SelectItem value="month">{t('thisMonth')}</SelectItem>
                  </SelectContent>
                </Select>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <p className="text-xs text-muted-foreground">
            {filteredActivities.length.toLocaleString()} {t('activities_found')}
          </p>

          {isLoading ? (
            <LoadingSkeleton count={5} compact />
          ) : filteredActivities.length > 0 ? (
            <div className="space-y-2">
              {filteredActivities.slice(0, displayCount).map((activity) => (
                <MobileActivityCard key={activity.id} activity={activity} />
              ))}
              {filteredActivities.length > displayCount && (
                <Button 
                  variant="outline" 
                  className="w-full text-xs h-9"
                  onClick={() => setDisplayCount(prev => prev + 50)}
                >
                  Ko'proq yuklash ({displayCount}/{filteredActivities.length})
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">{t('no_activities')}</p>
            </div>
          )}
        </div>
      </PullToRefresh>
    );
  }

  // Desktop view
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('system_activities')}</h1>
          <p className="text-muted-foreground">{t('system_activities_description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {failedSources.length > 0 && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            {failedSources.length} ta manba yuklanmadi: {failedSources.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards - scrollable grid */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card 
              key={card.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${categoryFilter === card.id ? `ring-2 ${card.ringColor}` : ''}`}
              onClick={() => setCategoryFilter(card.id as ActivityCategory | 'all')}
            >
              <CardContent className="pt-4 pb-3 px-3">
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-bold">{card.count.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('filters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('search_activities')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as ActivityCategory | 'all')}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder={t('category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                <SelectItem value="box">{t('category_box')}</SelectItem>
                <SelectItem value="product">{t('category_product')}</SelectItem>
                <SelectItem value="sale">{t('category_sale')}</SelectItem>
                <SelectItem value="finance">{t('category_finance')}</SelectItem>
                <SelectItem value="system">Tizim</SelectItem>
                <SelectItem value="verification">Tekshirish</SelectItem>
                <SelectItem value="task">Vazifa</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder={t('location')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allLocations')}</SelectItem>
                <SelectItem value="china">{t('china')}</SelectItem>
                <SelectItem value="transit">{t('transit')}</SelectItem>
                <SelectItem value="uzbekistan">{t('uzbekistan')}</SelectItem>
                <SelectItem value="Toshkent">Toshkent</SelectItem>
                <SelectItem value="Moliya">Moliya</SelectItem>
              </SelectContent>
            </Select>

            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeRange)}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder={t('time')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha vaqt</SelectItem>
                <SelectItem value="today">{t('today')}</SelectItem>
                <SelectItem value="week">{t('thisWeek')}</SelectItem>
                <SelectItem value="month">{t('thisMonth')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('activities_list')}</CardTitle>
          <CardDescription>
            {filteredActivities.length.toLocaleString()} {t('activities_found')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredActivities.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>{t('action')}</TableHead>
                    <TableHead>{t('category')}</TableHead>
                    <TableHead>{t('details')}</TableHead>
                    <TableHead>{t('amount_qty')}</TableHead>
                    <TableHead>{t('location')}</TableHead>
                    <TableHead>{t('who')}</TableHead>
                    <TableHead>{t('time')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities.slice(0, displayCount).map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <div className={`p-2 rounded-lg ${getActivityBadgeClass(activity)}`}>
                          {renderIcon(activity)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getActivityBadgeClass(activity)}>
                          {activity.title}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getCategoryBadgeClass(activity.category)}>
                          {getCategoryLabel(activity.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{activity.entity_name || '-'}</p>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {activity.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {activity.amount !== null ? (
                          <span className={`font-semibold ${activity.action_type === 'expense' ? 'text-red-600' : activity.action_type === 'income' || activity.category === 'sale' ? 'text-green-600' : ''}`}>
                            {formatAmount(activity.amount, activity.currency)}
                          </span>
                        ) : activity.quantity !== null ? (
                          <span className="font-semibold">{activity.quantity} {t('pcs')}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatLocationLabel(activity.location)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {activity.created_by_name || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span title={format(new Date(activity.created_at), 'dd.MM.yyyy HH:mm')}>
                            {formatDistanceToNow(new Date(activity.created_at), { 
                              addSuffix: true, 
                              locale: uz 
                            })}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredActivities.length > displayCount && (
                <div className="flex justify-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setDisplayCount(prev => prev + 100)}
                  >
                    Ko'proq yuklash ({displayCount}/{filteredActivities.length})
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">{t('no_activities')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
