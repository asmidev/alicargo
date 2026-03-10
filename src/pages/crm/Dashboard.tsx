import { useEffect, useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Box, Ship, DollarSign, Plus, ArrowRight, TrendingUp, TrendingDown, Clock, Activity, ChevronDown, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Link } from 'react-router-dom';
import { PullToRefresh, CollapsibleSection } from '@/components/mobile';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ui/error-boundary';

// Dashboard-specific error fallback
function DashboardErrorFallback() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-4">
      <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{t('dash_error_title')}</h2>
      <p className="text-muted-foreground text-center mb-4">
        {t('dash_error_desc')}
      </p>
      <Button onClick={() => window.location.reload()}>
        <RefreshCw className="h-4 w-4 mr-2" />
        {t('dash_reload')}
      </Button>
    </div>
  );
}

function DashboardContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAdmin, isFinance, isInvestor, isChinaStaff, isUzStaff, isLoading: rolesLoading } = useUserRole();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // All queries run in parallel for faster loading
      const [products, boxes, shipments, financeBalance, recentProducts, recentBoxes, boxesByStatus, shipmentsInTransit] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('boxes').select('*', { count: 'exact', head: true }),
        supabase.from('shipments').select('*', { count: 'exact', head: true }),
        supabase.rpc('get_finance_balance'),
        supabase.from('products').select('id, name, created_at, status').order('created_at', { ascending: false }).limit(5),
        supabase.from('boxes').select('id, box_number, created_at, status').order('created_at', { ascending: false }).limit(5),
        supabase.from('boxes').select('status, location'),
        supabase.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'in_transit'),
      ]);

      const balanceData = (financeBalance.data as any) || { total_income: 0, total_expense: 0, balance: 0 };
      const totalIncome = Number(balanceData.total_income) || 0;
      const totalExpense = Number(balanceData.total_expense) || 0;

      const packingBoxes = boxesByStatus.data?.filter(b => b.status === 'packing').length || 0;
      const sealedBoxes = boxesByStatus.data?.filter(b => b.status === 'sealed').length || 0;
      const inTransitBoxes = boxesByStatus.data?.filter(b => b.status === 'in_transit' || b.location === 'transit').length || 0;

      return {
        productsCount: products.count || 0,
        boxesCount: boxes.count || 0,
        shipmentsCount: shipments.count || 0,
        balance: Number(balanceData.balance) || 0,
        totalIncome,
        totalExpense,
        recentProducts: recentProducts.data || [],
        recentBoxes: recentBoxes.data || [],
        packingBoxes,
        sealedBoxes,
        inTransitBoxes,
        shipmentsInTransit: shipmentsInTransit.count || 0,
      };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Real-time subscriptions for dashboard stats
  useEffect(() => {
    const channels = [
      supabase.channel('dashboard-products').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      }),
      supabase.channel('dashboard-boxes').on('postgres_changes', { event: '*', schema: 'public', table: 'boxes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      }),
      supabase.channel('dashboard-shipments').on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      }),
      supabase.channel('dashboard-finance').on('postgres_changes', { event: '*', schema: 'public', table: 'finance_transactions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      }),
    ];

    channels.forEach(channel => channel.subscribe());

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [queryClient]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'packing': return 'bg-blue-500/10 text-blue-500';
      case 'sealed': return 'bg-green-500/10 text-green-500';
      case 'in_transit': return 'bg-purple-500/10 text-purple-500';
      case 'arrived': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return t('dash_status_pending');
      case 'packing': return t('dash_status_packing');
      case 'sealed': return t('dash_status_sealed');
      case 'in_transit': return t('dash_status_in_transit');
      case 'arrived': return t('dash_status_arrived');
      default: return status;
    }
  };

  const isMobile = useIsMobile();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  }, [queryClient]);

  const content = (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {t('dashboard')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('todayOverview')}
          </p>
        </div>
      </div>

      {(stats === undefined || rolesLoading) ? (
        <DashboardLoadingSkeleton />
      ) : (
        <>
          {/* Main Stats - hide from investors */}
          {!isInvestor && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <Link to="/crm/products">
                <Card className="p-3 sm:p-6 bg-card border-border hover:shadow-lg transition-shadow cursor-pointer hover:border-primary/50">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">{t('products')}</p>
                      <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.productsCount || 0}</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/crm/boxes">
                <Card className="p-3 sm:p-6 bg-card border-border hover:shadow-lg transition-shadow cursor-pointer hover:border-primary/50">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <Box className="h-5 w-5 sm:h-6 sm:w-6 text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">{t('boxes')}</p>
                      <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.boxesCount || 0}</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/crm/shipments">
                <Card className="p-3 sm:p-6 bg-card border-border hover:shadow-lg transition-shadow cursor-pointer hover:border-primary/50">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Ship className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">{t('shipments')}</p>
                      <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.shipmentsCount || 0}</p>
                    </div>
                  </div>
                </Card>
              </Link>

              {(isFinance || isAdmin) && (
                <Link to="/crm/finance">
                  <Card className="p-3 sm:p-6 bg-card border-border hover:shadow-lg transition-shadow cursor-pointer hover:border-primary/50">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">{t('balance')}</p>
                        <p className={`text-xl sm:text-2xl font-bold truncate ${(stats?.balance || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`} title={`$${stats?.balance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}>
                          ${stats?.balance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              )}
            </div>
          )}

          {/* Investor-only finance card */}
          {isInvestor && (
            <Card className="p-6 bg-card border-border hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('dash_financial_info')}</p>
                  <p className="text-foreground">{t('dash_financial_hint')}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Quick Actions - Horizontal scrollable on mobile */}
          <Card className="p-4 sm:p-6 bg-card border-border">
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {t('dash_quick_actions')}
            </h2>
            <div className={cn(
              "gap-3",
              isMobile 
                ? "flex overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory" 
                : "grid grid-cols-2 sm:grid-cols-4"
            )}>
              {(isAdmin || isChinaStaff) && (
                <Link to="/crm/products" className={isMobile ? "snap-start flex-shrink-0" : ""}>
                  <Button variant="outline" className={cn(
                    "gap-2 h-auto py-4 flex-col transition-all duration-200 hover:scale-[1.02] hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                    isMobile ? "w-[100px] min-h-[80px]" : "w-full min-h-[80px]"
                  )}>
                    <Plus className="h-5 w-5" />
                    <span className="text-xs text-center">{t('dash_add_product')}</span>
                  </Button>
                </Link>
              )}
              {(isAdmin || isChinaStaff) && (
                <Link to="/crm/boxes" className={isMobile ? "snap-start flex-shrink-0" : ""}>
                  <Button variant="outline" className={cn(
                    "gap-2 h-auto py-4 flex-col transition-all duration-200 hover:scale-[1.02] hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                    isMobile ? "w-[100px] min-h-[80px]" : "w-full min-h-[80px]"
                  )}>
                    <Box className="h-5 w-5" />
                    <span className="text-xs text-center">{t('dash_create_box')}</span>
                  </Button>
                </Link>
              )}
              {(isAdmin || isChinaStaff || isUzStaff) && (
                <Link to="/crm/shipments" className={isMobile ? "snap-start flex-shrink-0" : ""}>
                  <Button variant="outline" className={cn(
                    "gap-2 h-auto py-4 flex-col transition-all duration-200 hover:scale-[1.02] hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                    isMobile ? "w-[100px] min-h-[80px]" : "w-full min-h-[80px]"
                  )}>
                    <Ship className="h-5 w-5" />
                    <span className="text-xs text-center">{t('shipments')}</span>
                  </Button>
                </Link>
              )}
              {(isAdmin || isFinance) && (
                <Link to="/crm/finance" className={isMobile ? "snap-start flex-shrink-0" : ""}>
                  <Button variant="outline" className={cn(
                    "gap-2 h-auto py-4 flex-col transition-all duration-200 hover:scale-[1.02] hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                    isMobile ? "w-[100px] min-h-[80px]" : "w-full min-h-[80px]"
                  )}>
                    <DollarSign className="h-5 w-5" />
                    <span className="text-xs text-center">{t('finance')}</span>
                  </Button>
                </Link>
              )}
            </div>
          </Card>

          {/* Status Overview - hide from investors */}
          {!isInvestor && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box Status Overview */}
              <Card className="p-6 bg-card border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Box className="h-5 w-5 text-primary" />
                    {t('dash_box_status')}
                  </h2>
                  <Link to="/crm/boxes">
                    <Button variant="ghost" size="sm" className="gap-1">
                      {t('dash_view_all')} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">{t('dash_packing')}</span>
                    <span className="text-lg font-semibold text-blue-500">{stats?.packingBoxes || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">{t('dash_sealed')}</span>
                    <span className="text-lg font-semibold text-green-500">{stats?.sealedBoxes || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">{t('dash_in_transit')}</span>
                    <span className="text-lg font-semibold text-purple-500">{stats?.inTransitBoxes || 0}</span>
                  </div>
                </div>
              </Card>

              {/* Finance Overview - Only for authorized roles */}
              {(isFinance || isAdmin) && (
                <Card className="p-6 bg-card border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      {t('dash_finance_metrics')}
                    </h2>
                    <Link to="/crm/finance">
                      <Button variant="ghost" size="sm" className="gap-1">
                      {t('dash_view_all')} <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg gap-2">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">{t('dash_total_income')}</span>
                      </div>
                      <span className="text-base sm:text-lg font-semibold text-green-500 truncate" title={`$${stats?.totalIncome?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}>
                        ${stats?.totalIncome?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg gap-2">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-muted-foreground">{t('dash_total_expense')}</span>
                      </div>
                      <span className="text-base sm:text-lg font-semibold text-red-500 truncate" title={`$${stats?.totalExpense?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}>
                        ${stats?.totalExpense?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      </span>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Recent Activity - hide from investors, collapsible on mobile */}
          {!isInvestor && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Products */}
            {isMobile ? (
              <CollapsibleSection
                title={t('dash_recent_products')}
                icon={<Clock className="h-5 w-5 text-primary" />}
                defaultOpen={false}
              >
                <div className="flex justify-end mb-2">
                  <Link to="/crm/products">
                    <Button variant="ghost" size="sm" className="gap-1">
                      {t('dash_view_all')} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                {stats?.recentProducts && stats.recentProducts.length > 0 ? (
                  <div className="space-y-2">
                    {stats.recentProducts.map((product: any) => (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(product.created_at).toLocaleDateString('uz-UZ')}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(product.status)}`}>
                          {getStatusText(product.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('dash_no_products')}
                  </p>
                )}
              </CollapsibleSection>
            ) : (
              <Card className="p-6 bg-card border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    {t('dash_recent_products')}
                  </h2>
                  <Link to="/crm/products">
                    <Button variant="ghost" size="sm" className="gap-1">
                      {t('dash_view_all')} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                {stats?.recentProducts && stats.recentProducts.length > 0 ? (
                  <div className="space-y-2">
                    {stats.recentProducts.map((product: any) => (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(product.created_at).toLocaleDateString('uz-UZ')}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(product.status)}`}>
                          {getStatusText(product.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('dash_no_products')}
                  </p>
                )}
              </Card>
            )}

            {/* Recent Boxes */}
            {isMobile ? (
              <CollapsibleSection
                title={t('dash_recent_boxes')}
                icon={<Clock className="h-5 w-5 text-primary" />}
                defaultOpen={false}
              >
                <div className="flex justify-end mb-2">
                  <Link to="/crm/boxes">
                    <Button variant="ghost" size="sm" className="gap-1">
                      {t('dash_view_all')} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                {stats?.recentBoxes && stats.recentBoxes.length > 0 ? (
                  <div className="space-y-2">
                    {stats.recentBoxes.map((box: any) => (
                      <div key={box.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-foreground">{box.box_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(box.created_at).toLocaleDateString('uz-UZ')}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(box.status)}`}>
                          {getStatusText(box.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('dash_no_boxes')}
                  </p>
                )}
              </CollapsibleSection>
            ) : (
              <Card className="p-6 bg-card border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    {t('dash_recent_boxes')}
                  </h2>
                  <Link to="/crm/boxes">
                    <Button variant="ghost" size="sm" className="gap-1">
                      {t('dash_view_all')} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                {stats?.recentBoxes && stats.recentBoxes.length > 0 ? (
                  <div className="space-y-2">
                    {stats.recentBoxes.map((box: any) => (
                      <div key={box.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-foreground">{box.box_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(box.created_at).toLocaleDateString('uz-UZ')}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(box.status)}`}>
                          {getStatusText(box.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('dash_no_boxes')}
                  </p>
                )}
              </Card>
            )}
          </div>
          )}
        </>
      )}
    </div>
  );

  // Wrap with PullToRefresh on mobile
  if (isMobile) {
    return (
      <PullToRefresh onRefresh={handleRefresh} className="min-h-full">
        {content}
      </PullToRefresh>
    );
  }

  return content;
}

// Wrap Dashboard with ErrorBoundary for graceful error handling
export default function Dashboard() {
  return (
    <ErrorBoundary fallback={<DashboardErrorFallback />}>
      <DashboardContent />
    </ErrorBoundary>
  );
}
