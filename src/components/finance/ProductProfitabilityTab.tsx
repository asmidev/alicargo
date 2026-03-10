import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { useStoreDistribution } from '@/hooks/useStoreDistribution';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Exchange rates passed as props

interface ProductProfit {
  listingId: string;
  productName: string;
  storeName: string;
  storeId: string;
  buyingPrice: number;
  domesticShipping: number;
  internationalShipping: number;
  totalCost: number;
  sellingPrice: number;
  commissionRate: number;
  commissionAmount: number;
  avgDeliveryFee: number;
  amountReceived: number;
  tax: number;
  ownerShare: number;
  investorShare: number;
  boshMenejerShare: number;
  ownerNetPerUnit: number;
  salesCount: number;
  totalOwnerIncome: number;
  totalBMIncome: number;
  imageUrl: string | null;
  investorPct: number;
  boshMenejerPct: number;
}

interface ProductProfitabilityTabProps {
  usdToUzs?: number;
  cnyToUzs?: number;
}

export function ProductProfitabilityTab({ usdToUzs: usdToUzsProp, cnyToUzs: cnyToUzsProp }: ProductProfitabilityTabProps = {}) {
  const { t } = useTranslation();
  const { formatMoney, usdToUzs: contextUsdToUzs, cnyToUzs: contextCnyToUzs } = useFinanceCurrency();
  const usdToUzs = usdToUzsProp ?? contextUsdToUzs;
  const cnyToUzs = cnyToUzsProp ?? contextCnyToUzs;
  const { calculateDistribution } = useStoreDistribution();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Query 1: Listings with products and stores
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ['profitability-listings'],
    queryFn: async () => {
      return await fetchAllRows(
        supabase
          .from('marketplace_listings')
          .select('id, title, price, commission_rate, product_id, store_id, external_offer_id, image_url, marketplace_stores(id, name)')
          .not('product_id', 'is', null)
      );
    },
  });

  // Query 2: Product items costs grouped by product
  const { data: productItemCosts, isLoading: costsLoading } = useQuery({
    queryKey: ['profitability-product-costs'],
    queryFn: async () => {
      const items = await fetchAllRows(
        supabase
          .from('product_items')
          .select('product_id, unit_cost, unit_cost_currency, domestic_shipping_cost, international_shipping_cost')
      );
      // Group by product_id, average costs
      const grouped: Record<string, { unitCosts: number[]; domestic: number[]; international: number[] }> = {};
      for (const item of items || []) {
        if (!item.product_id) continue;
        if (!grouped[item.product_id]) {
          grouped[item.product_id] = { unitCosts: [], domestic: [], international: [] };
        }
        const g = grouped[item.product_id];
        // Convert CNY to UZS
        const currency = item.unit_cost_currency || 'CNY';
        const rate = currency === 'CNY' ? cnyToUzs : currency === 'USD' ? usdToUzs : 1;
        if (item.unit_cost) g.unitCosts.push(Number(item.unit_cost) * rate);
        if (item.domestic_shipping_cost) g.domestic.push(Number(item.domestic_shipping_cost) * rate);
        if (item.international_shipping_cost) g.international.push(Number(item.international_shipping_cost) * rate);
      }
      const result: Record<string, { avgUnitCost: number; avgDomestic: number; avgInternational: number }> = {};
      for (const [pid, g] of Object.entries(grouped)) {
        result[pid] = {
          avgUnitCost: g.unitCosts.length ? g.unitCosts.reduce((a, b) => a + b, 0) / g.unitCosts.length : 0,
          avgDomestic: g.domestic.length ? g.domestic.reduce((a, b) => a + b, 0) / g.domestic.length : 0,
          avgInternational: g.international.length ? g.international.reduce((a, b) => a + b, 0) / g.international.length : 0,
        };
      }
      return result;
    },
  });

  // Query 3: Delivered orders for sales count and avg delivery fee
  const { data: orderStats, isLoading: ordersLoading } = useQuery({
    queryKey: ['profitability-order-stats'],
    queryFn: async () => {
      const orders = await fetchAllRows(
        supabase
          .from('marketplace_orders')
          .select('items, delivery_fee, commission, status')
          .eq('fulfillment_status', 'delivered')
      );
      // Map external_offer_id -> { count, totalDeliveryFee, totalCommission, totalRevenue }
      const stats: Record<string, { count: number; totalDeliveryFee: number; totalCommission: number; totalRevenue: number }> = {};

      for (const order of orders || []) {
        const items = order.items as any;
        if (!items) continue;
        const itemList = Array.isArray(items) ? items : [items];

        const deliveryFee = Number(order.delivery_fee) || 0;
        const orderCommission = Number(order.commission) || 0;
        const perItemFee = itemList.length > 0 ? deliveryFee / itemList.length : 0;

        // Calculate items total revenue to apportion order-level commission
        const orderItemsTotal = itemList.reduce((sum: number, it: any) => {
          const qty = Number(it.quantity || it.count || 1);
          const price = Number(it.price || it.sellPrice || 0);
          return sum + (price * qty);
        }, 0);

        for (const item of itemList) {
          const offerId = String(item.offerId || item.offer_id || item.shopSku || '');
          if (!offerId) continue;
          if (!stats[offerId]) stats[offerId] = { count: 0, totalDeliveryFee: 0, totalCommission: 0, totalRevenue: 0 };

          const qty = Number(item.quantity || item.count || 1);
          const price = Number(item.price || item.sellPrice || 0);
          const itemRevenue = price * qty;

          // Use item.commission if exists (Uzum), else apportion order.commission (Yandex)
          let commission = Number(item.commission || item.commissionAmount || 0);
          if (!commission && orderCommission > 0 && orderItemsTotal > 0) {
            commission = orderCommission * (itemRevenue / orderItemsTotal);
          }

          stats[offerId].count += qty;
          stats[offerId].totalDeliveryFee += perItemFee;
          stats[offerId].totalCommission += commission;
          stats[offerId].totalRevenue += itemRevenue;
        }
      }
      return stats;
    },
  });

  // Compute profitability data
  const profitData = useMemo((): ProductProfit[] => {
    if (!listings || !productItemCosts || !orderStats) return [];

    return listings.map((listing: any) => {
      const costs = listing.product_id ? productItemCosts[listing.product_id] : null;
      const buyingPrice = costs?.avgUnitCost || 0;
      const domesticShipping = costs?.avgDomestic || 0;
      const internationalShipping = costs?.avgInternational || 0;
      const totalCost = buyingPrice + domesticShipping + internationalShipping;

      const sellingPrice = Number(listing.price) || 0;

      const offerId = listing.external_offer_id || '';
      const stats = orderStats[offerId] || { count: 0, totalDeliveryFee: 0, totalCommission: 0, totalRevenue: 0 };
      const salesCount = stats.count;
      const avgDeliveryFee = salesCount > 0 ? stats.totalDeliveryFee / salesCount : 0;

      let commissionRate = Number(listing.commission_rate) || 0;
      // Fallback: Calculate average commission rate from historical orders if not set
      if (commissionRate === 0 && stats.totalRevenue > 0) {
        commissionRate = (stats.totalCommission / stats.totalRevenue) * 100;
        // Round to 1 decimal place to prevent floating point chaos
        commissionRate = Math.round(commissionRate * 10) / 10;
      }

      // DB Data corruption guard: Prevent impossible listing commissions (e.g. 5000% from absolute UZS)
      if (commissionRate > 100 && sellingPrice > 0) {
        commissionRate = Math.round((commissionRate / sellingPrice) * 1000) / 10;
      }
      // If after all conversions it's still > 50% or 0%, fallback to a safe 20% standard Uzum average.
      if (commissionRate > 50 || commissionRate === 0) {
        commissionRate = 20;
      }

      const commissionAmount = sellingPrice * (commissionRate / 100);

      const amountReceived = sellingPrice - commissionAmount - avgDeliveryFee;
      const dist = calculateDistribution(listing.store_id, amountReceived);
      const ownerNetPerUnit = dist.ownerNet;

      const storeName = (listing.marketplace_stores as any)?.name || t('unknown');

      return {
        listingId: listing.id,
        productName: listing.title || t('unknown_product'),
        storeName,
        storeId: listing.store_id,
        buyingPrice,
        domesticShipping,
        internationalShipping,
        totalCost,
        sellingPrice,
        commissionRate,
        commissionAmount,
        avgDeliveryFee,
        amountReceived,
        tax: dist.taxAmount,
        ownerShare: dist.ownerShare,
        investorShare: dist.investorShare,
        boshMenejerShare: dist.boshMenejerShare,
        ownerNetPerUnit,
        salesCount,
        totalOwnerIncome: ownerNetPerUnit * salesCount,
        totalBMIncome: dist.boshMenejerShare * salesCount,
        imageUrl: listing.image_url,
        investorPct: dist.investorPct,
        boshMenejerPct: dist.boshMenejerPct,
      };
    });
  }, [listings, productItemCosts, orderStats, t, calculateDistribution]);

  // Filters
  const filtered = useMemo(() => {
    let data = profitData;
    if (storeFilter !== 'all') {
      data = data.filter(d => d.storeId === storeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(d => d.productName.toLowerCase().includes(q) || d.storeName.toLowerCase().includes(q));
    }
    return data;
  }, [profitData, storeFilter, search]);

  const stores = useMemo(() => {
    const map = new Map<string, string>();
    profitData.forEach(d => map.set(d.storeId, d.storeName));
    return Array.from(map.entries());
  }, [profitData]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isLoading = listingsLoading || costsLoading || ordersLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex justify-between items-center py-1.5 px-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", color)}>{value}</span>
    </div>
  );

  const BoldRow = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-md text-sm font-semibold">
      <span>{label}</span>
      <span className={color}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('pp_search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('all_stores')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_stores')}</SelectItem>
            {stores.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-50" />
          <p>{t('noData')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isExpanded = expandedIds.has(item.listingId);
            return (
              <Card
                key={item.listingId}
                interactive
                className="overflow-hidden"
                onClick={() => toggleExpand(item.listingId)}
              >
                {/* Header */}
                <div className="flex items-center gap-3 p-4">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.storeName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-emerald-600">{formatMoney(item.ownerNetPerUnit)}</p>
                    <p className="text-xs text-muted-foreground">{item.salesCount} {t('pp_sold')}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>

                {/* Expanded waterfall */}
                {isExpanded && (
                  <CardContent className="pt-0 pb-4 space-y-1 border-t">
                    <div className="mt-3 space-y-0.5">
                      {/* Cost section */}
                      <Row label={t('pp_buying_price')} value={formatMoney(item.buyingPrice)} color="text-destructive" />
                      <Row label={t('pp_domestic_shipping')} value={formatMoney(item.domesticShipping)} color="text-destructive" />
                      <Row label={t('pp_international_shipping')} value={formatMoney(item.internationalShipping)} color="text-destructive" />
                      <BoldRow label={t('pp_total_cost')} value={formatMoney(item.totalCost)} color="text-destructive" />

                      <div className="h-2" />

                      {/* Revenue section */}
                      <Row label={t('pp_selling_price')} value={formatMoney(item.sellingPrice)} />
                      <Row label={`${t('pp_commission')} (${item.commissionRate}%)`} value={`-${formatMoney(item.commissionAmount)}`} color="text-destructive" />
                      <Row label={t('pp_delivery_fee')} value={`-${formatMoney(item.avgDeliveryFee)}`} color="text-destructive" />
                      <BoldRow label={t('pp_amount_received')} value={formatMoney(item.amountReceived)} color="text-primary" />

                      <div className="h-2" />

                      {/* Distribution */}
                      <Row label={`BM ulushi (${item.boshMenejerPct}%)`} value={`-${formatMoney(item.boshMenejerShare)}`} color="text-amber-600" />
                      {item.investorPct > 0 && (
                        <Row label={`${t('fin_pl_investor_bm')} (${item.investorPct}%)`} value={`-${formatMoney(item.investorShare)}`} color="text-amber-600" />
                      )}
                      <Row label={`${t('pp_tax')} (4%)`} value={`-${formatMoney(item.tax)}`} color="text-amber-600" />
                      <BoldRow label={t('pp_owner_net')} value={formatMoney(item.ownerNetPerUnit)} color="text-emerald-600" />

                      <div className="h-2" />

                      {/* Totals */}
                      <Row label={t('pp_sales_count')} value={String(item.salesCount)} />
                      <BoldRow label={t('pp_total_owner_income')} value={formatMoney(item.totalOwnerIncome)} color="text-emerald-600" />
                      <BoldRow label="BM jami daromadi" value={formatMoney(item.totalBMIncome)} color="text-blue-600" />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
