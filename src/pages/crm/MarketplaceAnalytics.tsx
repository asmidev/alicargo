import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  BarChart3,
  Brain,
  RefreshCw,
  ShoppingCart,
  AlertTriangle,
  Target,
  LineChart,
  PieChart,
  Percent,
  Receipt,
  Store,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
  '#84cc16',
  '#a855f7',
];

const UZUM_COLORS = ['#a855f7', '#8b5cf6', '#7c3aed', '#6d28d9', '#c084fc', '#d8b4fe', '#9333ea', '#581c87'];
const YANDEX_COLORS = ['#f59e0b', '#d97706', '#b45309', '#fbbf24'];

type PlatformTab = 'all' | 'uzum' | 'yandex';

export default function MarketplaceAnalytics() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("sales");
  const [platformTab, setPlatformTab] = useState<PlatformTab>('all');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ['marketplace-stores-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  // PRIMARY data source: marketplace_finance_summary (accurate financial KPIs)
  const { data: financeSummary, isLoading: financeLoading, refetch: refetchFinance } = useQuery({
    queryKey: ['mp-analytics-finance-summary'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('marketplace_finance_summary')
        .select('*')
        .gte('period_date', thirtyDaysAgo)
        .lte('period_date', today)
        .eq('period_type', 'daily');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Lightweight: pending count only
  const { data: pendingCount } = useQuery({
    queryKey: ['mp-analytics-pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('marketplace_orders')
        .select('*', { count: 'exact', head: true })
        .in('fulfillment_status', ['pending', 'CREATED']);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 60000,
  });

  // Fetch listings for product analytics
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ['marketplace-listings-analytics'],
    queryFn: async () => {
      return await fetchAllRows(
        supabase
          .from('marketplace_listings')
          .select(`
            id, title, price, stock, status, product_rank, store_id, external_sku,
            marketplace_stores(name, platform)
          `)
      );
    },
  });

  // Listings count queries
  const { data: listingsCount } = useQuery({
    queryKey: ['marketplace-listings-count'],
    queryFn: async () => {
      const [activeResult, lowStockResult, outOfStockResult] = await Promise.all([
        supabase.from('marketplace_listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('marketplace_listings').select('*', { count: 'exact', head: true }).gt('stock', 0).lt('stock', 5),
        supabase.from('marketplace_listings').select('*', { count: 'exact', head: true }).eq('stock', 0).eq('status', 'active'),
      ]);
      return {
        activeCount: activeResult.count || 0,
        lowStockCount: lowStockResult.count || 0,
        outOfStockCount: outOfStockResult.count || 0,
      };
    },
  });

  // === Platform store splits ===
  const uzumStores = useMemo(() => stores?.filter(s => s.platform === 'uzum') || [], [stores]);
  const yandexStores = useMemo(() => stores?.filter(s => s.platform === 'yandex') || [], [stores]);

  const platformStores = useMemo(() => {
    if (platformTab === 'uzum') return uzumStores;
    if (platformTab === 'yandex') return yandexStores;
    return stores || [];
  }, [platformTab, stores, uzumStores, yandexStores]);

  // === Filter summary by platform ===
  const summary = financeSummary || [];

  const platformSummary = useMemo(() => {
    let filtered = summary;
    if (platformTab !== 'all') {
      const platformStoreIds = new Set(
        (platformTab === 'uzum' ? uzumStores : yandexStores).map(s => s.id)
      );
      filtered = filtered.filter(r => platformStoreIds.has(r.store_id));
    }
    if (selectedStoreId) {
      filtered = filtered.filter(r => r.store_id === selectedStoreId);
    }
    return filtered;
  }, [platformTab, selectedStoreId, summary, uzumStores, yandexStores]);

  // === Filterlangan listings (platform + store bo'yicha) ===
  const filteredListingsForKPI = useMemo(() => {
    if (!listings) return [];
    let result = listings;
    if (platformTab !== 'all') {
      result = result.filter(l => (l.marketplace_stores as any)?.platform === platformTab);
    }
    if (selectedStoreId) {
      result = result.filter(l => l.store_id === selectedStoreId);
    }
    return result;
  }, [listings, platformTab, selectedStoreId]);

  const filteredActiveListings = filteredListingsForKPI.filter(l => l.status === 'active').length;
  const filteredLowStock = filteredListingsForKPI.filter(l => (l.stock ?? 0) > 0 && (l.stock ?? 0) < 5).length;
  const filteredOutOfStock = filteredListingsForKPI.filter(l => (l.stock ?? 0) === 0 && l.status === 'active').length;

  // === Compute KPIs from filtered summary ===
  const analytics = useMemo(() => ({
    totalRevenue: platformSummary.reduce((s, r) => s + (r.gross_revenue || 0), 0),
    totalCommission: platformSummary.reduce((s, r) => s + (r.commission_total || 0), 0),
    totalOrders: platformSummary.reduce((s, r) => s + (r.orders_count || 0), 0),
    completedOrders: platformSummary.reduce((s, r) => s + (r.delivered_count || 0), 0),
    cancelledOrders: platformSummary.reduce((s, r) => s + (r.cancelled_count || 0), 0),
    returnedOrders: platformSummary.reduce((s, r) => s + (r.returned_count || 0), 0),
    pendingOrders: pendingCount || 0,
    activeListings: filteredActiveListings,
    lowStockListings: filteredLowStock,
    outOfStockListings: filteredOutOfStock,
  }), [platformSummary, pendingCount, filteredActiveListings, filteredLowStock, filteredOutOfStock]);

  const netRevenue = analytics.totalRevenue - analytics.totalCommission;

  // === Revenue trend from filtered summary (group by period_date) ===
  const trendData = useMemo(() => {
    const trendByDate: Record<string, { revenue: number; orders: number }> = {};
    for (const row of platformSummary) {
      const date = format(new Date(row.period_date + 'T00:00:00'), 'MM-dd');
      if (!trendByDate[date]) trendByDate[date] = { revenue: 0, orders: 0 };
      trendByDate[date].revenue += row.gross_revenue || 0;
      trendByDate[date].orders += row.delivered_count || 0;
    }
    return Object.entries(trendByDate)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [platformSummary]);

  // === Base store revenue for chips (platform filtered, NOT store filtered) ===
  const baseStoreRevenue = useMemo(() => {
    let filtered = summary;
    if (platformTab !== 'all') {
      const platformStoreIds = new Set(
        (platformTab === 'uzum' ? uzumStores : yandexStores).map(s => s.id)
      );
      filtered = filtered.filter(r => platformStoreIds.has(r.store_id));
    }
    const map: Record<string, number> = {};
    for (const row of filtered) {
      map[row.store_id] = (map[row.store_id] || 0) + (row.gross_revenue || 0);
    }
    return map;
  }, [platformTab, summary, uzumStores, yandexStores]);

  // === Base store orders for mini cards (platform filtered, NOT store filtered) ===
  const baseStoreOrders = useMemo(() => {
    let filtered = summary;
    if (platformTab !== 'all') {
      const platformStoreIds = new Set(
        (platformTab === 'uzum' ? uzumStores : yandexStores).map(s => s.id)
      );
      filtered = filtered.filter(r => platformStoreIds.has(r.store_id));
    }
    const map: Record<string, number> = {};
    for (const row of filtered) {
      map[row.store_id] = (map[row.store_id] || 0) + (row.orders_count || 0);
    }
    return map;
  }, [platformTab, summary, uzumStores, yandexStores]);

  // === Store distribution — ALL platform stores, including those with 0 revenue ===
  const storeChartData = useMemo(() => {
    if (platformTab === 'all') {
      const revenueByStoreId: Record<string, number> = {};
      for (const row of platformSummary) {
        revenueByStoreId[row.store_id] = (revenueByStoreId[row.store_id] || 0) + (row.gross_revenue || 0);
      }
      return Object.entries(revenueByStoreId)
        .map(([storeId, value]) => ({
          storeId,
          name: stores?.find(s => s.id === storeId)?.name || 'Unknown',
          value,
        }))
        .sort((a, b) => b.value - a.value);
    }
    return platformStores
      .map(store => ({
        storeId: store.id,
        name: store.name,
        value: baseStoreRevenue[store.id] || 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [platformTab, platformSummary, platformStores, baseStoreRevenue, stores]);

  // === Uzum & Yandex separate chart data ===
  const uzumChartData = useMemo(() => {
    const uzumStoreIds = new Set(uzumStores.map(s => s.id));
    const revenueByStoreId: Record<string, number> = {};
    for (const row of summary) {
      if (uzumStoreIds.has(row.store_id)) {
        revenueByStoreId[row.store_id] = (revenueByStoreId[row.store_id] || 0) + (row.gross_revenue || 0);
      }
    }
    return uzumStores
      .map(store => ({
        storeId: store.id,
        name: store.name,
        value: revenueByStoreId[store.id] || 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [uzumStores, summary]);

  const yandexChartData = useMemo(() => {
    const yandexStoreIds = new Set(yandexStores.map(s => s.id));
    const revenueByStoreId: Record<string, number> = {};
    for (const row of summary) {
      if (yandexStoreIds.has(row.store_id)) {
        revenueByStoreId[row.store_id] = (revenueByStoreId[row.store_id] || 0) + (row.gross_revenue || 0);
      }
    }
    return yandexStores
      .map(store => ({
        storeId: store.id,
        name: store.name,
        value: revenueByStoreId[store.id] || 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [yandexStores, summary]);

  // === Per-store revenue & orders map (from filtered platformSummary, for KPI cards) ===
  const storeRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of platformSummary) {
      map[row.store_id] = (map[row.store_id] || 0) + (row.gross_revenue || 0);
    }
    return map;
  }, [platformSummary]);

  const storeOrders = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of platformSummary) {
      map[row.store_id] = (map[row.store_id] || 0) + (row.orders_count || 0);
    }
    return map;
  }, [platformSummary]);

  // Product rank distribution
  const rankDistribution = listings?.reduce((acc: Record<string, number>, l) => {
    const rank = l.product_rank || 'N';
    acc[rank] = (acc[rank] || 0) + 1;
    return acc;
  }, {}) || {};

  const rankChartData = ['A', 'B', 'C', 'D', 'N'].map(rank => ({
    name: rank === 'N' ? t('mpa_rank_new') : `${rank}-Rank`,
    value: rankDistribution[rank] || 0,
    fill: rank === 'A' ? '#22c55e' : rank === 'B' ? '#3b82f6' : rank === 'C' ? '#eab308' : rank === 'D' ? '#ef4444' : '#94a3b8',
  }));

  const topProducts = listings?.filter(l => l.product_rank === 'A').slice(0, 5) || [];
  const worstProducts = listings?.filter(l => l.product_rank === 'D' || (l.stock === 0 && l.status === 'active')).slice(0, 5) || [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchFinance();
      toast.success(t('mp_data_refreshed'));
    } catch (error) {
      toast.error(t('mp_refresh_error'));
    }
    setIsRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + ' UZS';
  };

  // Platform color config
  const platformConfig = {
    all: { color: 'text-primary', bg: 'bg-primary/10', label: 'Barchasi' },
    uzum: { color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Uzum' },
    yandex: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Yandex Market' },
  };
  const cfg = platformConfig[platformTab];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('mpa_title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('mpa_subtitle')}
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing} className="w-full sm:w-auto min-h-[44px]">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('mpa_refresh')}
        </Button>
      </div>

      {/* Platform Tabs */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'uzum', 'yandex'] as PlatformTab[]).map((pt) => {
            const pcfg = platformConfig[pt];
            const isActive = platformTab === pt;
            return (
              <button
                key={pt}
                onClick={() => {
                  setPlatformTab(pt);
                  setSelectedStoreId(null);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${isActive
                  ? `${pcfg.bg} ${pcfg.color} border-current`
                  : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                  }`}
              >
                {pt === 'all' ? '🌐 Barchasi' : pt === 'uzum' ? '🟣 Uzum' : '🟡 Yandex Market'}
                {pt !== 'all' && (
                  <span className="ml-1.5 opacity-60 text-xs">
                    ({pt === 'uzum' ? uzumStores.length : yandexStores.length} do'kon)
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Store chips — shown only when uzum or yandex is selected */}
        {platformTab !== 'all' && platformStores.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-1">
            {/* "Barchasi" chip */}
            <button
              onClick={() => setSelectedStoreId(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${!selectedStoreId
                ? 'bg-muted border-foreground/30 text-foreground'
                : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                }`}
            >
              Barchasi ({platformStores.length})
            </button>

            {/* Individual store chips */}
            {platformStores.map(store => {
              const rev = baseStoreRevenue[store.id] || 0;
              const isSelected = selectedStoreId === store.id;
              return (
                <button
                  key={store.id}
                  onClick={() => setSelectedStoreId(isSelected ? null : store.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isSelected
                    ? `${cfg.bg} ${cfg.color} border-current`
                    : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                    }`}
                >
                  {store.name}
                  {rev > 0 && (
                    <span className="ml-1 opacity-60">
                      {(rev / 1_000_000).toFixed(0)}M
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected store badge */}
      {selectedStoreId && (() => {
        const selectedStore = stores?.find(s => s.id === selectedStoreId);
        if (!selectedStore) return null;
        const isUzum = selectedStore.platform === 'uzum';
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${isUzum ? 'border-purple-500/50 text-purple-600' : 'border-yellow-500/50 text-yellow-600'}`}>
              {isUzum ? '🟣' : '🟡'} {selectedStore.name}
              <button
                className="ml-1.5 hover:opacity-70"
                onClick={() => setSelectedStoreId(null)}
              >
                ✕
              </button>
            </Badge>
          </div>
        );
      })()}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('mpa_total_revenue')}</p>
                <p className="text-2xl font-bold">{formatCurrency(netRevenue)}</p>
                <p className="text-xs text-muted-foreground">{cfg.label} • {t('mpa_last_30_days')}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('mpa_total_orders')}</p>
                <p className="text-2xl font-bold">{analytics.totalOrders}</p>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-600">{analytics.completedOrders} ✓</span>
                  <span className="text-yellow-600">{analytics.pendingOrders} ⏳</span>
                </div>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('mpa_active_listings')}</p>
                <p className="text-2xl font-bold">{analytics.activeListings}</p>
                <div className="flex gap-2 text-xs">
                  <span className="text-yellow-600">{analytics.lowStockListings} {t('mpa_low')}</span>
                  <span className="text-red-600">{analytics.outOfStockListings} {t('mpa_ended')}</span>
                </div>
              </div>
              <Package className="h-8 w-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Komissiya</p>
                <p className="text-2xl font-bold">{formatCurrency(analytics.totalCommission)}</p>
                <p className="text-xs text-red-600">
                  {analytics.totalRevenue > 0
                    ? (() => {
                      let comm = analytics.totalCommission;
                      // Defensive guard against historical DB corruption (absolute UZS stored as %)
                      if (comm > analytics.totalRevenue * 0.45) {
                        return `${(20).toFixed(1)}% daromaddan (taxminiy)*`;
                      }
                      return `${((comm / analytics.totalRevenue) * 100).toFixed(1)}% daromaddan`;
                    })()
                    : '0% daromaddan'}
                </p>
              </div>
              <Receipt className="h-8 w-8 text-orange-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Store Mini Cards (shown when uzum or yandex tab is selected) */}
      {platformTab !== 'all' && platformStores.length > 0 && (
        <div>
          <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${cfg.color}`}>
            <Store className="h-4 w-4" />
            {cfg.label} do'konlari bo'yicha daromad
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {platformStores.map(store => {
              const rev = baseStoreRevenue[store.id] || 0;
              const orders = baseStoreOrders[store.id] || 0;
              const totalRev = platformStores.reduce((s, st) => s + (baseStoreRevenue[st.id] || 0), 0);
              const pct = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(0) : '0';
              const isSelected = selectedStoreId === store.id;
              return (
                <Card
                  key={store.id}
                  interactive
                  onClick={() => setSelectedStoreId(isSelected ? null : store.id)}
                  className={`relative overflow-hidden cursor-pointer transition-all ${isSelected
                    ? `ring-2 ${platformTab === 'uzum' ? 'ring-purple-500' : 'ring-yellow-500'}`
                    : selectedStoreId && !isSelected
                      ? 'opacity-50'
                      : ''
                    }`}
                >
                  <CardContent className="pt-3 pb-3">
                    <p className="font-medium text-sm line-clamp-1 mb-1">{store.name}</p>
                    <p className={`text-base font-bold ${cfg.color}`}>{formatCurrency(rev)}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">{orders} buyurtma</p>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">{pct}%</Badge>
                    </div>
                    {/* mini progress bar */}
                    <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${platformTab === 'uzum' ? 'bg-purple-500' : 'bg-yellow-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <LineChart className="h-4 w-4" />
            {t('mpa_tab_sales')}
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('mpa_tab_products')}
          </TabsTrigger>
          <TabsTrigger value="finance" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {t('mpa_tab_finance')}
          </TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {t('mpa_revenue_trend')}
                  {platformTab !== 'all' && (
                    <Badge variant="outline" className={`ml-2 ${cfg.color}`}>{cfg.label}</Badge>
                  )}
                </CardTitle>
                <CardDescription>{t('mpa_last_14_days')}</CardDescription>
              </CardHeader>
              <CardContent>
                {financeLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `${t('mpa_date_label')}: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={platformTab === 'uzum' ? '#a855f7' : platformTab === 'yandex' ? '#eab308' : 'hsl(var(--primary))'}
                        fill={platformTab === 'uzum' ? '#a855f7' : platformTab === 'yandex' ? '#eab308' : 'hsl(var(--primary))'}
                        fillOpacity={0.3}
                        name={t('mpa_revenue_label')}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Store Distribution — Two separate pie charts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  {t('mpa_by_stores')}
                </CardTitle>
                <CardDescription>{t('mpa_revenue_distribution')}</CardDescription>
              </CardHeader>
              <CardContent>
                {financeLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <div className={`grid ${platformTab === 'all' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    {/* Uzum Chart */}
                    {(platformTab === 'all' || platformTab === 'uzum') && (
                      <div>
                        <h4 className="text-sm font-semibold text-purple-500 mb-2 text-center">🟣 Uzum ({uzumChartData.length} do'kon)</h4>
                        {uzumChartData.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8 text-sm">Ma'lumot yo'q</p>
                        ) : (
                          <>
                            <ResponsiveContainer width="100%" height={200}>
                              <RechartsPieChart>
                                <Pie
                                  data={uzumChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={isMobile ? 25 : 35}
                                  outerRadius={isMobile ? 55 : 70}
                                  paddingAngle={2}
                                  dataKey="value"
                                  label={isMobile ? false : ({ name, percent }) => percent > 0.03 ? `${name.slice(0, 10)} ${(percent * 100).toFixed(0)}%` : ''}
                                  labelLine={!isMobile}
                                  cursor="pointer"
                                  onClick={(_, idx) => {
                                    const store = uzumChartData[idx];
                                    if (store) {
                                      if (selectedStoreId === store.storeId) {
                                        setSelectedStoreId(null);
                                      } else {
                                        setSelectedStoreId(store.storeId);
                                        if (platformTab === 'all') setPlatformTab('uzum');
                                      }
                                    }
                                  }}
                                >
                                  {uzumChartData.map((entry, index) => (
                                    <Cell
                                      key={`uzum-${index}`}
                                      fill={UZUM_COLORS[index % UZUM_COLORS.length]}
                                      stroke={selectedStoreId === entry.storeId ? '#fff' : 'transparent'}
                                      strokeWidth={selectedStoreId === entry.storeId ? 3 : 0}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              </RechartsPieChart>
                            </ResponsiveContainer>
                            {/* Uzum legend */}
                            <div className="space-y-1 mt-2">
                              {uzumChartData.map((store, index) => {
                                const total = uzumChartData.reduce((s, r) => s + r.value, 0);
                                const pct = total > 0 ? ((store.value / total) * 100) : 0;
                                const isActive = selectedStoreId === store.storeId;
                                const isDimmed = selectedStoreId && !isActive;
                                return (
                                  <div
                                    key={store.storeId}
                                    className={`flex items-center gap-2 text-xs cursor-pointer rounded px-1 py-0.5 transition-all ${isActive ? 'bg-purple-500/10 font-bold' : ''} ${isDimmed ? 'opacity-40' : ''}`}
                                    onClick={() => {
                                      setSelectedStoreId(isActive ? null : store.storeId);
                                      if (!isActive && platformTab === 'all') setPlatformTab('uzum');
                                    }}
                                  >
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: UZUM_COLORS[index % UZUM_COLORS.length] }} />
                                    <span className="flex-1 truncate">{store.name}</span>
                                    <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Yandex Chart */}
                    {(platformTab === 'all' || platformTab === 'yandex') && (
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-500 mb-2 text-center">🟡 Yandex ({yandexChartData.length} do'kon)</h4>
                        {yandexChartData.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8 text-sm">Ma'lumot yo'q</p>
                        ) : (
                          <>
                            <ResponsiveContainer width="100%" height={200}>
                              <RechartsPieChart>
                                <Pie
                                  data={yandexChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={isMobile ? 25 : 35}
                                  outerRadius={isMobile ? 55 : 70}
                                  paddingAngle={2}
                                  dataKey="value"
                                  label={isMobile ? false : ({ name, percent }) => percent > 0.03 ? `${name.slice(0, 10)} ${(percent * 100).toFixed(0)}%` : ''}
                                  labelLine={!isMobile}
                                  cursor="pointer"
                                  onClick={(_, idx) => {
                                    const store = yandexChartData[idx];
                                    if (store) {
                                      if (selectedStoreId === store.storeId) {
                                        setSelectedStoreId(null);
                                      } else {
                                        setSelectedStoreId(store.storeId);
                                        if (platformTab === 'all') setPlatformTab('yandex');
                                      }
                                    }
                                  }}
                                >
                                  {yandexChartData.map((entry, index) => (
                                    <Cell
                                      key={`yandex-${index}`}
                                      fill={YANDEX_COLORS[index % YANDEX_COLORS.length]}
                                      stroke={selectedStoreId === entry.storeId ? '#fff' : 'transparent'}
                                      strokeWidth={selectedStoreId === entry.storeId ? 3 : 0}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              </RechartsPieChart>
                            </ResponsiveContainer>
                            {/* Yandex legend */}
                            <div className="space-y-1 mt-2">
                              {yandexChartData.map((store, index) => {
                                const total = yandexChartData.reduce((s, r) => s + r.value, 0);
                                const pct = total > 0 ? ((store.value / total) * 100) : 0;
                                const isActive = selectedStoreId === store.storeId;
                                const isDimmed = selectedStoreId && !isActive;
                                return (
                                  <div
                                    key={store.storeId}
                                    className={`flex items-center gap-2 text-xs cursor-pointer rounded px-1 py-0.5 transition-all ${isActive ? 'bg-yellow-500/10 font-bold' : ''} ${isDimmed ? 'opacity-40' : ''}`}
                                    onClick={() => {
                                      setSelectedStoreId(isActive ? null : store.storeId);
                                      if (!isActive && platformTab === 'all') setPlatformTab('yandex');
                                    }}
                                  >
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: YANDEX_COLORS[index % YANDEX_COLORS.length] }} />
                                    <span className="flex-1 truncate">{store.name}</span>
                                    <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Store revenue table — grouped by platform */}
          {storeChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Do'konlar bo'yicha daromad jadvali
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Uzum section */}
                  {(platformTab === 'all' || platformTab === 'uzum') && uzumChartData.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-purple-500 mb-2">🟣 Uzum</h4>
                      <div className="space-y-1.5">
                        {uzumChartData.map((store, index) => {
                          const total = uzumChartData.reduce((s, r) => s + r.value, 0);
                          const pct = total > 0 ? ((store.value / total) * 100) : 0;
                          const isActive = selectedStoreId === store.storeId;
                          const isDimmed = selectedStoreId && !isActive;
                          return (
                            <div
                              key={store.storeId}
                              className={`flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all ${isActive ? 'bg-purple-500/10 ring-1 ring-purple-500/30 font-bold' : 'hover:bg-muted/50'} ${isDimmed ? 'opacity-40' : ''}`}
                              onClick={() => {
                                setSelectedStoreId(isActive ? null : store.storeId);
                                if (!isActive && platformTab === 'all') setPlatformTab('uzum');
                              }}
                            >
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: UZUM_COLORS[index % UZUM_COLORS.length] }} />
                              <span className="text-sm flex-1 truncate">{store.name}</span>
                              <div className="flex-1 bg-muted rounded-full h-2 hidden sm:block">
                                <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: UZUM_COLORS[index % UZUM_COLORS.length] }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                              <span className="text-sm font-semibold w-36 text-right">{formatCurrency(store.value)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Yandex section */}
                  {(platformTab === 'all' || platformTab === 'yandex') && yandexChartData.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-500 mb-2">🟡 Yandex</h4>
                      <div className="space-y-1.5">
                        {yandexChartData.map((store, index) => {
                          const total = yandexChartData.reduce((s, r) => s + r.value, 0);
                          const pct = total > 0 ? ((store.value / total) * 100) : 0;
                          const isActive = selectedStoreId === store.storeId;
                          const isDimmed = selectedStoreId && !isActive;
                          return (
                            <div
                              key={store.storeId}
                              className={`flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all ${isActive ? 'bg-yellow-500/10 ring-1 ring-yellow-500/30 font-bold' : 'hover:bg-muted/50'} ${isDimmed ? 'opacity-40' : ''}`}
                              onClick={() => {
                                setSelectedStoreId(isActive ? null : store.storeId);
                                if (!isActive && platformTab === 'all') setPlatformTab('yandex');
                              }}
                            >
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: YANDEX_COLORS[index % YANDEX_COLORS.length] }} />
                              <span className="text-sm flex-1 truncate">{store.name}</span>
                              <div className="flex-1 bg-muted rounded-full h-2 hidden sm:block">
                                <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: YANDEX_COLORS[index % YANDEX_COLORS.length] }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                              <span className="text-sm font-semibold w-36 text-right">{formatCurrency(store.value)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Volume */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t('mpa_orders_dynamics')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {financeLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar
                      dataKey="orders"
                      fill={platformTab === 'uzum' ? '#a855f7' : platformTab === 'yandex' ? '#eab308' : '#3b82f6'}
                      name={t('mpa_orders_label')}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Product Rank Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {t('mpa_product_rank')}
                </CardTitle>
                <CardDescription>{t('mpa_rank_distribution')}</CardDescription>
              </CardHeader>
              <CardContent>
                {listingsLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={rankChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="name" type="category" className="text-xs" width={60} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        name={t('mpa_chart_products')}
                        cursor="pointer"
                        onClick={(data: any) => {
                          const rankMap: Record<string, string> = { 'A-Rank': 'A', 'B-Rank': 'B', 'C-Rank': 'C', 'D-Rank': 'D' };
                          const rank = rankMap[data.name] || 'N';
                          navigate(`/crm/marketplace/listings?rank=${rank}`);
                        }}
                      >
                        {rankChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                  {t('mpa_top_products_title')}
                </CardTitle>
                <CardDescription>{t('mpa_top_desc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {listingsLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : topProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('mpa_no_a_rank')}</p>
                ) : (
                  <div className="space-y-2">
                    {topProducts.map((product, index) => (
                      <div key={product.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-green-600">#{index + 1}</span>
                          <div>
                            <p className="font-medium text-sm line-clamp-1">{product.title || product.external_sku}</p>
                            <p className="text-xs text-muted-foreground">{(product.marketplace_stores as any)?.name}</p>
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-600">A</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Worst Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <TrendingDown className="h-5 w-5" />
                {t('mpa_attention_needed')}
              </CardTitle>
              <CardDescription>{t('mpa_attention_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {listingsLoading ? (
                <Skeleton className="h-[100px] w-full" />
              ) : worstProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">{t('mpa_no_problems')}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {worstProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20">
                      <div>
                        <p className="font-medium text-sm line-clamp-1">{product.title || product.external_sku}</p>
                        <div className="flex gap-2">
                          {product.product_rank === 'D' && <Badge variant="destructive">D-Rank</Badge>}
                          {product.stock === 0 && <Badge variant="outline" className="text-red-600">{t('mpa_out_of_stock')}</Badge>}
                        </div>
                      </div>
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finance Tab */}
        <TabsContent value="finance" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-800">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Yalpi daromad</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(analytics.totalRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-900/10">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-800">
                    <Receipt className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Komissiya</p>
                    <p className="text-lg font-bold text-orange-600">-{formatCurrency(analytics.totalCommission)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-800">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Sof daromad</p>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(netRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-900/10">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-800">
                    <Percent className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Bajarilish %</p>
                    <p className="text-lg font-bold text-purple-600">
                      {analytics.totalOrders > 0
                        ? ((analytics.completedOrders / analytics.totalOrders) * 100).toFixed(1) + '%'
                        : '0%'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('mpa_financial_summary')}</CardTitle>
              <CardDescription>
                {cfg.label} • {t('mpa_last_30')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span>{t('mpa_total_sales')}</span>
                  <span className="font-bold">{analytics.totalOrders}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span>{t('mpa_successful')}</span>
                  <span className="font-bold text-green-600">{analytics.completedOrders}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span>{t('mpa_cancelled')}</span>
                  <span className="font-bold text-red-600">{analytics.cancelledOrders}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span>Qaytarilgan</span>
                  <span className="font-bold text-orange-600">{analytics.returnedOrders}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span>{t('mpa_waiting')}</span>
                  <span className="font-bold text-yellow-600">{analytics.pendingOrders}</span>
                </div>
                <div className="border-t pt-3 space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <span className="font-medium">Yalpi daromad</span>
                    <span className="font-bold text-green-600">{formatCurrency(analytics.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <span className="font-medium">Komissiya</span>
                    <span className="font-bold text-orange-600">-{formatCurrency(analytics.totalCommission)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <span className="font-medium">Sof daromad</span>
                    <span className="font-bold text-blue-600">{formatCurrency(netRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">O'rtacha buyurtma (delivered)</span>
                    <span className="font-bold">
                      {analytics.completedOrders > 0
                        ? formatCurrency(analytics.totalRevenue / analytics.completedOrders)
                        : '0 UZS'}
                    </span>
                  </div>
                </div>

                {/* Per-store breakdown in finance tab */}
                {storeChartData.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-semibold mb-2">Do'konlar bo'yicha daromad</p>
                    <div className="space-y-2">
                      {storeChartData.map((store, index) => (
                        <div key={store.storeId} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-sm truncate max-w-[160px]">{store.name}</span>
                          </div>
                          <span className="text-sm font-semibold">{formatCurrency(store.value)}</span>
                        </div>
                      ))}
                    </div>
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
