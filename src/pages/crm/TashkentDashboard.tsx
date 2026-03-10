import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Box, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Package,
  Plus,
  Warehouse,
  Activity,
  ShieldAlert,
  Grid3X3,
  ShoppingCart,
  TrendingUp,
  Truck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { PullToRefresh } from '@/components/mobile';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { TashkentWarehouseIndicators } from '@/components/inventory/TashkentWarehouseIndicators';
import { InTransitProductsList } from '@/components/inventory/InTransitProductsList';
import { AddProductToWarehouseDialog } from '@/components/inventory/AddProductToWarehouseDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TashkentSalesTab, DirectSalesHistory as DirectSalesHistoryComponent, NewArrivalsTab, ReturnsTab, SupplyInvoicesTab, HandoverInvoicesTab, ArchivedProductsTab } from '@/components/tashkent';
import { RotateCcw, FileText, Archive } from 'lucide-react';

export default function TashkentDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { isChiefManager, isUzManager, isUzStaff, isLoading: roleLoading } = useUserRole();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['tashkent-dashboard-stats'] });
  }, [queryClient]);
  
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Role-based access control - only UZ staff and Chief Manager
  const canAccess = isChiefManager || isUzManager || isUzStaff;
  
  if (!roleLoading && !canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('tash_access_denied')}</h2>
        <p className="text-muted-foreground">{t('tash_access_denied_msg')}</p>
      </div>
    );
  }

  // Permission to manage warehouse sections (only managers, not staff)
  const canManageWarehouse = isChiefManager || isUzManager;

  // Helper function to get preferred Tashkent warehouse (handles multiple warehouses)
  const getPreferredTashkentWarehouse = async () => {
    // First, try to get the canonical warehouse by name
    const { data: canonical, error: canonicalError } = await supabase
      .from('warehouses')
      .select('*')
      .eq('location', 'uzbekistan')
      .eq('name', 'Toshkent Ombori')
      .limit(1)
      .maybeSingle();
    
    if (canonicalError) throw canonicalError;
    if (canonical) return canonical;
    
    // Fallback: get latest created uzbekistan warehouse
    const { data: latest, error: latestError } = await supabase
      .from('warehouses')
      .select('*')
      .eq('location', 'uzbekistan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestError) throw latestError;
    return latest;
  };

  // Fetch Tashkent warehouse (deterministic selection)
  const { data: tashkentWarehouse, error: warehouseError } = useQuery({
    queryKey: ['tashkent-warehouse'],
    queryFn: async () => {
      const warehouse = await getPreferredTashkentWarehouse();
      
      // Create Tashkent warehouse if it doesn't exist and user can manage
      if (!warehouse && canManageWarehouse) {
        const { data: newWarehouse, error: createError } = await supabase
          .from('warehouses')
          .insert({
            name: 'Toshkent Ombori',
            location: 'uzbekistan',
            address: 'Toshkent, O\'zbekiston'
          })
          .select()
          .single();
        
        if (createError) throw createError;
        return newWarehouse;
      }
      
      return warehouse;
    },
  });

  // Fetch categories as sections (from categories_hierarchy)
  const { data: categories = [] } = useQuery({
    queryKey: ['tashkent-category-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories_hierarchy')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch TOTAL quantity per category (manual stock + product_items in Tashkent)
  const { data: categoryCounts = {} } = useQuery({
    queryKey: ['tashkent-category-counts'],
    queryFn: async () => {
      // 1. Get all active products with their categories and manual stock
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, category_id, tashkent_manual_stock')
        .eq('status', 'active')
        .neq('source', 'marketplace_auto')
        .not('category_id', 'is', null);
      
      if (prodError) throw prodError;
      
      // 2. Get product_items count in Tashkent
      const { data: itemCounts, error: itemError } = await supabase
        .from('product_items')
        .select('product_id')
        .eq('status', 'in_tashkent');
      
      if (itemError) throw itemError;
      
      // 3. Count product_items per product
      const tashkentItemCounts: Record<string, number> = {};
      itemCounts?.forEach(item => {
        tashkentItemCounts[item.product_id] = (tashkentItemCounts[item.product_id] || 0) + 1;
      });
      
      // 4. Calculate TOTAL quantity per category
      const counts: Record<string, number> = {};
      products?.forEach(product => {
        if (product.category_id) {
          const manualStock = product.tashkent_manual_stock || 0;
          const itemCount = tashkentItemCounts[product.id] || 0;
          const totalStock = manualStock + itemCount;
          
          counts[product.category_id] = (counts[product.category_id] || 0) + totalStock;
        }
      });
      
      return counts;
    },
  });

  // Map categories to sections format for UI compatibility
  const sections = categories.map(cat => ({
    id: cat.id,
    zone: cat.name,
    shelf: cat.name_ru || null,
    capacity: 100, // Default capacity
    current_count: categoryCounts[cat.id] || 0,
    icon: cat.icon,
  }));

  // Fetch product items in Tashkent - filter by category when a section (category) is selected
  const { data: productItems = [] } = useQuery({
    queryKey: ['tashkent-products', selectedSection],
    queryFn: async () => {
      let query = supabase
        .from('product_items')
        .select(`
          *,
          product:products!inner(id, name, category, category_id, main_image_url, marketplace_ready),
          variant:product_variants(id, sku, variant_attributes),
          location:warehouse_locations(id, zone, shelf)
        `)
        .eq('location', 'uzbekistan')
        .in('status', ['in_stock', 'received', 'arrived', 'in_tashkent', 'arrived_pending', 'in_transit']);
      
      // Filter by category when section is selected
      if (selectedSection) {
        query = query.eq('product.category_id', selectedSection);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch stats - CORRECTED to use proper data sources
  const { data: stats, isLoading } = useQuery({
    queryKey: ['tashkent-dashboard-stats', tashkentWarehouse?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [
        // Boxes in UZ OR arrived (status='arrived' or actual_arrival set)
        arrivedBoxesResult,
        // Boxes arrived today
        arrivedTodayResult,
        // Product items in stock (for tracked items)
        productItemsResult,
        // Boxes pending receive (in transit)
        pendingReceiveResult,
        // Product items received today
        receivedTodayResult,
        // Verification sessions (completed)
        verificationsResult,
        // Boxes in transit
        inTransitResult,
        // Manual stock from products table
        manualStockResult,
        // Direct sales - all time
        allSalesResult,
        // Direct sales - today
        todaySalesResult
      ] = await Promise.all([
        // Only boxes physically in Tashkent (uzbekistan location)
        supabase
          .from('boxes')
          .select('id, box_number, status, verification_complete, actual_arrival')
          .eq('location', 'uzbekistan'),
        
        // Boxes arrived today
        supabase
          .from('boxes')
          .select('id')
          .gte('actual_arrival', today.toISOString())
          .lt('actual_arrival', tomorrow.toISOString()),
        
        // Product items in Tashkent
        supabase
          .from('product_items')
          .select('id, status, sold_at')
          .eq('location', 'uzbekistan'),
        
        // Boxes pending receive (in transit or transit location or arrived but not yet confirmed)
        supabase
          .from('boxes')
          .select('id, box_number, created_at, product_items(id)')
          .or('status.eq.in_transit,location.eq.transit,status.eq.arrived')
          .order('created_at', { ascending: false })
          .limit(5),
        
        // Product items received today in Tashkent
        supabase
          .from('product_items')
          .select('id')
          .eq('location', 'uzbekistan')
          .gte('updated_at', today.toISOString())
          .lt('updated_at', tomorrow.toISOString())
          .in('status', ['in_stock', 'received', 'arrived_pending']),
        
        // Verification sessions only for Uzbekistan boxes
        supabase
          .from('verification_sessions')
          .select('id, status, ok_count, defective_count, missing_count, box_id, boxes!inner(location)')
          .eq('status', 'completed')
          .eq('boxes.location', 'uzbekistan'),
        
        // Total boxes in transit (including arrived but not yet confirmed)
        supabase
          .from('boxes')
          .select('id, box_number, estimated_arrival')
          .or('status.eq.in_transit,location.eq.transit,status.eq.arrived')
          .order('estimated_arrival', { ascending: true }),
        
        // FIX #2: Get manual stock from products table
        supabase
          .from('products')
          .select('tashkent_manual_stock')
          .eq('status', 'active')
          .neq('source', 'marketplace_auto')
          .gt('tashkent_manual_stock', 0),
        
        // FIX #4 & #5: Get all direct sales for total sold
        supabase
          .from('direct_sales')
          .select('quantity')
          .eq('payment_status', 'paid'),
        
        // Get today's direct sales
        supabase
          .from('direct_sales')
          .select('quantity')
          .eq('payment_status', 'paid')
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString())
      ]);

      const arrivedBoxes = arrivedBoxesResult.data || [];
      const arrivedToday = arrivedTodayResult.data || [];
      const items = productItemsResult.data || [];
      const pendingBoxes = pendingReceiveResult.data || [];
      const receivedToday = receivedTodayResult.data || [];
      const verifications = verificationsResult.data || [];
      const inTransitBoxes = inTransitResult.data || [];
      const manualStockItems = manualStockResult.data || [];
      const allSales = allSalesResult.data || [];
      const todaySales = todaySalesResult.data || [];

      // Calculate tracked items in warehouse
      const trackedItemsCount = items.filter(i => 
        i.status === 'in_stock' || i.status === 'received' || 
        i.status === 'arrived' || i.status === 'in_tashkent' ||
        i.status === 'arrived_pending'
      ).length;

      // Calculate manual stock total
      const manualStockTotal = manualStockItems.reduce((sum, p) => 
        sum + (p.tashkent_manual_stock || 0), 0
      );

      // TOTAL in warehouse = tracked items + manual stock
      const totalInWarehouse = trackedItemsCount + manualStockTotal;

      // FIX #4: Total sold from direct_sales
      const totalSoldFromSales = allSales.reduce((sum, s) => sum + (s.quantity || 0), 0);

      // FIX #5: Sold today from direct_sales
      const soldTodayFromSales = todaySales.reduce((sum, s) => sum + (s.quantity || 0), 0);

      return {
        totalBoxes: arrivedBoxes.length,
        arrivedToday: arrivedToday.length,
        totalItems: totalInWarehouse,
        trackedItems: trackedItemsCount,
        manualStock: manualStockTotal,
        soldItems: totalSoldFromSales,
        pendingReceive: pendingBoxes.length,
        pendingBoxes: pendingBoxes,
        receivedTodayCount: receivedToday.length,
        soldTodayCount: soldTodayFromSales,
        totalVerifications: verifications.length,
        verifiedBoxesCount: verifications.length, // FIX #3: Use verification sessions count
        inTransitCount: inTransitBoxes.length,
        inTransitBoxes: inTransitBoxes.slice(0, 5),
      };
    },
    enabled: !!tashkentWarehouse?.id,
  });


  // Real-time subscriptions
  useEffect(() => {
    const channels = [
      supabase.channel('tashkent-boxes').on('postgres_changes', { event: '*', schema: 'public', table: 'boxes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tashkent-dashboard-stats'] });
      }),
      supabase.channel('tashkent-items').on('postgres_changes', { event: '*', schema: 'public', table: 'product_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tashkent-products'] });
        queryClient.invalidateQueries({ queryKey: ['tashkent-dashboard-stats'] });
      }),
      supabase.channel('tashkent-locations').on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_locations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tashkent-sections'] });
      }),
    ];

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
            <span className="text-2xl">🇺🇿</span>
            {t('tash_title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            {t('tash_subtitle')}
          </p>
        </div>
      </div>
      
      {/* Add Product Dialog */}
      <AddProductToWarehouseDialog 
        open={isAddProductOpen}
        onOpenChange={setIsAddProductOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['product-inventory-overview'] })}
      />

      {/* Stat cards moved above tabs - always visible, act as navigation */}
      {/* Main Stats - Row 1 */}
      <div className={cn(
        "grid gap-3 sm:gap-4",
        "grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-4"
      )}>
        <Card interactive className={cn("p-4 sm:p-6 bg-card border-border", activeTab === 'overview' && "ring-2 ring-primary")} onClick={() => setActiveTab('overview')}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Box className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('tash_total_boxes')}</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.totalBoxes || 0}</p>
            </div>
          </div>
        </Card>

        <Card interactive className={cn("p-4 sm:p-6 bg-card border-border", activeTab === 'new-arrivals' && "ring-2 ring-primary")} onClick={() => setActiveTab('new-arrivals')}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('tash_arrived_today')}</p>
              <p className="text-xl sm:text-2xl font-bold text-green-500">{stats?.arrivedToday || 0}</p>
            </div>
          </div>
        </Card>

        <Card interactive className={cn("p-4 sm:p-6 bg-card border-border", activeTab === 'in-transit' && "ring-2 ring-primary")} onClick={() => setActiveTab('in-transit')}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('tash_in_transit')}</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-500">{stats?.inTransitCount || 0}</p>
            </div>
          </div>
        </Card>

        <Card interactive className={cn("p-4 sm:p-6 bg-card border-border", activeTab === 'sales' && "ring-2 ring-primary")} onClick={() => setActiveTab('sales')}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('tash_sold_today')}</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-500">{stats?.soldTodayCount || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2 stats */}
      <div className={cn(
        "grid gap-3 sm:gap-4",
        "grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-4"
      )}>
        <Card className="p-4 sm:p-6 bg-card border-border">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('tash_in_warehouse')}</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-500">{stats?.totalItems || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 bg-card border-border">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('tash_received_today')}</p>
              <p className="text-xl sm:text-2xl font-bold text-cyan-500">{stats?.receivedTodayCount || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 bg-card border-border">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('tash_verified')}</p>
              <p className="text-xl sm:text-2xl font-bold text-indigo-500">{stats?.verifiedBoxesCount || 0}</p>
            </div>
          </div>
        </Card>

        <Card interactive className={cn("p-4 sm:p-6 bg-card border-border", activeTab === 'history' && "ring-2 ring-primary")} onClick={() => setActiveTab('history')}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('tash_total_sold')}</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-500">{stats?.soldItems || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-4xl grid-cols-9">
          <TabsTrigger value="overview" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tash_tab_overview')}</span>
          </TabsTrigger>
          <TabsTrigger value="in-transit" className="gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tash_tab_in_transit')}</span>
          </TabsTrigger>
          <TabsTrigger value="new-arrivals" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tash_tab_new_arrivals')}</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tash_tab_sales')}</span>
          </TabsTrigger>
          <TabsTrigger value="returns" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Vozvratlar</span>
          </TabsTrigger>
          <TabsTrigger value="supply-invoices" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Yetkazib berish</span>
          </TabsTrigger>
          <TabsTrigger value="handover" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Nakladnoylar</span>
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2">
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">Arxiv</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tash_tab_history')}</span>
          </TabsTrigger>
        </TabsList>

        {/* In-Transit Tab */}
        <TabsContent value="in-transit" className="mt-6">
          <InTransitProductsList />
        </TabsContent>
        <TabsContent value="new-arrivals" className="mt-6">
          <NewArrivalsTab />
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="mt-6">
          <TashkentSalesTab />
        </TabsContent>

        {/* Returns Tab */}
        <TabsContent value="returns" className="mt-6">
          <ReturnsTab />
        </TabsContent>

        {/* Supply Invoices Tab - Yetkazib berish nakladnoylari */}
        <TabsContent value="supply-invoices" className="mt-6">
          <SupplyInvoicesTab />
        </TabsContent>

        {/* Handover Invoices Tab - Nakladnoylar */}
        <TabsContent value="handover" className="mt-6">
          <HandoverInvoicesTab />
        </TabsContent>

        {/* Archive Tab */}
        <TabsContent value="archive" className="mt-6">
          <ArchivedProductsTab />
        </TabsContent>

        {/* History Tab - Full sales history */}
        <TabsContent value="history" className="mt-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t('tash_sales_history')}</h2>
            <DirectSalesHistoryFull />
          </div>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-primary" />
            {t('tash_categories_by')}
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{t('tash_categories_count', { count: sections.length })}</Badge>
            <Link to="/crm/admin/categories">
              <Button variant="outline" size="sm">
                {t('tash_manage_categories')}
              </Button>
            </Link>
          </div>
        </div>
        
        {sections.length === 0 ? (
          <Card className="p-8 text-center">
            <Warehouse className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">{t('tash_no_categories')}</p>
            <Link to="/crm/admin/categories">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('tash_add_category')}
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sections.map((section) => {
              const isSelected = selectedSection === section.id;
              
              return (
                <Card 
                  key={section.id} 
                  className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                    isSelected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedSection(isSelected ? null : section.id)}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{section.zone}</p>
                      {section.shelf && (
                        <p className="text-xs text-muted-foreground truncate">{section.shelf}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('tash_products_label')}</span>
                    <Badge variant={section.current_count > 0 ? 'default' : 'secondary'}>
                      {section.current_count} dona
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Inventory Indicators - 8 Column Table */}
      <TashkentWarehouseIndicators 
        onAddProduct={() => setIsAddProductOpen(true)}
        canManageWarehouse={canManageWarehouse}
        selectedCategoryId={selectedSection}
        onClearFilter={() => setSelectedSection(null)}
      />

      </TabsContent>
      </Tabs>
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
// Full history component - using the imported DirectSalesHistory
function DirectSalesHistoryFull() {
  return <DirectSalesHistoryComponent />;
}
