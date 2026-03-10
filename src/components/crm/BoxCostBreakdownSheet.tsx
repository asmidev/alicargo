import { useState, useMemo, useEffect } from 'react';
import { Package, Calculator, RotateCcw, Check } from 'lucide-react';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VariantAttributes = Record<string, any>;

interface ProductItem {
  id: string;
  variant_id?: string | null;
  unit_cost?: number | null;
  unit_cost_currency?: string | null;
  domestic_shipping_cost?: number | null;
  international_shipping_cost?: number | null;
  verification_items?: Array<{ status?: string }>;
  products?: { name?: string } | null;
  product_variants?: { 
    id?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    variant_attributes?: any;
    cost_price?: number | null;
    cost_price_currency?: string | null;
  } | null;
}

interface ExchangeRates {
  USD: number;
  CNY: number;
  UZS: number;
  lastUpdated: string;
}

interface BoxCostBreakdownSheetProps {
  productItems: ProductItem[];
  exchangeRates: ExchangeRates | undefined;
  customRates?: { uzsRate: number; cnyToUzs: number } | null;
  onApplyRates?: (rates: { uzsRate: number; cnyToUzs: number }) => void;
}

// Helper function to get color emoji
const getColorEmoji = (color: string | undefined): string => {
  if (!color) return "";
  const c = color.toLowerCase();
  const colorMap: Record<string, string> = {
    'qizil': '🔴', 'red': '🔴',
    'ko\'k': '🔵', 'kok': '🔵', 'blue': '🔵',
    'yashil': '🟢', 'green': '🟢',
    'sariq': '🟡', 'yellow': '🟡',
    'qora': '⚫', 'black': '⚫',
    'oq': '⚪', 'white': '⚪',
    'jigarrang': '🟤', 'brown': '🟤',
    'pushti': '💗', 'pink': '💗',
    'binafsha': '🟣', 'purple': '🟣',
    'kulrang': '⚪', 'gray': '⚪', 'grey': '⚪',
    'moviy': '🔵', 'navy': '🔵',
    'oltin': '🟡', 'gold': '🟡',
    'kumush': '⚪', 'silver': '⚪',
  };
  return colorMap[c] || "⚪";
};

// Format variant attributes for display
const formatVariantInfo = (attrs: VariantAttributes | undefined): string | null => {
  if (!attrs) return null;
  const parts: string[] = [];
  
  // Priority order for attributes
  if (attrs.rang) parts.push(attrs.rang);
  if (attrs.material) parts.push(attrs.material);
  
  // Add any other attributes
  Object.entries(attrs).forEach(([key, value]) => {
    if (key !== 'rang' && key !== 'material' && value) {
      parts.push(value);
    }
  });
  
  return parts.length > 0 ? parts.join(' / ') : null;
};

export function BoxCostBreakdownSheet({ productItems, exchangeRates, customRates, onApplyRates }: BoxCostBreakdownSheetProps) {
  // Live rates from global context (sessiya override yoki DB)
  const { usdToUzs: contextUsdRate, cnyToUzs: contextCnyRate } = useFinanceCurrency();

  // Context kurslari asosiy manba — API fallback sifatida
  const apiUzsRate = contextUsdRate || exchangeRates?.UZS || 12500;
  const apiCnyToUzs = contextCnyRate || (exchangeRates ? exchangeRates.UZS / (exchangeRates.CNY || 7.2) : 1750);

  // Use custom rates if provided, otherwise use context rates
  const initialUzsRate = customRates?.uzsRate ?? Math.round(apiUzsRate);
  const initialCnyToUzs = customRates?.cnyToUzs ?? Math.round(apiCnyToUzs);

  // Editable rates state (stored as strings for better input UX)
  const [editedUzsRate, setEditedUzsRate] = useState(initialUzsRate.toString());
  const [editedCnyToUzs, setEditedCnyToUzs] = useState(initialCnyToUzs.toString());

  // Sync state when context or custom rates change
  useEffect(() => {
    const newUzsRate = customRates?.uzsRate ?? Math.round(apiUzsRate);
    const newCnyToUzs = customRates?.cnyToUzs ?? Math.round(apiCnyToUzs);
    setEditedUzsRate(newUzsRate.toString());
    setEditedCnyToUzs(newCnyToUzs.toString());
  }, [customRates?.uzsRate, customRates?.cnyToUzs, apiUzsRate, apiCnyToUzs]);

  // Numeric values for calculations
  const numericUzsRate = parseFloat(editedUzsRate) || apiUzsRate;
  const numericCnyToUzs = parseFloat(editedCnyToUzs) || apiCnyToUzs;

  // Check if current values differ from what's applied (either custom or context)
  const appliedUzsRate = customRates?.uzsRate ?? Math.round(apiUzsRate);
  const appliedCnyToUzs = customRates?.cnyToUzs ?? Math.round(apiCnyToUzs);
  const hasUnappliedChanges = numericUzsRate !== appliedUzsRate || numericCnyToUzs !== appliedCnyToUzs;

  // Check if rates differ from API
  const isModified = customRates !== null && customRates !== undefined;

  // Reset to API rates
  const handleReset = () => {
    setEditedUzsRate(Math.round(apiUzsRate).toString());
    setEditedCnyToUzs(Math.round(apiCnyToUzs).toString());
    // Also clear custom rates in parent
    onApplyRates?.({ uzsRate: Math.round(apiUzsRate), cnyToUzs: Math.round(apiCnyToUzs) });
  };

  // Apply current rates
  const handleApply = () => {
    onApplyRates?.({ uzsRate: numericUzsRate, cnyToUzs: numericCnyToUzs });
  };

  // Filter valid items
  const validItems = useMemo(() => {
    return productItems.filter((item: ProductItem) => {
      const verificationStatus = item.verification_items?.[0]?.status;
      return verificationStatus !== 'defective' && verificationStatus !== 'missing';
    });
  }, [productItems]);

  // Recalculate grouped costs with editable rates - now grouping by variant
  const { groupedArray, totalLandedCostUZS, avgUnitCostCNY, avgDomesticCNY, avgIntlUSD, perItemUZS } = useMemo(() => {
    interface GroupedItem {
      name: string;
      variantId: string | null;
      variantInfo: string | null;
      variantAttributes: VariantAttributes | undefined;
      count: number;
      totalCostUZS: number;
      unitCostUZS: number;
      items: ProductItem[];
    }
    
    const grouped: Record<string, GroupedItem> = {};

    validItems.forEach((item: ProductItem) => {
      const name = item.products?.name || 'Noma\'lum';
      const variantId = item.variant_id || null;
      const variantAttrs = item.product_variants?.variant_attributes;
      const variantInfo = formatVariantInfo(variantAttrs);
      
      // Group by product name + variant ID
      const groupKey = variantId 
        ? `${name}::${variantId}` 
        : `${name}::no-variant`;
      
      // unit_cost bo'sh bo'lsa → product_variants.cost_price dan fallback
      const rawUnitCost = item.unit_cost ?? item.product_variants?.cost_price ?? 0;
      const unitCostCurrency = item.unit_cost_currency || item.product_variants?.cost_price_currency || 'CNY';
      const unitCostCNY = unitCostCurrency === 'USD'
        ? Number(rawUnitCost) * (numericUzsRate / numericCnyToUzs)
        : Number(rawUnitCost) || 0;
      const domesticCNY = Number(item.domestic_shipping_cost) || 0;
      const intlUSD = Number(item.international_shipping_cost) || 0;
      
      // Use editable rates for calculation
      const landedCostUZS = (unitCostCNY + domesticCNY) * numericCnyToUzs + intlUSD * numericUzsRate;
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = { 
          name, 
          variantId,
          variantInfo,
          variantAttributes: variantAttrs,
          count: 0, 
          totalCostUZS: 0, 
          unitCostUZS: landedCostUZS, 
          items: [] 
        };
      }
      grouped[groupKey].count += 1;
      grouped[groupKey].totalCostUZS += landedCostUZS;
      grouped[groupKey].items.push(item);
    });

    // Recalculate unitCostUZS as average
    Object.values(grouped).forEach(g => {
      g.unitCostUZS = g.totalCostUZS / g.count;
    });

    const groupedArr = Object.values(grouped);
    const totalUZS = groupedArr.reduce((sum, g) => sum + g.totalCostUZS, 0);
    
    // Calculate averages
    const avgUnit = validItems.reduce((s: number, i: ProductItem) => s + (Number(i.unit_cost) || 0), 0) / (validItems.length || 1);
    const avgDomestic = validItems.reduce((s: number, i: ProductItem) => s + (Number(i.domestic_shipping_cost) || 0), 0) / (validItems.length || 1);
    const avgIntl = validItems.reduce((s: number, i: ProductItem) => s + (Number(i.international_shipping_cost) || 0), 0) / (validItems.length || 1);
    const perItem = totalUZS / (validItems.length || 1);

    return {
      groupedArray: groupedArr,
      totalLandedCostUZS: totalUZS,
      avgUnitCostCNY: avgUnit,
      avgDomesticCNY: avgDomestic,
      avgIntlUSD: avgIntl,
      perItemUZS: perItem
    };
  }, [validItems, numericUzsRate, numericCnyToUzs]);

  const lastUpdated = exchangeRates?.lastUpdated 
    ? formatDistanceToNow(new Date(exchangeRates.lastUpdated), { addSuffix: true, locale: uz }) 
    : 'noma\'lum';

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-green-600" />
          Quti tannarxi tafsiloti
        </SheetTitle>
      </SheetHeader>
      
      <ScrollArea className="mt-4 max-h-[60vh]">
        <div className="space-y-4 pr-4">
          {/* Editable Exchange rates */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Bugungi kurs (Kapital):
              </p>
              {isModified && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleReset}
                  className="h-6 px-2 text-xs gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Tiklash
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              {/* USD Rate */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap w-16">1 USD =</span>
              <Input
                  type="number"
                  value={editedUzsRate}
                  onChange={(e) => setEditedUzsRate(e.target.value)}
                  className="h-8 text-right font-medium flex-1"
                  mobileOptimized={false}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">so'm</span>
              </div>
              
              {/* CNY Rate */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap w-16">1 CNY =</span>
              <Input
                  type="number"
                  value={editedCnyToUzs}
                  onChange={(e) => setEditedCnyToUzs(e.target.value)}
                  className="h-8 text-right font-medium flex-1"
                  mobileOptimized={false}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">so'm</span>
              </div>
            </div>
            
            <p className="text-[10px] text-muted-foreground mt-2">
              Manba: Kapital (open.er-api.com) • Yangilangan: {lastUpdated}
              {isModified && <span className="text-yellow-500 ml-1">• Qo'lda o'zgartirilgan</span>}
            </p>
          </div>
          
          {/* Products breakdown - now showing variants */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Mahsulotlar ro'yxati:</p>
            <div className="space-y-2">
              {groupedArray.map((group, idx) => (
                <div key={idx} className="p-2 bg-background rounded-lg border">
                  <div className="flex items-start gap-2">
                    <Package className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      
                      {/* Variant info with color emoji */}
                      {group.variantInfo && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                          <span>{getColorEmoji(group.variantAttributes?.rang)}</span>
                          <span>{group.variantInfo}</span>
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        {group.count} ta × {group.unitCostUZS.toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} so'm = 
                        <span className="font-medium text-green-600 dark:text-green-400 ml-1">
                          {group.totalCostUZS.toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} so'm
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Average cost breakdown */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Har bir mahsulot (o'rtacha):</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sotib olish:</span>
                <span>{avgUnitCostCNY.toFixed(2)} ¥ × {numericCnyToUzs.toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} = {(avgUnitCostCNY * numericCnyToUzs).toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} so'm</span>
              </div>
              {avgDomesticCNY > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Xitoy yo'l:</span>
                  <span>{avgDomesticCNY.toFixed(2)} ¥ = {(avgDomesticCNY * numericCnyToUzs).toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} so'm</span>
                </div>
              )}
              {avgIntlUSD > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Xalqaro yo'l:</span>
                  <span>${avgIntlUSD.toFixed(2)} = {(avgIntlUSD * numericUzsRate).toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} so'm</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-medium">
                <span>O'rtacha tannarx:</span>
                <span className="text-green-600 dark:text-green-400">{perItemUZS.toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} so'm</span>
              </div>
            </div>
          </div>
          
          {/* Grand total */}
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{validItems.length} ta mahsulot:</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {totalLandedCostUZS.toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} so'm
              </span>
            </div>
          </div>
        </div>
      </ScrollArea>
      
      {/* Apply button */}
      {onApplyRates && (
        <SheetFooter className="mt-4 pt-4 border-t">
          <Button 
            onClick={handleApply}
            disabled={!hasUnappliedChanges}
            className="w-full gap-2"
          >
            <Check className="h-4 w-4" />
            Tasdiqlash
          </Button>
        </SheetFooter>
      )}
    </>
  );
}
