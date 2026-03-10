import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LazyImage } from "@/components/ui/lazy-image";
import { 
  ShoppingCart, 
  User, 
  Phone, 
  CreditCard, 
  Banknote, 
  ArrowRightLeft,
  Loader2,
  CheckCircle2,
  Package
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFinanceCurrency } from "@/contexts/FinanceCurrencyContext";
import { ExchangeRateBanner } from "@/components/crm/ExchangeRateBanner";


interface DirectSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preSelectedProduct?: {
    id: string;
    name: string;
    image?: string;
    warehousePrice: number | null;
    availableStock: number;
  };
}

const FALLBACK_RATE = 12850;

export function DirectSaleDialog({
  open,
  onOpenChange,
  onSuccess,
  preSelectedProduct,
}: DirectSaleDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { usdToUzs } = useFinanceCurrency();

  // Form state
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [currency, setCurrency] = useState<"UZS" | "USD">("UZS");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch products with stock
  const { data: products = [] } = useQuery({
    queryKey: ["tashkent-saleable-products-direct"],
    queryFn: async () => {
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          main_image_url,
          warehouse_price,
          tashkent_manual_stock
        `)
        .gt("tashkent_manual_stock", 0)
        .order("name");

      if (productsError) throw productsError;
      return productsData || [];
    },
    enabled: open,
  });

  // Use context rate (includes session override), fallback to constant
  const usdRate = usdToUzs || FALLBACK_RATE;


  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (preSelectedProduct) {
        setSelectedProductId(preSelectedProduct.id);
        setUnitPrice(preSelectedProduct.warehousePrice || 0);
      } else {
        setSelectedProductId("");
        setUnitPrice(0);
      }
      setQuantity(1);
      setCurrency("UZS");
      setPaymentMethod("cash");
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
    }
  }, [open, preSelectedProduct]);

  // Update price when product changes
  useEffect(() => {
    if (selectedProductId && !preSelectedProduct) {
      const product = products.find((p) => p.id === selectedProductId);
      if (product) {
        setUnitPrice(product.warehouse_price || 0);
      }
    }
  }, [selectedProductId, products, preSelectedProduct]);

  const selectedProduct = preSelectedProduct;
  const selectedProductFromList = products.find((p) => p.id === selectedProductId);

  const maxStock = preSelectedProduct?.availableStock ?? 
    selectedProductFromList?.tashkent_manual_stock ?? 0;

  // Calculate totals
  const totalPrice = quantity * unitPrice;
  const priceInUSD = currency === "USD" 
    ? totalPrice 
    : totalPrice / usdRate;
  const displayUSD = priceInUSD.toFixed(2);

  // Sale mutation
  const saleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductId || !user?.id) {
        throw new Error("Mahsulot tanlanmagan yoki foydalanuvchi topilmadi");
      }

      const productName = selectedProduct?.name || 
        products.find((p) => p.id === selectedProductId)?.name || "Noma'lum";

      // 1. Insert direct_sale
      const { data: sale, error: saleError } = await supabase
        .from("direct_sales")
        .insert({
          product_id: selectedProductId,
          product_name: productName,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          currency,
          price_usd: Number(priceInUSD.toFixed(2)),
          exchange_rate_at_sale: usdRate,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          payment_method: paymentMethod,
          payment_status: "paid",
          sold_by: user.id,
          notes: notes || null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Update product stock
      const currentProduct = products.find((p) => p.id === selectedProductId);
      const currentStock = currentProduct?.tashkent_manual_stock || 0;
      
      const { error: stockError } = await supabase
        .from("products")
        .update({ 
          tashkent_manual_stock: Math.max(0, currentStock - quantity) 
        })
        .eq("id", selectedProductId);

      if (stockError) throw stockError;

      // 3. Create finance transaction
      const { data: transaction, error: financeError } = await supabase
        .from("finance_transactions")
        .insert({
          transaction_type: "income",
          amount: Number(priceInUSD.toFixed(2)),
          currency: "USD",
          category: "To'g'ridan-to'g'ri sotuv",
          description: `${productName} - ${quantity} dona`,
          reference_id: sale.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (financeError) {
        console.error("Finance transaction error:", financeError);
      }

      // 4. Create inventory movement
      const { data: movement, error: movementError } = await supabase
        .from("inventory_movements")
        .insert({
          product_id: selectedProductId,
          movement_type: "sale",
          quantity: -quantity,
          reference_id: sale.id,
          reference_type: "direct_sale",
          notes: `Kvitansiya: ${sale.receipt_number}`,
          created_by: user.id,
        })
        .select()
        .single();

      if (movementError) {
        console.error("Movement error:", movementError);
      }

      // 5. Update sale with references
      if (transaction || movement) {
        await supabase
          .from("direct_sales")
          .update({
            finance_transaction_id: transaction?.id || null,
            movement_id: movement?.id || null,
          })
          .eq("id", sale.id);
      }

      return sale;
    },
    onSuccess: (sale) => {
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <p className="font-medium">Sotuv muvaffaqiyatli!</p>
            <p className="text-sm text-muted-foreground">
              Kvitansiya: {sale.receipt_number}
            </p>
          </div>
        </div>
      );
      queryClient.invalidateQueries({ queryKey: ["tashkent-saleable-products"] });
      queryClient.invalidateQueries({ queryKey: ["product-inventory-overview"] });
      queryClient.invalidateQueries({ queryKey: ["direct-sales"] });
      queryClient.invalidateQueries({ queryKey: ["tashkent-dashboard-stats"] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Sale error:", error);
      toast.error("Sotuvda xatolik yuz berdi");
    },
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("uz-UZ").format(price);
  };

  const paymentMethods = [
    { value: "cash", label: "Naqd", icon: Banknote },
    { value: "card", label: "Karta", icon: CreditCard },
    { value: "transfer", label: "O'tkazma", icon: ArrowRightLeft },
  ];

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[500px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Yangi sotuv
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          {/* Exchange Rate Banner */}
          <ExchangeRateBanner className="mb-1" />

          {/* Product Selection */}
          <div className="space-y-2">
            <Label>Mahsulot *</Label>
            {preSelectedProduct ? (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <LazyImage
                  src={preSelectedProduct.image || "/placeholder.svg"}
                  alt={preSelectedProduct.name}
                  className="w-12 h-12 rounded object-cover"
                />
                <div className="flex-1">
                  <p className="font-medium">{preSelectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(preSelectedProduct.warehousePrice || 0)} so'm
                  </p>
                </div>
                <Badge variant="secondary">
                  {preSelectedProduct.availableStock} dona
                </Badge>
              </div>
            ) : (
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Mahsulotni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span>{product.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {product.tashkent_manual_stock} dona
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Quantity & Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Miqdor *</Label>
              <Input
                type="number"
                min={1}
                max={maxStock}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(maxStock, Math.max(1, parseInt(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">
                Mavjud: {maxStock} dona
              </p>
            </div>
            <div className="space-y-2">
              <Label>Birlik narxi ({currency}) *</Label>
              <Input
                type="number"
                min={0}
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Currency & Total */}
          <div className="p-4 bg-primary/5 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <Label>Valyuta</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={currency === "UZS" ? "default" : "outline"}
                  onClick={() => setCurrency("UZS")}
                >
                  UZS
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={currency === "USD" ? "default" : "outline"}
                  onClick={() => setCurrency("USD")}
                >
                  USD
                </Button>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Jami:</span>
              <div className="text-right">
                <p className="text-xl font-bold">
                  {formatPrice(totalPrice)} {currency === "UZS" ? "so'm" : "$"}
                </p>
                {currency === "UZS" && (
                  <p className="text-sm text-muted-foreground">
                    ≈ ${displayUSD}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>To'lov usuli</Label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((method) => (
                <Button
                  key={method.value}
                  type="button"
                  variant={paymentMethod === method.value ? "default" : "outline"}
                  className="flex items-center gap-2"
                  onClick={() => setPaymentMethod(method.value as any)}
                >
                  <method.icon className="h-4 w-4" />
                  {method.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Customer Info (Optional) */}
          <div className="space-y-3">
            <Label className="text-muted-foreground">Xaridor (ixtiyoriy)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ism"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Telefon"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Izoh (ixtiyoriy)</Label>
            <Textarea
              placeholder="Qo'shimcha ma'lumot..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saleMutation.isPending}
          >
            Bekor qilish
          </Button>
          <Button
            onClick={() => saleMutation.mutate()}
            disabled={
              !selectedProductId || 
              quantity < 1 || 
              unitPrice <= 0 || 
              saleMutation.isPending
            }
            className="gap-2"
          >
            {saleMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saqlanmoqda...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Sotish
              </>
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
