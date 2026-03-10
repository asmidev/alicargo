import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calculator, Loader2 } from "lucide-react";

interface ProductIndicator {
  id: string;
  productId: string;
  name: string;
  variantLabel: string | null;
  isVariant: boolean;
  cost_price: number | null;
  cost_price_currency: string | null;
  shipping_cost_to_china: number | null;
  product_quantity: number | null;
  avg_domestic_shipping: number | null;
  avg_international_shipping_usd: number | null;
}

export interface CostPriceData {
  costPrice: number;
  costPriceCurrency: string;
  totalShippingCny: number;
  productQty: number;
  intlShippingUsd: number;
}

interface CostPriceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicator: ProductIndicator;
  onSave: (data: CostPriceData) => Promise<void>;
  usdToUzs: number;
  cnyToUzs: number;
}

export function CostPriceEditDialog({
  open,
  onOpenChange,
  indicator,
  onSave,
  usdToUzs,
  cnyToUzs,
}: CostPriceEditDialogProps) {
  const [saving, setSaving] = useState(false);

  const initCurrency = indicator.cost_price_currency || 'CNY';
  const initCostPrice = indicator.cost_price ?? 0;
  // domestic_shipping stored per unit in CNY, display as total * qty for editing
  const initQty = indicator.product_quantity ?? 1;
  // Fallback chain: avg_domestic_shipping → shipping_cost_to_china / qty → 0
  const initDomestic = indicator.avg_domestic_shipping;
  const initShippingFallback = (indicator.shipping_cost_to_china ?? 0) / Math.max(initQty, 1);
  const initDomesticPerUnit = (initDomestic !== null && initDomestic !== undefined) ? initDomestic : initShippingFallback;
  const initTotalShippingCny = initDomesticPerUnit * initQty;
  const initIntlUsd = indicator.avg_international_shipping_usd ?? 0;

  const [costPrice, setCostPrice] = useState(initCostPrice.toString());
  const [currency, setCurrency] = useState(initCurrency);
  const [totalShippingCny, setTotalShippingCny] = useState(initTotalShippingCny.toString());
  const [productQty, setProductQty] = useState(initQty.toString());
  const [intlShippingUsd, setIntlShippingUsd] = useState(initIntlUsd.toString());

  // Reset when dialog opens with new indicator
  useEffect(() => {
    if (open) {
      const currentCurrency = indicator.cost_price_currency || 'CNY';
      setCurrency(currentCurrency);
      setCostPrice((indicator.cost_price ?? 0).toString());
      const qty = indicator.product_quantity ?? 1;
      setProductQty(qty.toString());
      // Fallback chain: avg_domestic_shipping → shipping_cost_to_china / qty → 0
      const domestic = indicator.avg_domestic_shipping;
      const shippingFallback = (indicator.shipping_cost_to_china ?? 0) / Math.max(qty, 1);
      const perUnit = (domestic !== null && domestic !== undefined) ? domestic : shippingFallback;
      setTotalShippingCny((perUnit * qty).toFixed(2));
      setIntlShippingUsd((indicator.avg_international_shipping_usd ?? 0).toString());
    }
  }, [open, indicator]);

  const num = (v: string) => parseFloat(v) || 0;

  // Per-unit domestic in CNY
  const perUnitDomesticCny = useMemo(() => {
    const qty = Math.max(num(productQty), 1);
    return num(totalShippingCny) / qty;
  }, [totalShippingCny, productQty]);

  // Real-time total in UZS
  const totalUzs = useMemo(() => {
    const cp = num(costPrice);
    let baseUzs = 0;
    if (currency === "CNY") baseUzs = cp * cnyToUzs;
    else if (currency === "USD") baseUzs = cp * usdToUzs;
    else baseUzs = cp; // UZS

    const domesticUzs = perUnitDomesticCny * cnyToUzs;
    const intlUzs = num(intlShippingUsd) * usdToUzs;
    return baseUzs + domesticUzs + intlUzs;
  }, [costPrice, currency, perUnitDomesticCny, intlShippingUsd, cnyToUzs, usdToUzs]);

  const formatUzs = (v: number) =>
    new Intl.NumberFormat("uz-UZ").format(Math.round(v)) + " so'm";

  const handleSave = async () => {
    setSaving(true);
    try {
      // China Price as is
      const priceVal = num(costPrice);

      // Calculate total shipping in CNY:
      // Domestic total (already in CNY) + International per unit (transformed to CNY total)
      const usdToCny = usdToUzs / cnyToUzs;
      const qty = Math.max(num(productQty), 1);
      const intlTotalCny = num(intlShippingUsd) * qty * usdToCny;
      const combinedShippingCny = num(totalShippingCny) + intlTotalCny;

      await onSave({
        costPrice: priceVal,
        costPriceCurrency: currency,
        totalShippingCny: combinedShippingCny,
        productQty: qty,
        intlShippingUsd: num(intlShippingUsd),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const title = indicator.variantLabel
    ? `${indicator.name} — ${indicator.variantLabel}`
    : indicator.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-primary" />
            Tannarx tahrirlash
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{title}</p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Tan narx (Jami) - TEPADA KO'RSATILADI */}
          <div className="rounded-lg border bg-primary/5 border-primary/20 px-4 py-3 flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Tannarx (Jami):</span>
              <span className="text-xs text-muted-foreground">Barcha xarajatlar yig'indisi</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xl font-bold text-primary">
                {totalUzs > 0 ? formatUzs(totalUzs) : "—"}
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-primary underline decoration-primary/30"
                onClick={() => {
                  const baseUzs = totalUzs;
                  let finalVal = baseUzs;
                  if (currency === "CNY") finalVal = baseUzs / cnyToUzs;
                  else if (currency === "USD") finalVal = baseUzs / usdToUzs;
                  setCostPrice(finalVal.toFixed(2));
                  setTotalShippingCny("0");
                  setIntlShippingUsd("0");
                }}
              >
                Yig'indini narxga o'tkazish
              </Button>
            </div>
          </div>

          <Separator />

          {/* Xitoy narxi */}
          <div className="space-y-1.5 pt-2">
            <Label className="text-sm font-medium">Xitoy narxi (Sotib olingan narxi)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                className="flex-1"
                mobileOptimized={false}
              />
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-24 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">CNY ¥</SelectItem>
                  <SelectItem value="USD">USD $</SelectItem>
                  <SelectItem value="UZS">UZS so'm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {currency !== "UZS" && num(costPrice) > 0 && (
              <p className="text-xs text-muted-foreground">
                ≈{" "}
                {formatUzs(
                  num(costPrice) * (currency === "CNY" ? cnyToUzs : usdToUzs)
                )}
              </p>
            )}
          </div>

          <Separator />

          {/* Umumiy yo'l haqqi */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Umumiy yo'l haqqi</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Jami (CNY)</Label>
                <Input
                  type="number"
                  value={totalShippingCny}
                  onChange={(e) => setTotalShippingCny(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  mobileOptimized={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mahsulot soni</Label>
                <Input
                  type="number"
                  value={productQty}
                  onChange={(e) => setProductQty(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="1"
                  min={1}
                  mobileOptimized={false}
                />
              </div>
            </div>
            {perUnitDomesticCny > 0 && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex justify-between">
                <span>Dona uchun: {perUnitDomesticCny.toFixed(2)} CNY</span>
                <span className="font-medium text-foreground">
                  = {formatUzs(perUnitDomesticCny * cnyToUzs)}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Logistika yo'l haqqi */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Logistika yo'l haqqi</Label>
            <Label className="text-xs text-muted-foreground block">Dona uchun (USD)</Label>
            <Input
              type="number"
              value={intlShippingUsd}
              onChange={(e) => setIntlShippingUsd(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              mobileOptimized={false}
            />
            {num(intlShippingUsd) > 0 && (
              <p className="text-xs text-muted-foreground">
                ≈ {formatUzs(num(intlShippingUsd) * usdToUzs)}
              </p>
            )}
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Bekor qilish
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
