import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useFinanceCurrency } from "@/contexts/FinanceCurrencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineImageEdit } from "./InlineImageEdit";
import { InlineVariantImageEdit } from "./InlineVariantImageEdit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Package, Plus, Search, X, Trash2, ChevronDown, Pencil, Edit, Loader2 } from "lucide-react";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect, useMemo, Fragment } from "react";
import { CostPriceEditDialog, type CostPriceData } from "./CostPriceEditDialog";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { InlineStockInput } from "./InlineStockInput";
import { InlinePriceInput } from "./InlinePriceInput";
import { InlineCategorySelect } from "./InlineCategorySelect";
import { InlineSectionInput } from "./InlineSectionInput";
import { InlineNameInput } from "./InlineNameInput";
import { useUserRole } from "@/hooks/useUserRole";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fetchAllRows } from "@/lib/fetchAllRows";

interface ProductIndicator {
  id: string;
  productId: string;
  name: string;
  variantLabel: string | null;
  variantAttributes: Record<string, string> | null;
  isVariant: boolean;
  category_id: string | null;
  category_name: string | null;
  main_image_url: string | null;
  variant_image_url: string | null;
  cost_price: number | null;
  cost_price_currency: string | null;
  shipping_cost_to_china: number | null;
  product_quantity: number | null;
  avg_unit_cost_from_items: number | null;
  avg_unit_cost_currency: string | null;
  avg_domestic_shipping: number | null;
  avg_international_shipping_usd: number | null;
  warehouse_price: number | null;
  avg_daily_sales: number | null;
  tashkent_manual_stock: number | null;
  tashkent_section: string | null;
  in_transit_count: number;
  tashkent_count: number;
  notes: string | null;
}

// Rang hex mapping for CSS circles
const getColorHex = (color: string | undefined): string => {
  if (!color) return "#9ca3af";
  const c = color.toLowerCase();
  const colorMap: Record<string, string> = {
    'qizil': '#ef4444', 'red': '#ef4444',
    "ko'k": '#3b82f6', 'kok': '#3b82f6', 'blue': '#3b82f6',
    'yashil': '#22c55e', 'green': '#22c55e',
    'sariq': '#eab308', 'yellow': '#eab308',
    'qora': '#1f2937', 'black': '#1f2937',
    'oq': '#f3f4f6', 'white': '#f3f4f6',
    'jigarrang': '#92400e', 'brown': '#92400e',
    'pushti': '#ec4899', 'pink': '#ec4899',
    'binafsha': '#8b5cf6', 'purple': '#8b5cf6',
    'kulrang': '#6b7280', 'grey': '#6b7280', 'gray': '#6b7280',
    'oltin': '#f59e0b', 'gold': '#f59e0b',
    'kumush': '#9ca3af', 'silver': '#9ca3af',
    'apelsin': '#f97316', 'orange': '#f97316',
  };
  return colorMap[c] || "#6b7280";
};

interface TashkentWarehouseIndicatorsProps {
  onAddProduct?: () => void;
  canManageWarehouse?: boolean;
  selectedCategoryId?: string | null;
  onClearFilter?: () => void;
}

export function TashkentWarehouseIndicators({
  onAddProduct,
  canManageWarehouse,
  selectedCategoryId,
  onClearFilter
}: TashkentWarehouseIndicatorsProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { isChiefManager, isOwner } = useUserRole();
  const { usdToUzs, cnyToUzs } = useFinanceCurrency();
  const canDelete = isChiefManager || isOwner;
  const [searchQuery, setSearchQuery] = useState("");
  const [productToDelete, setProductToDelete] = useState<{ id: string, name: string } | null>(null);
  const [editingCostIndicator, setEditingCostIndicator] = useState<ProductIndicator | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState<string | null>(null);

  const handleEditProduct = async (productId: string) => {
    setIsEditLoading(productId);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, brand, model, barcode,
          category_id, notes, price, purchase_currency,
          quantity, weight, main_image_url, has_variants,
          shipping_cost_to_china, custom_attributes, purchased_at, status
        `)
        .eq('id', productId)
        .maybeSingle();

      if (error || !data) {
        toast.error("Mahsulot ma'lumotlarini yuklashda xato");
        return;
      }

      setEditingProduct(data);
      setEditDialogOpen(true);
    } finally {
      setIsEditLoading(null);
    }
  };

  const { data: indicators, isLoading, refetch } = useQuery({
    queryKey: ['product-inventory-overview', selectedCategoryId],
    queryFn: async () => {
      // 1. Get in_transit boxes - match dashboard behavior plus packing/sealed items so they don't disappear
      const { data: transitBoxes } = await supabase
        .from('boxes')
        .select('id')
        .in('status', ['packing', 'sealed', 'in_transit', 'arrived'])
        .or('location.eq.transit');

      const transitBoxIds = transitBoxes?.map(b => b.id) || [];

      // 2. Get product item counts - include items in in_transit/arrived boxes
      // Exclude 'missing' items — they are physically absent and should not count toward inventory
      const itemCounts = await fetchAllRows(
        supabase
          .from('product_items')
          .select('id, product_id, variant_id, status, box_id')
          .in('status', ['pending', 'in_transit', 'in_tashkent', 'packed', 'arrived_pending', 'arrived', 'in_stock', 'received', 'defective'])
          .neq('status', 'missing')
      );

      // 2b. Fetch verified-as-missing items from verification_items (covers old data where
      //     product_items.status might still be 'packed' even though verification marked them missing)
      const { data: missingVerifications } = await supabase
        .from('verification_items')
        .select('product_item_id')
        .eq('status', 'missing');
      const missingVerifiedIds = new Set((missingVerifications || []).map((v: any) => v.product_item_id));

      const transitCounts: Record<string, number> = {};
      const tashkentCounts: Record<string, number> = {};
      const productsWithTransitItems = new Set<string>();

      itemCounts?.forEach(item => {
        // Skip items that were verified as 'missing' in any verification session
        if (missingVerifiedIds.has((item as any).id)) return;

        // Items are "in transit" if explicitly marked so, or if packed/arrived in a transit/arrived box,
        // or if they've arrived but are still pending confirmation (to avoid disappearing)
        // AND NOW explicitly if 'pending' (just ordered but not yet packed)
        const isInTransit = item.status === 'pending' ||
          item.status === 'in_transit' || 
          item.status === 'arrived_pending' ||
          (item.box_id && transitBoxIds.includes(item.box_id) && 
            ['packed', 'arrived', 'in_stock', 'received', 'defective'].includes(item.status));

        // Use variant_id if available for accurate variant-level counts
        const itemKey = item.variant_id || item.product_id;

        if (isInTransit) {
          transitCounts[itemKey] = (transitCounts[itemKey] || 0) + 1;
          if (item.product_id) productsWithTransitItems.add(item.product_id);
        } else if (item.status === 'in_tashkent') {
          tashkentCounts[itemKey] = (tashkentCounts[itemKey] || 0) + 1;
        }
      });

      const pendingProductIds = Array.from(productsWithTransitItems);

      // 3. Fetch products, explicitly including those with transit items
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          main_image_url,
          cost_price,
          avg_daily_sales,
          tashkent_manual_stock,
          tashkent_section,
          category_id,
          has_variants,
          notes,
          price,
          shipping_cost_to_china,
          quantity,
          purchase_currency,
          categories_hierarchy!products_category_id_fkey (name),
          product_variants(
            id, 
            sku, 
            variant_attributes, 
            stock_quantity, 
            price, 
            cost_price, 
            cost_price_currency,
            image_url
          )
        `)
        .order('name');

      // Always show products that have transit items. Otherwise filter normally
      if (pendingProductIds.length > 0) {
        query = query.or(
          `and(status.eq.active,source.neq.marketplace_auto),id.in.(${pendingProductIds.join(',')})`
        );
      } else {
        query = query.eq('status', 'active').neq('source', 'marketplace_auto');
      }

      // Filter by category if selected
      if (selectedCategoryId) {
        query = query.eq('category_id', selectedCategoryId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get full cost data per variant/product from product_items
      const { data: shippingData } = await supabase
        .from('product_items')
        .select('product_id, variant_id, unit_cost, unit_cost_currency, domestic_shipping_cost, international_shipping_cost')
        .not('unit_cost', 'is', null)
        .gt('unit_cost', 0);

      // Calculate avg cost components per variant_id (fallback to product_id)
      const avgCostsByKey: Record<string, {
        unit_cost: number; unit_cost_currency: string;
        domestic_shipping: number; intl_shipping: number; count: number;
      }> = {};
      const avgCostsByProduct: Record<string, {
        unit_cost: number; unit_cost_currency: string;
        domestic_shipping: number; intl_shipping: number; count: number;
      }> = {};

      shippingData?.forEach(item => {
        const varKey = (item.variant_id || item.product_id) as string;
        const prodKey = item.product_id as string;
        const currency = (item as any).unit_cost_currency || 'CNY';

        if (!avgCostsByKey[varKey]) {
          avgCostsByKey[varKey] = { unit_cost: 0, unit_cost_currency: currency, domestic_shipping: 0, intl_shipping: 0, count: 0 };
        }
        avgCostsByKey[varKey].unit_cost += (item as any).unit_cost ?? 0;
        avgCostsByKey[varKey].domestic_shipping += (item as any).domestic_shipping_cost ?? 0;
        avgCostsByKey[varKey].intl_shipping += item.international_shipping_cost ?? 0;
        avgCostsByKey[varKey].count += 1;

        if (!avgCostsByProduct[prodKey]) {
          avgCostsByProduct[prodKey] = { unit_cost: 0, unit_cost_currency: currency, domestic_shipping: 0, intl_shipping: 0, count: 0 };
        }
        avgCostsByProduct[prodKey].unit_cost += (item as any).unit_cost ?? 0;
        avgCostsByProduct[prodKey].domestic_shipping += (item as any).domestic_shipping_cost ?? 0;
        avgCostsByProduct[prodKey].intl_shipping += item.international_shipping_cost ?? 0;
        avgCostsByProduct[prodKey].count += 1;
      });

      const getAvgCosts = (variantId: string | null, productId: string) => {
        const key = variantId || productId;
        const src = avgCostsByKey[key] || avgCostsByProduct[productId];
        if (!src) return { unit_cost: null, unit_cost_currency: null, domestic_shipping: null, intl_shipping: null };
        const n = src.count;
        return {
          unit_cost: src.unit_cost / n,
          unit_cost_currency: src.unit_cost_currency,
          domestic_shipping: src.domestic_shipping / n,
          intl_shipping: src.intl_shipping / n,
        };
      };




      // Flatten products with variants - each variant becomes a separate row
      const flattenedProducts: ProductIndicator[] = [];

      (data || []).forEach(product => {
        const variants = (product as any).product_variants || [];
        const shippingCostToChina = (product as any).shipping_cost_to_china ?? null;
        const productQuantity = (product as any).quantity ?? null;

        if ((product as any).has_variants && variants.length > 0) {
          variants.forEach((variant: any) => {
            const attrs = (variant.variant_attributes as Record<string, string>) || {};
            const attrLabel = Object.values(attrs).filter(Boolean).join(' / ');
            const avgCosts = getAvgCosts(variant.id, product.id);

            flattenedProducts.push({
              id: variant.id,
              productId: product.id,
              name: product.name,
              variantLabel: attrLabel,
              variantAttributes: attrs,
              isVariant: true,
              category_id: product.category_id,
              category_name: (product.categories_hierarchy as any)?.name || null,
              main_image_url: product.main_image_url,
              variant_image_url: variant.image_url || null,
              cost_price: variant.cost_price ?? product.cost_price,
              cost_price_currency: variant.cost_price_currency || 'CNY',
              shipping_cost_to_china: shippingCostToChina,
              product_quantity: productQuantity,
              avg_unit_cost_from_items: avgCosts.unit_cost,
              avg_unit_cost_currency: avgCosts.unit_cost_currency,
              avg_domestic_shipping: avgCosts.domestic_shipping,
              avg_international_shipping_usd: avgCosts.intl_shipping,
              warehouse_price: variant.price,
              avg_daily_sales: product.avg_daily_sales,
              tashkent_manual_stock: variant.stock_quantity,
              tashkent_section: product.tashkent_section,
              in_transit_count: transitCounts[variant.id] || 0,
              tashkent_count: tashkentCounts[variant.id] || 0,
              notes: product.notes,
            });
          });
        } else {
          const avgCosts = getAvgCosts(null, product.id);
          flattenedProducts.push({
            id: product.id,
            productId: product.id,
            name: product.name,
            variantLabel: null,
            variantAttributes: null,
            isVariant: false,
            category_id: product.category_id,
            category_name: (product.categories_hierarchy as any)?.name || null,
            main_image_url: product.main_image_url,
            variant_image_url: null,
            cost_price: product.cost_price,
            cost_price_currency: (product as any).purchase_currency || 'CNY',
            shipping_cost_to_china: shippingCostToChina,
            product_quantity: productQuantity,
            avg_unit_cost_from_items: avgCosts.unit_cost,
            avg_unit_cost_currency: avgCosts.unit_cost_currency,
            avg_domestic_shipping: avgCosts.domestic_shipping,
            avg_international_shipping_usd: avgCosts.intl_shipping,
            warehouse_price: (product as any).price,
            avg_daily_sales: product.avg_daily_sales,
            tashkent_manual_stock: product.tashkent_manual_stock,
            tashkent_section: product.tashkent_section,
            in_transit_count: transitCounts[product.id] || 0,
            tashkent_count: tashkentCounts[product.id] || 0,
            notes: product.notes,
          });
        }

      });

      return flattenedProducts;
    },
  });

  // Arxivlash funksiyasi (Soft Delete)
  const archiveProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ status: 'archived' })
        .eq('id', productId);

      if (error) throw error;

      toast.success(t('inv_archive_success'));
      refetch();
      queryClient.invalidateQueries({ queryKey: ["tashkent-category-counts"] });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('toast_unknown_error');
      toast.error(t('inv_archive_error') + ": " + errorMessage);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ['categories-list-for-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories_hierarchy')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('inventory-indicators')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'product_items' },
        () => refetch()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const handleUpdateTashkentStock = async (indicator: ProductIndicator, newValue: number) => {
    if (indicator.isVariant) {
      // Variant stock yangilash
      const { error } = await supabase
        .from('product_variants')
        .update({ stock_quantity: newValue })
        .eq('id', indicator.id);

      if (error) {
        toast.error(t('inventory.stockUpdateError'));
        throw error;
      }

      // Product tashkent_manual_stock ni sync qilish
      const { data: allVariants } = await supabase
        .from('product_variants')
        .select('stock_quantity')
        .eq('product_id', indicator.productId);

      const totalStock = allVariants?.reduce((sum, v) => sum + (v.stock_quantity || 0), 0) || 0;

      await supabase
        .from('products')
        .update({ tashkent_manual_stock: totalStock })
        .eq('id', indicator.productId);
    } else {
      const { error } = await supabase
        .from('products')
        .update({ tashkent_manual_stock: newValue })
        .eq('id', indicator.id);

      if (error) {
        toast.error(t('inventory.stockUpdateError'));
        throw error;
      }
    }

    toast.success(t('inventory.stockUpdated'));
    await refetch();
  };

  const handleUpdateWarehousePrice = async (indicator: ProductIndicator, newValue: number) => {
    if (indicator.isVariant) {
      const { error } = await supabase
        .from('product_variants')
        .update({ price: newValue })
        .eq('id', indicator.id);

      if (error) {
        toast.error(t('inventory.priceUpdateError', 'Narxni yangilashda xatolik'));
        throw error;
      }
    } else {
      const { error } = await supabase
        .from('products')
        .update({ warehouse_price: newValue })
        .eq('id', indicator.id);

      if (error) {
        toast.error(t('inventory.priceUpdateError', 'Narxni yangilashda xatolik'));
        throw error;
      }
    }

    toast.success(t('inventory.priceUpdated', 'Narx yangilandi'));
    await refetch();
  };

  const handleSaveCostData = async (indicator: ProductIndicator, data: CostPriceData) => {
    // 1. cost_price yangilash (variant yoki product)
    if (indicator.isVariant) {
      const { error } = await supabase
        .from('product_variants')
        .update({ cost_price: data.costPrice, cost_price_currency: data.costPriceCurrency })
        .eq('id', indicator.id);
      if (error) { toast.error(t('inv_tash_cost_error')); throw error; }
    } else {
      const { error } = await supabase
        .from('products')
        .update({ cost_price: data.costPrice })
        .eq('id', indicator.id);
      if (error) { toast.error(t('inv_tash_cost_error')); throw error; }
    }

    // 2. products jadvalida shipping_cost_to_china va quantity yangilash
    // Bu getCostPriceProps fallback uchun kerak:
    // rawDomesticPerUnit = shipping_cost_to_china / product_quantity
    const { error: productUpdateError } = await supabase
      .from('products')
      .update({
        shipping_cost_to_china: data.totalShippingCny,
        quantity: data.productQty,
      })
      .eq('id', indicator.productId);
    if (productUpdateError) {
      toast.error(t('inv_tash_cost_error'));
      throw productUpdateError;
    }

    toast.success(t('inv_tash_cost_updated'));
    await refetch();
  };

  const handleUpdateCategory = async (productId: string, categoryId: string | null) => {
    const { error } = await supabase
      .from('products')
      .update({ category_id: categoryId })
      .eq('id', productId);

    if (error) {
      toast.error(t('inv_tash_category_error'));
      throw error;
    }

    toast.success(t('inv_tash_category_updated'));
    await refetch();
  };

  const handleUpdateSection = async (productId: string, section: string | null) => {
    const { error } = await supabase
      .from('products')
      .update({ tashkent_section: section })
      .eq('id', productId);

    if (error) {
      toast.error(t('inv_tash_section_error'));
      throw error;
    }

    toast.success(t('inv_tash_section_updated'));
    await refetch();
  };

  const handleUpdateName = async (productId: string, name: string) => {
    const { error } = await supabase
      .from('products')
      .update({ name })
      .eq('id', productId);

    if (error) {
      toast.error(t('inv_tash_name_error'));
      throw error;
    }

    toast.success(t('inv_tash_name_updated'));
    await refetch();
  };

  const handleUpdateImage = async (productId: string, newImageUrl: string | null) => {
    const { error } = await supabase
      .from('products')
      .update({ main_image_url: newImageUrl })
      .eq('id', productId);

    if (error) {
      throw error;
    }

    await refetch();
  };

  const handleUpdateVariantImage = async (variantId: string, newImageUrl: string | null) => {
    const { error } = await supabase
      .from('product_variants')
      .update({ image_url: newImageUrl })
      .eq('id', variantId);

    if (error) throw error;
    await refetch();
  };

  const getDailySales = (indicator: ProductIndicator) =>
    indicator.avg_daily_sales ?? 0;

  const getTotalStock = (indicator: ProductIndicator) => {
    const tashkentStock = indicator.tashkent_manual_stock ?? indicator.tashkent_count;
    return tashkentStock;
  };

  const calculateStockoutDate = (indicator: ProductIndicator) => {
    const totalStock = getTotalStock(indicator);
    const dailySales = getDailySales(indicator);
    if (dailySales <= 0 || totalStock <= 0) return null;

    const daysUntilStockout = Math.floor(totalStock / dailySales);
    return addDays(new Date(), daysUntilStockout);
  };

  const calculateReorderQty = (indicator: ProductIndicator) => {
    const dailySales = getDailySales(indicator);
    const totalStock = getTotalStock(indicator);
    if (dailySales <= 0) return null;

    const targetDays = 14;
    const targetStock = Math.ceil(dailySales * targetDays);
    const needed = Math.max(0, targetStock - totalStock);
    return needed > 0 ? needed : null;
  };

  const getStockoutBadgeVariant = (date: Date | null): "destructive" | "secondary" | "default" => {
    if (!date) return "secondary";

    const daysLeft = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 7) return "destructive";
    if (daysLeft < 14) return "secondary";
    return "default";
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "-";
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  // Tannarx uchun: product_items dan unit_cost + domestic + intl hammasi so'mga o'girib ko'rsatadi
  // Formula: (unit_cost → UZS) + (domestic_shipping CNY → UZS) + (intl_shipping USD → UZS)
  // Fallback: product_variants.cost_price + mavjud shipping ma'lumotlari
  const getCostPriceProps = (indicator: ProductIndicator) => {
    const hasUnitCostFromItems = indicator.avg_unit_cost_from_items !== null &&
      indicator.avg_unit_cost_from_items !== undefined &&
      indicator.avg_unit_cost_from_items > 0;

    // Shipping komponentlari (product_items dan, CNY va USD da)
    const rawDomesticPerUnit = (indicator.avg_domestic_shipping !== null && indicator.avg_domestic_shipping !== undefined)
      ? indicator.avg_domestic_shipping
      : (indicator.shipping_cost_to_china !== null && indicator.shipping_cost_to_china !== undefined && (indicator.product_quantity ?? 0) > 0)
        ? indicator.shipping_cost_to_china / indicator.product_quantity!
        : 0;
    const domesticUzs = rawDomesticPerUnit * cnyToUzs;   // CNY → UZS
    const intlUzs = (indicator.avg_international_shipping_usd ?? 0) * usdToUzs; // USD → UZS

    if (hasUnitCostFromItems) {
      const unitCost = indicator.avg_unit_cost_from_items ?? 0;
      const unitCurrency = indicator.avg_unit_cost_currency || 'CNY';

      let unitUzs = 0;
      if (unitCurrency === 'CNY') unitUzs = unitCost * cnyToUzs;
      else if (unitCurrency === 'USD') unitUzs = unitCost * usdToUzs;
      else unitUzs = unitCost;

      const total = unitUzs + domesticUzs + intlUzs;
      return {
        currencyAfter: "so'm",
        displayValue: total > 0 ? Math.round(total) : null,
        chinaUzs: unitUzs > 0 ? Math.round(unitUzs) : 0,
        shippingUzs: (domesticUzs + intlUzs) > 0 ? Math.round(domesticUzs + intlUzs) : 0,
        isMissing: false,
      };
    }

    // cost_price NULL bo'lsa — kiritilmagan deb belgilaymiz
    const currency = indicator.cost_price_currency || 'CNY';
    const base = indicator.cost_price; // NULL saqlaymiz, ?? 0 ishlatmaymiz

    if (base === null || base === undefined) {
      // Tannarx kiritilmagan — faqat shipping bor bo'lsa ko'rsatamiz
      const shippingOnly = domesticUzs + intlUzs;
      return {
        currencyAfter: "so'm",
        displayValue: shippingOnly > 0 ? Math.round(shippingOnly) : null,
        chinaUzs: 0,
        shippingUzs: shippingOnly > 0 ? Math.round(shippingOnly) : 0,
        isMissing: true, // Tannarx kiritilmagan belgisi
      };
    }

    let baseUzs = 0;
    if (currency === 'CNY') baseUzs = base * cnyToUzs;
    else if (currency === 'USD') baseUzs = base * usdToUzs;
    else baseUzs = base;

    const total = baseUzs + domesticUzs + intlUzs;

    return {
      currencyAfter: "so'm",
      displayValue: total > 0 ? Math.round(total) : null,
      chinaUzs: baseUzs > 0 ? Math.round(baseUzs) : 0,
      shippingUzs: (domesticUzs + intlUzs) > 0 ? Math.round(domesticUzs + intlUzs) : 0,
      isMissing: false,
    };
  };

  // Dialog trigger uchun: to'liq tannarxni so'mda formatlab qaytaradi
  const getCostPriceDisplay = (indicator: ProductIndicator): string => {
    const props = getCostPriceProps(indicator);
    if (props.isMissing) {
      // Kiritilmagan — faqat shipping bo'lsa "+shipping" ko'rsatamiz, aks holda "Kiritilmagan"
      if (props.displayValue && props.displayValue > 0) {
        return "+" + new Intl.NumberFormat('uz-UZ').format(props.displayValue) + " so'm";
      }
      return "Kiritilmagan";
    }
    if (props.displayValue && props.displayValue > 0) {
      return new Intl.NumberFormat('uz-UZ').format(props.displayValue) + " so'm";
    }
    return "—";
  };

  // Tannarx button class — isMissing bo'lsa sariq/to'q sariq rang
  const getCostButtonClass = (indicator: ProductIndicator): string => {
    const props = getCostPriceProps(indicator);
    if (props.isMissing) {
      return "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm cursor-pointer ml-auto text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30";
    }
    return "inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/50 text-sm cursor-pointer ml-auto";
  };

  // Group indicators by productId for collapsible view
  const groupedProducts = useMemo(() => {
    if (!indicators) return [];

    const groupMap = new Map<string, { product: ProductIndicator; variants: ProductIndicator[] }>();

    for (const indicator of indicators) {
      if (!groupMap.has(indicator.productId)) {
        groupMap.set(indicator.productId, { product: indicator, variants: [] });
      }
      if (indicator.isVariant) {
        groupMap.get(indicator.productId)!.variants.push(indicator);
      }
    }

    return Array.from(groupMap.values()).map(({ product, variants }) => ({
      productId: product.productId,
      name: product.name,
      category_id: product.category_id,
      category_name: product.category_name,
      main_image_url: product.main_image_url,
      tashkent_section: product.tashkent_section,
      notes: product.notes,
      in_transit_count: variants.length > 0
        ? variants.reduce((sum, v) => sum + (v.in_transit_count || 0), 0)
        : (product.in_transit_count || 0),
      avg_daily_sales: product.avg_daily_sales,
      variants: variants.length > 0 ? variants : [product],
      isMultiVariant: variants.length > 1,
      totalStock: variants.length > 0
        ? variants.reduce((sum, v) => sum + (v.tashkent_manual_stock ?? v.tashkent_count ?? 0), 0)
        : (product.tashkent_manual_stock ?? product.tashkent_count ?? 0),
    }));
  }, [indicators]);

  // Sort by stockout date (soonest first) - use first variant for sorting
  const sortedGroups = useMemo(() => {
    return groupedProducts.slice().sort((a, b) => {
      const aIndicator = a.variants[0];
      const bIndicator = b.variants[0];
      const dateA = calculateStockoutDate(aIndicator);
      const dateB = calculateStockoutDate(bIndicator);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateA.getTime() - dateB.getTime();
    });
  }, [groupedProducts]);

  // Filter by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return sortedGroups;
    const query = searchQuery.toLowerCase();

    return sortedGroups.filter(group => {
      if (group.name.toLowerCase().includes(query)) return true;
      if (group.category_name?.toLowerCase().includes(query)) return true;

      return group.variants.some(v => {
        if (v.variantLabel?.toLowerCase().includes(query)) return true;
        if (v.variantAttributes) {
          const attrValues = Object.values(v.variantAttributes).join(' ').toLowerCase();
          if (attrValues.includes(query)) return true;
        }
        return false;
      });
    });
  }, [sortedGroups, searchQuery]);

  // Track open product groups
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (productId: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('inv_tash_products')}
          </CardTitle>
          {selectedCategoryId && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors gap-1"
              onClick={onClearFilter}
            >
              {filteredGroups?.[0]?.category_name || t('inv_tash_selected_category')}
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('inv_tash_search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {canManageWarehouse && onAddProduct && (
            <Button onClick={onAddProduct} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {t('inventory.addProduct', 'Mahsulot qo\'shish')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!filteredGroups?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>
              {searchQuery
                ? t('inv_tash_no_results', { query: searchQuery })
                : t('inv_tash_no_products')
              }
            </p>
          </div>
        ) : isMobile ? (
          <div className="space-y-2">
            {filteredGroups.map((group) => {
              const isOpen = openGroups.has(group.productId);

              return (
                <div key={group.productId} className="border rounded-lg overflow-hidden">
                  {/* Product header */}
                  <div
                    className={cn(
                      "p-3 flex items-start gap-2",
                      group.isMultiVariant && "cursor-pointer hover:bg-muted/50"
                    )}
                    onClick={() => group.isMultiVariant && toggleGroup(group.productId)}
                  >
                    <InlineImageEdit
                      productId={group.productId}
                      currentImageUrl={group.main_image_url}
                      productName={group.name}
                      onSave={(newUrl) => handleUpdateImage(group.productId, newUrl)}
                    />
                    <div className="flex-1 min-w-0">
                      <InlineNameInput
                        value={group.name}
                        onSave={(name) => handleUpdateName(group.productId, name)}
                      />
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {group.isMultiVariant && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            {group.variants.length} variant
                          </Badge>
                        )}
                        <Badge variant={group.totalStock > 5 ? "default" : "destructive"}
                          className={cn(group.totalStock > 5 && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400")}>
                          {t('inv_tash_total', { count: group.totalStock })}
                        </Badge>
                      </div>
                      {!group.isMultiVariant && group.variants[0]?.variantLabel && (
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          {group.variants[0].variantAttributes?.rang && (
                            <Badge variant="outline" className="text-xs gap-1 items-center">
                              <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-400 shrink-0 shadow-sm" style={{ backgroundColor: getColorHex(group.variants[0].variantAttributes.rang) }} />
                              {group.variants[0].variantAttributes.rang}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline" size="sm"
                        onClick={(e) => { e.stopPropagation(); handleEditProduct(group.productId); }}
                        className="h-7 w-7 p-0"
                        disabled={isEditLoading === group.productId}
                      >
                        {isEditLoading === group.productId
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Edit className="h-3.5 w-3.5" />}
                      </Button>
                      {canDelete && (
                        <Button
                          variant="outline" size="sm"
                          onClick={(e) => { e.stopPropagation(); setProductToDelete({ id: group.productId, name: group.name }); }}
                          className="text-destructive border-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {group.isMultiVariant && (
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                      )}
                    </div>
                  </div>

                  {/* Variant rows (collapsible for multi-variant) */}
                  {(isOpen || !group.isMultiVariant) && (
                    <div className={cn(group.isMultiVariant && "border-t")}>
                      {group.variants.map((indicator) => {
                        const stockoutDate = calculateStockoutDate(indicator);
                        const badgeVariant = getStockoutBadgeVariant(stockoutDate);
                        const tashkentStock = indicator.tashkent_manual_stock ?? indicator.tashkent_count;
                        const reorderQty = calculateReorderQty(indicator);

                        return (
                          <div key={indicator.id} className={cn("p-3 space-y-2", group.isMultiVariant && "border-b last:border-b-0 bg-muted/20")}>
                            {group.isMultiVariant && indicator.variantLabel && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <InlineVariantImageEdit
                                  variantId={indicator.id}
                                  currentImageUrl={indicator.variant_image_url}
                                  variantLabel={indicator.variantLabel || indicator.variantAttributes?.rang || 'Variant'}
                                  onSave={(url) => handleUpdateVariantImage(indicator.id, url)}
                                />
                                {indicator.variantAttributes?.rang && (
                                  <Badge variant="outline" className="text-xs gap-1 items-center">
                                    {!indicator.variant_image_url && <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-400 shrink-0 shadow-sm" style={{ backgroundColor: getColorHex(indicator.variantAttributes.rang) }} />}
                                    {indicator.variantAttributes.rang}
                                  </Badge>
                                )}
                                {indicator.variantAttributes?.razmer && (
                                  <Badge variant="secondary" className="text-xs">{indicator.variantAttributes.razmer}</Badge>
                                )}
                                {indicator.variantAttributes?.material && (
                                  <Badge variant="secondary" className="text-xs">{indicator.variantAttributes.material}</Badge>
                                )}
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">{t('inventory.tashkentStockQty', 'Zaxira')}</span>
                                <div><InlineStockInput value={tashkentStock} onSave={(v) => handleUpdateTashkentStock(indicator, v)} /></div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">{t('inventory.inTransitQty', "Yo'lda")}</span>
                                <div>
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                    {indicator.in_transit_count}
                                  </Badge>
                                </div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">{t('inventory.stockoutDate', 'Tugash')}</span>
                                <div>
                                  {stockoutDate ? (
                                    <Badge variant={badgeVariant} className="text-xs">
                                      {badgeVariant === "destructive" && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                                      {format(stockoutDate, 'dd.MM')}
                                    </Badge>
                                  ) : <span className="text-muted-foreground">-</span>}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">{t('inv_tash_cost', 'Tannarx')}</span>
                                <div className="flex flex-col gap-1 items-start mt-1">
                                  <button
                                    onClick={() => setEditingCostIndicator(indicator)}
                                    className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm cursor-pointer border", getCostPriceProps(indicator).isMissing ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-900/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800")}
                                  >
                                    <span className={cn("font-semibold", getCostPriceProps(indicator).isMissing ? "" : "text-foreground")}>{getCostPriceDisplay(indicator)}</span>
                                    <Pencil className="h-3.5 w-3.5 opacity-50" />
                                  </button>

                                  {/* Cost Breakdown Details */}
                                  {!getCostPriceProps(indicator).isMissing && (
                                    <div className="text-[10px] text-muted-foreground space-y-0.5 ml-1 mt-0.5 w-full">
                                      <div className="flex justify-between items-center w-full gap-2">
                                        <span>Xitoy:</span>
                                        <span className="font-medium">{new Intl.NumberFormat('uz-UZ').format(getCostPriceProps(indicator).chinaUzs || 0)}</span>
                                      </div>
                                      <div className="flex justify-between items-center w-full gap-2">
                                        <span>Yo'l haqqi:</span>
                                        <span className="font-medium">{new Intl.NumberFormat('uz-UZ').format(getCostPriceProps(indicator).shippingUzs || 0)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">{t('inv_tash_sale', 'Sotuv')}</span>
                                <div><InlinePriceInput value={indicator.warehouse_price} onSave={(v) => handleUpdateWarehousePrice(indicator, v)} /></div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">{t('inventory.reorderQty', 'Buyurtma')}</span>
                                <div>
                                  {reorderQty ? <Badge variant="outline" className="font-semibold">+{reorderQty}</Badge> : <span className="text-muted-foreground">-</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[60px]">{t('inventory.image')}</TableHead>
                  <TableHead>{t('inventory.colName')}</TableHead>
                  <TableHead className="text-center">{t('inv_tash_section', 'Bo\'lim')}</TableHead>
                  <TableHead>{t('inventory.colCategory')}</TableHead>
                  <TableHead className="text-right">{t('inv_tash_cost', 'Tannarx')}</TableHead>
                  <TableHead className="text-center">{t('inventory.inTransitQty')}</TableHead>
                  <TableHead className="text-center">{t('inventory.tashkentStockQty')}</TableHead>
                  <TableHead className="text-right">{t('inventory.tashkentSalePrice')}</TableHead>
                  <TableHead className="text-center">{t('inventory.stockoutDate')}</TableHead>
                  <TableHead className="text-center">{t('inventory.reorderQty')}</TableHead>
                  <TableHead className="text-center w-[110px]">{t('inv_tash_actions', 'Amallar')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group) => {
                  const isOpen = openGroups.has(group.productId);

                  if (!group.isMultiVariant) {
                    // Single product/variant - render as before
                    const indicator = group.variants[0];
                    const stockoutDate = calculateStockoutDate(indicator);
                    const badgeVariant = getStockoutBadgeVariant(stockoutDate);
                    const tashkentStock = indicator.tashkent_manual_stock ?? indicator.tashkent_count;
                    const reorderQty = calculateReorderQty(indicator);

                    return (
                      <TableRow key={indicator.id}>
                        <TableCell></TableCell>
                        <TableCell>
                          <InlineImageEdit productId={indicator.productId} currentImageUrl={indicator.main_image_url} productName={indicator.name} onSave={(newUrl) => handleUpdateImage(indicator.productId, newUrl)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <InlineNameInput value={indicator.name} onSave={(name) => handleUpdateName(indicator.productId, name)} />
                            {indicator.variantLabel && (
                              <div className="flex items-center gap-2 flex-wrap">
                                {indicator.isVariant && (
                                  <InlineVariantImageEdit
                                    variantId={indicator.id}
                                    currentImageUrl={indicator.variant_image_url}
                                    variantLabel={indicator.variantLabel || indicator.variantAttributes?.rang || 'Variant'}
                                    onSave={(url) => handleUpdateVariantImage(indicator.id, url)}
                                  />
                                )}
                                {indicator.variantAttributes?.rang && (
                                  <Badge variant="outline" className="text-xs gap-1 items-center">
                                    {!indicator.variant_image_url && <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-400 shrink-0 shadow-sm" style={{ backgroundColor: getColorHex(indicator.variantAttributes.rang) }} />}
                                    {indicator.variantAttributes.rang}
                                  </Badge>
                                )}
                                {indicator.variantAttributes?.material && <Badge variant="secondary" className="text-xs">{indicator.variantAttributes.material}</Badge>}
                                {indicator.variantAttributes?.razmer && <Badge variant="secondary" className="text-xs">{indicator.variantAttributes.razmer}</Badge>}
                                {Object.entries(indicator.variantAttributes || {}).filter(([key]) => !['rang', 'material', 'razmer'].includes(key)).map(([key, value]) => (
                                  <Badge key={key} variant="outline" className="text-xs">{String(value)}</Badge>
                                ))}
                              </div>
                            )}
                            {indicator.notes && <span className="text-xs text-amber-600 dark:text-amber-400">📝 {indicator.notes}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <InlineSectionInput value={indicator.tashkent_section} onSave={(section) => handleUpdateSection(indicator.productId, section)} />
                        </TableCell>
                        <TableCell>
                          <InlineCategorySelect currentCategoryId={indicator.category_id} currentCategoryName={indicator.category_name} categories={categories || []} onSave={(catId) => handleUpdateCategory(indicator.productId, catId)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1 px-1">
                            <button
                              onClick={() => setEditingCostIndicator(indicator)}
                              className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm cursor-pointer border transition-colors", getCostPriceProps(indicator).isMissing ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-900/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800")}
                            >
                              <span className={cn("font-semibold", getCostPriceProps(indicator).isMissing ? "" : "")}>{getCostPriceDisplay(indicator)}</span>
                              <Pencil className="h-3 w-3 opacity-50 flex-shrink-0" />
                            </button>

                            {/* Desktop Cost Breakdown */}
                            {!getCostPriceProps(indicator).isMissing && (
                              <div className="text-[11px] text-muted-foreground space-y-0.5 w-full max-w-[130px] pt-1 border-t border-border mt-1">
                                <div className="flex justify-between items-center w-full gap-2">
                                  <span className="text-muted-foreground/80">Xitoy:</span>
                                  <span className="font-medium text-foreground">{new Intl.NumberFormat('uz-UZ').format(getCostPriceProps(indicator).chinaUzs || 0)} </span>
                                </div>
                                <div className="flex justify-between items-center w-full gap-2">
                                  <span className="text-muted-foreground/80">Yo'l:</span>
                                  <span className="font-medium text-foreground">{new Intl.NumberFormat('uz-UZ').format(getCostPriceProps(indicator).shippingUzs || 0)} </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{indicator.in_transit_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <InlineStockInput value={tashkentStock} onSave={(newValue) => handleUpdateTashkentStock(indicator, newValue)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <InlinePriceInput value={indicator.warehouse_price} onSave={(newValue) => handleUpdateWarehousePrice(indicator, newValue)} />
                        </TableCell>
                        <TableCell className="text-center">
                          {stockoutDate ? (
                            <Badge variant={badgeVariant} className="flex items-center gap-1 justify-center">
                              {badgeVariant === "destructive" && <AlertTriangle className="h-3 w-3" />}
                              {format(stockoutDate, 'dd.MM.yyyy')}
                            </Badge>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {reorderQty ? <Badge variant="outline" className="font-semibold">+{reorderQty}</Badge> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="outline" size="sm" onClick={() => handleEditProduct(indicator.productId)} className="h-8 w-8 p-0" disabled={isEditLoading === indicator.productId}>
                              {isEditLoading === indicator.productId
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Edit className="h-4 w-4" />}
                            </Button>
                            {canDelete && (
                              <Button variant="outline" size="sm" onClick={() => setProductToDelete({ id: indicator.productId, name: indicator.name })} className="text-destructive border-destructive hover:bg-destructive/10 h-8 w-8 p-0" disabled={isDeleting}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // Multi-variant product - collapsible parent + children
                  return (
                    <Fragment key={group.productId}>
                      {/* Parent row */}
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleGroup(group.productId)}
                      >
                        <TableCell className="w-[40px]">
                          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                        </TableCell>
                        <TableCell>
                          <InlineImageEdit productId={group.productId} currentImageUrl={group.main_image_url} productName={group.name} onSave={(newUrl) => handleUpdateImage(group.productId, newUrl)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <InlineNameInput value={group.name} onSave={(name) => handleUpdateName(group.productId, name)} />
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <Package className="h-3 w-3" />
                                {group.variants.length} variant
                              </Badge>
                              {group.variants.slice(0, 4).map((v, i) => (
                                <span
                                  key={i}
                                  className="inline-block w-3.5 h-3.5 rounded-full border-2 border-gray-400 shadow-sm"
                                  style={{ backgroundColor: getColorHex(v.variantAttributes?.rang) }}
                                  title={v.variantLabel || ''}
                                />
                              ))}
                              {group.variants.length > 4 && <span className="text-xs text-muted-foreground">+{group.variants.length - 4}</span>}
                            </div>
                            {group.notes && <span className="text-xs text-amber-600 dark:text-amber-400">📝 {group.notes}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <InlineSectionInput value={group.tashkent_section} onSave={(section) => handleUpdateSection(group.productId, section)} />
                        </TableCell>
                        <TableCell>
                          <InlineCategorySelect currentCategoryId={group.category_id} currentCategoryName={group.category_name} categories={categories || []} onSave={(catId) => handleUpdateCategory(group.productId, catId)} />
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{group.in_transit_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={group.totalStock > 5 ? "default" : "destructive"}
                            className={cn(group.totalStock > 5 && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400")}>
                            {t('inv_tash_total', { count: group.totalStock })}
                          </Badge>
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleEditProduct(group.productId); }} className="h-8 w-8 p-0" disabled={isEditLoading === group.productId}>
                              {isEditLoading === group.productId
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Edit className="h-4 w-4" />}
                            </Button>
                            {canDelete && (
                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setProductToDelete({ id: group.productId, name: group.name }); }} className="text-destructive border-destructive hover:bg-destructive/10 h-8 w-8 p-0" disabled={isDeleting}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Variant rows */}
                      {isOpen && group.variants.map((indicator) => {
                        const stockoutDate = calculateStockoutDate(indicator);
                        const badgeVariant = getStockoutBadgeVariant(stockoutDate);
                        const tashkentStock = indicator.tashkent_manual_stock ?? indicator.tashkent_count;
                        const reorderQty = calculateReorderQty(indicator);

                        return (
                          <TableRow key={indicator.id} className="bg-muted/20">
                            <TableCell></TableCell>
                            <TableCell>
                              <InlineVariantImageEdit
                                variantId={indicator.id}
                                currentImageUrl={indicator.variant_image_url}
                                variantLabel={indicator.variantLabel || indicator.variantAttributes?.rang || 'Variant'}
                                onSave={(url) => handleUpdateVariantImage(indicator.id, url)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 flex-wrap pl-2">
                                {indicator.variantAttributes?.rang && (
                                  <Badge variant="outline" className="text-xs gap-1 items-center">
                                    {!indicator.variant_image_url && <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-400 shrink-0 shadow-sm" style={{ backgroundColor: getColorHex(indicator.variantAttributes.rang) }} />}
                                    {indicator.variantAttributes.rang}
                                  </Badge>
                                )}
                                {indicator.variantAttributes?.material && <Badge variant="secondary" className="text-xs">{indicator.variantAttributes.material}</Badge>}
                                {indicator.variantAttributes?.razmer && <Badge variant="secondary" className="text-xs">{indicator.variantAttributes.razmer}</Badge>}
                                {Object.entries(indicator.variantAttributes || {}).filter(([key]) => !['rang', 'material', 'razmer'].includes(key)).map(([key, value]) => (
                                  <Badge key={key} variant="outline" className="text-xs">{String(value)}</Badge>
                                ))}
                                {!indicator.variantLabel && <span className="text-xs text-muted-foreground">Variant</span>}
                              </div>
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right">
                              <button onClick={() => setEditingCostIndicator(indicator)} className={getCostButtonClass(indicator)}><span>{getCostPriceDisplay(indicator)}</span><Pencil className="h-3 w-3 opacity-50 flex-shrink-0" /></button>
                            </TableCell>
                            <TableCell className="text-center">
                              {indicator.in_transit_count > 0 ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                  {indicator.in_transit_count}
                                </Badge>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-center">
                              <InlineStockInput value={tashkentStock} onSave={(newValue) => handleUpdateTashkentStock(indicator, newValue)} />
                            </TableCell>
                            <TableCell className="text-right">
                              <InlinePriceInput value={indicator.warehouse_price} onSave={(newValue) => handleUpdateWarehousePrice(indicator, newValue)} />
                            </TableCell>
                            <TableCell className="text-center">
                              {stockoutDate ? (
                                <Badge variant={badgeVariant} className="flex items-center gap-1 justify-center">
                                  {badgeVariant === "destructive" && <AlertTriangle className="h-3 w-3" />}
                                  {format(stockoutDate, 'dd.MM.yyyy')}
                                </Badge>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {reorderQty ? <Badge variant="outline" className="font-semibold">+{reorderQty}</Badge> : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            {canDelete && <TableCell></TableCell>}
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Arxivlash Tasdiqlash Dialogi */}
        <ConfirmDialog
          open={!!productToDelete}
          onOpenChange={(open) => !open && setProductToDelete(null)}
          title={t('inv_archive_title')}
          description={t('inv_archive_desc', { name: productToDelete?.name })}
          confirmText={t('inv_archive_confirm')}
          cancelText={t('cancel')}
          variant="destructive"
          onConfirm={async () => {
            if (productToDelete) {
              setIsDeleting(true);
              await archiveProduct(productToDelete.id);
              setProductToDelete(null);
              setIsDeleting(false);
            }
          }}
          isLoading={isDeleting}
        />

        {/* Tannarx tahrirlash dialogi */}
        {editingCostIndicator && (
          <CostPriceEditDialog
            open={!!editingCostIndicator}
            onOpenChange={(open) => !open && setEditingCostIndicator(null)}
            indicator={editingCostIndicator}
            onSave={(data) => handleSaveCostData(editingCostIndicator, data)}
            usdToUzs={usdToUzs}
            cnyToUzs={cnyToUzs}
          />
        )}

        {/* Mahsulot tahrirlash dialogi */}
        <ProductFormDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingProduct(null);
          }}
          editingProduct={editingProduct}
        />
      </CardContent>
    </Card>
  );
}
