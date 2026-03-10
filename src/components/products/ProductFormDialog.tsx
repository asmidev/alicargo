import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Loader2, Package, Palette, Layers, Plus, X, Search, CheckCircle2, Link2, Truck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { VariantMatrix } from "./VariantMatrix";
import { NestedVariantBuilder, NestedVariantItem, generateVariantsFromNested } from "./NestedVariantBuilder";
import { VariantImageUpload } from "./VariantImageUpload";
import { ExchangeRateBanner } from "@/components/crm/ExchangeRateBanner";
import { useFinanceCurrency } from "@/contexts/FinanceCurrencyContext";
import { groupProducts, getColorStyle } from "@/lib/productGrouping";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct?: any;
}

interface Category {
  id: string;
  name: string;
  level: number;
  parent_id: string | null;
}

interface VariantAttribute {
  name: string;
  key: string;
  values: string[];
}

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
  image_url?: string;
}

interface CustomAttribute {
  key: string;
  value: string;
}

interface ExchangeRates {
  USD: number;
  CNY: number;
  UZS: number;
  lastUpdated: string | null;
}

interface TashkentProduct {
  id: string;
  uuid: string;
  name: string;
  main_image_url: string | null;
  tashkent_manual_stock: number;
  warehouse_price: number | null;
  source: string | null;
  product_variants: {
    id: string;
    sku: string;
    variant_attributes: Record<string, string>;
    stock_quantity: number;
  }[];
}

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  CNY: 7.25,
  UZS: 12700,
};

// Rang nomidan emoji olish
const getColorEmoji = (color: string | undefined): string => {
  if (!color) return "⚪";
  const c = color.toLowerCase().trim();
  const colorMap: Record<string, string> = {
    'qizil': '🔴', 'red': '🔴',
    "ko'k": '🔵', 'kok': '🔵', 'blue': '🔵', 'moviy': '🔵',
    'yashil': '🟢', 'green': '🟢',
    'sariq': '🟡', 'yellow': '🟡',
    'qora': '⚫', 'black': '⚫',
    'oq': '⚪', 'white': '⚪',
    'jigarrang': '🟤', 'brown': '🟤', 'qoʻngʻir': '🟤',
    'pushti': '💗', 'pink': '💗',
    'binafsha': '🟣', 'purple': '🟣',
    'kulrang': '⚫', 'gray': '⚫', 'grey': '⚫',
    'oltin': '🟡', 'gold': '🟡',
    'kumush': '⚪', 'silver': '⚪',
    "to'q ko'k": '🔵', 'navy': '🔵',
    'och yashil': '🟢', 'lime': '🟢',
  };
  return colorMap[c] || "⚪";
};

export function ProductFormDialog({ open, onOpenChange, editingProduct }: ProductFormDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("basic");

  // Basic product info
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    model: "",
    barcode: "", // NEW: Product barcode for marketplace linking
    category_id: "",
    notes: "",
    price: "",
    purchase_currency: "CNY",
    quantity: "1",
    weight: "",
    main_image_url: "",
    has_variants: true, // Always enabled - all products support variants
    shippingCostToChina: "", // Shipping cost to Chinese warehouse in CNY
    shippingDistribution: "equal" as "equal" | "individual", // Yo'l haqi taqsimoti usuli
  });

  // Individual yo'l haqilari (variant indeksi -> har bir itemga yo'l haqi CNY)
  const [individualShippingCosts, setIndividualShippingCosts] = useState<Record<number, string>>({});

  // Custom attributes (key-value pairs)
  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>([]);
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrValue, setNewAttrValue] = useState("");

  // Variant system - NESTED variant builder (rang → materiallar)
  const [nestedVariants, setNestedVariants] = useState<NestedVariantItem[]>([]);
  const [variants, setVariants] = useState<VariantData[]>([]);
  const [isLoadingExistingVariants, setIsLoadingExistingVariants] = useState(false);
  // Rang rasmlari: { rang: image_url }
  const [variantImages, setVariantImages] = useState<Record<string, string>>({});
  // SKU mappings: { variantIndex -> { storeId -> sku[] } }
  const [skuMappings, setSkuMappings] = useState<Record<number, Record<string, string[]>>>({});

  // === MAVJUD MAHSULOTGA BOG'LASH ===
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [existingProductSearch, setExistingProductSearch] = useState('');
  const [selectedExistingProduct, setSelectedExistingProduct] = useState<TashkentProduct | null>(null);
  const orderDetailsRef = useRef<HTMLDivElement>(null);
  const [selectedExistingVariant, setSelectedExistingVariant] = useState<string | null>(null);

  // Multi-select variant system for existing products
  interface SelectedVariantOrder {
    variantId: string;  // Mavjud variant ID yoki 'new-{index}' yangi uchun
    quantity: number | '';  // Bo'sh qiymatga ruxsat - yozish osonligi uchun
    isNew: boolean;
    rang?: string;
    material?: string;
    price?: string;
    weight?: string;  // Og'irlik (gramda)
  }
  const [selectedVariantOrders, setSelectedVariantOrders] = useState<SelectedVariantOrder[]>([]);
  const [showNewColorDialog, setShowNewColorDialog] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newMaterial, setNewMaterial] = useState('');
  const [newColorQuantity, setNewColorQuantity] = useState('1');
  const [newColorPrice, setNewColorPrice] = useState('');
  const [newColorWeight, setNewColorWeight] = useState('');

  // Use context exchange rates (session override or DB)
  const { usdToUzs, cnyToUzs } = useFinanceCurrency();

  // Calculate USD equivalent using context rates
  const calculateUSDEquivalent = (amount: string, currency: string): number | null => {
    if (!amount || isNaN(parseFloat(amount))) return null;
    const val = parseFloat(amount);
    if (currency === 'USD') return val;
    if (currency === 'CNY') return val / (cnyToUzs / usdToUzs);
    if (currency === 'UZS') return val / usdToUzs;
    return val;
  };

  const usdEquivalent = calculateUSDEquivalent(formData.price, formData.purchase_currency);

  // Fetch categories from categories_hierarchy (correct table for foreign key)
  const { data: categories } = useQuery({
    queryKey: ["categories_hierarchy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories_hierarchy")
        .select("id, name, slug, is_active, level, parent_id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
  });

  // === TOSHKENT OMBORIDAGI MAHSULOTLARNI QIDIRISH ===
  const { data: tashkentProducts = [], isLoading: isSearchingTashkent } = useQuery({
    queryKey: ['tashkent-linkable-products', existingProductSearch],
    queryFn: async (): Promise<TashkentProduct[]> => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, uuid, name, main_image_url, source,
          tashkent_manual_stock, warehouse_price,
          product_variants(id, sku, variant_attributes, stock_quantity)
        `)
        .eq('status', 'active')
        .neq('source', 'marketplace_auto')
        .gt('tashkent_manual_stock', 0)
        .ilike('name', `%${existingProductSearch}%`)
        .limit(30);

      if (error) throw error;
      return (data || []) as TashkentProduct[];
    },
    enabled: linkMode === 'existing' && existingProductSearch.length >= 2,
  });

  // Generate variants when nestedVariants change (using nested logic, NOT cartesian product)
  useEffect(() => {
    // Skip regeneration when loading existing variants
    if (isLoadingExistingVariants) return;
    // Edit rejimda variantlar bazadan yuklanadi, qayta generatsiya qilmaslik
    if (editingProduct) return;

    if (!formData.has_variants || nestedVariants.length === 0) {
      setVariants([]);
      return;
    }

    // Generate variants from nested structure (NOT cartesian product!)
    const newVariantData = generateVariantsFromNested(nestedVariants, formData.name);

    setVariants(prevVariants => {
      return newVariantData.map((newV) => {
        // Find existing variant by matching attributes (preserve user-entered values)
        const existingVariant = prevVariants.find(v =>
          v.sku === newV.sku || (
            v.variant_attributes.rang === newV.variant_attributes.rang &&
            (v.variant_attributes.material || '') === (newV.variant_attributes.material || '')
          )
        );

        if (existingVariant) {
          // Keep all user-entered values intact
          return existingVariant;
        }

        // Only create new variant if it doesn't exist
        return newV;
      });
    });
  }, [nestedVariants, formData.has_variants, formData.name, isLoadingExistingVariants]);

  // Valyuta sinxronizatsiyasi: purchase_currency o'zgarganda barcha variantlarni yangilash
  useEffect(() => {
    if (variants.length === 0) return;
    setVariants(prev => prev.map(v => ({
      ...v,
      cost_price_currency: formData.purchase_currency
    })));
  }, [formData.purchase_currency]);

  // Load existing variants when editing a product
  useEffect(() => {
    const loadExistingVariants = async () => {
      if (open && editingProduct?.id) {
        setIsLoadingExistingVariants(true);

        const { data: existingVariants, error } = await supabase
          .from('product_variants')
          .select('*')
          .eq('product_id', editingProduct.id)
          .eq('is_active', true);

        if (!error && existingVariants && existingVariants.length > 0) {
          // Reconstruct nested structure from existing variants
          const nestedMap = new Map<string, Set<string>>();

          existingVariants.forEach((v, index) => {
            const attrs = v.variant_attributes as Record<string, string>;
            const rang = attrs?.rang || attrs?.color || Object.values(attrs || {})[0] || `Variant-${index + 1}`;
            const material = attrs?.material || Object.values(attrs || {})[1] || "";

            if (!nestedMap.has(rang)) {
              nestedMap.set(rang, new Set());
            }
            if (material) {
              nestedMap.get(rang)!.add(material);
            }
          });

          // Convert to nestedVariants format
          const reconstructedNested: NestedVariantItem[] = Array.from(nestedMap.entries()).map(([rang, materials]) => ({
            rang,
            materiallar: Array.from(materials),
          }));

          setNestedVariants(reconstructedNested);

          // Set variants data
          const variantData: VariantData[] = existingVariants.map(v => ({
            id: v.id,
            sku: v.sku,
            barcode: v.barcode || "",
            price: v.price?.toString() || "",
            stock_quantity: v.stock_quantity?.toString() || "0",
            weight: v.weight?.toString() || "",
            variant_attributes: v.variant_attributes as Record<string, string>,
            is_active: v.is_active ?? true,
            cost_price: (v as any).cost_price?.toString() || "",
            cost_price_currency: (v as any).cost_price_currency || "CNY",
            image_url: (v as any).image_url || undefined,
          }));

          setVariants(variantData);

          // Load variant images map: { rang -> image_url }
          const imagesMap: Record<string, string> = {};
          existingVariants.forEach((v, index) => {
            const attrs = v.variant_attributes as Record<string, string>;
            const rang = attrs?.rang || attrs?.color || Object.values(attrs || {})[0] || `Variant-${index + 1}`;
            if ((v as any).image_url) {
              imagesMap[rang] = (v as any).image_url;
            }
          });
          setVariantImages(imagesMap);

          // Load existing SKU mappings for each variant
          const variantIds = existingVariants.map(v => v.id).filter(Boolean);
          if (variantIds.length > 0) {
            const { data: skuData } = await supabase
              .from('variant_sku_mappings')
              .select('variant_id, store_id, external_sku')
              .in('variant_id', variantIds);
            if (skuData && skuData.length > 0) {
              const mappingsByIndex: Record<number, Record<string, string[]>> = {};
              existingVariants.forEach((v, idx) => {
                const variantMappings: Record<string, string[]> = {};
                skuData.filter(s => s.variant_id === v.id).forEach(s => {
                  if (!variantMappings[s.store_id]) variantMappings[s.store_id] = [];
                  variantMappings[s.store_id].push(s.external_sku);
                });
                if (Object.keys(variantMappings).length > 0) {
                  mappingsByIndex[idx] = variantMappings;
                }
              });
              setSkuMappings(mappingsByIndex);
            }
          }
        }

        // Allow regeneration again after a short delay
        setTimeout(() => setIsLoadingExistingVariants(false), 100);
      }
    };

    loadExistingVariants();
  }, [open, editingProduct?.id]);

  useEffect(() => {
    if (open && editingProduct) {
      // Tahrirlash rejimi - form ni mavjud mahsulot ma'lumotlari bilan to'ldirish
      // Edit rejimda: variantdagi valyutani ustunlik bilan olish
      // Agar variantlarda CNY bo'lsa, lekin productda UZS — variantnikini olish
      const effectiveCurrency = editingProduct.product_variants?.[0]?.cost_price_currency
        || editingProduct.purchase_currency
        || 'CNY';
      setFormData({
        name: editingProduct.name || "",
        brand: editingProduct.brand || "",
        model: editingProduct.model || "",
        barcode: editingProduct.barcode || "", // NEW
        category_id: editingProduct.category_id || "",
        notes: editingProduct.notes || "",
        price: editingProduct.price?.toString() || "",
        purchase_currency: effectiveCurrency,
        quantity: editingProduct.quantity?.toString() || "1",
        weight: editingProduct.weight?.toString() || "",
        main_image_url: editingProduct.main_image_url || "",
        has_variants: true,
        shippingCostToChina: editingProduct.shipping_cost_to_china?.toString() || "",
        shippingDistribution: "equal",
      });
      const attrs = editingProduct.custom_attributes || {};
      setCustomAttributes(Object.entries(attrs).map(([key, value]) => ({ key, value: String(value) })));

      // If editing a product, check if it has pending items in China (to populate link state)
      const fetchPendingItems = async () => {
        const { data: pendingItems, error } = await supabase
          .from('product_items')
          .select('variant_id, unit_cost, weight_grams')
          .eq('product_id', editingProduct.id)
          .eq('status', 'pending')
          .eq('location', 'china');
        
        if (!error && pendingItems && pendingItems.length > 0) {
          // Group by variant_id
          const grouped: Record<string, { count: number, price: number, weight: number }> = {};
          pendingItems.forEach(item => {
            const vid = item.variant_id || 'no-variant';
            if (!grouped[vid]) {
              grouped[vid] = { count: 0, price: item.unit_cost || 0, weight: item.weight_grams || 0 };
            }
            grouped[vid].count++;
          });

          const initialOrders: SelectedVariantOrder[] = Object.entries(grouped).map(([vid, data]) => ({
            variantId: vid === 'no-variant' ? "" : vid,
            quantity: data.count,
            isNew: false,
            price: data.price.toString(),
            weight: data.weight.toString()
          }));

          if (initialOrders.length > 0) {
            setSelectedVariantOrders(initialOrders);
            // Also set linkMode to existing if we found pending items (implies it originated from a link/order)
            setLinkMode('existing');
            setSelectedExistingProduct({
              id: editingProduct.id,
              uuid: editingProduct.uuid,
              name: editingProduct.name,
              main_image_url: editingProduct.main_image_url,
              source: editingProduct.source,
              tashkent_manual_stock: editingProduct.tashkent_manual_stock,
              warehouse_price: editingProduct.warehouse_price,
              product_variants: editingProduct.product_variants || []
            } as any);
          }
        }
      };

      fetchPendingItems();
    } else if (open && !editingProduct) {
      // YANGI MAHSULOT rejimi - barcha state larni tozalash
      setFormData({
        name: "",
        brand: "",
        model: "",
        barcode: "", // NEW
        category_id: "",
        notes: "",
        price: "",
        purchase_currency: "CNY",
        quantity: "1",
        weight: "",
        main_image_url: "",
        has_variants: true,
        shippingCostToChina: "",
        shippingDistribution: "equal",
      });
      setCustomAttributes([]);
      setNestedVariants([]);
      setVariants([]);
      setVariantImages({});
      setSkuMappings({});
      setIsLoadingExistingVariants(false);
      setActiveTab("basic");
      setNewAttrKey("");
      setNewAttrValue("");
      // Link mode state larni tozalash - bu ToggleGroup ko'rinishi uchun muhim
      setLinkMode('new');
      setExistingProductSearch('');
      setSelectedExistingProduct(null);
      setSelectedExistingVariant(null);
      setIndividualShippingCosts({});
      // Multi-select variant state larni tozalash
      setSelectedVariantOrders([]);
      setShowNewColorDialog(false);
      setNewColorName('');
      setNewMaterial('');
      setNewColorQuantity('1');
      setNewColorPrice('');
    }
    // !open holatida hech narsa qilmaymiz - keyingi ochilishda tozalanadi
  }, [open, editingProduct]);

  const generateUUID = () => {
    return 'PROD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      console.log("Starting product save...", { formData, variants });

      const { data: { user } } = await supabase.auth.getUser();

      const customAttrsObj = customAttributes.reduce((acc, attr) => {
        if (attr.key.trim()) {
          acc[attr.key] = attr.value;
        }
        return acc;
      }, {} as Record<string, string>);

      // Get current exchange rate for the selected currency using context rates
      // currentRate is the multiplier to get UZS from the selected currency
      let currentRate = 1;
      if (formData.purchase_currency === 'CNY') currentRate = cnyToUzs;
      else if (formData.purchase_currency === 'USD') currentRate = usdToUzs;
      else if (formData.purchase_currency === 'UZS') currentRate = 1;

      const priceValue = formData.price ? parseFloat(formData.price) : null;
      // Convert to USD safely
      const purchasePriceUSD = (priceValue !== null && usdToUzs > 0) ? (priceValue * currentRate) / usdToUzs : null;

      // Calculate quantity: if variants exist use their sum, otherwise use form quantity
      const calculatedQuantity = formData.has_variants && variants.length > 0
        ? variants.reduce((sum, v) => sum + parseInt(v.stock_quantity || "0"), 0)
        : parseInt(formData.quantity) || 1;

      // Convert and average unit costs correctly across different currencies
      const getUnitCostInUZS = (v: VariantData) => {
        const cost = parseFloat(v.cost_price || '0');
        const currency = v.cost_price_currency || formData.purchase_currency;
        const rate = currency === 'USD' ? usdToUzs : currency === 'CNY' ? cnyToUzs : 1;
        return cost * rate;
      };

      const variantsWithCost = variants.filter(v => parseFloat(v.cost_price) > 0);
      let avgUnitCostUZS = 0;

      if (formData.has_variants && variantsWithCost.length > 0) {
        avgUnitCostUZS = variantsWithCost.reduce((sum, v) => sum + getUnitCostInUZS(v), 0) / variantsWithCost.length;
      } else {
        const rate = formData.purchase_currency === 'USD' ? usdToUzs : formData.purchase_currency === 'CNY' ? cnyToUzs : 1;
        avgUnitCostUZS = (priceValue || 0) * rate;
      }

      const totalShipping = parseFloat(formData.shippingCostToChina) || 0;
      const shippingPerItemCNY = calculatedQuantity > 0 ? totalShipping / calculatedQuantity : 0;
      const shippingPerItemUZS = shippingPerItemCNY * cnyToUzs;
      const landedCostUZS = Math.round(avgUnitCostUZS + shippingPerItemUZS);

      const productData = {
        uuid: editingProduct?.uuid || generateUUID(),
        name: formData.name,
        brand: formData.brand || null,
        model: formData.model || null,
        barcode: formData.barcode || null,
        category_id: formData.category_id || null,
        notes: formData.notes || null,
        price: priceValue,
        purchase_currency: formData.purchase_currency || editingProduct?.purchase_currency || 'CNY',
        purchase_exchange_rate: currentRate,
        purchase_price_usd: purchasePriceUSD,
        purchased_at: editingProduct?.purchased_at || new Date().toISOString(),
        weight: formData.weight ? parseFloat(formData.weight) : null,
        main_image_url: formData.main_image_url || null,
        has_variants: formData.has_variants,
        custom_attributes: customAttrsObj,
        quantity: calculatedQuantity,
        created_by: user?.id,
        shipping_cost_to_china: formData.shippingCostToChina ? parseFloat(formData.shippingCostToChina) : null,
        // MUHIM: cost_price ni so'mga o'girmasdan, asl purchase currencyda saqlaymiz.
        // Bu keyinchalik indicators va edit dialog-da double-counting va unit mismatch-ni oldini oladi.
        cost_price: priceValue,
      };

      console.log("Product data to save:", productData);

      const makeItemUuid = (productUuid: string, suffix: string) => {
        const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
        return `${productUuid}-${suffix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
      };

      const syncFreeItems = async (opts: {
        productId: string;
        productUuid: string;
        desiredCount: number;
        itemStatus: string;
        itemLocation: string;
        unitCost: number | null;
        unitCostUSD: number | null;
        variantId?: string | null;
        variantSku?: string | null;
        domesticShippingPerItem?: number; // Pre-calculated shipping per item for variants
      }) => {
        const {
          productId,
          productUuid,
          desiredCount,
          itemStatus,
          itemLocation,
          unitCost,
          unitCostUSD,
          variantId = null,
          variantSku = null,
          domesticShippingPerItem: preCalculatedShipping,
        } = opts;

        // Count ALL free items (not in any box), regardless of status
        // This fixes the issue where editing a product wouldn't find existing items
        // because they had a different status than the default
        const baseQuery = supabase
          .from('product_items')
          .select('id, status')
          .eq('product_id', productId)
          .is('box_id', null);

        const { data: existingItems, error: existingError } = variantId
          ? await baseQuery.eq('variant_id', variantId)
          : await baseQuery.is('variant_id', null);

        if (existingError) throw existingError;

        const currentCount = existingItems?.length || 0;
        const diff = desiredCount - currentCount;

        if (diff > 0) {
          // Use pre-calculated shipping if provided (for variants), otherwise calculate from total
          const domesticShippingPerItem = preCalculatedShipping !== undefined
            ? preCalculatedShipping
            : (formData.shippingCostToChina && desiredCount > 0
              ? parseFloat(formData.shippingCostToChina) / desiredCount
              : 0);

          const itemsToCreate = Array.from({ length: diff }, (_, i) => ({
            item_uuid: makeItemUuid(productUuid, variantSku ? `${variantSku}-${i + 1}` : (i + 1).toString().padStart(3, '0')),
            product_id: productId,
            variant_id: variantId,
            status: itemStatus,
            location: itemLocation,
            unit_cost: unitCost,
            unit_cost_currency: formData.purchase_currency,
            unit_cost_usd: unitCostUSD,
            exchange_rate_at_purchase: currentRate,
            domestic_shipping_cost: domesticShippingPerItem,
            cost_breakdown: {
              purchase_price: unitCost,
              purchase_currency: formData.purchase_currency,
              domestic_shipping: domesticShippingPerItem,
              domestic_shipping_currency: 'CNY',
            },
          }));

          const { error: insertError } = await supabase
            .from('product_items')
            .insert(itemsToCreate);
          if (insertError) throw insertError;
        }

        if (diff < 0) {
          const idsToDelete = (existingItems || []).slice(0, Math.abs(diff)).map((i: any) => i.id);
          if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
              .from('product_items')
              .delete()
              .in('id', idsToDelete);
            if (deleteError) throw deleteError;
          }
        }
      };

      const itemStatus = 'pending';
      const itemLocation = 'china';

      // === MAVJUD MAHSULOTGA BOG'LASH LOGIKASI (MULTI-SELECT) ===
      if (linkMode === 'existing' && selectedExistingProduct) {
        console.log("Linking to existing product:", selectedExistingProduct.name, "with", selectedVariantOrders.length, "variant orders");

        const productId = selectedExistingProduct.id;

        // Agar mahsulot marketplace_auto bo'lsa, source ni manual ga o'zgartirish
        if (selectedExistingProduct.source === 'marketplace_auto') {
          await supabase.from('products').update({ source: 'manual' }).eq('id', productId);
        }
        const productUuid = selectedExistingProduct.uuid;

        // === NEW: Clear all existing pending items for this product in China before re-syncing ===
        // This ensures that if a variant is unchecked, its items are removed.
        const { error: clearError } = await supabase
          .from('product_items')
          .delete()
          .eq('product_id', productId)
          .eq('status', 'pending')
          .eq('location', 'china');
        
        if (clearError) console.warn("Error clearing old pending items:", clearError);

        // Agar multi-select variant orders mavjud bo'lsa
        if (selectedVariantOrders.length > 0) {
          // Calculate total quantity for equal shipping distribution
          const totalQuantityForLink = selectedVariantOrders.reduce((sum, o) => sum + (typeof o.quantity === 'number' ? o.quantity : 1), 0);
          const totalShippingForLink = parseFloat(formData.shippingCostToChina) || 0;
          const equalShippingForLink = totalShippingForLink > 0 && totalQuantityForLink > 0
            ? totalShippingForLink / totalQuantityForLink
            : 0;

          for (const order of selectedVariantOrders) {
            let variantId: string;

            if (order.isNew) {
              // Yangi variant yaratish
              const newSku = `${selectedExistingProduct.uuid}-${(order.rang || 'X').substring(0, 3).toUpperCase()}-${(order.material || 'X').substring(0, 3).toUpperCase()}`;
              const { data: newVariant, error: variantError } = await supabase
                .from('product_variants')
                .insert({
                  product_id: productId,
                  sku: newSku,
                  price: order.price ? parseFloat(order.price) : priceValue,
                  stock_quantity: 0, // Xitoyda kutilmoqda, Toshkentda 0
                  variant_attributes: { rang: order.rang, material: order.material },
                  is_active: true,
                  cost_price: order.price ? parseFloat(order.price) : priceValue,
                  cost_price_currency: 'CNY',
                  weight: order.weight ? parseFloat(order.weight) : null,  // Og'irlikni variantga saqlash
                })
                .select('id')
                .single();

              if (variantError) throw variantError;
              variantId = newVariant.id;
              console.log("Created new variant:", order.rang, order.material, "->", variantId);
            } else {
              variantId = order.variantId;
              // MUHIM: Mavjud variantning tannarxini va og'irligini ham yangilab qo'yamiz (Arslonbek so'ragan avtomatlashtirish)
              await supabase
                .from('product_variants')
                .update({ 
                  cost_price: order.price ? parseFloat(order.price) : priceValue,
                  cost_price_currency: formData.purchase_currency,
                  weight: order.weight ? parseFloat(order.weight) : null
                })
                .eq('id', variantId);
            }

            // product_items yaratish - bo'sh quantity bo'lsa 1 ga default
            const qty = typeof order.quantity === 'number' && order.quantity > 0 ? order.quantity : 1;
            if (qty > 0) {
              const unitCost = order.price ? parseFloat(order.price) : priceValue;
              // currentRate helps convert unitCost to UZS, then divide by usdToUzs to get USD
              const unitCostUSD = (unitCost !== null && usdToUzs > 0) ? (unitCost * (formData.purchase_currency === 'CNY' ? cnyToUzs : usdToUzs)) / usdToUzs : null;
              const domesticShippingPerItem = equalShippingForLink;
              const domesticShippingPerItemUSD = (domesticShippingPerItem * cnyToUzs) / usdToUzs;
              const finalCostUSD = (unitCostUSD || 0) + domesticShippingPerItemUSD;

              // Deletion is now handled once above the loop to handle unchecks correctly

              // Get variant SKU for item_uuid
              let variantSku = 'ITEM';
              if (!order.isNew) {
                const existingV = selectedExistingProduct.product_variants?.find(v => v.id === variantId);
                if (existingV) variantSku = existingV.sku;
              } else {
                variantSku = `${(order.rang || 'X').substring(0, 3).toUpperCase()}-${(order.material || 'X').substring(0, 3).toUpperCase()}`;
              }

              const itemsToCreate = Array.from({ length: qty }, (_, i) => ({
                item_uuid: makeItemUuid(productUuid, `${variantSku}-${i + 1}`),
                product_id: productId,
                variant_id: variantId,
                status: itemStatus,
                location: itemLocation,
                unit_cost: unitCost,
                unit_cost_currency: formData.purchase_currency,
                unit_cost_usd: unitCostUSD,
                exchange_rate_at_purchase: currentRate,
                domestic_shipping_cost: domesticShippingPerItem,
                final_cost_usd: finalCostUSD > 0 ? finalCostUSD : null,
                weight_grams: order.weight ? parseFloat(order.weight) : null,  // Og'irlikni saqlash
                cost_breakdown: {
                  purchase_price: unitCost,
                  purchase_currency: formData.purchase_currency,
                  domestic_shipping: domesticShippingPerItem,
                  domestic_shipping_currency: 'CNY',
                },
              }));

              const { error: itemError } = await supabase
                .from('product_items')
                .insert(itemsToCreate);
              if (itemError) throw itemError;
              console.log(`Created ${qty} items for variant ${variantId}`);
            }
          }
        } else if (selectedExistingVariant) {
          // Eskcha bitta variant tanlash (backward compatibility)
          const desiredCount = parseInt(formData.quantity) || 1;
          const unitCost = priceValue;
          const unitCostUSD = purchasePriceUSD;

          const totalShippingCNY = parseFloat(formData.shippingCostToChina) || 0;
          const domesticShippingPerItem = totalShippingCNY > 0 && desiredCount > 0
            ? totalShippingCNY / desiredCount
            : 0;
          const domesticShippingPerItemUSD = domesticShippingPerItem / currentRate;
          const finalCostUSD = (unitCostUSD || 0) + domesticShippingPerItemUSD;

          const productItems = Array.from({ length: desiredCount }, (_, i) => ({
            item_uuid: makeItemUuid(productUuid, (i + 1).toString().padStart(3, '0')),
            product_id: productId,
            variant_id: selectedExistingVariant,
            status: itemStatus,
            location: itemLocation,
            unit_cost: unitCost,
            unit_cost_currency: formData.purchase_currency,
            unit_cost_usd: unitCostUSD,
            domestic_shipping_cost: domesticShippingPerItem,
            final_cost_usd: finalCostUSD > 0 ? finalCostUSD : null,
            exchange_rate_at_purchase: currentRate,
          }));

          const { error: itemError } = await supabase
            .from("product_items")
            .insert(productItems);
          if (itemError) throw itemError;
        } else {
          // Variantsiz mahsulot uchun (hech qanday variant tanlanmagan)
          const desiredCount = parseInt(formData.quantity) || 1;
          const unitCost = priceValue;
          const unitCostUSD = purchasePriceUSD;

          const totalShippingCNY = parseFloat(formData.shippingCostToChina) || 0;
          const domesticShippingPerItem = totalShippingCNY > 0 && desiredCount > 0
            ? totalShippingCNY / desiredCount
            : 0;
          const domesticShippingPerItemUSD = domesticShippingPerItem / currentRate;
          const finalCostUSD = (unitCostUSD || 0) + domesticShippingPerItemUSD;

          const productItems = Array.from({ length: desiredCount }, (_, i) => ({
            item_uuid: makeItemUuid(productUuid, (i + 1).toString().padStart(3, '0')),
            product_id: productId,
            variant_id: null,
            status: itemStatus,
            location: itemLocation,
            unit_cost: unitCost,
            unit_cost_currency: formData.purchase_currency,
            unit_cost_usd: unitCostUSD,
            domestic_shipping_cost: domesticShippingPerItem,
            final_cost_usd: finalCostUSD > 0 ? finalCostUSD : null,
            exchange_rate_at_purchase: currentRate,
          }));

          const { error: itemError } = await supabase
            .from("product_items")
            .insert(productItems);
          if (itemError) throw itemError;
        }

        // Buyurtma mahsulotning quantity'sini yangilash shart emas - product_items allaqachon bog'langan
        console.log("Successfully linked product_items to existing product:", productId);
        
        // Invalidate queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['pending-items-china'] });
        queryClient.invalidateQueries({ queryKey: ['product-inventory-overview'] });
        queryClient.invalidateQueries({ queryKey: ['tashkent-grouped-products'] });
        
        return; // Erta chiqish - yangi mahsulot yaratmaslik
      }

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);
        if (error) throw error;

        // Keep stock in sync so products always appear in box packing search
        if (formData.has_variants) {
          // Upsert variants by SKU (avoid deleting variants because product_items may reference them)
          const { data: existingVariants, error: existingVariantsError } = await supabase
            .from('product_variants')
            .select('id, sku')
            .eq('product_id', editingProduct.id);
          if (existingVariantsError) throw existingVariantsError;

          const existingBySku = new Map((existingVariants || []).map(v => [v.sku, v.id]));
          const desiredSkus = new Set(variants.map(v => v.sku));

          for (const v of variants) {
            const attrs = v.variant_attributes || {};
            const rang = attrs.rang || attrs.color || Object.values(attrs)[0] || v.sku;
            const payload = {
              product_id: editingProduct.id,
              sku: v.sku,
              barcode: v.barcode || null,
              price: v.price ? parseFloat(v.price) : null,
              stock_quantity: parseInt(v.stock_quantity) || 0,
              weight: v.weight ? parseFloat(v.weight) : null,
              variant_attributes: v.variant_attributes,
              is_active: v.is_active,
              cost_price: v.cost_price ? parseFloat(v.cost_price) : null,
              cost_price_currency: formData.purchase_currency || v.cost_price_currency || 'CNY',
              image_url: variantImages[rang] || (v as any).image_url || null,
            };

            const existingId = existingBySku.get(v.sku);
            if (existingId) {
              const { error: updateVariantError } = await supabase
                .from('product_variants')
                .update(payload)
                .eq('id', existingId);
              if (updateVariantError) throw updateVariantError;
            } else {
              const { error: insertVariantError } = await supabase
                .from('product_variants')
                .insert(payload);
              if (insertVariantError) throw insertVariantError;
            }
          }

          // Deactivate removed variants (don’t delete)
          const removedVariantIds = (existingVariants || [])
            .filter(v => !desiredSkus.has(v.sku))
            .map(v => v.id);

          if (removedVariantIds.length > 0) {
            const { error: deactivateError } = await supabase
              .from('product_variants')
              .update({ is_active: false, stock_quantity: 0 })
              .in('id', removedVariantIds);
            if (deactivateError) throw deactivateError;
          }

          // Save SKU mappings
          const { data: allCurVarsForSku } = await supabase
            .from('product_variants')
            .select('id, sku')
            .eq('product_id', editingProduct.id)
            .eq('is_active', true);
          if (allCurVarsForSku) {
            for (const [indexStr, storeMappings] of Object.entries(skuMappings)) {
              const idx = parseInt(indexStr);
              const v = variants[idx];
              if (!v) continue;
              const matched = allCurVarsForSku.find(cv => cv.sku === v.sku);
              if (!matched) continue;
              // Delete existing mappings for this variant then insert new ones
              await supabase.from('variant_sku_mappings').delete().eq('variant_id', matched.id);
              const toInsert: { variant_id: string; store_id: string; external_sku: string }[] = [];
              for (const [storeId, skus] of Object.entries(storeMappings)) {
                for (const sku of skus) {
                  if (sku.trim()) {
                    toInsert.push({ variant_id: matched.id, store_id: storeId, external_sku: sku.trim() });
                  }
                }
              }
              if (toInsert.length > 0) {
                await supabase.from('variant_sku_mappings').insert(toInsert);
              }
            }
          }

        }
      } else {
        const { data: newProduct, error: productError } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();

        if (productError) {
          console.error("Product insert error:", productError);
          throw productError;
        }

        console.log("Product created:", newProduct);

        if (formData.has_variants && variants.length > 0) {
          const variantInserts = variants.map(v => ({
            product_id: newProduct.id,
            sku: v.sku,
            barcode: v.barcode || null,
            price: v.price ? parseFloat(v.price) : null,
            stock_quantity: parseInt(v.stock_quantity) || 0,
            weight: v.weight ? parseFloat(v.weight) : null,
            variant_attributes: v.variant_attributes,
            is_active: v.is_active,
            cost_price: v.cost_price ? parseFloat(v.cost_price) : null,
            cost_price_currency: v.cost_price_currency || 'CNY',
            image_url: v.variant_attributes?.rang ? (variantImages[v.variant_attributes.rang] || null) : null,
          }));

          const { data: insertedVariants, error: variantError } = await supabase
            .from("product_variants")
            .insert(variantInserts)
            .select('id, sku, price, stock_quantity, is_active');
          if (variantError) throw variantError;

          // Save SKU mappings for newly created variants
          if (insertedVariants) {
            for (const [indexStr, storeMappings] of Object.entries(skuMappings)) {
              const idx = parseInt(indexStr);
              const originalVariant = variants[idx];
              if (!originalVariant) continue;
              const matched = insertedVariants.find(iv => iv.sku === originalVariant.sku);
              if (!matched) continue;
              const toInsert: { variant_id: string; store_id: string; external_sku: string }[] = [];
              for (const [storeId, skus] of Object.entries(storeMappings)) {
                for (const sku of skus) {
                  if (sku.trim()) {
                    toInsert.push({ variant_id: matched.id, store_id: storeId, external_sku: sku.trim() });
                  }
                }
              }
              if (toInsert.length > 0) {
                await supabase.from('variant_sku_mappings').insert(toInsert);
              }
            }
          }

          // Create product_items for each variant stock so it appears in box packing
          // Calculate shipping based on distribution mode
          const isIndividualShipping = formData.shippingDistribution === "individual";

          // For equal distribution, calculate total shipping per item
          const totalQuantityAcrossVariants = (insertedVariants || [])
            .filter(v => v.is_active && Number(v.stock_quantity || 0) > 0)
            .reduce((sum, v) => sum + Number(v.stock_quantity || 0), 0);

          const totalShippingCNY = parseFloat(formData.shippingCostToChina) || 0;
          const equalShippingPerItem = totalShippingCNY > 0 && totalQuantityAcrossVariants > 0
            ? totalShippingCNY / totalQuantityAcrossVariants
            : 0;

          const itemsToCreate: any[] = [];

          // Create a map from SKU to original variant index for individual shipping lookup
          const skuToOriginalIndex = new Map<string, number>();
          variants.forEach((v, idx) => {
            skuToOriginalIndex.set(v.sku, idx);
          });

          for (const v of insertedVariants || []) {
            if (!v.is_active) continue;
            const qty = Number(v.stock_quantity || 0);
            if (qty <= 0) continue;

            const unitCost = v.price !== null && v.price !== undefined ? Number(v.price) : priceValue;
            // Unit cost in USD: (price * currency_rate) / usd_rate
            const vRate = formData.purchase_currency === 'CNY' ? cnyToUzs : formData.purchase_currency === 'USD' ? usdToUzs : 1;
            const unitCostUSD = (unitCost !== null && usdToUzs > 0) ? (unitCost * vRate) / usdToUzs : null;

            // Get shipping cost - either individual or equal distribution
            let domesticShippingPerItem: number;
            if (isIndividualShipping) {
              // Find original variant index by SKU and get individual shipping cost
              const originalIndex = skuToOriginalIndex.get(v.sku) ?? 0;
              domesticShippingPerItem = parseFloat(individualShippingCosts[originalIndex] || "0");
            } else {
              domesticShippingPerItem = equalShippingPerItem;
            }

            // Calculate final cost: unit cost + domestic shipping (both converted to USD)
            const domesticShippingPerItemUSD = (domesticShippingPerItem * cnyToUzs) / usdToUzs;
            const finalCostUSD = (unitCostUSD || 0) + domesticShippingPerItemUSD;

            // Variantdan og'irlikni olish
            const originalIndex = skuToOriginalIndex.get(v.sku) ?? 0;
            const originalVariant = variants[originalIndex];
            const weightGrams = originalVariant?.weight ? parseFloat(originalVariant.weight) : null;

            for (let i = 0; i < qty; i++) {
              itemsToCreate.push({
                item_uuid: makeItemUuid(newProduct.uuid, `${v.sku}-${i + 1}`),
                product_id: newProduct.id,
                variant_id: v.id,
                status: itemStatus,
                location: itemLocation,
                unit_cost: unitCost,
                unit_cost_currency: formData.purchase_currency,
                unit_cost_usd: unitCostUSD,
                exchange_rate_at_purchase: currentRate,
                domestic_shipping_cost: domesticShippingPerItem,
                final_cost_usd: finalCostUSD > 0 ? finalCostUSD : null,
                weight_grams: weightGrams,  // Variantdan og'irlikni saqlash
                cost_breakdown: {
                  purchase_price: unitCost,
                  purchase_currency: formData.purchase_currency,
                  domestic_shipping: domesticShippingPerItem,
                  domestic_shipping_currency: 'CNY',
                  shipping_distribution: formData.shippingDistribution,
                },
              });
            }
          }

          if (itemsToCreate.length > 0) {
            console.log('=== DOMESTIC SHIPPING DEBUG (variants) ===');
            console.log('shippingDistribution:', formData.shippingDistribution);
            console.log('shippingCostToChina:', formData.shippingCostToChina);
            console.log('totalQuantityAcrossVariants:', totalQuantityAcrossVariants);
            console.log('isIndividualShipping:', isIndividualShipping);
            console.log('First item sample:', itemsToCreate[0]);
            console.log('=========================================');

            const { data: insertedItems, error: itemError } = await supabase
              .from('product_items')
              .insert(itemsToCreate)
              .select('id, domestic_shipping_cost, final_cost_usd');

            if (itemError) throw itemError;

            console.log('Inserted items verification:', insertedItems);
          }
        } else {
          // Create individual product items with cost tracking
          const itemQuantity = parseInt(formData.quantity) || 1;
          const unitCost = priceValue;
          const unitCostUSD = purchasePriceUSD;

          // Calculate domestic shipping per item (in CNY, converted to USD)
          const domesticShippingPerItem = totalShippingCNY > 0 && itemQuantity > 0
            ? totalShippingCNY / itemQuantity
            : 0;
          const domesticShippingPerItemUSD = (domesticShippingPerItem * cnyToUzs) / usdToUzs;

          // Calculate final landed cost per item (unit cost + domestic shipping, both in USD)
          const finalCostUSD = (unitCostUSD || 0) + domesticShippingPerItemUSD;

          const productItems = Array.from({ length: itemQuantity }, (_, i) => ({
            item_uuid: makeItemUuid(newProduct.uuid, (i + 1).toString().padStart(3, '0')),
            product_id: newProduct.id,
            status: itemStatus,
            location: itemLocation,
            unit_cost: unitCost,
            unit_cost_currency: formData.purchase_currency,
            unit_cost_usd: unitCostUSD,
            domestic_shipping_cost: domesticShippingPerItem,
            final_cost_usd: finalCostUSD > 0 ? finalCostUSD : null,
            exchange_rate_at_purchase: currentRate,
          }));

          console.log('=== DOMESTIC SHIPPING DEBUG (no variants) ===');
          console.log('shippingCostToChina:', formData.shippingCostToChina);
          console.log('itemQuantity:', itemQuantity);
          console.log('domesticShippingPerItem:', domesticShippingPerItem);
          console.log('finalCostUSD:', finalCostUSD);
          console.log('First item sample:', productItems[0]);
          console.log('=============================================');

          const { data: insertedItems, error: itemError } = await supabase
            .from("product_items")
            .insert(productItems)
            .select('id, domestic_shipping_cost, final_cost_usd');

          if (itemError) {
            console.error("Product items insert error:", itemError);
            throw itemError;
          }

          console.log('Inserted items verification:', insertedItems);
        }
      }
    },
    onSuccess: async () => {
      // MUHIM: Avval pending-items-china ni yangilash va KUTISH
      await queryClient.invalidateQueries({ queryKey: ["pending-items-china"] });
      // Keyin products ni yangilash - pending-items allaqachon yangilangan
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
      toast.success(editingProduct ? "Mahsulot yangilandi" : linkMode === 'existing' ? "Buyurtma muvaffaqiyatli qo'shildi" : "Mahsulot yaratildi");
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Save mutation error:", error);
      toast.error("Xatolik: " + (error.message || "Noma'lum xato"));
    },
  });

  const getCategoryPath = (categoryId: string): string => {
    const category = categories?.find(c => c.id === categoryId);
    return category?.name || "";
  };

  const handleAddCustomAttribute = () => {
    if (!newAttrKey.trim()) return;
    setCustomAttributes([...customAttributes, { key: newAttrKey, value: newAttrValue }]);
    setNewAttrKey("");
    setNewAttrValue("");
  };

  const handleRemoveCustomAttribute = (index: number) => {
    setCustomAttributes(customAttributes.filter((_, i) => i !== index));
  };

  // Handler for VariantMatrix field changes
  const handleVariantChange = (index: number, field: keyof VariantData, value: string | boolean) => {
    if (linkMode === 'existing' && selectedExistingProduct) {
      const variant = variants[index];
      if (!variant?.id) return;

      // Redirect quantity and price changes to selectedVariantOrders
      if (field === 'stock_quantity') {
        updateVariantOrderQuantity(variant.id, value as string);
      } else if (field === 'cost_price') {
        updateVariantOrderPrice(variant.id, value as string);
      } else if (field === 'weight') {
        updateVariantOrderWeight(variant.id, value as string);
      }
      return;
    }

    setVariants(prev => prev.map((v, i) =>
      i === index ? { ...v, [field]: value } : v
    ));
  };

  // Handler for VariantMatrix toggle
  const handleVariantToggle = (index: number) => {
    if (linkMode === 'existing' && selectedExistingProduct) {
      const variant = variants[index];
      if (variant?.id) {
        toggleVariantSelection(variant.id);
      }
      return;
    }

    setVariants(prev => prev.map((v, i) =>
      i === index ? { ...v, is_active: !v.is_active } : v
    ));
  };

  // Mavjud mahsulotga bog'lashda narx yoki multi-variant tanlangan bo'lishi kerak
  const isFormValid = linkMode === 'existing'
    ? selectedExistingProduct !== null &&
    (selectedVariantOrders.length > 0 || (parseFloat(formData.price) > 0 && parseInt(formData.quantity) > 0))
    : formData.name.trim() !== "";

  // Multi-select variant funksiyalari
  const toggleVariantSelection = (variantId: string) => {
    setSelectedVariantOrders(prev => {
      const existing = prev.find(o => o.variantId === variantId);
      if (existing) {
        return prev.filter(o => o.variantId !== variantId);
      } else {
        const variant = selectedExistingProduct?.product_variants?.find(v => v.id === variantId);
        return [...prev, {
          variantId,
          quantity: 1,
          isNew: false,
          rang: variant?.variant_attributes?.rang,
          material: variant?.variant_attributes?.material,
          price: formData.price || '',
          weight: (variant as any)?.weight?.toString() || ''  // Variantdan og'irlik
        }];
      }
    });
  };

  const updateVariantOrderQuantity = (variantId: string, value: string) => {
    // Bo'sh qiymatga ruxsat - foydalanuvchi o'chirib yangi son yozishi mumkin
    const quantity = value === '' ? '' : Math.max(1, parseInt(value) || 1);
    setSelectedVariantOrders(prev =>
      prev.map(o => o.variantId === variantId ? { ...o, quantity } : o)
    );
  };

  const updateVariantOrderPrice = (variantId: string, price: string) => {
    setSelectedVariantOrders(prev =>
      prev.map(o => o.variantId === variantId ? { ...o, price } : o)
    );
  };

  const updateVariantOrderWeight = (variantId: string, weight: string) => {
    setSelectedVariantOrders(prev =>
      prev.map(o => o.variantId === variantId ? { ...o, weight } : o)
    );
  };

  const addNewColorToOrder = () => {
    if (!newColorName.trim()) {
      toast.error("Rang nomini kiriting");
      return;
    }
    const newId = `new-${Date.now()}`;
    setSelectedVariantOrders(prev => [...prev, {
      variantId: newId,
      quantity: parseInt(newColorQuantity) || 1,
      isNew: true,
      rang: newColorName.trim(),
      material: newMaterial.trim() || undefined,
      price: newColorPrice || formData.price || '',
      weight: newColorWeight || undefined  // Og'irlikni qo'shish
    }]);
    setShowNewColorDialog(false);
    setNewColorName('');
    setNewMaterial('');
    setNewColorQuantity('1');
    setNewColorPrice('');
    setNewColorWeight('');  // Og'irlikni tozalash
    toast.success(`${newColorName} rangi qo'shildi`);
  };

  const removeVariantOrder = (variantId: string) => {
    setSelectedVariantOrders(prev => prev.filter(o => o.variantId !== variantId));
  };

  // Jami hisoblash - bo'sh quantity ni 1 ga default qilish
  const totalSelectedQuantity = selectedVariantOrders.reduce((sum, o) => sum + (typeof o.quantity === 'number' ? o.quantity : 1), 0);

  // Base price in UZS for accurate summing
  const totalSelectedBasePriceUZS = selectedVariantOrders.reduce((sum, o) => {
    const price = parseFloat(o.price || formData.price || '0');
    const qty = typeof o.quantity === 'number' ? o.quantity : 1;
    const currency = formData.purchase_currency;
    const rate = currency === 'USD' ? usdToUzs : currency === 'CNY' ? cnyToUzs : 1;
    return sum + (price * qty * rate);
  }, 0);

  const totalShippingCNY = parseFloat(formData.shippingCostToChina) || 0;
  const totalShippingUZS = totalShippingCNY * cnyToUzs;
  const totalSelectedPriceUZS = totalSelectedBasePriceUZS + totalShippingUZS;

  // Attributes for matrix - derived from nestedVariants
  const variantAttributesForMatrix = [
    { id: "rang", name: "Rang", attribute_key: "rang", attribute_type: "color", options: nestedVariants.map(v => v.rang) },
    { id: "material", name: "Material", attribute_key: "material", attribute_type: "text", options: Array.from(new Set(nestedVariants.flatMap(v => v.materiallar))) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[90vh] p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl">
            {editingProduct ? "Mahsulotni tahrirlash" : "Yangi mahsulot qo'shish"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic" className="gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Asosiy</span>
              </TabsTrigger>
              <TabsTrigger value="attributes" className="gap-2">
                <Layers className="h-4 w-4" />
                <span className="hidden sm:inline">Xususiyatlar</span>
              </TabsTrigger>
              <TabsTrigger value="variants" className="gap-2">
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Variantlar</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-6 py-4" style={{ height: "calc(90vh - 200px)" }}>
            <TabsContent value="basic" className="mt-0 space-y-4">
              {/* === LINK MODE TOGGLE === */}
              {!editingProduct && (
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Label className="text-sm text-muted-foreground">Buyurtma turi:</Label>
                    </div>
                    <ToggleGroup
                      type="single"
                      value={linkMode}
                      onValueChange={(value) => {
                        if (value) {
                          setLinkMode(value as 'new' | 'existing');
                          if (value === 'new') {
                            setSelectedExistingProduct(null);
                            setExistingProductSearch('');
                            setSelectedExistingVariant(null);
                          }
                        }
                      }}
                      className="w-full"
                    >
                      <ToggleGroupItem value="new" className="flex-1 gap-2">
                        <Plus className="h-4 w-4" />
                        Yangi mahsulot
                      </ToggleGroupItem>
                      <ToggleGroupItem value="existing" className="flex-1 gap-2">
                        <Link2 className="h-4 w-4" />
                        Mavjud mahsulotga bog'lash
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </CardContent>
                </Card>
              )}

              {/* === MAVJUD MAHSULOTNI QIDIRISH === */}
              {linkMode === 'existing' && !editingProduct && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Toshkent omboridagi mahsulotni qidiring
                    </CardTitle>
                    <CardDescription>
                      Omborda mavjud mahsulotni toping va yangi buyurtmani unga bog'lang
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder="Mahsulot nomini yozing (kamida 2 ta belgi)..."
                      value={existingProductSearch}
                      onChange={(e) => setExistingProductSearch(e.target.value)}
                      className="w-full"
                    />

                    {/* Qidiruv natijalari */}
                    {isSearchingTashkent && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Qidirilmoqda...</span>
                      </div>
                    )}

                    {!isSearchingTashkent && existingProductSearch.length >= 2 && tashkentProducts.length === 0 && (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        Hech narsa topilmadi. Yangi mahsulot yaratishni tanlang.
                      </div>
                    )}

                    {tashkentProducts.length > 0 && (() => {
                      const grouped = groupProducts(tashkentProducts);
                      return (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {grouped.map((group) => {
                            const firstProduct = tashkentProducts.find(p => p.id === group.variants[0]?.productId);
                            const isSelected = firstProduct && selectedExistingProduct?.id === firstProduct.id;
                            return (
                              <div
                                key={group.baseName}
                                onClick={() => {
                                  if (!firstProduct) return;
                                  setSelectedExistingProduct(firstProduct);
                                  setSelectedExistingVariant(null);
                                  setSelectedVariantOrders([]);
                                  setFormData(prev => ({
                                    ...prev,
                                    name: group.displayName,
                                    price: '',
                                    quantity: '',
                                    shippingCostToChina: '',
                                  }));
                                  setTimeout(() => {
                                    orderDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }, 150);
                                }}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'hover:bg-muted/50'
                                  }`}
                              >
                                {group.representativeImage ? (
                                  <img
                                    src={group.representativeImage}
                                    alt={group.displayName}
                                    className="w-12 h-12 object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                    <Package className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{group.displayName}</div>
                                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                      Omborda: {group.totalStock} dona
                                    </Badge>
                                    {group.variants.length > 1 && (
                                      <span className="text-xs text-muted-foreground">
                                        ({group.variants.length} ta variant)
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Multi-Select Variant tanlash */}
                    {selectedExistingProduct && selectedExistingProduct.product_variants?.length > 0 && (
                      <div className="pt-3 border-t space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            Variantlarni tanlang (bir nechta tanlash mumkin):
                          </Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowNewColorDialog(true)}
                            className="gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Yangi rang
                          </Button>
                        </div>

                        {/* Mavjud variantlar - Checkbox bilan */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedExistingProduct.product_variants.map((variant) => {
                            const isSelected = selectedVariantOrders.some(o => o.variantId === variant.id);
                            const order = selectedVariantOrders.find(o => o.variantId === variant.id);

                            return (
                              <div
                                key={variant.id}
                                className={`p-3 text-sm rounded-lg border cursor-pointer transition-all ${isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'hover:bg-muted/50'
                                  }`}
                              >
                                <div
                                  className="flex items-center gap-2"
                                  onClick={() => toggleVariantSelection(variant.id)}
                                >
                                  <Checkbox checked={isSelected} />
                                  <span className="text-lg">{getColorEmoji(variant.variant_attributes?.rang)}</span>
                                  <span className="font-medium flex-1">
                                    {variant.variant_attributes?.rang || variant.sku || `Variant-${selectedExistingProduct.product_variants.indexOf(variant) + 1}`}
                                    {variant.variant_attributes?.material ? ` / ${variant.variant_attributes.material}` : ''}
                                  </span>
                                  <Badge variant="secondary" className="text-xs">
                                    {variant.stock_quantity} ta
                                  </Badge>
                                </div>

                                {/* Miqdor va narx inputlari */}
                                {isSelected && (
                                  <div className="mt-2 pt-2 border-t flex gap-2">
                                    <div className="flex-1">
                                      <Label className="text-xs text-muted-foreground">Miqdor</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={order?.quantity ?? ''}
                                        onChange={(e) => updateVariantOrderQuantity(variant.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-8 mt-1"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <Label className="text-xs text-muted-foreground">Narx ({formData.purchase_currency})</Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={order?.price || ''}
                                        onChange={(e) => updateVariantOrderPrice(variant.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="0.00"
                                        className="h-8 mt-1"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <Label className="text-xs text-muted-foreground">Og'irlik (g)</Label>
                                      <Input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={order?.weight || ''}
                                        onChange={(e) => updateVariantOrderWeight(variant.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="0"
                                        className="h-8 mt-1"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Yangi qo'shilgan ranglar */}
                        {selectedVariantOrders.filter(o => o.isNew).length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-primary">Yangi ranglar:</Label>
                            {selectedVariantOrders.filter(o => o.isNew).map((order) => (
                              <div key={order.variantId} className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
                                <span className="text-lg">{getColorEmoji(order.rang)}</span>
                                <span className="flex-1 font-medium text-sm">
                                  {order.rang}{order.material ? ` / ${order.material}` : ''}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    value={order.quantity ?? ''}
                                    onChange={(e) => updateVariantOrderQuantity(order.variantId, e.target.value)}
                                    className="h-8 w-16"
                                  />
                                  <span className="text-xs text-muted-foreground">dona</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={order.price || ''}
                                    onChange={(e) => updateVariantOrderPrice(order.variantId, e.target.value)}
                                    placeholder="Narx"
                                    className="h-8 w-20"
                                  />
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={order.weight || ''}
                                    onChange={(e) => updateVariantOrderWeight(order.variantId, e.target.value)}
                                    placeholder="g"
                                    className="h-8 w-16"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeVariantOrder(order.variantId)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Jami ko'rsatkichi */}
                        {selectedVariantOrders.length > 0 && (
                          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">Jami:</span>
                              <span className="font-bold text-primary">
                                {totalSelectedQuantity} dona ({selectedVariantOrders.length} ta variantda)
                              </span>
                            </div>
                            {totalSelectedPriceUZS > 0 && (
                              <div className="flex flex-col items-end gap-1 mt-1 border-t border-primary/10 pt-2">
                                <div className="text-sm font-semibold text-primary">
                                  Jami tannarx: {Math.round(totalSelectedPriceUZS).toLocaleString('uz-UZ')} so'm
                                </div>
                                <div className="text-[10px] text-muted-foreground italic">
                                  (Mahsulotlar: {Math.round(totalSelectedBasePriceUZS).toLocaleString('uz-UZ')} + Yo'l haqi: {Math.round(totalShippingUZS).toLocaleString('uz-UZ')})
                                </div>
                                {formData.purchase_currency !== 'UZS' && (
                                  <div className="text-[10px] font-medium text-muted-foreground">
                                    ≈ {(totalSelectedPriceUZS / (formData.purchase_currency === 'CNY' ? cnyToUzs : usdToUzs)).toFixed(2)} {formData.purchase_currency}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="mt-2 pt-2 border-t border-primary/20 space-y-1">
                              {selectedVariantOrders.map(order => {
                                const variant = selectedExistingProduct.product_variants?.find(v => v.id === order.variantId);
                                return (
                                  <div key={order.variantId} className="flex items-center gap-1.5 text-xs">
                                    <span>{getColorEmoji(order.rang)}</span>
                                    <span className="text-muted-foreground">
                                      {order.rang}{order.material ? ` / ${order.material}` : ''}
                                    </span>
                                    <span className="text-muted-foreground">×</span>
                                    <span className="font-medium">{order.quantity}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="text-xs">
                                      {order.isNew
                                        ? <Badge variant="outline" className="text-xs py-0">yangi variant</Badge>
                                        : `ombordagi ${variant?.stock_quantity || 0} ga qo'shiladi`
                                      }
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Yangi rang qo'shish - inline card (nested Dialog o'rniga) */}
                    {showNewColorDialog && (
                      <Card className="border-primary/30 bg-primary/5">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm">Yangi rang/variant qo'shish</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-3">
                          <div className="grid gap-2">
                            <Label htmlFor="new-color" className="text-xs">Rang *</Label>
                            <Input
                              id="new-color"
                              placeholder="masalan: qizil, ko'k, yashil..."
                              value={newColorName}
                              onChange={(e) => setNewColorName(e.target.value)}
                              className="h-8"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="new-material" className="text-xs">Material (ixtiyoriy)</Label>
                            <Input
                              id="new-material"
                              placeholder="masalan: plastik, mato, teri..."
                              value={newMaterial}
                              onChange={(e) => setNewMaterial(e.target.value)}
                              className="h-8"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="grid gap-1">
                              <Label htmlFor="new-qty" className="text-xs">Miqdor</Label>
                              <Input
                                id="new-qty"
                                type="number"
                                min="1"
                                value={newColorQuantity}
                                onChange={(e) => setNewColorQuantity(e.target.value)}
                                className="h-8"
                              />
                            </div>
                            <div className="grid gap-1">
                              <Label htmlFor="new-price" className="text-xs">Narx ({formData.purchase_currency})</Label>
                              <Input
                                id="new-price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={newColorPrice}
                                onChange={(e) => setNewColorPrice(e.target.value)}
                                placeholder="0.00"
                                className="h-8"
                              />
                            </div>
                            <div className="grid gap-1">
                              <Label htmlFor="new-weight" className="text-xs">Og'irlik (g)</Label>
                              <Input
                                id="new-weight"
                                type="number"
                                step="1"
                                min="0"
                                value={newColorWeight}
                                onChange={(e) => setNewColorWeight(e.target.value)}
                                placeholder="0"
                                className="h-8"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" size="sm" onClick={() => setShowNewColorDialog(false)}>
                              Bekor qilish
                            </Button>
                            <Button size="sm" onClick={addNewColorToOrder} disabled={!newColorName.trim()}>
                              <Plus className="h-3 w-3 mr-1" />
                              Qo'shish
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* === MAVJUD MAHSULOTGA BOG'LASH UCHUN BUYURTMA TAFSILOTLARI === */}
              {linkMode === 'existing' && selectedExistingProduct && !editingProduct && (
                <Card ref={orderDetailsRef}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {selectedVariantOrders.length > 0 ? "Qo'shimcha xarajatlar" : "Buyurtma tafsilotlari"}
                    </CardTitle>
                    <CardDescription>
                      {selectedVariantOrders.length > 0
                        ? "Miqdor va narxlar yuqorida variantlar ichida belgilangan"
                        : "Buyurtma qilinayotgan miqdor va narxni kiriting"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Valyuta kursi banneri */}
                    <ExchangeRateBanner className="mb-1" />

                    {/* Tannarx va Yo'l haqqi seksiyasi */}
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/40">
                      <Label className="text-sm font-bold text-foreground">Tan narxi</Label>

                      {selectedVariantOrders.length === 0 ? (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="link-quantity" className="text-xs text-muted-foreground">Miqdori *</Label>
                            <Input
                              id="link-quantity"
                              type="number"
                              min="1"
                              value={formData.quantity}
                              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                              placeholder="1"
                              required
                              className="h-9"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="link-price" className="text-xs text-muted-foreground">Xitoy narxi ({formData.purchase_currency}) *</Label>
                            <Input
                              id="link-price"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.price}
                              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                              placeholder="0.00"
                              required
                              className="h-9"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="link-shipping" className="text-xs text-muted-foreground">Yo'l haqqi (jami)</Label>
                            <div className="relative">
                              <Input
                                id="link-shipping"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.shippingCostToChina}
                                onChange={(e) => setFormData({ ...formData, shippingCostToChina: e.target.value })}
                                placeholder="0.00"
                                className="h-9 pr-10 text-xs"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-bold">
                                CNY
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <Label htmlFor="link-shipping" className="text-xs text-muted-foreground">Yo'l haqqi (jami)</Label>
                          <div className="relative">
                            <Input
                              id="link-shipping"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.shippingCostToChina}
                              onChange={(e) => setFormData({ ...formData, shippingCostToChina: e.target.value })}
                              placeholder="0.00"
                              className="h-9 pr-12"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">
                              CNY
                            </span>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Bu summa {selectedVariantOrders.length > 0
                          ? totalSelectedQuantity
                          : (formData.quantity || 1)} ta mahsulotga teng bo'linadi
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* === YANGI MAHSULOT FORMASI === */}
              {(linkMode === 'new' || editingProduct) && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Mahsulot nomi *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="iPhone 15 Pro Max"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="brand">Brend</Label>
                      <Input
                        id="brand"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        placeholder="Apple"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        placeholder="A3106"
                      />
                    </div>
                  </div>

                  {/* Narx va Yo'l haqqi - YANGI MAHSULOT uchun */}
                  <div className="p-3 bg-muted/40 rounded-xl border border-border/50">
                    <div className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-1">
                      <div className="flex-shrink-0">
                        <Label className="text-sm font-bold text-foreground whitespace-nowrap">Tan narxi:</Label>
                      </div>

                      <div className="flex items-end gap-2 flex-1 min-w-0">
                        <div className="grid gap-1 min-w-[100px] flex-1">
                          <Label htmlFor="price" className="text-[10px] text-muted-foreground whitespace-nowrap">Xitoy narxi *</Label>
                          <div className="relative">
                            <Input
                              id="price"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.price}
                              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                              placeholder="0.00"
                              className="h-8 pr-10 text-xs"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-bold">
                              {formData.purchase_currency}
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-1 min-w-[100px] flex-1">
                          <Label htmlFor="shipping" className="text-[10px] text-muted-foreground whitespace-nowrap">Yo'l haqqi (jami)</Label>
                          <div className="relative">
                            <Input
                              id="shipping"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.shippingCostToChina}
                              onChange={(e) => setFormData({ ...formData, shippingCostToChina: e.target.value })}
                              placeholder="0.00"
                              className="h-8 pr-8 text-xs"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-bold">
                              CNY
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-1 w-16">
                          <Label htmlFor="quantity" className="text-[10px] text-muted-foreground">Miqdori *</Label>
                          <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            placeholder="1"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* NEW: Barcode input for marketplace linking */}
                  <div className="grid gap-2">
                    <Label htmlFor="barcode">Shtrix-kod (Barcode)</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="1000035357826"
                    />
                    <p className="text-xs text-muted-foreground">
                      Marketplace listinglarni avtomatik bog'lash uchun shtrix-kodni kiriting
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Kategoriya</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => {
                        setFormData({ ...formData, category_id: value });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kategoriyani tanlang">
                          {formData.category_id && getCategoryPath(formData.category_id)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="notes">Tavsif</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Mahsulot haqida qo'shimcha ma'lumot..."
                      rows={3}
                    />
                  </div>

                  {/* Exchange Rate Banner - narx kiritish uchun */}
                  <ExchangeRateBanner className="mt-1" />

                  {/* Cost Calculator - Tannarx hisoblash */}
                  {(() => {
                    const variantCostPrice = variants.length > 0
                      ? variants.find(v => v.cost_price)?.cost_price
                      : null;
                    const costUnitPrice = variantCostPrice
                      ? parseFloat(variantCostPrice)
                      : parseFloat(formData.price) || 0;
                    const costCurrency = variants.find(v => v.cost_price_currency)?.cost_price_currency || formData.purchase_currency || 'CNY';

                    // Helper function for specific currency conversion within this component
                    const convertCNYToCurrency = (amountCNY: number, toCurrency: string) => {
                      if (toCurrency === 'CNY') return amountCNY;
                      const amountUZS = amountCNY * cnyToUzs;
                      if (toCurrency === 'USD') return amountUZS / usdToUzs;
                      return amountUZS; // UZS
                    };

                    const convertToUZSLocal = (amount: number, fromCurrency: string) => {
                      if (fromCurrency === 'USD') return amount * usdToUzs;
                      if (fromCurrency === 'CNY') return amount * cnyToUzs;
                      return amount; // UZS
                    };

                    const totalShippingCNY = parseFloat(formData.shippingCostToChina) || 0;
                    const qty = parseInt(formData.quantity || "0");
                    const hasCostData = costUnitPrice > 0 || totalShippingCNY > 0;

                    if (!hasCostData) return null;

                    const previewQty = Math.max(qty, 1);
                    const perItemShippingCNY = totalShippingCNY / previewQty;
                    const perItemShippingInCostCurrency = convertCNYToCurrency(perItemShippingCNY, costCurrency);
                    const landedCost = costUnitPrice + perItemShippingInCostCurrency;
                    const landedCostUZS = convertToUZSLocal(landedCost, costCurrency);

                    // Summary for the whole order
                    const totalBaseCostUZS = convertToUZSLocal(costUnitPrice * qty, costCurrency);
                    const totalShippingUZS = totalShippingCNY * cnyToUzs;
                    const totalOrderLandedCostUZS = totalBaseCostUZS + totalShippingUZS;

                    return (
                      <div className="space-y-3">
                        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                          <h4 className="font-medium text-sm mb-3 flex items-center gap-2 text-green-700 dark:text-green-400">
                            <Package className="h-4 w-4" />
                            Bir dona tannarx hisoblash
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bir dona narxi:</span>
                              <span className="font-medium">{costUnitPrice.toFixed(2)} {costCurrency}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bir donaga yo'l haqqi:</span>
                              <span className="font-medium">
                                {perItemShippingInCostCurrency.toFixed(2)} {costCurrency}
                                {costCurrency !== 'CNY' && (
                                  <span className="text-[10px] text-muted-foreground ml-1">
                                    (≈ {perItemShippingCNY.toFixed(2)} CNY)
                                  </span>
                                )}
                              </span>
                            </div>
                            <Separator className="my-2" />
                            <div className="flex justify-between text-green-600 dark:text-green-400 font-bold text-base">
                              <span>Bir dona tannarx:</span>
                              <span>
                                {landedCost.toFixed(2)} {costCurrency} (~{Math.round(landedCostUZS).toLocaleString('uz-UZ')} so'm)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                          <h4 className="font-medium text-sm mb-3 flex items-center gap-2 text-blue-700 dark:text-blue-400">
                            <Layers className="h-4 w-4" />
                            Jami buyurtma qiymati
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Jami mahsulotlar ({qty} dona):</span>
                              <span className="font-medium">{(costUnitPrice * qty).toFixed(2)} {costCurrency}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Jami yo'l haqqi:</span>
                              <span className="font-medium">{totalShippingCNY.toFixed(2)} CNY</span>
                            </div>
                            <Separator className="my-2" />
                            <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold text-lg">
                              <span>Jami tannarx:</span>
                              <span>
                                {Math.round(totalOrderLandedCostUZS).toLocaleString('uz-UZ')} so'm
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}
            </TabsContent>

            <TabsContent value="attributes" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Qo'shimcha xususiyatlar</CardTitle>
                  <CardDescription>
                    Mahsulotga xos xususiyatlarni qo'shing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Xususiyat nomi (masalan: Material)"
                      value={newAttrKey}
                      onChange={(e) => setNewAttrKey(e.target.value)}
                    />
                    <Input
                      placeholder="Qiymat (masalan: Plastik)"
                      value={newAttrValue}
                      onChange={(e) => setNewAttrValue(e.target.value)}
                    />
                    <Button onClick={handleAddCustomAttribute} size="icon" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {customAttributes.length > 0 && (
                    <div className="space-y-2">
                      {customAttributes.map((attr, index) => (
                        <div key={index} className="flex items-center gap-2 bg-muted p-2 rounded-lg">
                          <span className="font-medium">{attr.key}:</span>
                          <span className="text-muted-foreground flex-1">{attr.value}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveCustomAttribute(index)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="variants" className="mt-0 space-y-4">
              {/* Nested Variant Builder */}
              <NestedVariantBuilder
                nestedVariants={nestedVariants}
                onNestedVariantsChange={setNestedVariants}
              />

              {/* Rang rasmlari - ranglar kiritilganda ko'rinadi */}
              {nestedVariants.length > 0 && (
                <VariantImageUpload
                  nestedVariants={nestedVariants}
                  variantImages={variantImages}
                  onVariantImagesChange={setVariantImages}
                />
              )}

              {/* Variant Matrix - shows when variants exist */}
              {variants.length > 0 && (() => {
                // When in link mode, we proxy the variants data to show order quantities instead of warehouse stock
                const matrixVariants = linkMode === 'existing' 
                  ? variants.map(v => {
                      const order = selectedVariantOrders.find(o => o.variantId === v.id);
                      return {
                        ...v,
                        stock_quantity: order ? (order.quantity?.toString() || "1") : "0",
                        cost_price: order ? (order.price || v.cost_price) : v.cost_price,
                        weight: order ? (order.weight || v.weight) : v.weight,
                        is_active: !!order
                      };
                    })
                  : variants;

                return (
                  <VariantMatrix
                    mode="order"
                    attributes={variantAttributesForMatrix}
                    variants={matrixVariants}
                    selectedAttributes={["rang", "material"]}
                    onVariantChange={handleVariantChange}
                    onVariantToggle={handleVariantToggle}
                    currency="CNY"
                    onCurrencyChange={(value) => setFormData({ ...formData, purchase_currency: value })}
                    shippingCost={formData.shippingCostToChina}
                    onShippingCostChange={(value) => setFormData({ ...formData, shippingCostToChina: value })}
                    skuMappings={skuMappings}
                    onSkuMappingsChange={(index, mappings) => {
                      setSkuMappings(prev => ({ ...prev, [index]: mappings }));
                    }}
                  />
                );
              })()}
            </TabsContent>

          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-2 p-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isFormValid || saveMutation.isPending}
            className="bg-gradient-to-r from-primary to-secondary"
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingProduct ? "Saqlash" : linkMode === 'existing' ? "Buyurtma qo'shish" : "Yaratish"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
