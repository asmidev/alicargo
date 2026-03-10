import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Search, Layers, Tag } from "lucide-react";
import { ProductGroupCard } from "./ProductGroupCard";
import {
  groupProducts,
  filterGroups,
  calculateGroupingStats,
} from "@/lib/productGrouping";

interface GroupedProductListProps {
  onSellProduct: (product: {
    id: string;
    name: string;
    image?: string;
    warehousePrice: number | null;
    availableStock: number;
  }) => void;
  onDeleteProduct?: (productId: string, productName: string) => void;
  canDelete?: boolean;
  className?: string;
}

export function GroupedProductList({
  onSellProduct,
  onDeleteProduct,
  canDelete,
  className,
}: GroupedProductListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["tashkent-grouped-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          id,
          name,
          notes,
          main_image_url,
          warehouse_price,
          tashkent_manual_stock,
          category_id,
          has_variants,
          cost_price,
          categories_hierarchy!products_category_id_fkey (name),
          product_variants(id, sku, variant_attributes, stock_quantity, price, cost_price, cost_price_currency)
        `
        )
        .neq("source", "marketplace_auto")
        .gt("tashkent_manual_stock", 0)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  // Group products using the algorithm
  const groups = useMemo(() => groupProducts(products), [products]);

  // Bo'sh yoki stoki yo'q guruhlarni filtr qilish (xavfsizlik qatlami)
  const nonEmptyGroups = useMemo(
    () => groups.filter(g => g.variants.length > 0 && g.totalStock > 0),
    [groups]
  );

  // Filter groups by search query
  const filteredGroups = useMemo(
    () => filterGroups(nonEmptyGroups, searchQuery),
    [nonEmptyGroups, searchQuery]
  );

  // Calculate statistics
  const stats = useMemo(() => calculateGroupingStats(nonEmptyGroups), [nonEmptyGroups]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header with search and stats */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Guruhlangan mahsulotlar
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Statistics badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Layers className="h-3 w-3" />
              {stats.totalGroups} guruh
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Tag className="h-3 w-3" />
              {stats.totalVariants} variant
            </Badge>
            {stats.largestGroup && (
              <Badge variant="outline" className="gap-1">
                Eng katta: {stats.largestGroup.name} ({stats.largestGroup.count})
              </Badge>
            )}
            <Badge variant="outline">
              {stats.singleProducts} yagona mahsulot
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Product groups list */}
      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>
                {searchQuery
                  ? `"${searchQuery}" bo'yicha mahsulot topilmadi`
                  : "Sotuvga tayyor mahsulotlar yo'q"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <ProductGroupCard
              key={group.baseName}
              group={group}
              onSellProduct={onSellProduct}
              onDeleteProduct={onDeleteProduct}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
