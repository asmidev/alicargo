import { useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Box, CheckCircle2, AlertTriangle, Clock, ArrowRight, Package, ClipboardCheck, ShieldCheck, ShieldAlert, Truck, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { useUserRole } from '@/hooks/useUserRole';
import { PullToRefresh, CollapsibleSection } from '@/components/mobile';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function ChinaDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const {
    isChiefManager,
    isChinaManager,
    isChinaStaff,
    isLoading: roleLoading
  } = useUserRole();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['china-dashboard-stats'] });
  }, [queryClient]);

  // Role-based access control - only China staff and Chief Manager
  const canAccess = isChiefManager || isChinaManager || isChinaStaff;

  // Access denied check
  if (!roleLoading && !canAccess) {
    return <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('cn_access_denied')}</h2>
        <p className="text-muted-foreground">{t('cn_access_denied_msg')}</p>
      </div>;
  }
  const {
    data: stats,
    isLoading
  } = useQuery({
    queryKey: ['china-dashboard-stats'],
    queryFn: async () => {
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
    const [allBoxesResult, todayBoxesResult, verificationsResult, defectCategoriesResult, recentVerificationsResult, sealedTodayResult, inTransitAllResult, inTransitBoxesResult, pendingItemsResult, arrivedPendingResult] = await Promise.all([
      // All boxes in china location
      supabase.from('boxes').select('id, box_number, status, verification_complete, verification_required, defect_count, missing_count, created_at, product_items(id)').eq('location', 'china').order('created_at', {
        ascending: false
      }),
      // Today's boxes
      supabase.from('boxes').select('id').eq('location', 'china').gte('created_at', today.toISOString()).lt('created_at', tomorrow.toISOString()),
      // Verification sessions stats
      supabase.from('verification_sessions').select('id, status, defective_count, missing_count, ok_count, completed_at, total_items, verified_count, boxes!inner(location)').gte('created_at', today.toISOString()).eq('boxes.location', 'china'),
      // Defect categories
      supabase.from('defect_categories').select('*').eq('is_active', true).order('sort_order'),
      // Recent verification activity
      supabase.from('verification_sessions').select('id, box_id, status, ok_count, defective_count, missing_count, completed_at, boxes!inner(box_number, location)').eq('boxes.location', 'china').order('created_at', {
        ascending: false
      }).limit(5),
      // Sealed today
      supabase.from('boxes').select('id').eq('status', 'sealed').gte('sealed_at', today.toISOString()).lt('sealed_at', tomorrow.toISOString()),
      // All in transit boxes (yo'ldagi or transit location)
      supabase.from('boxes').select('id').or('status.eq.in_transit,location.eq.transit'),
      // In transit boxes list (for display)
      supabase.from('boxes').select('id, box_number, estimated_arrival, updated_at, product_items(id)').or('status.eq.in_transit,location.eq.transit').order('updated_at', {
        ascending: false
      }).limit(10),
      // Pending items - product items not assigned to any box (waiting to be packed)
      supabase.from('product_items').select('id').is('box_id', null).in('status', ['pending', 'ordered', 'in_china']),
      // Verified boxes at China warehouse
      supabase.from('boxes').select('id').eq('location', 'china').eq('verification_complete', true)
    ]);
      const allBoxes = allBoxesResult.data || [];
      const todayBoxes = todayBoxesResult.data || [];
      const verifications = verificationsResult.data || [];
      const sealedToday = sealedTodayResult.data || [];
      const inTransitAll = inTransitAllResult.data || [];
      const inTransitBoxes = inTransitBoxesResult.data || [];
      const pendingItems = pendingItemsResult.data || [];
      const arrivedPending = arrivedPendingResult.data || [];

      // Calculate stats
      const pendingVerification = allBoxes.filter(b => b.status === 'packing' && !b.verification_complete && b.verification_required);
      const readyToSeal = allBoxes.filter(b => b.status === 'packing' && b.verification_complete);
      const inProgressVerifications = verifications.filter(v => v.status === 'in_progress');
      const completedToday = verifications.filter(v => v.status === 'completed');
      const totalDefectsToday = completedToday.reduce((sum, v) => sum + (v.defective_count || 0), 0);
      const totalMissingToday = completedToday.reduce((sum, v) => sum + (v.missing_count || 0), 0);
      const totalItemsCheckedToday = completedToday.reduce((sum, v) => sum + (v.verified_count || 0), 0);
      const totalOkItemsToday = completedToday.reduce((sum, v) => sum + (v.ok_count || 0), 0);
      return {
        todayBoxesCount: todayBoxes.length,
        pendingItemsCount: pendingItems.length, // Kutilayotgan - qutiga qo'yilmagan mahsulotlar
        readyToSealCount: readyToSeal.length,
        defectsFoundToday: totalDefectsToday,
        missingItemsToday: totalMissingToday,
        inProgressCount: inProgressVerifications.length,
        completedTodayCount: completedToday.length,
        pendingVerificationBoxes: pendingVerification.slice(0, 5),
        recentVerifications: recentVerificationsResult.data || [],
        defectCategories: defectCategoriesResult.data || [],
        sealedTodayCount: sealedToday.length,
        inTransitAllCount: inTransitAll.length, // Barcha yo'ldagi qutilar
        arrivedPendingCount: arrivedPending.length, // Kelgan, tekshirishni kutayotgan
        totalItemsCheckedToday,
        totalOkItemsToday,
        inTransitBoxes,
        inTransitCount: inTransitBoxes.length
      };
    }
  });

  // Real-time subscriptions
  useEffect(() => {
    const channels = [supabase.channel('china-boxes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'boxes'
    }, () => {
      queryClient.invalidateQueries({
        queryKey: ['china-dashboard-stats']
      });
    }), supabase.channel('china-verifications').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'verification_sessions'
    }, () => {
      queryClient.invalidateQueries({
        queryKey: ['china-dashboard-stats']
      });
    }), supabase.channel('china-verification-items').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'verification_items'
    }, () => {
      queryClient.invalidateQueries({
        queryKey: ['china-dashboard-stats']
      });
    })];
    channels.forEach(channel => channel.subscribe());
    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [queryClient]);
  if (isLoading) {
    return <DashboardLoadingSkeleton />;
  }
  
  const content = (
    <div className="space-y-6">
      {/* Header */}
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <span className="text-2xl">🇨🇳</span>
            {t('cn_title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            {t('cn_subtitle')}
          </p>
        </div>
        <Link to="/crm/boxes">
          <Button className="gap-2">
            <Box className="h-4 w-4" />
            {t('cn_boxes_page')}
          </Button>
        </Link>
      </div>

      {/* Main Stats - Row 1: Stack on very small screens (<375px), 2-col on mobile, 4-col on desktop */}
      <div className={cn(
        "grid gap-3 sm:gap-4",
        "grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-4"
      )}>
        <Link to="/crm/boxes">
          <Card className="p-4 sm:p-6 bg-card border-border hover:shadow-lg transition-all cursor-pointer hover:border-primary/50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Box className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('cn_todays_boxes')}</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.todayBoxesCount || 0}</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/crm/products">
          <Card className="p-4 sm:p-6 bg-card border-border hover:shadow-lg transition-all cursor-pointer hover:border-yellow-500/50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('cn_waiting')}</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-500">{stats?.pendingItemsCount || 0}</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/crm/boxes?filter=ready">
          <Card className="p-4 sm:p-6 bg-card border-border hover:shadow-lg transition-all cursor-pointer hover:border-green-500/50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('cn_ready')}</p>
                <p className="text-xl sm:text-2xl font-bold text-green-500">{stats?.readyToSealCount || 0}</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/crm/verification-reports">
          <Card className="p-4 sm:p-6 bg-card border-border hover:shadow-lg transition-all cursor-pointer hover:border-red-500/50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('cn_defects')}</p>
                <p className="text-xl sm:text-2xl font-bold text-red-500">{stats?.defectsFoundToday || 0}</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Main Stats - Row 2 */}
      <div className={cn(
        "grid gap-3 sm:gap-4",
        "grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-4"
      )}>
        <Card className="p-4 sm:p-6 bg-card border-border hover:shadow-lg transition-all">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('cn_sealed_today')}</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-500">{stats?.sealedTodayCount || 0}</p>
            </div>
          </div>
        </Card>

        <Link to="/crm/shipments">
          <Card className="p-4 sm:p-6 bg-card border-border hover:shadow-lg transition-all cursor-pointer hover:border-indigo-500/50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('cn_shipped')}</p>
                <p className="text-xl sm:text-2xl font-bold text-indigo-500">{stats?.inTransitAllCount || 0}</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/crm/boxes?filter=pending">
          <Card className="p-4 sm:p-6 bg-card border-border hover:shadow-lg transition-all cursor-pointer hover:border-cyan-500/50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('cn_verified')}</p>
                <p className="text-xl sm:text-2xl font-bold text-cyan-500">{stats?.arrivedPendingCount || 0}</p>
              </div>
            </div>
          </Card>
        </Link>

        <Card className="p-4 sm:p-6 bg-card border-border hover:shadow-lg transition-all">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('cn_ok_products')}</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-500">{stats?.totalOkItemsToday || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Pending Verification Queue */}
        <Card className="p-4 sm:p-6 bg-card border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-yellow-500" />
              {t('cn_pending_boxes')}
            </h2>
            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">
              {stats?.pendingVerificationBoxes?.length || 0} ta
            </Badge>
          </div>
          
          {stats?.pendingVerificationBoxes && stats.pendingVerificationBoxes.length > 0 ? <div className="space-y-3">
              {stats.pendingVerificationBoxes.map((box: any) => <div key={box.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                      <Box className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{box.box_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('cn_products_count', { count: box.product_items?.length || 0 })}
                      </p>
                    </div>
                  </div>
                  <Link to={`/crm/boxes?box=${box.id}`}>
                    <Button size="sm" variant="outline" className="gap-1">
                      {t('cn_inspect')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>)}
            </div> : <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mb-3 text-green-500/50" />
              <p className="text-sm">{t('cn_no_pending')}</p>
            </div>}
        </Card>

        {/* In Transit Boxes - Tracking shipped boxes */}
        <Card className="p-4 sm:p-6 bg-card border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
              <Truck className="h-5 w-5 text-indigo-500" />
              {t('cn_in_transit')}
            </h2>
            <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-500">
              {stats?.inTransitCount || 0} ta
            </Badge>
          </div>
          
          {stats?.inTransitBoxes && stats.inTransitBoxes.length > 0 ? <div className="space-y-3">
              {stats.inTransitBoxes.map((box: any) => {
            const daysInTransit = box.updated_at ? Math.floor((new Date().getTime() - new Date(box.updated_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
            return <div key={box.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-indigo-500/20 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Truck className="h-5 w-5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{box.box_number}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{t('cn_products_count', { count: box.product_items?.length || 0 })}</span>
                          <span>•</span>
                          <span className="text-indigo-500">{t('cn_days_in_transit', { days: daysInTransit })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {box.estimated_arrival ? <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(box.estimated_arrival).toLocaleDateString('uz-UZ')}</span>
                        </div> : <span className="text-xs text-muted-foreground">{t('cn_eta_unknown')}</span>}
                    </div>
                  </div>;
          })}
              
              {(stats?.inTransitCount || 0) > 10 && <Link to="/crm/shipments">
                  <Button variant="ghost" className="w-full gap-2 mt-2">
                    {t('cn_view_all', { count: stats.inTransitAllCount })}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>}
            </div> : <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Truck className="h-12 w-12 mb-3 opacity-50" />
               <p className="text-sm">{t('cn_no_in_transit')}</p>
               <p className="text-xs">{t('cn_send_hint')}</p>
            </div>}
        </Card>
      </div>

      {/* Recent Verification Activity */}
      {stats?.recentVerifications && stats.recentVerifications.length > 0 && <Card className="p-4 sm:p-6 bg-card border-border">
           <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            {t('cn_recent_verifications')}
           </h2>
          
          <div className="space-y-2">
            {stats.recentVerifications.map((v: any) => <div key={v.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${v.status === 'completed' ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                    {v.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Clock className="h-4 w-4 text-yellow-500" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {v.boxes?.box_number || 'Quti'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {v.status === 'completed' ? t('cn_completed') : t('cn_in_progress')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {v.status === 'completed' && <>
                      <span className="text-green-500">{v.ok_count || 0} OK</span>
                      {(v.defective_count || 0) > 0 && <span className="text-red-500">{v.defective_count} {t('cn_defect_label')}</span>}
                      {(v.missing_count || 0) > 0 && <span className="text-yellow-500">{v.missing_count} {t('cn_missing_label')}</span>}
                    </>}
                </div>
              </div>)}
          </div>
        </Card>}
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