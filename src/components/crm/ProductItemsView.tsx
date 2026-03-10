import { useState, useMemo, useCallback } from 'react';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight, Package, MapPin, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ProductItemsViewProps {
  productId: string;
  productUuid: string;
  hasVariants?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'packed': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'verified': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'in_transit': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'arrived': return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'sold': return 'bg-primary/10 text-primary border-primary/20';
    case 'damaged': return 'bg-red-500/10 text-red-500 border-red-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getLocationColor = (location: string) => {
  switch (location) {
    case 'china': return 'text-blue-500';
    case 'transit': return 'text-orange-500';
    case 'uzbekistan': return 'text-green-500';
    default: return 'text-muted-foreground';
  }
};

const translateStatus = (status: string) => {
  switch (status) {
    case 'pending': return 'Kutilmoqda';
    case 'packed': return 'Qadoqlangan';
    case 'verified': return 'Tekshirilgan';
    case 'in_transit': return 'Yo\'lda';
    case 'arrived': return 'Yetib keldi';
    case 'sold': return 'Sotildi';
    case 'damaged': return 'Shikastlangan';
    default: return status;
  }
};

const translateLocation = (location: string) => {
  switch (location) {
    case 'china': return 'Xitoy';
    case 'transit': return 'Yo\'lda';
    case 'uzbekistan': return 'O\'zbekiston';
    default: return location;
  }
};

// Color name to hex mapping
const colorMap: Record<string, string> = {
  'qora': '#1a1a1a',
  'black': '#1a1a1a',
  'oq': '#ffffff',
  'white': '#ffffff',
  'qizil': '#ef4444',
  'red': '#ef4444',
  'ko\'k': '#3b82f6',
  'blue': '#3b82f6',
  'yashil': '#22c55e',
  'green': '#22c55e',
  'sariq': '#eab308',
  'yellow': '#eab308',
  'pushti': '#ec4899',
  'pink': '#ec4899',
  'kulrang': '#6b7280',
  'gray': '#6b7280',
  'grey': '#6b7280',
  'jigarrang': '#92400e',
  'brown': '#92400e',
  'binafsha': '#8b5cf6',
  'purple': '#8b5cf6',
  'to\'q ko\'k': '#1e3a8a',
  'navy': '#1e3a8a',
  'oltin': '#fbbf24',
  'gold': '#fbbf24',
  'kumush': '#94a3b8',
  'silver': '#94a3b8',
  'bej': '#d4b896',
  'beige': '#d4b896',
};

// Chart colors for pie chart
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8b5cf6',
  '#f97316',
  '#06b6d4',
];

// Helper to format variant attributes
const formatVariantAttributes = (attrs: Record<string, any>) => {
  return Object.entries(attrs)
    .map(([key, value]) => `${value}`)
    .join(' / ');
};

// Extract color from variant attributes
const getColorFromAttrs = (attrs: Record<string, any>): string | null => {
  const colorKeys = ['color', 'rang', 'rangi'];
  for (const key of colorKeys) {
    if (attrs[key]) {
      const colorName = String(attrs[key]).toLowerCase();
      return colorMap[colorName] || null;
    }
  }
  return null;
};

// Group variants by attribute
const groupVariantsByAttribute = (
  variants: any[],
  attributeKey: string
): Record<string, any[]> => {
  return variants.reduce((groups, variant) => {
    const attrs = variant.variant_attributes as Record<string, any>;
    const value = attrs[attributeKey] || 'Boshqa';
    if (!groups[value]) groups[value] = [];
    groups[value].push(variant);
    return groups;
  }, {} as Record<string, any[]>);
};

// Get available grouping keys from variants
const getGroupingKeys = (variants: any[]): string[] => {
  if (!variants || variants.length === 0) return [];
  const keys = new Set<string>();
  variants.forEach((v) => {
    const attrs = v.variant_attributes as Record<string, any>;
    Object.keys(attrs).forEach((k) => keys.add(k));
  });
  return Array.from(keys);
};

export function ProductItemsView({ productId, productUuid, hasVariants }: ProductItemsViewProps) {
  const { cnyToUzs, usdToUzs } = useFinanceCurrency();
  const [expanded, setExpanded] = useState(false);
  const [groupBy, setGroupBy] = useState<string | null>(null);

  // Fetch variants for products with variants
  const { data: variants, isLoading: variantsLoading } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: hasVariants === true,
  });

  // Fetch item counts for summary (always fetch for box assignment display)
  const { data: itemSummary } = useQuery({
    queryKey: ['product-items-summary', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_items')
        .select('id, status, box_id, variant_id, boxes(box_number)')
        .eq('product_id', productId);

      if (error) throw error;
      return data;
    },
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ['product-items', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_items')
        .select('*, boxes(box_number)')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: expanded,
  });

  // Group items by box for summary
  const boxSummary = useMemo(() => {
    if (!itemSummary) return { inBoxes: [], noBox: 0, total: 0 };

    const boxCounts: Record<string, { boxNumber: string; count: number }> = {};
    const variantPendingCounts: Record<string, number> = {};
    let noBoxCount = 0;

    itemSummary.forEach(item => {
      // Count items in China/Transit/Pending per variant
      if (item.variant_id && (item.status === 'pending' || item.status === 'packed' || item.status === 'in_transit')) {
        variantPendingCounts[item.variant_id] = (variantPendingCounts[item.variant_id] || 0) + 1;
      }

      if (item.box_id && item.boxes) {
        const boxNumber = (item.boxes as any).box_number;
        if (!boxCounts[item.box_id]) {
          boxCounts[item.box_id] = { boxNumber, count: 0 };
        }
        boxCounts[item.box_id].count++;
      } else {
        // Only count as "no box" if item has progressed past pending/china stage
        const isPendingInChina = (item.status === 'pending' || !item.status);
        if (!isPendingInChina) {
          noBoxCount++;
        }
      }
    });

    return {
      inBoxes: Object.values(boxCounts),
      variantPending: variantPendingCounts,
      noBox: noBoxCount,
      total: itemSummary.length
    };
  }, [itemSummary]);

  const isLoadingData = (isLoading && expanded) || variantsLoading;

  // Grouping keys
  const groupingKeys = useMemo(() => getGroupingKeys(variants || []), [variants]);

  // Grouped variants
  const groupedVariants = useMemo(() => {
    if (!variants || !groupBy) return null;
    return groupVariantsByAttribute(variants, groupBy);
  }, [variants, groupBy]);

  // Pie chart data
  const pieData = useMemo(() => {
    if (!variants || variants.length === 0) return [];
    return variants
      .filter((v) => (v.stock_quantity || 0) > 0)
      .map((v) => {
        const attrs = v.variant_attributes as Record<string, any>;
        return {
          name: formatVariantAttributes(attrs),
          value: v.stock_quantity || 0,
        };
      });
  }, [variants]);

  if (isLoadingData && expanded) {
    return (
      <div className="mt-3 space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const itemCounts = items?.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate total stock from variants if available
  // Calculate total stock from variants if available (including pending in China)
  const totalVariantStock = variants?.reduce((sum, v) => {
    const local = v.stock_quantity || 0;
    const pending = boxSummary.variantPending[v.id] || 0;
    return sum + local + pending;
  }, 0) || 0;

  const renderVariantCard = (variant: any) => {
    const attrs = variant.variant_attributes as Record<string, any>;
    const colorHex = getColorFromAttrs(attrs);

    return (
      <Card
        key={variant.id}
        className="p-3 bg-secondary/20 border-border hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {colorHex && (
                <div
                  className="w-5 h-5 rounded-full border-2 border-border shadow-sm"
                  style={{ backgroundColor: colorHex }}
                  title={formatVariantAttributes(attrs)}
                />
              )}
              <Layers className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">
                {formatVariantAttributes(attrs)}
              </p>
              <Badge variant="outline" className="text-xs font-mono">
                SKU: {variant.sku}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {(variant.cost_price || variant.price) && (
                <span>Tannarx: {new Intl.NumberFormat('uz-UZ').format(
                  (() => {
                    const price = variant.cost_price || variant.price || 0;
                    if (variant.cost_price_currency === 'CNY') return price * cnyToUzs;
                    if (variant.cost_price_currency === 'USD') return price * usdToUzs;
                    return price;
                  })()
                )} so'm</span>
              )}
              {variant.barcode && (
                <span>Barkod: {variant.barcode}</span>
              )}
            </div>
          </div>
          <Badge
            variant={(variant.stock_quantity || 0) > 0 ? "default" : "secondary"}
            className="text-sm"
          >
            {variant.stock_quantity || 0} dona
          </Badge>
        </div>
      </Card>
    );
  };

  return (
    <div className="mt-3">
      {/* Variant Summary with color swatches */}
      {hasVariants && variants && variants.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {variants
            .filter(variant => {
              const localStock = variant.stock_quantity || 0;
              const pendingStock = boxSummary.variantPending[variant.id] || 0;
              return localStock > 0 || pendingStock > 0;
            })
            .map((variant) => {
              const attrs = variant.variant_attributes as Record<string, any>;
              const colorHex = getColorFromAttrs(attrs);
              const localStock = variant.stock_quantity || 0;
              const pendingStock = boxSummary.variantPending[variant.id] || 0;
              const totalStock = localStock + pendingStock;

              return (
                <Badge
                  key={variant.id}
                  variant="outline"
                  className={`text-xs gap-1.5 ${totalStock > 0 ? "bg-secondary/30" : "bg-muted/30 opacity-60"}`}
                >
                  {colorHex && (
                    <div
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: colorHex }}
                    />
                  )}
                  <Layers className="h-3 w-3" />
                  {formatVariantAttributes(attrs)}: {totalStock} dona
                  {pendingStock > 0 && localStock > 0 && (
                    <span className="text-[9px] text-orange-500 ml-0.5">({localStock} + {pendingStock})</span>
                  )}
                  {pendingStock > 0 && localStock === 0 && (
                    <span className="text-[9px] text-orange-500 ml-0.5">(yo'lda)</span>
                  )}
                </Badge>
              );
            })}
        </div>
      )}

      {/* Box Assignment Summary */}
      {boxSummary.total > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {boxSummary.inBoxes.map(box => (
            <Badge
              key={box.boxNumber}
              variant="outline"
              className="text-xs gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20"
            >
              📦 {box.boxNumber}: {box.count} ta
            </Badge>
          ))}
          {boxSummary.noBox > 0 && (
            <Badge
              variant="outline"
              className="text-xs gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
            >
              📭 Qutisiz: {boxSummary.noBox} ta
            </Badge>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Package className="h-4 w-4" />
        {hasVariants && variants ? (
          <span>
            {totalVariantStock} dona ({variants.length} variant)
          </span>
        ) : (
          <span>{boxSummary.total || items?.length || 0} ta individual mahsulot</span>
        )}
        {itemCounts && Object.keys(itemCounts).length > 0 && (
          <span className="text-xs">
            ({Object.entries(itemCounts).map(([status, count]) =>
              `${translateStatus(status)}: ${count}`
            ).join(', ')})
          </span>
        )}
      </Button>

      {expanded && (
        <div className="mt-2 space-y-3 pl-6 border-l-2 border-border ml-4">
          {/* Pie Chart for stock distribution */}
          {hasVariants && pieData.length > 0 && (
            <Card className="p-4 bg-secondary/10">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Zaxira taqsimoti
              </p>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={20}
                        outerRadius={40}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                        formatter={(value: number) => [`${value} dona`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{entry.name}:</span>
                      <span className="font-medium">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Detailed Variant List with Grouping */}
          {hasVariants && variants && variants.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Variantlar
                </p>
                {groupingKeys.length > 0 && (
                  <Tabs
                    value={groupBy || 'all'}
                    onValueChange={(v) => setGroupBy(v === 'all' ? null : v)}
                  >
                    <TabsList className="h-7">
                      <TabsTrigger value="all" className="text-xs px-2 h-6">
                        Hammasi
                      </TabsTrigger>
                      {groupingKeys.map((key) => (
                        <TabsTrigger key={key} value={key} className="text-xs px-2 h-6 capitalize">
                          {key}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}
              </div>

              {/* Ungrouped list */}
              {!groupBy && variants
                .filter(v => (v.stock_quantity || 0) > 0 || (boxSummary.variantPending[v.id] || 0) > 0)
                .map(renderVariantCard)}

              {/* Grouped list */}
              {groupBy && groupedVariants && (
                <div className="space-y-4">
                  {Object.entries(groupedVariants).map(([groupValue, groupVariants]) => {
                    const filteredVariants = groupVariants.filter(
                      v => (v.stock_quantity || 0) > 0 || (boxSummary.variantPending[v.id] || 0) > 0
                    );
                    
                    if (filteredVariants.length === 0) return null;

                    return (
                      <div key={groupValue} className="space-y-2">
                        <div className="flex items-center gap-2">
                          {colorMap[groupValue.toLowerCase()] && (
                            <div
                              className="w-4 h-4 rounded-full border border-border"
                              style={{ backgroundColor: colorMap[groupValue.toLowerCase()] }}
                            />
                          )}
                          <p className="text-sm font-medium text-foreground capitalize">
                            {groupValue}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {filteredVariants.reduce((sum, v) => sum + (v.stock_quantity || 0) + (boxSummary.variantPending[v.id] || 0), 0)} dona
                          </Badge>
                        </div>
                        {filteredVariants.map(renderVariantCard)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Individual Items */}
          {items && items.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Individual mahsulotlar
              </p>
              {items.map((item) => (
                <Card
                  key={item.id}
                  className="p-3 bg-muted/50 border-border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-mono text-foreground">
                          {item.item_uuid}
                        </p>
                        {item.boxes && (
                          <Badge variant="outline" className="text-xs">
                            📦 {item.boxes.box_number}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className={`h-3 w-3 ${getLocationColor(item.location || 'china')}`} />
                          {translateLocation(item.location || 'china')}
                        </span>
                        {item.notes && (
                          <span className="text-xs">• {item.notes}</span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getStatusColor(item.status || 'pending')}`}
                    >
                      {translateStatus(item.status || 'pending')}
                    </Badge>
                  </div>
                </Card>
              ))}
            </>
          )}

          {/* Empty state */}
          {(!items || items.length === 0) && (!variants || variants.length === 0) && (
            <p className="text-sm text-muted-foreground py-2">
              Hali individual mahsulotlar yo'q
            </p>
          )}
        </div>
      )}
    </div>
  );
}
