import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, FileSpreadsheet, Calculator } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { DateRange } from 'react-day-picker';

interface AccountingReportTabProps { }

interface ReportRow {
  sku: string;
  chinaPrice: number;
  cargoPrice: number;
  tanNarx: number;
  sotuvNarx: number;
  commissionPct: number;
  commissionSum: number;
  logistics: number;
  platformIncome: number;
  tax4pct: number;
  profitBeforeTax: number;
  profitPerUnit: number;
  profit25: number;
  salesCount: number;
  totalProfit: number;
  totalProfit25: number;
  isFallbackPrice: boolean;
}

export function AccountingReportTab({ }: AccountingReportTabProps) {
  const { usdToUzs, cnyToUzs } = useFinanceCurrency();
  const { toast } = useToast();
  const now = new Date();
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: now,
  });
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Reset report when store/month/year changes
  useEffect(() => {
    setReportData([]);
    setGenerated(false);
  }, [selectedStore, dateRange]);

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ['marketplace-stores-accounting'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const selectedStoreName = stores?.find(s => s.id === selectedStore)?.name || '';


  const generateReport = async () => {
    if (!selectedStore) return;
    setGenerating(true);
    setGenerated(false);

    try {
      if (!dateRange?.from || !dateRange?.to) {
        alert('Iltimos, sana oralig\'ini tanlang');
        setGenerating(false);
        return;
      }

      const startStr = format(dateRange.from, 'yyyy-MM-dd');
      const endStr = format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59';

      // 1. Fetch delivered orders for this store + period
      const orders = await fetchAllRows(
        supabase.from('marketplace_orders')
          .select('id, items, total_amount, commission, delivery_cost, store_id, delivered_at')
          .eq('store_id', selectedStore)
          .eq('fulfillment_status', 'delivered')
          .gte('delivered_at', startStr)
          .lte('delivered_at', endStr)
      );

      // 2. Aggregate by SKU from items JSONB
      const skuMap: Record<string, {
        totalPrice: number;
        totalCommission: number;
        totalDeliveryFee: number;
        totalQuantity: number;
        skuTitle: string;
      }> = {};

      for (const order of orders) {
        const items = order.items as any[];
        if (!items || !Array.isArray(items)) continue;

        // Order-level commission & delivery (Yandex stores these here, not in items)
        const orderCommission = Number(order.commission) || 0;
        const orderDeliveryCost = Number(order.delivery_cost) || 0;
        const totalItemsInOrder = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0);

        for (const item of items) {
          const sku = item.skuTitle || item.offerId || 'Unknown';
          const qty = Number(item.quantity) || 1;
          if (!skuMap[sku]) {
            skuMap[sku] = { totalPrice: 0, totalCommission: 0, totalDeliveryFee: 0, totalQuantity: 0, skuTitle: sku };
          }
          // item.commission and item.deliveryFee in DB are usually TOTALS for the item row (qty included).
          // If we fall back to orderCommission, we apportion it based on the item's quantity.
          const itemCommission = item.commission !== undefined && item.commission !== null
            ? Number(item.commission)
            : (orderCommission / totalItemsInOrder) * qty;

          const itemDeliveryFee = item.deliveryFee !== undefined && item.deliveryFee !== null
            ? Number(item.deliveryFee)
            : (orderDeliveryCost / totalItemsInOrder) * qty;

          skuMap[sku].totalPrice += (Number(item.price) || 0) * qty;
          skuMap[sku].totalCommission += itemCommission;
          skuMap[sku].totalDeliveryFee += itemDeliveryFee;
          skuMap[sku].totalQuantity += qty;
        }
      }

      // 3. Fetch variant_sku_mappings for this store's SKUs
      const uniqueSkus = Object.keys(skuMap);

      // 3a. variant_sku_mappings -> variant_id for each external_sku
      const skuMappings = uniqueSkus.length > 0
        ? await fetchAllRows(
          supabase.from('variant_sku_mappings')
            .select('external_sku, variant_id, store_id')
            .eq('store_id', selectedStore)
            .in('external_sku', uniqueSkus)
        )
        : [];

      // 3b. Fetch marketplace_listings for fallback mapping
      const storeListings = await fetchAllRows(
        supabase.from('marketplace_listings')
          .select('id, title, external_sku, external_offer_id, product_id, commission_rate, price')
          .eq('store_id', selectedStore)
      );

      // Map SKUs to variant_id/product_id
      const resolvedMapping: Record<string, { variantId?: string; productId?: string }> = {};

      // First, use variant_sku_mappings
      for (const m of skuMappings) {
        resolvedMapping[m.external_sku] = { variantId: m.variant_id };
      }

      // Then, use marketplace_listings as fallback or for direct product mapping
      for (const sku of uniqueSkus) {
        if (!resolvedMapping[sku]) {
          const l = storeListings.find(item =>
            item.external_sku === sku ||
            item.external_offer_id === sku ||
            item.title === sku
          );
          if (l) {
            resolvedMapping[sku] = {
              variantId: undefined, // listing doesn't have variant_id in types.ts
              productId: l.product_id || undefined
            };
          }
        }
      }

      const variantIds = [...new Set(Object.values(resolvedMapping).map(m => m.variantId).filter(Boolean))] as string[];
      const directProductIds = [...new Set(Object.values(resolvedMapping).map(m => m.productId).filter(Boolean))] as string[];

      // 3c. product_variants -> cost_price + product_id
      let variantsMap: Record<string, { costPrice: number; costPriceCurrency: string; productId: string | null }> = {};
      if (variantIds.length > 0) {
        const variants = await fetchAllRows(
          supabase.from('product_variants')
            .select('id, cost_price, cost_price_currency, product_id')
            .in('id', variantIds)
        );
        for (const v of variants) {
          variantsMap[v.id] = {
            costPrice: Number(v.cost_price) || 0,
            costPriceCurrency: (v as any).cost_price_currency || 'UZS',
            productId: v.product_id
          };
        }
      }

      // Collect all product IDs to fetch (from variants and direct mappings)
      const allProductIdsSet = new Set(directProductIds);
      Object.values(variantsMap).forEach(v => {
        if (v.productId) allProductIdsSet.add(v.productId);
      });
      const allProductIds = Array.from(allProductIdsSet);

      // 3d. products -> shipping_cost_to_china, quantity, cost_price
      let productsMap: Record<string, { shippingCostToChina: number; quantity: number; costPrice: number }> = {};
      if (allProductIds.length > 0) {
        const products = await fetchAllRows(
          supabase.from('products')
            .select('id, shipping_cost_to_china, quantity, cost_price')
            .in('id', allProductIds)
        );
        for (const p of products) {
          productsMap[p.id] = {
            shippingCostToChina: Number(p.shipping_cost_to_china) || 0,
            quantity: Math.max(Number(p.quantity) || 1, 1),
            costPrice: Number(p.cost_price) || 0,
          };
        }
      }

      // 3e. Fetch product_items to get average domestic and international shipping (like CRM Toshkent ombori)
      const avgCostsByKey: Record<string, { domestic: number; intl: number; unitCost: number; count: number }> = {};
      const avgCostsByProduct: Record<string, { domestic: number; intl: number; unitCost: number; count: number }> = {};

      if (allProductIds.length > 0) {
        const productItems = await fetchAllRows(
          supabase.from('product_items')
            .select('product_id, variant_id, unit_cost, domestic_shipping_cost, international_shipping_cost')
            .in('product_id', allProductIds)
            .not('unit_cost', 'is', null)
            .gt('unit_cost', 0)
        );

        productItems.forEach(item => {
          const varKey = item.variant_id as string;
          const prodKey = item.product_id as string;

          if (varKey) {
            if (!avgCostsByKey[varKey]) avgCostsByKey[varKey] = { domestic: 0, intl: 0, unitCost: 0, count: 0 };
            avgCostsByKey[varKey].domestic += Number(item.domestic_shipping_cost) || 0;
            avgCostsByKey[varKey].intl += Number(item.international_shipping_cost) || 0;
            avgCostsByKey[varKey].unitCost += Number(item.unit_cost) || 0;
            avgCostsByKey[varKey].count += 1;
          }

          if (prodKey) {
            if (!avgCostsByProduct[prodKey]) avgCostsByProduct[prodKey] = { domestic: 0, intl: 0, unitCost: 0, count: 0 };
            avgCostsByProduct[prodKey].domestic += Number(item.domestic_shipping_cost) || 0;
            avgCostsByProduct[prodKey].intl += Number(item.international_shipping_cost) || 0;
            avgCostsByProduct[prodKey].unitCost += Number(item.unit_cost) || 0;
            avgCostsByProduct[prodKey].count += 1;
          }
        });
      }

      const getAvgShipping = (variantId?: string, productId?: string) => {
        const src = (variantId ? avgCostsByKey[variantId] : null) || (productId ? avgCostsByProduct[productId] : null);
        if (!src || src.count === 0) return { avgDomestic: null, avgIntl: null, avgUnitCost: null };
        return {
          avgDomestic: src.domestic / src.count,
          avgIntl: src.intl / src.count,
          avgUnitCost: src.unitCost / src.count,
        };
      };

      // Final mapping lookup
      const listingPriceMap: Record<string, number> = {};
      const listingCommissionMap: Record<string, number> = {};
      for (const l of storeListings) {
        if (l.external_sku) {
          listingPriceMap[l.external_sku] = Number(l.price) || 0;
          listingCommissionMap[l.external_sku] = Number(l.commission_rate) || 0;
        }
        if (l.title) {
          listingCommissionMap[l.title] = Number(l.commission_rate) || 0;
        }
      }

      // 4. Build report rows
      const rows: ReportRow[] = Object.entries(skuMap).map(([sku, data]) => {
        const mapping = resolvedMapping[sku];
        const variantId = mapping?.variantId;
        const variant = variantId ? variantsMap[variantId] : null;
        const productId = variant?.productId || mapping?.productId;
        const product = productId ? productsMap[productId] : null;

        // Tannarx fallback chain:
        // 1. variant.cost_price (valyutaga qarab konvertatsiya)
        // 2. product.cost_price
        // 3. listing price * 0.4 (taxminiy)
        let chinaPrice = 0;
        let isFallbackPrice = false;
        const variantCost = variant?.costPrice || 0;
        if (variantCost > 0) {
          const cur = variant!.costPriceCurrency;
          if (cur === 'CNY') chinaPrice = variantCost * cnyToUzs;
          else if (cur === 'USD') chinaPrice = variantCost * usdToUzs;
          else chinaPrice = variantCost; // UZS
        } else if (product?.costPrice && product.costPrice > 0) {
          chinaPrice = product.costPrice;
        } else {
          // Fallback: listing narxining 40%
          const listingPrice = listingPriceMap[sku] || 0;
          if (listingPrice > 0) {
            chinaPrice = listingPrice * 0.4;
            isFallbackPrice = true;
          }
        }

        // Cargo price logic matching Toshkent Ombori
        let cargoPrice = 0;
        const avgShipping = getAvgShipping(variantId, productId);

        let avgDomesticCny = 0;
        let avgIntlUsd = 0;

        // 1. CRM umumiy qismida (product_items) real kelgan tovarlar kargosi mavjud bo'lsa va 0 dan katta bo'lsa
        if ((avgShipping.avgDomestic ?? 0) > 0 || (avgShipping.avgIntl ?? 0) > 0) {
          avgDomesticCny = avgShipping.avgDomestic || 0;
          avgIntlUsd = avgShipping.avgIntl || 0;
        }

        // 2. Fallback: Agar product_items dan kargo nol bo'lsa yoki topilmasa, bazaviy products dagi kargoni olamiz.
        if (avgDomesticCny === 0 && avgIntlUsd === 0) {
          if (product && product.shippingCostToChina > 0) {
            const qtyForKargo = product.quantity || 1;
            avgDomesticCny = product.shippingCostToChina / qtyForKargo;
          }
        }

        const domesticUzs = avgDomesticCny * cnyToUzs; // CNY to UZS
        const intlUzs = avgIntlUsd * usdToUzs; // USD to UZS

        // Jami kargo
        cargoPrice = domesticUzs + intlUzs;

        // Xatolikni oldini olish: Agar cargo baribir 0 bo'lsa,
        // Tannarx va kargo nol bo'lgan holatda tozalab qo'yamiz.
        if (cargoPrice === 0 && variant?.costPrice === 0 && product?.costPrice === 0 && !isFallbackPrice) {
          cargoPrice = 0;
        }

        const tanNarx = chinaPrice + cargoPrice;
        const avgPrice = data.totalQuantity > 0 ? data.totalPrice / data.totalQuantity : 0;
        let avgCommission = data.totalQuantity > 0 ? data.totalCommission / data.totalQuantity : 0;
        const avgDeliveryFee = data.totalQuantity > 0 ? data.totalDeliveryFee / data.totalQuantity : 0;

        // DB Data corruption guard: Prevent impossible commissions (e.g. fallback bug stored absolute UZS instead of %)
        if (avgPrice > 0 && avgCommission > avgPrice * 0.45) {
          let safeRate = listingCommissionMap[sku] || 0;
          // If listing rate is also corrupted (>100 means absolute UZS instead of %), gracefully convert it
          if (safeRate > 100) safeRate = (safeRate / avgPrice) * 100;
          // If still weird, fallback to 20% as standard Uzum commission estimate
          if (safeRate === 0 || safeRate > 50) safeRate = 20;

          avgCommission = avgPrice * (safeRate / 100);
        }

        let commissionPct = avgPrice > 0 ? (avgCommission / avgPrice) * 100 : (listingCommissionMap[sku] || 0);
        if (commissionPct > 100 && avgPrice > 0) commissionPct = (commissionPct / avgPrice) * 100;
        if (commissionPct > 50) commissionPct = 20;
        const platformIncome = avgPrice - avgCommission;
        const taxBase = platformIncome - avgDeliveryFee;
        const tax4pct = Math.max(0, taxBase * 0.04);
        const profitBeforeTax = platformIncome - avgDeliveryFee - tanNarx;
        const profitPerUnit = profitBeforeTax - tax4pct;
        const profit25 = profitPerUnit * 0.25;

        return {
          sku,
          chinaPrice: Math.round(chinaPrice),
          cargoPrice: Math.round(cargoPrice),
          tanNarx: Math.round(tanNarx),
          sotuvNarx: Math.round(avgPrice),
          commissionPct: Math.round(commissionPct * 10) / 10,
          commissionSum: Math.round(avgCommission),
          logistics: Math.round(avgDeliveryFee),
          platformIncome: Math.round(platformIncome),
          tax4pct: Math.round(tax4pct),
          profitBeforeTax: Math.round(profitBeforeTax),
          profitPerUnit: Math.round(profitPerUnit),
          profit25: Math.round(profit25),
          salesCount: data.totalQuantity,
          totalProfit: Math.round(profitPerUnit * data.totalQuantity),
          totalProfit25: Math.round(profitPerUnit * data.totalQuantity * 0.25),
          isFallbackPrice,
        };
      });

      // Sort by total profit descending
      rows.sort((a, b) => b.totalProfit - a.totalProfit);
      setReportData(rows);
      setGenerated(true);
    } catch (err: any) {
      console.error('Report generation error:', err);
      toast({
        title: "Hisobot yaratishda xatolik",
        description: err.message || "Noma'lum xato yuz berdi",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const totals = useMemo(() => {
    if (!reportData.length) return null;
    return {
      salesCount: reportData.reduce((s, r) => s + r.salesCount, 0),
      totalRevenue: reportData.reduce((s, r) => s + r.sotuvNarx * r.salesCount, 0),
      totalCommission: reportData.reduce((s, r) => s + r.commissionSum * r.salesCount, 0),
      totalLogistics: reportData.reduce((s, r) => s + r.logistics * r.salesCount, 0),
      totalTax: reportData.reduce((s, r) => s + r.tax4pct * r.salesCount, 0),
      totalProfit: reportData.reduce((s, r) => s + r.totalProfit, 0),
    };
  }, [reportData]);

  const fmt = (n: number) => n.toLocaleString('uz-UZ');

  const exportToExcel = () => {
    if (!reportData.length) return;

    const headers = ['SKU', 'Xitoy narxi', 'Kargo narxi', 'Tan narxi', 'Sotuv narxi', 'Komissiya %', 'Komissiya summa', 'Logistika', 'Platformadan tushadi', 'NALOG 4%', 'Nalogsiz', 'Dona foyda', 'Dona foyda 25%', 'Sotuvlar soni', 'Jami foyda', 'Jami foydaning 25%'];

    const wsData = [
      headers,
      ...reportData.map(r => [
        r.sku, r.chinaPrice, r.cargoPrice, r.tanNarx, r.sotuvNarx,
        r.commissionPct, r.commissionSum, r.logistics, r.platformIncome,
        r.tax4pct, r.profitBeforeTax, r.profitPerUnit, r.profit25, r.salesCount, r.totalProfit, r.totalProfit25,
      ]),
    ];

    // Add totals row
    if (totals) {
      wsData.push([
        `JAMI: ${selectedStoreName}`, '', '', '', totals.totalRevenue,
        '', totals.totalCommission, totals.totalLogistics, '',
        totals.totalTax, '', '', '', totals.salesCount, totals.totalProfit, totals.totalProfit * 0.25,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hisobot');

    const startStr = dateRange?.from ? format(dateRange.from, 'dd.MM') : '';
    const endStr = dateRange?.to ? format(dateRange.to, 'dd.MM') : '';
    const fileName = `${selectedStoreName}_oraliq_atchet_${startStr}-${endStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-4">
      {/* Selection Controls */}
      <Card className="p-4 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-end mb-6">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Do'konni tanlang</label>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger>
                <SelectValue placeholder="Do'konni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {stores?.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.platform})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Sana oralig'i (Kunlik/Oraliq)</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-10 px-3",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Sana oralig'ini tanlang</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={generateReport}
            disabled={generating || !selectedStore}
            className="flex-1 gap-2"
          >  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            Hisobotni yaratish
          </Button>

          {generated && reportData.length > 0 && (
            <Button variant="outline" onClick={exportToExcel} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Excel yuklab olish
            </Button>
          )}
        </div>
      </Card>

      {generated && reportData.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Tanlangan davr uchun yetkazilgan buyurtmalar topilmadi.
        </Card>
      )}

      {generated && reportData.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">SKU</TableHead>
                  <TableHead className="text-right">Xitoy narxi</TableHead>
                  <TableHead className="text-right">Kargo</TableHead>
                  <TableHead className="text-right">Tan narxi</TableHead>
                  <TableHead className="text-right">Sotuv narxi</TableHead>
                  <TableHead className="text-right">Kom. %</TableHead>
                  <TableHead className="text-right">Komissiya</TableHead>
                  <TableHead className="text-right">Logistika</TableHead>
                  <TableHead className="text-right">Tushadi</TableHead>
                  <TableHead className="text-right">Nalog 4%</TableHead>
                  <TableHead className="text-right">Nalogsiz</TableHead>
                  <TableHead className="text-right">Dona foyda</TableHead>
                  <TableHead className="text-right">Dona foyda 25%</TableHead>
                  <TableHead className="text-right">Soni</TableHead>
                  <TableHead className="text-right">Jami foyda</TableHead>
                  <TableHead className="text-right">Jami foydaning 25%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-xs">{row.sku}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.isFallbackPrice ? `~${fmt(row.chinaPrice)}` : fmt(row.chinaPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.cargoPrice)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${row.isFallbackPrice ? 'text-amber-600' : ''}`}>{row.isFallbackPrice ? `~${fmt(row.tanNarx)}` : fmt(row.tanNarx)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.sotuvNarx)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.commissionPct}%</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.commissionSum)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.logistics)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.platformIncome)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.tax4pct)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${row.profitBeforeTax >= 0 ? 'text-blue-600' : 'text-destructive'}`}>
                      {fmt(row.profitBeforeTax)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${row.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {fmt(row.profitPerUnit)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${row.profit25 >= 0 ? 'text-amber-600' : 'text-destructive'}`}>
                      {fmt(row.profit25)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.salesCount}</TableCell>
                    <TableCell className={`text-right tabular-nums font-bold ${row.totalProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {fmt(row.totalProfit)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-bold ${row.totalProfit25 >= 0 ? 'text-amber-600' : 'text-destructive'}`}>
                      {fmt(row.totalProfit25)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {totals && (
                <TableFooter>
                  <TableRow className="bg-muted/70 font-bold">
                    <TableCell>JAMI: {selectedStoreName}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(totals.totalRevenue)}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(totals.totalCommission)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(totals.totalLogistics)}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(totals.totalTax)}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right tabular-nums">{totals.salesCount}</TableCell>
                    <TableCell className={`text-right tabular-nums ${totals.totalProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {fmt(totals.totalProfit)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${totals.totalProfit >= 0 ? 'text-amber-600' : 'text-destructive'}`}>
                      {fmt(Math.round(totals.totalProfit * 0.25))}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
