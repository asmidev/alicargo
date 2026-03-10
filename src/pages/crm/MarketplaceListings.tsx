import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { InlineNameInput } from "@/components/inventory/InlineNameInput";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileListingCard } from "@/components/marketplace/MobileListingCard";
import { ListingAnalyticsSheet } from "@/components/marketplace/ListingAnalyticsSheet";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Package, 
  Search, 
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Box,
  Archive,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { TableLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useFBOData } from "@/hooks/useFBOData";
import { FBOSummaryCard } from "@/components/marketplace/FBOSummaryCard";
import { FBOReturnsTable } from "@/components/marketplace/FBOReturnsTable";
import { FBOInvoiceHistory } from "@/components/marketplace/FBOInvoiceHistory";
import { FBOOrdersTable } from "@/components/marketplace/FBOOrdersTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MarketplaceListing {
  id: string;
  store_id: string;
  product_id: string | null;
  external_sku: string;
  external_product_id: string | null;
  fulfillment_type: string | null;
  title: string | null;
  price: number | null;
  currency: string;
  stock: number;
  stock_fbs: number | null;
  stock_fbu: number | null;
  stock_fby: number | null;
  status: string;
  moderation_status: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
  commission_rate: number | null;
  cost_price: number | null;
  compare_price: number | null;
  image_url: string | null;
  category_title: string | null;
  product_rank: string | null;
  marketplace_stores: {
    name: string;
    platform: string;
  };
  products: {
    name: string;
    main_image_url: string | null;
  } | null;
}

// SKU-level guruhlangan qator
interface SkuRow {
  sku: string;
  listing: MarketplaceListing; // representative listing
  fbsStock: number;
  fbuStock: number;
  fbyStock: number;
  fulfillmentTypes: string[];
  listings: MarketplaceListing[];
}

// Mega-guruh: bir xil external_product_id ostidagi SKU'lar
interface ProductGroup {
  key: string;
  skuRows: SkuRow[];
  primaryListing: MarketplaceListing;
}

// Barcha listinglarni yuklaymiz (max 3000), frontend-da grouplaymiz
const PAGE_SIZE = 3000;
const GROUP_PAGE_SIZE = 50;

export default function MarketplaceListings() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [rankFilter, setRankFilter] = useState<string>(searchParams.get('rank') || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeStatCard, setActiveStatCard] = useState<string | null>(searchParams.get('rank') ? `rank_${searchParams.get('rank')}` : null);
  const [fboDialogOpen, setFboDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Sync rankFilter from URL params on mount
  useEffect(() => {
    const urlRank = searchParams.get('rank');
    if (urlRank && ['A', 'B', 'C', 'D', 'N'].includes(urlRank)) {
      setRankFilter(urlRank);
      setActiveStatCard(`rank_${urlRank}`);
    }
  }, []);
  // Get Uzum stores for FBO data
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

  // Filter Uzum stores for FBO aggregation
  const uzumStores = stores?.filter(s => s.platform === 'uzum') || [];
  
  // Determine if we should show FBO (Uzum platform or specific Uzum store selected)
  const selectedStore = stores?.find(s => s.id === storeFilter);
  const isUzumContext = platformFilter === 'uzum' || selectedStore?.platform === 'uzum' || (platformFilter === 'all' && storeFilter === 'all');
  const selectedUzumStoreId = storeFilter !== 'all' && selectedStore?.platform === 'uzum' ? storeFilter : null;
  
  // Pass Uzum stores for aggregation when no specific store selected
  const fboData = useFBOData(
    selectedUzumStoreId, 
    !selectedUzumStoreId && isUzumContext ? uzumStores : undefined
  );


  // PHASE 11: Get GLOBAL counts (not page-subset) for accurate statistics
  const { data: globalCounts } = useQuery({
    queryKey: ['marketplace-listings-global-counts', platformFilter, storeFilter],
    queryFn: async () => {
      const buildQuery = (extraFilters?: (q: any) => any) => {
        let q = supabase
          .from('marketplace_listings')
          .select('id, marketplace_stores!inner(platform)', { count: 'exact', head: true });
        if (storeFilter !== 'all') q = q.eq('store_id', storeFilter);
        else if (platformFilter !== 'all') q = q.eq('marketplace_stores.platform', platformFilter);
        if (extraFilters) q = extraFilters(q);
        return q;
      };

      const [active, lowStock, outOfStock, archived, rankA, rankB, rankC, rankD, rankN] = await Promise.all([
        buildQuery(q => q.eq('status', 'active')),
        buildQuery(q => q.gt('stock', 0).lt('stock', 5)),
        buildQuery(q => q.eq('stock', 0)),
        buildQuery(q => q.in('status', ['archived', 'inactive'])),
        buildQuery(q => q.eq('product_rank', 'A')),
        buildQuery(q => q.eq('product_rank', 'B')),
        buildQuery(q => q.eq('product_rank', 'C')),
        buildQuery(q => q.eq('product_rank', 'D')),
        buildQuery(q => q.is('product_rank', null)),
      ]);

      return {
        active: active.count || 0,
        lowStock: lowStock.count || 0,
        outOfStock: outOfStock.count || 0,
        archived: archived.count || 0,
        rankA: rankA.count || 0,
        rankB: rankB.count || 0,
        rankC: rankC.count || 0,
        rankD: rankD.count || 0,
        rankN: rankN.count || 0,
      };
    },
  });

  // Get total count for pagination (with status filter)
  const { data: totalCount } = useQuery({
    queryKey: ['marketplace-listings-count', platformFilter, storeFilter, statusFilter, fulfillmentFilter, stockFilter, rankFilter],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_listings')
        .select('id, marketplace_stores!inner(platform)', { count: 'exact', head: true });

      if (storeFilter !== 'all') {
        query = query.eq('store_id', storeFilter);
      } else if (platformFilter !== 'all') {
        query = query.eq('marketplace_stores.platform', platformFilter);
      }

      if (statusFilter === 'archived_inactive') {
        query = query.in('status', ['archived', 'inactive']);
      } else if (statusFilter === 'out_of_stock') {
        query = query.eq('stock', 0);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (fulfillmentFilter !== 'all') {
        query = query.eq('fulfillment_type', fulfillmentFilter);
      }

      if (stockFilter === 'low') {
        query = query.gt('stock', 0).lt('stock', 5);
      } else if (stockFilter === 'out') {
        query = query.eq('stock', 0);
      }

      if (rankFilter !== 'all') {
        if (rankFilter === 'N') {
          query = query.is('product_rank', null);
        } else {
          query = query.eq('product_rank', rankFilter);
        }
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: listings, isLoading } = useQuery({
    queryKey: ['marketplace-listings', platformFilter, storeFilter, statusFilter, fulfillmentFilter, stockFilter, rankFilter],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_listings')
        .select(`
          *,
          marketplace_stores!inner (
            name,
            platform
          ),
          products (
            name,
            main_image_url
          )
        `)
        .order('title', { ascending: true });

      if (storeFilter !== 'all') {
        query = query.eq('store_id', storeFilter);
      } else if (platformFilter !== 'all') {
        query = query.eq('marketplace_stores.platform', platformFilter);
      }

      if (statusFilter === 'archived_inactive') {
        query = query.in('status', ['archived', 'inactive']);
      } else if (statusFilter === 'out_of_stock') {
        query = query.eq('stock', 0);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (fulfillmentFilter !== 'all') {
        query = query.eq('fulfillment_type', fulfillmentFilter);
      }

      if (stockFilter === 'low') {
        query = query.gt('stock', 0).lt('stock', 5);
      } else if (stockFilter === 'out') {
        query = query.eq('stock', 0);
      }

      if (rankFilter !== 'all') {
        if (rankFilter === 'N') {
          query = query.is('product_rank', null);
        } else {
          query = query.eq('product_rank', rankFilter);
        }
      }

      const data = await fetchAllRows(query);
      return data as unknown as MarketplaceListing[];
    },
  });

  // Reset page when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleStatCardClick = (card: string) => {
    if (activeStatCard === card) {
      // Toggle off - reset filters
      setStatusFilter('all');
      setStockFilter('all');
      setRankFilter('all');
      setActiveStatCard(null);
      setSearchParams({});
    } else {
      setActiveStatCard(card);
      // Reset all filters first
      setStatusFilter('all');
      setStockFilter('all');
      setRankFilter('all');
      
      if (card === 'total') {
        // already reset
      } else if (card === 'active') {
        setStatusFilter('active');
      } else if (card === 'low_stock') {
        setStockFilter('low');
      } else if (card === 'out_of_stock') {
        setStockFilter('out');
      } else if (card === 'archived') {
        setStatusFilter('archived_inactive');
      } else if (card.startsWith('rank_')) {
        const rank = card.replace('rank_', '');
        setRankFilter(rank);
        setSearchParams({ rank });
      }
    }
    setCurrentPage(1);
  };

  const filteredListings = listings?.filter(listing => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      listing.title?.toLowerCase().includes(search) ||
      listing.external_sku.toLowerCase().includes(search) ||
      listing.products?.name?.toLowerCase().includes(search)
    );
  });

  // Step 1: SKU + store_id bo'yicha guruhlash (FBS/FBU bir xil SKU uchun birlashadi)
  const allGroupedListings = useMemo((): ProductGroup[] => {
    if (!filteredListings) return [];
    
    // SKU + store_id bo'yicha guruhlash
    const skuGroups = new Map<string, MarketplaceListing[]>();
    filteredListings.forEach(listing => {
      const key = `sku_${listing.external_sku}_store_${listing.store_id}`;
      if (!skuGroups.has(key)) skuGroups.set(key, []);
      skuGroups.get(key)!.push(listing);
    });

    // Har bir SKU guruhidan SkuRow yasash
    const skuRows: SkuRow[] = Array.from(skuGroups.values()).map(listings => {
      const primary = listings[0];
      const fulfillmentTypes = [...new Set(listings.map(l => l.fulfillment_type).filter(Boolean))] as string[];
      
      // stock_fbs/stock_fbu/stock_fby to'g'ridan-to'g'ri ishlatish
      const fbsRow = listings.find(l => (l.fulfillment_type || '').toLowerCase() === 'fbs');
      const fbuRow = listings.find(l => ['fbu', 'fbo'].includes((l.fulfillment_type || '').toLowerCase()));
      const fbyRow = listings.find(l => (l.fulfillment_type || '').toLowerCase() === 'fby');

      const fbsStock = fbsRow?.stock_fbs ?? fbsRow?.stock ?? 0;
      const fbuStock = fbuRow?.stock_fbu ?? fbuRow?.stock ?? 0;
      const fbyStock = fbyRow?.stock_fby ?? fbyRow?.stock ?? 0;

      return {
        sku: primary.external_sku,
        listing: primary,
        fbsStock,
        fbuStock,
        fbyStock,
        fulfillmentTypes,
        listings,
      };
    });

    // Step 2: external_product_id + store_id bo'yicha mega-guruh (faqat 2+ SKU bo'lganda expandable)
    const megaGroups = new Map<string, SkuRow[]>();
    skuRows.forEach(row => {
      const l = row.listing;
      const megaKey = l.product_id
        ? `pid_${l.product_id}_store_${l.store_id}`
        : l.external_product_id
          ? `ext_${l.external_product_id}_store_${l.store_id}`
          : `sku_${row.sku}_store_${l.store_id}`;
      if (!megaGroups.has(megaKey)) megaGroups.set(megaKey, []);
      megaGroups.get(megaKey)!.push(row);
    });

    return Array.from(megaGroups.entries()).map(([key, rows]) => ({
      key,
      skuRows: rows,
      primaryListing: rows[0].listing,
    }));
  }, [filteredListings]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-emerald-600 dark:bg-emerald-700"><CheckCircle className="h-3 w-3 mr-1" />{t('mpl_status_active')}</Badge>;
      case 'inactive':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />{t('mpl_status_inactive')}</Badge>;
      case 'pending':
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />{t('mpl_status_pending')}</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{t('mpl_status_error')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: currency === 'UZS' ? 'UZS' : currency === 'RUB' ? 'RUB' : 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Pagination
  const totalGroupCount = allGroupedListings.length;
  const totalGroupPages = Math.ceil(totalGroupCount / GROUP_PAGE_SIZE);
  const groupedListings = useMemo(() => {
    const from = (currentPage - 1) * GROUP_PAGE_SIZE;
    const to = from + GROUP_PAGE_SIZE;
    return allGroupedListings.slice(from, to);
  }, [allGroupedListings, currentPage]);

  const totalPages = totalGroupPages;

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      // Show all pages if few enough
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis');
      }
      
      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  // Use global counts instead of page-subset counts
  const activeCount = globalCounts?.active || 0;
  const lowStockCount = globalCounts?.lowStock || 0;
  const outOfStockCount = globalCounts?.outOfStock || 0;
  const archivedCount = globalCounts?.archived || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            {t('mpl_title')}
          </h1>
          <p className="text-muted-foreground">
            {totalGroupCount} ta mahsulot guruhi · {totalCount || 0} ta listing
          </p>
        </div>
      </div>

      {/* Platform + Store Chip Selector */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'uzum', 'yandex'] as const).map((pt) => {
            const isActive = platformFilter === pt && storeFilter === 'all';
            const ptColor = pt === 'uzum' ? 'text-purple-500' : pt === 'yandex' ? 'text-yellow-500' : 'text-primary';
            const ptBg = pt === 'uzum' ? 'bg-purple-500/10' : pt === 'yandex' ? 'bg-yellow-500/10' : 'bg-primary/10';
            const ptCount = pt === 'uzum' ? uzumStores.length : pt === 'yandex' ? (stores?.filter(s => s.platform === 'yandex') || []).length : (stores?.length || 0);
            return (
              <button
                key={pt}
                onClick={() => {
                  handleFilterChange(setPlatformFilter, pt);
                  handleFilterChange(setStoreFilter, 'all');
                }}
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
              onClick={() => handleFilterChange(setStoreFilter, 'all')}
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
                  onClick={() => handleFilterChange(setStoreFilter, isSelected ? 'all' : store.id)}
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
      <div className={cn("grid gap-4", isMobile ? "grid-cols-2" : "grid-cols-1 md:grid-cols-5")}>
        <Card 
          interactive 
          onClick={() => handleStatCardClick('total')}
          className={cn(activeStatCard === 'total' && "ring-2 ring-primary")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('mpl_total_listings')}</p>
                <p className="text-2xl font-bold">{totalCount || 0}</p>
              </div>
              <Package className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card 
          interactive 
          onClick={() => handleStatCardClick('active')}
          className={cn(activeStatCard === 'active' && "ring-2 ring-primary")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('mpl_active')}</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card 
          interactive 
          onClick={() => handleStatCardClick('low_stock')}
          className={cn(activeStatCard === 'low_stock' && "ring-2 ring-primary")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('mpl_low_stock')}</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{lowStockCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card 
          interactive 
          onClick={() => handleStatCardClick('out_of_stock')}
          className={cn(activeStatCard === 'out_of_stock' && "ring-2 ring-primary")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('mpl_out_of_stock')}</p>
                <p className="text-2xl font-bold text-destructive">{outOfStockCount}</p>
              </div>
              <Box className="h-8 w-8 text-destructive opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card 
          interactive 
          onClick={() => handleStatCardClick('archived')}
          className={cn(activeStatCard === 'archived' && "ring-2 ring-primary")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('mpl_archived')}</p>
                <p className="text-2xl font-bold text-slate-500 dark:text-slate-400">{archivedCount}</p>
              </div>
              <Archive className="h-8 w-8 text-slate-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rank Cards */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-3" : "grid-cols-5")}>
        {[
          { key: 'A', label: 'A-Rank', color: 'text-emerald-600 dark:text-emerald-400', iconColor: 'text-emerald-500', count: globalCounts?.rankA || 0 },
          { key: 'B', label: 'B-Rank', color: 'text-blue-600 dark:text-blue-400', iconColor: 'text-blue-500', count: globalCounts?.rankB || 0 },
          { key: 'C', label: 'C-Rank', color: 'text-amber-600 dark:text-amber-400', iconColor: 'text-amber-500', count: globalCounts?.rankC || 0 },
          { key: 'D', label: 'D-Rank', color: 'text-red-600 dark:text-red-400', iconColor: 'text-red-500', count: globalCounts?.rankD || 0 },
          { key: 'N', label: 'Yangi', color: 'text-slate-600 dark:text-slate-400', iconColor: 'text-slate-400', count: globalCounts?.rankN || 0 },
        ].map(rank => (
          <Card
            key={rank.key}
            interactive
            onClick={() => handleStatCardClick(`rank_${rank.key}`)}
            className={cn(activeStatCard === `rank_${rank.key}` && "ring-2 ring-primary")}
          >
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{rank.label}</p>
                  <p className={cn("text-xl font-bold", rank.color)}>{rank.count}</p>
                </div>
                <Star className={cn("h-6 w-6 opacity-80", rank.iconColor)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={fboDialogOpen} onOpenChange={setFboDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('mpl_fbo_title')}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="orders">
                {t('mpl_fbo_orders')} ({fboData.orders?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="invoices">
                {t('mpl_fbo_invoices')} ({fboData.invoices?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="returns">
                {t('mpl_fbo_returns')} ({fboData.returns?.length || 0})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="orders" className="mt-4">
              <FBOOrdersTable 
                orders={fboData.orders || []} 
                isLoading={fboData.isLoading}
                isAggregated={fboData.isAggregated}
              />
            </TabsContent>
            <TabsContent value="invoices" className="mt-4">
              <FBOInvoiceHistory 
                invoices={fboData.invoices} 
                isLoading={fboData.isLoading} 
              />
            </TabsContent>
            <TabsContent value="returns" className="mt-4">
              <FBOReturnsTable 
                returns={fboData.returns} 
                isLoading={fboData.isLoading} 
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className={cn("flex gap-4", isMobile ? "flex-col" : "flex-wrap")}>
            <div className={cn(isMobile ? "w-full" : "flex-1 min-w-[200px]")}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('mpl_search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
              <SelectTrigger className={cn("min-h-[44px]", isMobile ? "w-full" : "w-[150px]")}><SelectValue placeholder={t('mpl_filter_status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('mpl_filter_all')}</SelectItem>
                <SelectItem value="active">{t('mpl_filter_active')}</SelectItem>
                <SelectItem value="inactive">{t('mpl_filter_inactive')}</SelectItem>
                <SelectItem value="archived_inactive">{t('mpl_archived')}</SelectItem>
                <SelectItem value="pending">{t('mpl_filter_pending')}</SelectItem>
                <SelectItem value="error">{t('mpl_filter_error')}</SelectItem>
                <SelectItem value="out_of_stock">{t('mpl_out_of_stock')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fulfillmentFilter} onValueChange={(v) => handleFilterChange(setFulfillmentFilter, v)}>
              <SelectTrigger className={cn("min-h-[44px]", isMobile ? "w-full" : "w-[130px]")}><SelectValue placeholder="Turi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('mpl_filter_all')}</SelectItem>
                <SelectItem value="fbs">FBS</SelectItem>
                <SelectItem value="fbu">FBU (FBO)</SelectItem>
                <SelectItem value="fby">FBY</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Listings */}
      {isLoading ? (
        <Card><CardContent className="p-0"><TableLoadingSkeleton rows={8} /></CardContent></Card>
      ) : isMobile ? (
        /* Mobile: Card list */
        <div className="space-y-2">
          {groupedListings?.length ? (
            groupedListings.map(group => {
              const primary = group.primaryListing;
              const allFulfillmentTypes = [...new Set(group.skuRows.flatMap(r => r.fulfillmentTypes))];
              const totalStock = group.skuRows.reduce((s, r) => s + r.fbsStock + r.fbuStock + r.fbyStock, 0);
              const displayListing = { ...primary, stock: totalStock, _fulfillmentTypes: allFulfillmentTypes };
              return (
                <MobileListingCard
                  key={primary.id}
                  listing={displayListing as any}
                  formatCurrency={formatCurrency}
                  onClick={() => setSelectedListing(primary)}
                />
              );
            })
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              {t('mpl_no_products')}
            </Card>
          )}

          {/* Mobile Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {(currentPage - 1) * GROUP_PAGE_SIZE + 1}–{Math.min(currentPage * GROUP_PAGE_SIZE, totalGroupCount)} / {totalGroupCount} guruh
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>←</Button>
                <span className="text-sm font-medium px-2">{currentPage}/{totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>→</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Desktop: Table */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">{t('mpl_th_product')}</TableHead>
                  <TableHead>{t('mpl_th_store')}</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>{t('mpl_th_price')}</TableHead>
                  <TableHead className="text-center">FBS</TableHead>
                  <TableHead className="text-center">FBU/FBO</TableHead>
                  <TableHead className="text-center">FBY</TableHead>
                  <TableHead>{t('mpl_th_status')}</TableHead>
                  <TableHead>{t('mpl_th_sync')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedListings?.map(group => {
                  const listing = group.primaryListing;
                  const { skuRows } = group;
                  const isExpandable = skuRows.length > 1;
                  const isExpanded = expandedGroups.has(group.key);
                  const allFulfillmentTypes = [...new Set(skuRows.flatMap(r => r.fulfillmentTypes))];
                  const hasActive = skuRows.some(r => r.listings.some(l => l.status === 'active'));
                  const displayStatus = hasActive ? 'active' : listing.status;

                  // Agar faqat 1 ta SKU bo'lsa, to'g'ridan-to'g'ri ko'rsatamiz
                  const singleRow = skuRows.length === 1 ? skuRows[0] : null;
                  const totalFbs = skuRows.reduce((s, r) => s + r.fbsStock, 0);
                  const totalFbu = skuRows.reduce((s, r) => s + r.fbuStock, 0);
                  const totalFby = skuRows.reduce((s, r) => s + r.fbyStock, 0);

                  const StockCell = ({ value }: { value: number }) => (
                    <span className={cn("font-semibold",
                      value === 0 ? 'text-destructive' : value < 5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                    )}>{value}</span>
                  );

                  return (
                    <React.Fragment key={group.key}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/70"
                        onClick={() => {
                          if (isExpandable) {
                            setExpandedGroups(prev => {
                              const next = new Set(prev);
                              if (next.has(group.key)) next.delete(group.key);
                              else next.add(group.key);
                              return next;
                            });
                          } else {
                            setSelectedListing(listing);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {(listing.image_url || listing.products?.main_image_url) ? (
                              <img src={listing.image_url || listing.products?.main_image_url || ''} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium line-clamp-1 flex items-center gap-1">
                                {isExpandable && (
                                  <span className="text-muted-foreground text-xs mr-0.5 flex-shrink-0">
                                    {isExpanded ? '▼' : '▶'}
                                  </span>
                                )}
                                {listing.title || listing.products?.name || t('mpl_unnamed')}
                              </div>
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {allFulfillmentTypes.map(ft => (
                                  <Badge key={ft} variant="outline" className={cn("text-xs",
                                    ft.toLowerCase() === 'fbs' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200',
                                    (ft.toLowerCase() === 'fbu' || ft.toLowerCase() === 'fbo') && 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-purple-200',
                                    ft.toLowerCase() === 'fby' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200',
                                  )}>{ft.toUpperCase()}</Badge>
                                ))}
                                {isExpandable && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    {skuRows.length} variant
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const uniqueStores = [...new Map(
                              skuRows.map(r => [r.listing.store_id, r.listing.marketplace_stores])
                            ).values()];
                            if (uniqueStores.length <= 1) {
                              return (
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className={listing.marketplace_stores.platform === 'uzum' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}>
                                    {listing.marketplace_stores.platform.toUpperCase()}
                                  </Badge>
                                  <span className="text-sm">{listing.marketplace_stores.name}</span>
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-col gap-1">
                                {uniqueStores.map((store: any) => (
                                  <div key={store.id} className="flex items-center gap-2">
                                    <Badge variant="secondary" className={store.platform === 'uzum' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}>
                                      {store.platform.toUpperCase()}
                                    </Badge>
                                    <span className="text-sm">{store.name}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="font-mono text-sm" onClick={(e) => e.stopPropagation()}>
                          {singleRow ? (
                            <InlineNameInput
                              value={listing.external_sku}
                              onSave={async (newSku) => {
                                const { error } = await supabase
                                  .from('marketplace_listings')
                                  .update({ external_sku: newSku })
                                  .eq('id', listing.id);
                                if (error) throw error;
                                queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
                                toast.success('SKU yangilandi');
                              }}
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">{skuRows.length} ta SKU</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(listing.price, listing.currency)}</TableCell>
                        <TableCell className="text-center"><StockCell value={totalFbs} /></TableCell>
                        <TableCell className="text-center"><StockCell value={totalFbu} /></TableCell>
                        <TableCell className="text-center"><StockCell value={totalFby} /></TableCell>
                        <TableCell>{getStatusBadge(displayStatus)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {listing.last_synced_at ? format(new Date(listing.last_synced_at), 'dd.MM HH:mm') : '-'}
                        </TableCell>
                      </TableRow>

                      {isExpanded && skuRows.map(row => {
                        const childImage = (row.listing as any).image_url || row.listing.products?.main_image_url;
                        const childTitle = row.listing.title || row.listing.products?.name || row.sku;
                        return (
                        <TableRow
                          key={`${group.key}_sku_${row.sku}`}
                          className="bg-muted/20 hover:bg-muted/40 cursor-pointer border-l-2 border-l-primary/20"
                          onClick={() => setSelectedListing(row.listing)}
                        >
                          <TableCell className="pl-10">
                            <div className="flex items-center gap-2.5">
                              <span className="opacity-40 text-xs">└</span>
                              {childImage ? (
                                <img src={childImage} alt="" className="w-9 h-9 rounded object-cover shrink-0 border border-border/50" />
                              ) : (
                                <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[220px]">{childTitle}</p>
                                <p className="text-[11px] text-muted-foreground font-mono">SKU: {row.sku}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0',
                                row.listing.marketplace_stores.platform === 'uzum'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                              )}>
                                {row.listing.marketplace_stores.platform.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate max-w-[100px]">{row.listing.marketplace_stores.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                            <InlineNameInput
                              value={row.sku}
                              onSave={async (newSku) => {
                                const { error } = await supabase
                                  .from('marketplace_listings')
                                  .update({ external_sku: newSku })
                                  .eq('id', row.listing.id);
                                if (error) throw error;
                                queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
                                toast.success('SKU yangilandi');
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{formatCurrency(row.listing.price, row.listing.currency)}</TableCell>
                          <TableCell className="text-center"><StockCell value={row.fbsStock} /></TableCell>
                          <TableCell className="text-center"><StockCell value={row.fbuStock} /></TableCell>
                          <TableCell className="text-center"><StockCell value={row.fbyStock} /></TableCell>
                          <TableCell>{getStatusBadge(row.listing.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.listing.last_synced_at ? format(new Date(row.listing.last_synced_at), 'dd.MM HH:mm') : '-'}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                {!groupedListings?.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">{t('mpl_no_products')}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {(currentPage - 1) * GROUP_PAGE_SIZE + 1}–{Math.min(currentPage * GROUP_PAGE_SIZE, totalGroupCount)} / {totalGroupCount} guruh
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                    </PaginationItem>
                    {getPageNumbers().map((page, idx) => (
                      <PaginationItem key={idx}>
                        {page === 'ellipsis' ? <PaginationEllipsis /> : (
                          <PaginationLink onClick={() => setCurrentPage(page)} isActive={currentPage === page} className="cursor-pointer">{page}</PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ListingAnalyticsSheet
        listing={selectedListing}
        open={!!selectedListing}
        onOpenChange={(open) => { if (!open) setSelectedListing(null); }}
        onSelectListing={(listing) => setSelectedListing(listing)}
      />
    </div>
  );
}
