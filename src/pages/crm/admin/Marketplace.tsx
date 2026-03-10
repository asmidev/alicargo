import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLoadingSkeleton, LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Store, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Activity,
  Package,
  ShoppingCart,
  AlertTriangle,
  Loader2,
  Zap,
  Calendar,
  TrendingUp
} from "lucide-react";
import { format, formatDistanceToNow, addMinutes } from "date-fns";

interface MarketplaceStore {
  id: string;
  name: string;
  platform: 'uzum' | 'yandex';
  shop_id: string | null;
  seller_id: string | null;
  business_id: string | null;
  campaign_id: string | null;
  fby_campaign_id: string | null;
  fbs_campaign_id: string | null;
  fulfillment_type: string | null;
  api_key_secret_name: string;
  is_active: boolean;
  auto_sync_enabled: boolean;
  last_sync_at: string | null;
  next_sync_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
}

interface SyncLog {
  id: string;
  store_id: string;
  sync_type: string;
  fulfillment_type: string | null;
  status: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

// Auto-sync schedule configuration
const SYNC_SCHEDULES = {
  orders: { interval: 15, label: "Har 15 daqiqada" },
  listings: { interval: 30, label: "Har 30 daqiqada" },
  stocks: { interval: 60, label: "Har soatda" },
};

export default function MarketplaceAdmin() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);
  const [healthResults, setHealthResults] = useState<Record<string, boolean>>({});
  const [forceSync, setForceSync] = useState<{ loading: boolean; type: string | null }>({ loading: false, type: null });

  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ['marketplace-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('*')
        .order('platform', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as MarketplaceStore[];
    },
  });

  const { data: syncLogs } = useQuery({
    queryKey: ['marketplace-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as SyncLog[];
    },
  });

  // Get last auto-sync log
  const lastAutoSync = syncLogs?.find(log => log.sync_type?.startsWith('auto_'));
  
  // Calculate next sync times based on schedule
  const getNextSyncTime = (syncType: keyof typeof SYNC_SCHEDULES) => {
    if (lastAutoSync?.completed_at) {
      return addMinutes(new Date(lastAutoSync.completed_at), SYNC_SCHEDULES[syncType].interval);
    }
    return addMinutes(new Date(), SYNC_SCHEDULES[syncType].interval);
  };

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('marketplace-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketplace_sync_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['marketplace-sync-logs'] });
          queryClient.invalidateQueries({ queryKey: ['marketplace-stores'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketplace_orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const toggleStoreMutation = useMutation({
    mutationFn: async ({ storeId, isActive }: { storeId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('marketplace_stores')
        .update({ is_active: isActive })
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-stores'] });
      toast.success(t('mpadm_store_updated'));
    },
    onError: (error) => {
      toast.error(`Xatolik: ${error.message}`);
    },
  });

  const handleForceSync = async (syncType: string) => {
    setForceSync({ loading: true, type: syncType });
    
    try {
      const { data, error } = await supabase.functions.invoke('marketplace-auto-sync', {
        body: { sync_type: syncType, trigger_ai: true, send_alerts: true },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(t('mpadm_sync_complete', { success: data.summary.success_count, total: data.summary.total_stores }));
      } else {
        toast.warning(t('mpadm_sync_partial', { success: data.summary.success_count, errors: data.summary.error_count }));
      }

      queryClient.invalidateQueries({ queryKey: ['marketplace-stores'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-sync-logs'] });
    } catch (error) {
      toast.error(`${t('mpadm_sync_error')}: ${error instanceof Error ? error.message : ''}`);
    } finally {
      setForceSync({ loading: false, type: null });
    }
  };

  const handleHealthCheck = async () => {
    setHealthCheckLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('marketplace-health', {
        body: {},
      });

      if (error) throw error;

      const results: Record<string, boolean> = {};
      for (const store of data.stores || []) {
        results[store.store_id] = store.api_connected;
      }
      setHealthResults(results);

      toast.success(t('mpadm_health_result', { connected: data.summary.connected, total: data.summary.total_stores }));
    } catch (error) {
      toast.error(`${t('mpadm_health_error')}: ${error instanceof Error ? error.message : ''}`);
    } finally {
      setHealthCheckLoading(false);
    }
  };

  const uzumStores = stores?.filter(s => s.platform === 'uzum') || [];
  const yandexStores = stores?.filter(s => s.platform === 'yandex') || [];
  const activeStores = stores?.filter(s => s.is_active) || [];

  const getStatusBadge = (store: MarketplaceStore) => {
    if (!store.is_active) {
      return <Badge variant="secondary">{t('mpadm_disabled')}</Badge>;
    }
    if (store.sync_status === 'success') {
      return <Badge variant="default" className="bg-green-600">{t('mpadm_success')}</Badge>;
    }
    if (store.sync_status === 'error') {
      return <Badge variant="destructive">{t('mpadm_error')}</Badge>;
    }
    return <Badge variant="outline">{t('mpadm_waiting')}</Badge>;
  };

  const getFulfillmentBadge = (store: MarketplaceStore) => {
    if (store.fulfillment_type === 'fby_fbs') {
      return (
        <div className="flex gap-1">
          <Badge variant="outline" className="text-xs">FBY</Badge>
          <Badge variant="outline" className="text-xs">FBS</Badge>
        </div>
      );
    }
    if (store.fulfillment_type === 'fby') {
      return <Badge variant="outline" className="text-xs">FBY</Badge>;
    }
    if (store.fulfillment_type === 'fbs') {
      return <Badge variant="outline" className="text-xs">FBS</Badge>;
    }
    return null;
  };

  // Per-store sync mutation
  const storeSyncMutation = useMutation({
    mutationFn: async ({ storeId, platform, syncType }: { storeId: string; platform: string; syncType: string }) => {
      const functionName = platform === 'uzum' 
        ? (syncType === 'stocks' ? 'uzum-stocks' : 'uzum-sync')
        : (syncType === 'stocks' ? 'yandex-stocks' : 'yandex-sync');
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          store_id: storeId, 
          sync_type: syncType,
          action: syncType === 'stocks' ? 'sync' : undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-stores'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-sync-logs'] });
      const records = data?.records_processed || data?.synced || 0;
      toast.success(t('mpadm_sync_records', { count: records }));
    },
    onError: (error) => {
      toast.error(`Xatolik: ${error instanceof Error ? error.message : 'Noma\'lum xato'}`);
    },
  });

  const StoreCard = ({ store }: { store: MarketplaceStore }) => {
    const healthStatus = healthResults[store.id];
    const isStoreSyncing = storeSyncMutation.isPending;

    return (
      <Card className={`${!store.is_active ? 'opacity-60' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{store.name}</CardTitle>
              {getFulfillmentBadge(store)}
            </div>
            <Switch
              checked={store.is_active}
              onCheckedChange={(checked) => 
                toggleStoreMutation.mutate({ storeId: store.id, isActive: checked })
              }
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('mpadm_store_status')}</span>
            <div className="flex items-center gap-2">
              {getStatusBadge(store)}
              {healthStatus !== undefined && (
                healthStatus ? 
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                  <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>

          {store.platform === 'uzum' && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Shop ID: {store.shop_id}</div>
              <div>Seller ID: {store.seller_id}</div>
            </div>
          )}

          {store.platform === 'yandex' && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Business ID: {store.business_id}</div>
              {store.campaign_id && <div>Campaign: {store.campaign_id}</div>}
              {store.fby_campaign_id && <div>FBY: {store.fby_campaign_id}</div>}
              {store.fbs_campaign_id && <div>FBS: {store.fbs_campaign_id}</div>}
            </div>
          )}

          {store.last_sync_at && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {t('mpadm_last')}: {formatDistanceToNow(new Date(store.last_sync_at), { addSuffix: true })}
            </div>
          )}

          {store.sync_error && (
            <div className="flex items-start gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{store.sync_error}</span>
            </div>
          )}

          {/* Per-store sync buttons */}
          {store.is_active && (
            <div className="flex flex-wrap gap-1 pt-2 border-t">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2"
                disabled={isStoreSyncing}
                onClick={() => storeSyncMutation.mutate({ 
                  storeId: store.id, 
                  platform: store.platform, 
                  syncType: 'orders' 
                })}
              >
                {isStoreSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2"
                disabled={isStoreSyncing}
                onClick={() => storeSyncMutation.mutate({ 
                  storeId: store.id, 
                  platform: store.platform, 
                  syncType: 'listings' 
                })}
              >
                {isStoreSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2"
                disabled={isStoreSyncing}
                onClick={() => storeSyncMutation.mutate({ 
                  storeId: store.id, 
                  platform: store.platform, 
                  syncType: 'stocks' 
                })}
              >
                {isStoreSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (storesLoading) {
    return (
      <div className="space-y-6">
        <DashboardLoadingSkeleton cardCount={3} />
        <LoadingSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('mpadm_title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('mpadm_stores_connected', { count: stores?.length || 0, uzum: uzumStores.length, yandex: yandexStores.length })}
          </p>
        </div>
        <Button onClick={handleHealthCheck} disabled={healthCheckLoading} className="w-full sm:w-auto min-h-[44px]">
          {healthCheckLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Activity className="h-4 w-4 mr-2" />
          )}
          {t('mpadm_api_check')}
        </Button>
      </div>

      {/* Auto-Sync Status Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            {t('mpadm_auto_sync')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Overview */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{t('mpadm_status_active')}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {t('mpadm_active_stores', { count: activeStores.length })}
              </div>
              {lastAutoSync && (
                <div className="text-xs text-muted-foreground">
                  {t('mpadm_last_sync')}: {formatDistanceToNow(new Date(lastAutoSync.completed_at || lastAutoSync.started_at), { addSuffix: true })}
                </div>
              )}
            </div>

            {/* Schedule Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">{t('mpadm_schedule')}</span>
              </div>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>{t('mpadm_orders_btn')}:</span>
                  <span>{t('mpadm_schedule_orders')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('mpadm_products_btn')}:</span>
                  <span>{t('mpadm_schedule_listings')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('mpadm_stocks_btn')}:</span>
                  <span>{t('mpadm_schedule_stocks')}</span>
                </div>
              </div>
            </div>

            {/* Force Sync Buttons */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <span className="font-medium">{t('mpadm_manual_sync')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleForceSync('orders')}
                  disabled={forceSync.loading}
                  className="text-xs min-h-[44px]"
                >
                  {forceSync.loading && forceSync.type === 'orders' ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <ShoppingCart className="h-3 w-3 mr-1" />
                  )}
                   {t('mpadm_orders_btn')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleForceSync('listings')}
                  disabled={forceSync.loading}
                  className="text-xs min-h-[44px]"
                >
                  {forceSync.loading && forceSync.type === 'listings' ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Package className="h-3 w-3 mr-1" />
                  )}
                  {t('mpadm_products_btn')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleForceSync('stocks')}
                  disabled={forceSync.loading}
                  className="text-xs min-h-[44px]"
                >
                  {forceSync.loading && forceSync.type === 'stocks' ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  )}
                  {t('mpadm_stocks_btn')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="stores">
        <TabsList>
          <TabsTrigger value="stores">{t('mpadm_stores_tab')}</TabsTrigger>
          <TabsTrigger value="logs">{t('mpadm_logs_tab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="space-y-6">
          {/* Uzum Stores */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Badge className="bg-purple-600">Uzum</Badge>
              {uzumStores.length} {t('mpadm_n_stores', { count: uzumStores.length }).split(' ').slice(1).join(' ')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uzumStores.map(store => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          </div>

          {/* Yandex Stores */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Badge className="bg-yellow-600">Yandex</Badge>
              {yandexStores.length} {t('mpadm_n_stores', { count: yandexStores.length }).split(' ').slice(1).join(' ')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {yandexStores.map(store => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                {t('mpadm_sync_logs_title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {syncLogs?.map(log => {
                  const store = stores?.find(s => s.id === log.store_id);
                  const isAutoSync = log.sync_type?.startsWith('auto_');
                  return (
                    <div
                      key={log.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card gap-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        ) : log.status === 'error' ? (
                          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        ) : log.status === 'partial' ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                        ) : (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium flex flex-wrap items-center gap-1 sm:gap-2">
                            {isAutoSync ? (
                              <Badge variant="outline" className="text-xs bg-primary/10">
                                <Zap className="h-3 w-3 mr-1" />
                                AUTO
                              </Badge>
                            ) : null}
                            <span className="truncate">{store?.name || t('mpadm_all_stores')} - {log.sync_type?.replace('auto_', '')}</span>
                            {log.fulfillment_type && (
                              <Badge variant="outline" className="text-xs">
                                {log.fulfillment_type.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(log.started_at), 'dd.MM.yyyy HH:mm')}
                            {log.duration_ms && ` • ${log.duration_ms}ms`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm flex-shrink-0 pl-8 sm:pl-0">
                        <div className="text-muted-foreground">
                          {t('mpadm_n_records', { count: log.records_processed })}
                        </div>
                        {log.error_message && (
                          <div className="text-xs text-destructive line-clamp-1 max-w-48">
                            {log.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!syncLogs?.length && (
                  <div className="text-center text-muted-foreground py-8">
                    {t('mpadm_no_sync_history')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
