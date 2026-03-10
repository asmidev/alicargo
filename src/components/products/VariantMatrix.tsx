import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatUZS } from "@/lib/utils";
import { VariantSkuMapping } from "./VariantSkuMapping";
import { useFinanceCurrency } from "@/contexts/FinanceCurrencyContext";

interface VariantData {
  id?: string;
  sku: string;
  barcode: string;
  price: string;
  stock_quantity: string;
  weight: string;
  variant_attributes: Record<string, string>;
  is_active: boolean;
  cost_price: string;
  cost_price_currency: string;
}

interface AttributeDefinition {
  id: string;
  name: string;
  attribute_key: string;
  attribute_type: string;
}

interface VariantMatrixProps {
  variants: VariantData[];
  selectedAttributes: string[];
  attributes: AttributeDefinition[];
  onVariantChange: (index: number, field: keyof VariantData, value: string | boolean) => void;
  onVariantToggle: (index: number) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  /** 
   * Mode: 'order' for Buyurtmalar (hides selling price, default CNY)
   * Mode: 'warehouse' for Toshkent Ombori (shows selling price, default UZS)
   */
  mode?: 'order' | 'warehouse';
  /** Shipping cost to China warehouse (CNY) */
  shippingCost?: string;
  onShippingCostChange?: (value: string) => void;
  /** SKU mappings per variant index: Record<storeId, sku[]> */
  skuMappings?: Record<number, Record<string, string[]>>;
  onSkuMappingsChange?: (index: number, mappings: Record<string, string[]>) => void;
}

const getCurrencySymbol = (currency: string) => {
  switch (currency) {
    case 'CNY': return '¥';
    case 'USD': return '$';
    case 'UZS': return "so'm";
    default: return '$';
  }
};

export function VariantMatrix({
  variants,
  selectedAttributes,
  attributes,
  onVariantChange,
  onVariantToggle,
  currency,
  onCurrencyChange,
  mode = 'warehouse',
  shippingCost,
  onShippingCostChange,
  skuMappings = {},
  onSkuMappingsChange,
}: VariantMatrixProps) {
  // Live exchange rates from global context (sessiya override yoki DB)
  const { usdToUzs, cnyToUzs } = useFinanceCurrency();

  // Helper to convert any amount to UZS
  const convertToUZS = (amount: number, fromCurrency: string) => {
    if (fromCurrency === 'USD') return amount * usdToUzs;
    if (fromCurrency === 'CNY') return amount * cnyToUzs;
    return amount; // UZS
  };

  // Helper to convert from CNY to another currency
  const convertFromCNY = (amountCNY: number, toCurrency: string) => {
    if (toCurrency === 'CNY') return amountCNY;
    const amountUZS = amountCNY * cnyToUzs;
    if (toCurrency === 'USD') return amountUZS / usdToUzs;
    return amountUZS; // UZS
  };

  const calculateTotalBaseCostInUZS = () => {
    return variants
      .filter(v => v.is_active)
      .reduce((sum, v) => sum + convertToUZS(parseFloat(v.cost_price || '0'), v.cost_price_currency || 'CNY') * parseInt(v.stock_quantity || '0'), 0);
  };

  const totalBaseCostInUZS = calculateTotalBaseCostInUZS();

  // Average Unit Price in CNY (for preview)
  const activeVariants = variants.filter(v => v.is_active);
  const avgUnitPriceCNY = activeVariants.length > 0
    ? activeVariants.reduce((sum, v) => sum + (convertToUZS(parseFloat(v.cost_price || '0'), v.cost_price_currency || 'CNY') / cnyToUzs), 0) / activeVariants.length
    : 0;

  // Shipping per item calculation (shippingCost is always in CNY)
  const totalActiveQuantity = variants
    .filter(v => v.is_active)
    .reduce((sum, v) => sum + parseInt(v.stock_quantity || '0'), 0);

  // Use 1 as fallback for unit preview
  const previewQuantity = Math.max(totalActiveQuantity, 1);
  const shippingPerItemCNY = (parseFloat(shippingCost || '0')) / previewQuantity;

  const totalShippingInUZS = (parseFloat(shippingCost || '0')) * cnyToUzs;

  const getAttributeName = (key: string) => {
    return attributes.find(a => a.attribute_key === key)?.name || key;
  };

  const getAttributeType = (key: string) => {
    return attributes.find(a => a.attribute_key === key)?.attribute_type || "text";
  };

  const getColorCode = (colorName: string): string => {
    const colors: Record<string, string> = {
      "qizil": "#ef4444",
      "ko'k": "#3b82f6",
      "yashil": "#22c55e",
      "sariq": "#eab308",
      "qora": "#171717",
      "oq": "#ffffff",
      "kulrang": "#6b7280",
      "pushti": "#ec4899",
      "binafsha": "#8b5cf6",
      "red": "#ef4444",
      "blue": "#3b82f6",
      "green": "#22c55e",
      "yellow": "#eab308",
      "black": "#171717",
      "white": "#ffffff",
      "gray": "#6b7280",
      "pink": "#ec4899",
      "purple": "#8b5cf6",
      "orange": "#f97316",
      "silver": "#c0c0c0",
      "gold": "#ffd700",
    };
    return colors[colorName.toLowerCase().trim()] || "#9ca3af";
  };

  if (variants.length === 0) {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Tan narx va zaxira</CardTitle>
            <Badge variant="outline" className="text-xs">{variants.length}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 border-r pr-3">
              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Yo'l haqqi (CNY):</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!onShippingCostChange}
                  value={shippingCost || ''}
                  onChange={(e) => onShippingCostChange?.(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="h-7 text-xs w-20 pr-7 py-0"
                  placeholder="0.00"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold">
                  CNY
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground">Valyuta:</Label>
              <Select value={currency} onValueChange={onCurrencyChange}>
                <SelectTrigger className="w-18 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">CNY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="UZS">UZS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full overflow-auto" style={{ maxHeight: "50vh" }}>
          <div className="min-w-[700px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-8 text-center px-1">Faol</TableHead>
                  {selectedAttributes.map(key => (
                    <TableHead key={key} className="min-w-[80px] px-2">
                      {getAttributeName(key)}
                    </TableHead>
                  ))}
                  {onSkuMappingsChange && (
                    <TableHead className="min-w-[130px] px-1">🏪 Do'kon SKU</TableHead>
                  )}
                  <TableHead className="min-w-[150px] px-1">Tan narx</TableHead>
                  {mode !== 'order' && (
                    <TableHead className="min-w-[110px] px-1">Narx</TableHead>
                  )}
                  <TableHead className="min-w-[80px] px-1">Miqdor</TableHead>
                  <TableHead className="min-w-[90px] px-1">Og'irlik</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((variant, index) => (
                  <TableRow
                    key={index}
                    className={!variant.is_active ? "opacity-50 bg-muted/30" : ""}
                  >
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => onVariantToggle(index)}
                        className="p-1"
                      >
                        {variant.is_active ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    {selectedAttributes.map(key => {
                      const value = variant.variant_attributes[key] || "-";
                      const type = getAttributeType(key);

                      return (
                        <TableCell key={key}>
                          <div className="flex items-center gap-1.5">
                            {type === "color" && (
                              <span
                                className="w-4 h-4 rounded-full border flex-shrink-0"
                                style={{ backgroundColor: getColorCode(value) }}
                              />
                            )}
                            <span className="text-sm">{value}</span>
                          </div>
                        </TableCell>
                      );
                    })}
                    {onSkuMappingsChange && (
                      <TableCell className="px-1 align-top">
                        <VariantSkuMapping
                          variantId={variant.id}
                          localMappings={skuMappings[index] || {}}
                          onLocalMappingsChange={(mappings) => onSkuMappingsChange(index, mappings)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="px-1">
                      <div className="flex items-center gap-0.5">
                        <Select
                          value={variant.cost_price_currency || 'CNY'}
                          onValueChange={(val) => onVariantChange(index, "cost_price_currency", val)}
                          disabled={!variant.is_active}
                        >
                          <SelectTrigger className="h-6 w-14 text-[10px] px-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CNY">¥</SelectItem>
                            <SelectItem value="USD">$</SelectItem>
                            <SelectItem value="UZS">so'm</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          value={variant.cost_price || ''}
                          onChange={(e) => onVariantChange(index, "cost_price", e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="h-6 text-xs w-24"
                          placeholder="0"
                          disabled={!variant.is_active}
                        />
                        {variant.is_active && (parseFloat(shippingCost || '0') > 0 || parseFloat(variant.cost_price || '0') > 0) && (
                          <div className="text-[9px] text-muted-foreground mt-1 whitespace-nowrap bg-green-50 dark:bg-green-950/30 px-1 rounded border border-green-100 dark:border-green-900/50">
                            <span className="font-semibold text-green-700 dark:text-green-400">
                              {totalActiveQuantity > 0 ? "Jami unit:" : "Projected unit:"}
                            </span> {(parseFloat(variant.cost_price || '0') + convertFromCNY(shippingPerItemCNY, variant.cost_price_currency || 'CNY')).toFixed(2)} {variant.cost_price_currency || 'CNY'}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {mode !== 'order' && (
                      <TableCell className="px-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={variant.price}
                          onChange={(e) => onVariantChange(index, "price", e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="h-6 text-xs w-24"
                          placeholder="0"
                          disabled={!variant.is_active}
                        />
                      </TableCell>
                    )}
                    <TableCell className="px-1">
                      <Input
                        type="number"
                        min="0"
                        value={variant.stock_quantity}
                        onChange={(e) => onVariantChange(index, "stock_quantity", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="h-6 text-xs w-16"
                        disabled={!variant.is_active}
                      />
                    </TableCell>
                    <TableCell className="px-1">
                      <div className="flex items-center gap-0.5">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={variant.weight || ''}
                          onChange={(e) => onVariantChange(index, "weight", e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="h-6 text-xs w-16"
                          placeholder="0"
                          disabled={!variant.is_active}
                        />
                        <span className="text-[10px] text-muted-foreground">g</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Summary and Shipping - Unified Row */}
        <div className="p-2 border-t bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Jami Tan narx:</span>
                  <span className="font-semibold">{formatUZS(totalBaseCostInUZS)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Jami Tan narx:</span>
                  <span className="font-semibold">{formatUZS(totalBaseCostInUZS)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Zaxira:</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {totalActiveQuantity}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">
                  {totalActiveQuantity > 0 ? "Umumiy buyurtma:" : "Taxminiy jami (1 dona uchun):"}
                </span>
                <Badge variant="outline" className="h-7 px-3 font-mono text-sm bg-background border-primary/20 text-primary">
                  {totalActiveQuantity > 0
                    ? formatUZS(totalBaseCostInUZS + totalShippingInUZS)
                    : formatUZS(Math.round((avgUnitPriceCNY + shippingPerItemCNY) * cnyToUzs))
                  }
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Dona tannarxi (Landed):</span>
                <span className="text-[10px] font-bold text-green-600 dark:text-green-400">
                  {formatUZS(Math.round((avgUnitPriceCNY + shippingPerItemCNY) * cnyToUzs))}
                </span>
                {parseFloat(shippingCost || '0') > 0 && (
                  <div className="text-[10px] text-muted-foreground italic bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded ml-1">
                    {totalActiveQuantity > 0
                      ? `(${shippingPerItemCNY.toFixed(2)} CNY yo'l haqqi/dona)`
                      : `(${parseFloat(shippingCost || '0').toFixed(2)} CNY yo'l haqqi jami)`
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
