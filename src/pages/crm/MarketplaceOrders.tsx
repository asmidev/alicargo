import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ShoppingCart, Search, Package, Truck, CheckCircle, XCircle, Clock,
  PackageCheck, RotateCcw, MapPin, AlertTriangle, RefreshCw, CalendarIcon, X,
  ChevronLeft, ChevronRight
} from "lucide-react";
import {
  format, formatDistanceToNow, startOfDay, endOfDay,
  startOfWeek, startOfMonth, endOfMonth, subDays, subMonths
} from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { TableLoadingSkeleton } from '@/components/ui/loading-skeleton';

interface OrderItem {
  id?: number;
  productId?: number;
  skuId?: number;
  title?: string;
  offerName?: string;
  skuTitle?: string;
  image?: string;
  quantity?: number;
  count?: number;
  price?: number;
  fullPrice?: number;
}

interface MarketplaceOrder {
  id: string;
  store_id: string;
  external_order_id: string;
  order_number: string | null;
  fulfillment_type: string | null;
  status: string;
  substatus: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  total_amount: number | null;
  items_total: number | null;
  delivery_cost: number | null;
  currency: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_type: string | null;
  items: OrderItem[];
  ordered_at: string | null;
  created_at: string;
  last_synced_at: string | null;
  marketplace_stores: {
    name: string;
    platform: string;
  };
}

// Fallback image cache: productId -> image_url from marketplace_listings
// No gate flag — fetches only for productIds not yet in cache (supports pagination)
const fallbackImageCache: Record<string, string> = {};

async function loadFallbackImages(orders: Array<{ items: OrderItem[] }>) {
  const missingProductIds = new Set<string>();
  for (const order of orders) {
    for (const item of (order.items || [])) {
      if (!item.image && item.productId && !fallbackImageCache[String(item.productId)]) {
        missingProductIds.add(String(item.productId));
      }
    }
  }
  if (missingProductIds.size === 0) return;
  
  const ids = Array.from(missingProductIds).slice(0, 500);
  const { data } = await supabase
    .from('marketplace_listings')
    .select('external_product_id, image_url')
    .in('external_product_id', ids)
    .not('image_url', 'is', null);
  
  if (data) {
    for (const l of data) {
      if (l.external_product_id && l.image_url) {
        fallbackImageCache[l.external_product_id] = l.image_url;
      }
    }
  }
}

function getProductImageUrl(item: OrderItem, platform: string): string | null {
  if (item.image) {
    if (platform === 'uzum') {
      if (item.image.startsWith('http')) return item.image;
      return `https://images.uzum.uz/${item.image}-list_thumbnail.jpg`;
    }
    if (platform === 'yandex') {
      return item.image.startsWith('http') ? item.image : null;
    }
    return item.image.startsWith('http') ? item.image : null;
  }
  // Fallback: look up from listings cache
  if (item.productId) {
    const fallback = fallbackImageCache[String(item.productId)];
    if (fallback) return fallback;
  }
  return null;
}

function getProductName(item: OrderItem): string {
  return item.title || item.offerName || item.skuTitle || 'Noma\'lum mahsulot';
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  CREATED: 'mpo_status_created',
  PACKING: 'mpo_status_packing',
  PENDING_DELIVERY: 'mpo_status_pending_delivery',
  DELIVERING: 'mpo_status_delivering',
  DELIVERED: 'mpo_status_delivered',
  ACCEPTED_AT_DP: 'mpo_status_accepted_dp',
  DELIVERED_TO_CUSTOMER_DELIVERY_POINT: 'mpo_status_customer_dp',
  COMPLETED: 'mpo_status_completed',
  CANCELED: 'mpo_status_canceled',
  PENDING_CANCELLATION: 'mpo_status_pending_cancel',
  RETURNED: 'mpo_status_returned',
  CANCELLED_BEFORE_PROCESSING: 'mpo_status_cancel_before',
  CANCELLED_IN_DELIVERY: 'mpo_status_cancel_delivery',
  CANCELLED_IN_PROCESSING: 'mpo_status_cancel_processing',
  PARTIALLY_DELIVERED: 'mpo_status_partial_delivered',
  PICKUP: 'mpo_status_pickup',
  PROCESSING: 'mpo_status_processing',
  DELIVERY: 'mpo_status_delivery',
  CANCELLED: 'mpo_status_cancelled',
  PENDING: 'mpo_status_pending',
};

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; color?: string }> = {
  CREATED: { variant: "outline", icon: <Clock className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  PACKING: { variant: "secondary", icon: <Package className="h-3 w-3" />, color: "bg-yellow-100 text-yellow-700" },
  PENDING_DELIVERY: { variant: "secondary", icon: <PackageCheck className="h-3 w-3" />, color: "bg-orange-100 text-orange-700" },
  DELIVERING: { variant: "default", icon: <Truck className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  DELIVERED: { variant: "default", icon: <CheckCircle className="h-3 w-3" />, color: "bg-green-100 text-green-700" },
  ACCEPTED_AT_DP: { variant: "secondary", icon: <MapPin className="h-3 w-3" />, color: "bg-purple-100 text-purple-700" },
  DELIVERED_TO_CUSTOMER_DELIVERY_POINT: { variant: "default", icon: <MapPin className="h-3 w-3" />, color: "bg-teal-100 text-teal-700" },
  COMPLETED: { variant: "default", icon: <CheckCircle className="h-3 w-3" />, color: "bg-green-100 text-green-700" },
  CANCELED: { variant: "destructive", icon: <XCircle className="h-3 w-3" />, color: "bg-red-100 text-red-700" },
  PENDING_CANCELLATION: { variant: "secondary", icon: <AlertTriangle className="h-3 w-3" />, color: "bg-orange-100 text-orange-700" },
  RETURNED: { variant: "destructive", icon: <RotateCcw className="h-3 w-3" />, color: "bg-red-100 text-red-700" },
  CANCELLED_BEFORE_PROCESSING: { variant: "destructive", icon: <XCircle className="h-3 w-3" />, color: "bg-red-100 text-red-700" },
  CANCELLED_IN_DELIVERY: { variant: "destructive", icon: <XCircle className="h-3 w-3" />, color: "bg-red-100 text-red-700" },
  CANCELLED_IN_PROCESSING: { variant: "destructive", icon: <XCircle className="h-3 w-3" />, color: "bg-red-100 text-red-700" },
  PARTIALLY_DELIVERED: { variant: "secondary", icon: <Package className="h-3 w-3" />, color: "bg-amber-100 text-amber-700" },
  PICKUP: { variant: "default", icon: <MapPin className="h-3 w-3" />, color: "bg-indigo-100 text-indigo-700" },
  PROCESSING: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  DELIVERY: { variant: "default", icon: <Truck className="h-3 w-3" /> },
  CANCELLED: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  PENDING: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
};

const STATUS_GROUPS: Record<string, string[]> = {
  'new_processing': ['CREATED', 'PACKING', 'PROCESSING', 'PENDING_DELIVERY', 'PENDING'],
  'in_delivery': ['DELIVERING', 'DELIVERY', 'PICKUP', 'ACCEPTED_AT_DP', 'DELIVERED_TO_CUSTOMER_DELIVERY_POINT'],
  'completed': ['COMPLETED', 'DELIVERED', 'PARTIALLY_DELIVERED'],
  'cancelled': ['CANCELED', 'CANCELLED', 'CANCELLED_IN_PROCESSING', 'CANCELLED_IN_DELIVERY', 'CANCELLED_BEFORE_PROCESSING', 'PENDING_CANCELLATION'],
  'returned': ['RETURNED'],
};

const STATUS_GROUP_LABELS: Record<string, string> = {
  'new_processing': 'mpo_group_new_processing',
  'in_delivery': 'mpo_group_in_delivery',
  'completed': 'mpo_group_completed',
  'cancelled': 'mpo_group_cancelled',
  'returned': 'mpo_group_returned',
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function MarketplaceOrders() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page on any filter change
  useEffect(() => {
    setPage(0);
  }, [platformFilter, storeFilter, statusFilter, fulfillmentFilter, dateRange, debouncedSearch, pageSize]);

  const handlePlatformChange = (value: string) => {
    setPlatformFilter(value);
    setStoreFilter('all');
  };

  // Date presets
  const datePresets = [
    { labelKey: 'mpo_date_today', getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
    { labelKey: 'mpo_date_yesterday', getValue: () => { const y = subDays(new Date(), 1); return { from: startOfDay(y), to: endOfDay(y) }; } },
    { labelKey: 'mpo_date_this_week', getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: new Date() }) },
    { labelKey: 'mpo_date_this_month', getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
    { labelKey: 'mpo_date_last_month', getValue: () => { const lm = subMonths(new Date(), 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; } },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['marketplace-orders-stats'] });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper: apply shared filters to a query builder
  const applyFilters = (query: any) => {
    if (storeFilter !== 'all') {
      query = query.eq('store_id', storeFilter);
    } else if (platformFilter !== 'all') {
      query = query.eq('marketplace_stores.platform', platformFilter);
    }
    if (statusFilter !== 'all' && STATUS_GROUPS[statusFilter]) {
      query = query.in('status', STATUS_GROUPS[statusFilter]);
    }
    if (fulfillmentFilter !== 'all') {
      query = query.eq('fulfillment_type', fulfillmentFilter);
    }
    if (dateRange?.from) {
      query = query.gte('ordered_at', startOfDay(dateRange.from).toISOString());
    }
    if (dateRange?.to) {
      query = query.lte('ordered_at', endOfDay(dateRange.to).toISOString());
    }
    if (debouncedSearch) {
      query = query.or(
        `external_order_id.ilike.%${debouncedSearch}%,order_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%`
      );
    }
    return query;
  };

  const filterKeys = [platformFilter, storeFilter, statusFilter, fulfillmentFilter, dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), debouncedSearch];

  const { data: stores } = useQuery({
    queryKey: ['marketplace-stores-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Paginated orders query — single request for current page
  const { data: ordersData, isLoading, isFetching } = useQuery({
    queryKey: ['marketplace-orders', ...filterKeys, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_orders')
        .select(`*, marketplace_stores!inner (name, platform)`, { count: 'exact' })
        .order('ordered_at', { ascending: false });

      query = applyFilters(query);
      query = query.range(page * pageSize, (page + 1) * pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      const orders = (data as unknown as MarketplaceOrder[]) || [];
      // Load fallback images for orders missing item images
      await loadFallbackImages(orders);
      return { orders, totalCount: count || 0 };
    },
    refetchInterval: 30000,
  });


  // Stats query for cancelled and completed counts
  const { data: statsData } = useQuery({
    queryKey: ['marketplace-orders-stats', ...filterKeys],
    queryFn: async () => {
      let cancelledQuery = supabase
        .from('marketplace_orders')
        .select('*, marketplace_stores!inner (name, platform)', { count: 'exact', head: true })
        .in('status', STATUS_GROUPS['cancelled']);
      cancelledQuery = applyFilters(cancelledQuery);
      // Remove status filter that applyFilters may have added — we want cancelled specifically
      // Actually applyFilters only adds status filter when statusFilter !== 'all', so we rebuild:
      let cq = supabase
        .from('marketplace_orders')
        .select('*, marketplace_stores!inner (name, platform)', { count: 'exact', head: true })
        .in('status', STATUS_GROUPS['cancelled']);
      if (storeFilter !== 'all') cq = cq.eq('store_id', storeFilter);
      else if (platformFilter !== 'all') cq = cq.eq('marketplace_stores.platform', platformFilter);
      if (fulfillmentFilter !== 'all') cq = cq.eq('fulfillment_type', fulfillmentFilter);
      if (dateRange?.from) cq = cq.gte('ordered_at', startOfDay(dateRange.from).toISOString());
      if (dateRange?.to) cq = cq.lte('ordered_at', endOfDay(dateRange.to).toISOString());
      if (debouncedSearch) cq = cq.or(`external_order_id.ilike.%${debouncedSearch}%,order_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%`);

      let compQ = supabase
        .from('marketplace_orders')
        .select('*, marketplace_stores!inner (name, platform)', { count: 'exact', head: true })
        .in('status', STATUS_GROUPS['completed']);
      if (storeFilter !== 'all') compQ = compQ.eq('store_id', storeFilter);
      else if (platformFilter !== 'all') compQ = compQ.eq('marketplace_stores.platform', platformFilter);
      if (fulfillmentFilter !== 'all') compQ = compQ.eq('fulfillment_type', fulfillmentFilter);
      if (dateRange?.from) compQ = compQ.gte('ordered_at', startOfDay(dateRange.from).toISOString());
      if (dateRange?.to) compQ = compQ.lte('ordered_at', endOfDay(dateRange.to).toISOString());
      if (debouncedSearch) compQ = compQ.or(`external_order_id.ilike.%${debouncedSearch}%,order_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%`);

      const [cancelledRes, completedRes] = await Promise.all([cq, compQ]);
      return {
        cancelled: cancelledRes.count || 0,
        completed: completedRes.count || 0,
      };
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'marketplace_orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
          queryClient.invalidateQueries({ queryKey: ['marketplace-orders-stats'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const orders = ordersData?.orders || [];
  const totalCount = ordersData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { variant: "outline" as const, icon: null };
    const labelKey = STATUS_LABEL_KEYS[status];
    const label = labelKey ? t(labelKey) : status;
    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.color || ''}`}>
        {config.icon}
        {label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: currency === 'UZS' ? 'UZS' : currency === 'RUB' ? 'RUB' : 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            {t('mp_title')}
          </h1>
          <p className="text-muted-foreground">{t('mp_subtitle')}</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing || isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${(isRefreshing || isFetching) ? 'animate-spin' : ''}`} />
          {t('mp_refresh')}
        </Button>
      </div>

      {/* Platform + Store Chip Selector */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'uzum', 'yandex'] as const).map((pt) => {
            const isActive = platformFilter === pt && storeFilter === 'all';
            const ptColor = pt === 'uzum' ? 'text-purple-500' : pt === 'yandex' ? 'text-yellow-500' : 'text-primary';
            const ptBg = pt === 'uzum' ? 'bg-purple-500/10' : pt === 'yandex' ? 'bg-yellow-500/10' : 'bg-primary/10';
            const ptCount = pt === 'uzum'
              ? (stores?.filter(s => s.platform === 'uzum').length || 0)
              : pt === 'yandex'
              ? (stores?.filter(s => s.platform === 'yandex').length || 0)
              : (stores?.length || 0);
            return (
              <button
                key={pt}
                onClick={() => { handlePlatformChange(pt); }}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  isActive
                    ? `${ptBg} ${ptColor} border-current`
                    : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                }`}
              >
                {pt === 'all' ? '🌐 Barchasi' : pt === 'uzum' ? '🟣 Uzum' : '🟡 Yandex'}
                {pt !== 'all' && <span className="ml-1.5 opacity-60 text-xs">({ptCount})</span>}
              </button>
            );
          })}
        </div>
        {/* Store chips */}
        {platformFilter !== 'all' && (
          <div className="flex flex-wrap gap-2 pl-1">
            <button
              onClick={() => setStoreFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                storeFilter === 'all'
                  ? 'bg-muted border-foreground/30 text-foreground'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/50'
              }`}
            >
              Barchasi ({stores?.filter(s => s.platform === platformFilter).length || 0})
            </button>
            {stores?.filter(s => s.platform === platformFilter).map(store => {
              const isSelected = storeFilter === store.id;
              const ptColor = platformFilter === 'uzum' ? 'text-purple-500' : 'text-yellow-500';
              const ptBg = platformFilter === 'uzum' ? 'bg-purple-500/10' : 'bg-yellow-500/10';
              return (
                <button
                  key={store.id}
                  onClick={() => setStoreFilter(isSelected ? 'all' : store.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? `${ptBg} ${ptColor} border-current`
                      : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                  }`}
                >
                  {store.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-full bg-primary/10 p-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('mpo_stats_all')}</p>
              <p className="text-2xl font-bold">{totalCount.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-full bg-red-100 p-2">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('mpo_stats_cancelled')}</p>
              <p className="text-2xl font-bold">{(statsData?.cancelled ?? 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-full bg-green-100 p-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('mpo_stats_completed')}</p>
              <p className="text-2xl font-bold">{(statsData?.completed ?? 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('mp_search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={cn("min-h-[44px]", isMobile ? "w-full" : "w-[200px]")}>
                <SelectValue placeholder={t('mpo_filter_status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('mpo_filter_all_statuses')}</SelectItem>
                {Object.keys(STATUS_GROUPS).map(groupKey => (
                  <SelectItem key={groupKey} value={groupKey}>{t(STATUS_GROUP_LABELS[groupKey])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
              <SelectTrigger className={cn("min-h-[44px]", isMobile ? "w-full" : "w-[120px]")}>
                <SelectValue placeholder={t('mpo_filter_type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('mpo_filter_all')}</SelectItem>
                <SelectItem value="fbs">FBS</SelectItem>
                <SelectItem value="fbu">FBU (FBO)</SelectItem>
                <SelectItem value="fby">FBY</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Picker */}
            <div className="flex items-center gap-1">
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[250px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground",
                      dateRange && "border-primary bg-primary/5"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>{format(dateRange.from, "dd.MM.yyyy")} - {format(dateRange.to, "dd.MM.yyyy")}</>
                      ) : format(dateRange.from, "dd.MM.yyyy")
                    ) : (
                      <span>{t('mpo_select_date')}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium mb-2">{t('mpo_quick_select')}</p>
                    <div className="flex flex-wrap gap-1">
                      {datePresets.map((preset) => (
                        <Button key={preset.labelKey} variant="outline" size="sm"
                          onClick={() => { setDateRange(preset.getValue()); setIsDatePickerOpen(false); }}
                          className="text-xs"
                        >{t(preset.labelKey)}</Button>
                      ))}
                      <Button variant="ghost" size="sm"
                        onClick={() => { setDateRange(undefined); setIsDatePickerOpen(false); }}
                        className="text-xs text-muted-foreground"
                      >{t('mpo_clear')}</Button>
                    </div>
                  </div>
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => { setDateRange(range); if (range?.to) setIsDatePickerOpen(false); }}
                    numberOfMonths={isMobile ? 1 : 2}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {dateRange && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setDateRange(undefined)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table / Mobile Cards */}
      <Card>
        <CardContent className={isMobile ? "p-2" : "p-0"}>
          {isLoading ? (
            <TableLoadingSkeleton rows={8} />
          ) : isMobile ? (
            <div className="space-y-2">
              {orders.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">{t('mpo_no_orders')}</div>
              )}
              {orders.map(order => {
                const firstItem = order.items?.[0];
                const itemCount = order.items?.length || 0;
                const totalQuantity = order.items?.reduce((sum, item) => sum + (item.quantity || item.count || 1), 0) || 0;
                const platform = order.marketplace_stores.platform;
                const imageUrl = firstItem ? getProductImageUrl(firstItem, platform) : null;

                return (
                  <div key={order.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="w-12 h-12 rounded-md object-cover bg-muted flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-2">{firstItem ? getProductName(firstItem) : t('mpo_no_product')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {totalQuantity} {t('mpo_pcs')}{itemCount > 1 && <span className="text-primary ml-1">(+{itemCount - 1} {t('mpo_types')})</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-xs">#{order.order_number || order.external_order_id.slice(0, 8)}</Badge>
                      <Badge variant="secondary" className={`text-xs ${platform === 'uzum' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {platform.toUpperCase()}
                      </Badge>
                      {order.fulfillment_type && (
                        <Badge variant="outline" className="text-xs">{order.fulfillment_type.toUpperCase()}</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm whitespace-nowrap">{formatCurrency(order.total_amount, order.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      {getStatusBadge(order.status)}
                      <span className="text-xs text-muted-foreground">
                        {order.ordered_at ? format(new Date(order.ordered_at), 'dd.MM.yyyy HH:mm') : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('mpo_th_order')}</TableHead>
                  <TableHead className="min-w-[200px]">{t('mpo_th_product')}</TableHead>
                  <TableHead>{t('mpo_th_store')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('mpo_th_customer')}</TableHead>
                  <TableHead>{t('mpo_th_amount')}</TableHead>
                  <TableHead>{t('mpo_th_status')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('mpo_th_date')}</TableHead>
                  <TableHead className="hidden xl:table-cell">Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(order => {
                  const firstItem = order.items?.[0];
                  const itemCount = order.items?.length || 0;
                  const totalQuantity = order.items?.reduce((sum, item) => sum + (item.quantity || item.count || 1), 0) || 0;
                  const platform = order.marketplace_stores.platform;
                  const imageUrl = firstItem ? getProductImageUrl(firstItem, platform) : null;

                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium text-sm">#{order.order_number || order.external_order_id}</div>
                        {order.fulfillment_type && (
                          <Badge variant="outline" className="mt-1 text-xs">{order.fulfillment_type.toUpperCase()}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {imageUrl ? (
                            <img src={imageUrl} alt="Mahsulot" className="w-10 h-10 rounded-md object-cover bg-muted flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[180px]">{firstItem ? getProductName(firstItem) : t('mpo_no_product')}</p>
                            <p className="text-xs text-muted-foreground">
                              {totalQuantity} {t('mpo_pcs')}
                              {itemCount > 1 && <span className="ml-1 text-primary">(+{itemCount - 1} {t('mpo_types')})</span>}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={platform === 'uzum' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}>
                            {platform.toUpperCase()}
                          </Badge>
                          <span className="text-sm hidden lg:inline">{order.marketplace_stores.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div>{order.customer_name || '-'}</div>
                        {order.customer_phone && <div className="text-xs text-muted-foreground">{order.customer_phone}</div>}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(order.total_amount, order.currency)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {order.ordered_at ? format(new Date(order.ordered_at), 'dd.MM.yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden xl:table-cell">
                        {order.last_synced_at ? formatDistanceToNow(new Date(order.last_synced_at), { addSuffix: true }) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!orders.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">{t('mpo_no_orders')}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{totalCount} ta buyurtma</span>
            <span>·</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-[80px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(size => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>/ sahifa</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Oldingi
            </Button>
            <span className="text-sm font-medium px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Keyingi
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
