import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStoreDistribution } from '@/hooks/useStoreDistribution';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Search, TrendingUp, TrendingDown, ShoppingCart, Percent, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatusFilterType } from './FinanceIncomeByStatus';

const PENDING_STATUSES = ['pending', 'shipped', 'processing', 'CREATED', 'PACKING', 'DELIVERING', 'PICKUP', 'READY_TO_SHIP', 'SHIPPED'];
const COMPLETED_STATUSES = ['delivered', 'COMPLETED', 'DELIVERED'];
const REJECTED_STATUSES = ['cancelled', 'canceled', 'returned', 'CANCELLED', 'CANCELED', 'RETURNED'];

const STATUS_CONFIG: Record<StatusFilterType, { statuses: string[]; dateCol: 'delivered_at' | 'ordered_at'; label: string; color: string }> = {
  completed: { statuses: COMPLETED_STATUSES, dateCol: 'delivered_at', label: 'Qabul qilingan', color: 'bg-green-500/20 text-green-600 border-green-500/30' },
  pending: { statuses: PENDING_STATUSES, dateCol: 'ordered_at', label: 'Kutilmoqda', color: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  rejected: { statuses: REJECTED_STATUSES, dateCol: 'ordered_at', label: 'Rad etilgan', color: 'bg-red-500/20 text-red-600 border-red-500/30' },
};

// Exchange rates are now fetched from the edge function via props

interface FinanceSaleBreakdownTabProps {
  selectedMonth: number;
  selectedYear: number;
  usdToUzs?: number;
  cnyToUzs?: number;
  statusFilter?: StatusFilterType;
  onClearFilter?: () => void;
}

export function FinanceSaleBreakdownTab({ selectedMonth, selectedYear, usdToUzs: usdToUzsProp, cnyToUzs: cnyToUzsProp, statusFilter, onClearFilter }: FinanceSaleBreakdownTabProps) {
  const { t } = useTranslation();
  const { formatMoney, usdToUzs: contextUsdToUzs, cnyToUzs: contextCnyToUzs } = useFinanceCurrency();
  const usdToUzs = usdToUzsProp ?? contextUsdToUzs;
  const cnyToUzs = cnyToUzsProp ?? contextCnyToUzs;
  const isMobile = useIsMobile();
  const { calculateDistribution } = useStoreDistribution();
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'margin'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const periodStart = new Date(selectedYear, selectedMonth, 1).toISOString();
  const periodEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).toISOString();

  const activeFilter = statusFilter || 'completed';
  const filterConfig = STATUS_CONFIG[activeFilter];

  // Fetch orders for the period based on status filter
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['sale-breakdown-orders', selectedMonth, selectedYear, activeFilter],
    queryFn: async () => {
      const data = await fetchAllRows(
        supabase
          .from('marketplace_orders')
          .select('id, store_id, external_order_id, order_number, total_amount, commission, delivery_cost, items, currency, ordered_at, delivered_at, fulfillment_status, customer_name, marketplace_stores(name, platform)')
          .in('fulfillment_status', filterConfig.statuses)
          .gte(filterConfig.dateCol, periodStart)
          .lte(filterConfig.dateCol, periodEnd)
          .order(filterConfig.dateCol, { ascending: false })
      );
      return data;
    },
  });

  // Fetch listings for cost lookup
  const { data: listings } = useQuery({
    queryKey: ['sale-breakdown-listings'],
    queryFn: async () => {
      const data = await fetchAllRows(
        supabase.from('marketplace_listings').select('id, store_id, external_sku, external_product_id, product_id, cost_price, title')
      );
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  // Fetch product variants for cost_price
  const { data: variants } = useQuery({
    queryKey: ['sale-breakdown-variants'],
    queryFn: async () => {
      const data = await fetchAllRows(
        supabase.from('product_variants').select('id, product_id, cost_price, cost_price_currency, sku')
      );
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  // Build cost lookup: SKU -> cost in UZS
  const costLookup = useMemo(() => {
    if (!listings || !variants) return new Map<string, { costUZS: number; source: string }>();
    const map = new Map<string, { costUZS: number; source: string }>();

    // Build product_id -> avg cost from variants
    const productCostMap = new Map<string, { totalCost: number; count: number; currency: string }>();
    for (const v of variants) {
      if (v.cost_price && v.product_id) {
        const existing = productCostMap.get(v.product_id) || { totalCost: 0, count: 0, currency: v.cost_price_currency || 'UZS' };
        existing.totalCost += Number(v.cost_price);
        existing.count += 1;
        existing.currency = v.cost_price_currency || 'UZS';
        productCostMap.set(v.product_id, existing);
      }
    }

    for (const listing of listings) {
      const keys = [listing.external_sku, listing.external_product_id].filter(Boolean);
      for (const key of keys) {
        if (map.has(`${listing.store_id}:${key}`)) continue;

        // Try product variant cost
        if (listing.product_id && productCostMap.has(listing.product_id)) {
          const pc = productCostMap.get(listing.product_id)!;
          const avgCost = pc.totalCost / pc.count;
          let costUZS = avgCost;
          if (pc.currency === 'USD') costUZS = avgCost * usdToUzs;
          else if (pc.currency === 'CNY') costUZS = avgCost * cnyToUzs;
          map.set(`${listing.store_id}:${key}`, { costUZS, source: 'variant' });
          continue;
        }

        // Fallback: listing cost_price (assume UZS since cost_price_currency column doesn't exist)
        if (listing.cost_price) {
          const costUZS = Number(listing.cost_price);
          map.set(`${listing.store_id}:${key}`, { costUZS, source: 'listing' });
        }
      }
    }
    return map;
  }, [listings, variants, usdToUzs, cnyToUzs]);

  // Unique stores for filter
  const stores = useMemo(() => {
    if (!orders) return [];
    const storeMap = new Map<string, { id: string; name: string; platform: string }>();
    for (const o of orders) {
      if (!storeMap.has(o.store_id)) {
        const ms = o.marketplace_stores as any;
        storeMap.set(o.store_id, { id: o.store_id, name: ms?.name || o.store_id.slice(0, 8), platform: ms?.platform || '' });
      }
    }
    return Array.from(storeMap.values());
  }, [orders]);

  // Process orders into sale rows
  const saleRows = useMemo(() => {
    if (!orders) return [];
    return orders.map(order => {
      const ms = order.marketplace_stores as any;
      const storeName = ms?.name || order.store_id.slice(0, 8);
      const platform = ms?.platform || '';
      const sellingPrice = Number(order.total_amount) || 0;
      const commissionAmt = Number(order.commission) || 0;
      const deliveryFee = Number(order.delivery_cost) || 0;
      const netIncome = sellingPrice - commissionAmt - deliveryFee;

      // Extract product names and costs from items
      const items = (order.items as any[]) || [];
      let totalCostUZS = 0;
      let costKnown = true;
      const productNames: string[] = [];

      for (const item of items) {
        const title = item.title || item.offerName || item.skuTitle || t('fin_sale_cost_unknown');
        productNames.push(title);
        const sku = item.skuTitle || item.offerId || item.sku || '';
        const qty = Number(item.quantity || item.count || 1);

        const lookupKey = `${order.store_id}:${sku}`;
        const costData = costLookup.get(lookupKey);
        if (costData) {
          totalCostUZS += costData.costUZS * qty;
        } else {
          // Fallback: 40% of selling price
          totalCostUZS += sellingPrice * 0.4 / items.length;
          costKnown = false;
        }
      }

      const grossProfit = netIncome - totalCostUZS;
      const margin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

      // Distribution
      const dist = calculateDistribution(order.store_id, netIncome);

      return {
        id: order.id,
        date: (order as any).delivered_at || order.ordered_at,
        orderNumber: order.order_number || order.external_order_id || '',
        productName: productNames.join(', ') || t('fin_sale_cost_unknown'),
        storeName, platform,
        storeId: order.store_id,
        sellingPrice, commissionAmt, deliveryFee, netIncome,
        totalCostUZS, costKnown, grossProfit, margin,
        dist,
        items,
        currency: order.currency || 'UZS',
      };
    });
  }, [orders, costLookup, calculateDistribution, t]);

  // Filter and sort
  const filtered = useMemo(() => {
    let rows = saleRows;
    if (storeFilter !== 'all') rows = rows.filter(r => r.storeId === storeFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.productName.toLowerCase().includes(q) || r.orderNumber.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === 'amount') cmp = a.sellingPrice - b.sellingPrice;
      else if (sortField === 'margin') cmp = a.margin - b.margin;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return rows;
  }, [saleRows, storeFilter, search, sortField, sortDir]);

  // Summary stats
  const totalSales = filtered.length;
  const totalRevenue = filtered.reduce((s, r) => s + r.sellingPrice, 0);
  const totalNetProfit = filtered.reduce((s, r) => s + r.grossProfit, 0);
  const avgMargin = totalSales > 0 ? filtered.reduce((s, r) => s + r.margin, 0) / totalSales : 0;

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const marginBadge = (margin: number) => {
    if (margin >= 30) return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">{margin.toFixed(1)}%</Badge>;
    if (margin >= 15) return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">{margin.toFixed(1)}%</Badge>;
    return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">{margin.toFixed(1)}%</Badge>;
  };

  const pctOf = (val: number, total: number) => total > 0 ? `${((val / total) * 100).toFixed(1)}%` : '0%';

  if (ordersLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Active filter badge */}
      {statusFilter && onClearFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Badge className={`${filterConfig.color} gap-1 cursor-pointer`} onClick={onClearFilter}>
            {filterConfig.label}
            <X className="h-3 w-3" />
          </Badge>
        </div>
      )}
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <ShoppingCart className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">{t('fin_sale_total_sales')}</p>
          <p className="text-lg font-bold text-foreground">{totalSales}</p>
        </Card>
        <Card className="p-3 text-center">
          <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">{t('total_revenue')}</p>
          <p className="text-lg font-bold text-foreground">{formatMoney(totalRevenue)}</p>
        </Card>
        <Card className="p-3 text-center">
          <TrendingDown className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">{t('fin_sale_net_income')}</p>
          <p className={`text-lg font-bold ${totalNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(totalNetProfit)}</p>
        </Card>
        <Card className="p-3 text-center">
          <Percent className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">{t('fin_sale_avg_margin')}</p>
          <p className="text-lg font-bold text-foreground">{avgMargin.toFixed(1)}%</p>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('search') + '...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-input border-border" />
        </div>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-input border-border">
            <SelectValue placeholder={t('all_stores')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_stores')}</SelectItem>
            {stores.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.platform === 'uzum' ? '🟣' : '🔴'} {s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table / Cards */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">{t('noData')}</Card>
      ) : isMobile ? (
        <div className="space-y-2">
          {filtered.map((row, idx) => (
            <MobileSaleCard key={row.id} row={row} idx={idx} expanded={expandedRows.has(row.id)} onToggle={() => toggleRow(row.id)} marginBadge={marginBadge} formatMoney={formatMoney} pctOf={pctOf} t={t} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('date')}>{t('date')} {sortField === 'date' && (sortDir === 'desc' ? '↓' : '↑')}</TableHead>
                <TableHead>{t('fin_sale_product')}</TableHead>
                <TableHead>{t('all_stores')}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('amount')}>{t('fin_sale_selling_price')} {sortField === 'amount' && (sortDir === 'desc' ? '↓' : '↑')}</TableHead>
                <TableHead className="text-right">{t('pp_total_cost')}</TableHead>
                <TableHead className="text-right">{t('pp_commission')}</TableHead>
                <TableHead className="text-right">{t('fin_sale_net_income')}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('margin')}>{t('fin_sale_margin')} {sortField === 'margin' && (sortDir === 'desc' ? '↓' : '↑')}</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, idx) => (
                <SaleRow key={row.id} row={row} idx={idx} expanded={expandedRows.has(row.id)} onToggle={() => toggleRow(row.id)} marginBadge={marginBadge} formatMoney={formatMoney} pctOf={pctOf} t={t} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// Desktop expandable row
function SaleRow({ row, idx, expanded, onToggle, marginBadge, formatMoney, pctOf, t }: any) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
        <TableCell className="text-xs whitespace-nowrap">{new Date(row.date).toLocaleDateString('uz-UZ')}</TableCell>
        <TableCell className="max-w-[200px] truncate text-sm font-medium">
          {row.productName}
          {!row.costKnown && <span className="text-xs text-muted-foreground ml-1">~</span>}
        </TableCell>
        <TableCell className="text-xs">{row.platform === 'uzum' ? '🟣' : '🔴'} {row.storeName}</TableCell>
        <TableCell className="text-right text-sm">{formatMoney(row.sellingPrice)}</TableCell>
        <TableCell className="text-right text-sm text-muted-foreground">{formatMoney(row.totalCostUZS)}</TableCell>
        <TableCell className="text-right text-sm text-muted-foreground">{formatMoney(row.commissionAmt)}</TableCell>
        <TableCell className="text-right text-sm font-medium">{formatMoney(row.grossProfit)}</TableCell>
        <TableCell className="text-right">{marginBadge(row.margin)}</TableCell>
        <TableCell>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={10} className="bg-muted/30 p-4">
            <WaterfallDetail row={row} formatMoney={formatMoney} pctOf={pctOf} t={t} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// Mobile card
function MobileSaleCard({ row, idx, expanded, onToggle, marginBadge, formatMoney, pctOf, t }: any) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card className="p-3">
        <CollapsibleTrigger className="w-full text-left">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{row.productName}</p>
              <p className="text-xs text-muted-foreground">{new Date(row.date).toLocaleDateString('uz-UZ')} · {row.platform === 'uzum' ? '🟣' : '🔴'} {row.storeName}</p>
            </div>
            <div className="text-right ml-2 flex-shrink-0">
              <p className="text-sm font-bold">{formatMoney(row.sellingPrice)}</p>
              {marginBadge(row.margin)}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 mt-3 border-t border-border">
          <WaterfallDetail row={row} formatMoney={formatMoney} pctOf={pctOf} t={t} />
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Waterfall detail shared between desktop and mobile
function WaterfallDetail({ row, formatMoney, pctOf, t }: any) {
  const { dist } = row;
  return (
    <div className="space-y-3 text-sm">
      {/* Revenue waterfall */}
      <div className="space-y-1">
        <div className="flex justify-between"><span className="font-medium">{t('fin_sale_selling_price')}</span><span className="font-bold">{formatMoney(row.sellingPrice)} <span className="text-xs text-muted-foreground">(100%)</span></span></div>
        <div className="flex justify-between text-red-500"><span className="pl-2">(-) {t('pp_commission')}</span><span>-{formatMoney(row.commissionAmt)} <span className="text-xs">({pctOf(row.commissionAmt, row.sellingPrice)})</span></span></div>
        <div className="flex justify-between text-red-500"><span className="pl-2">(-) {t('shipping')}</span><span>-{formatMoney(row.deliveryFee)} <span className="text-xs">({pctOf(row.deliveryFee, row.sellingPrice)})</span></span></div>
        <div className="flex justify-between border-t border-border pt-1"><span className="font-medium">= {t('fin_sale_net_income')}</span><span className="font-bold">{formatMoney(row.netIncome)} <span className="text-xs text-muted-foreground">({pctOf(row.netIncome, row.sellingPrice)})</span></span></div>
        <div className="flex justify-between text-red-500"><span className="pl-2">(-) {t('pp_total_cost')} {!row.costKnown && <span className="text-xs text-muted-foreground">(~{t('fin_sale_cost_unknown')})</span>}</span><span>-{formatMoney(row.totalCostUZS)} <span className="text-xs">({pctOf(row.totalCostUZS, row.sellingPrice)})</span></span></div>
        <div className="flex justify-between border-t border-border pt-1 font-bold"><span>= {t('fin_sale_gross_profit')}</span><span className={row.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatMoney(row.grossProfit)} <span className="text-xs font-normal text-muted-foreground">({pctOf(row.grossProfit, row.sellingPrice)})</span></span></div>
      </div>

      {/* Distribution */}
      <div className="bg-background rounded-md p-3 space-y-1">
        <p className="font-medium text-xs text-muted-foreground mb-2">{t('fin_sale_distribution')}</p>
        <div className="flex justify-between"><span>BM ulushi ({dist.boshMenejerPct}%)</span><span className="text-red-500">-{formatMoney(dist.boshMenejerShare)}</span></div>
        {dist.investorPct > 0 && (
          <div className="flex justify-between"><span>{t('fin_pl_investor')} ({dist.investorPct}%)</span><span className="text-red-500">-{formatMoney(dist.investorShare)}</span></div>
        )}
        <div className="flex justify-between"><span>{t('pp_tax')} (4%)</span><span className="text-red-500">-{formatMoney(dist.taxAmount)}</span></div>
        <div className="flex justify-between border-t border-border pt-1 font-bold"><span>{t('pp_owner_net')}</span><span className={dist.ownerNet >= 0 ? 'text-green-600' : 'text-red-600'}>{formatMoney(dist.ownerNet)}</span></div>
      </div>
    </div>
  );
}
