import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineImageEdit } from "@/components/inventory/InlineImageEdit";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Package, ShoppingCart, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductGroup, getColorStyle } from "@/lib/productGrouping";
import { VariantSkuMapping } from "@/components/products/VariantSkuMapping";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const formatCostPrice = (price: number | null, currency: string | null): string => {
  if (!price) return "";
  if (currency === 'CNY') return `¥${price.toFixed(2)}`;
  if (currency === 'USD') return `$${price.toFixed(2)}`;
  return new Intl.NumberFormat("uz-UZ").format(price) + " so'm";
};

interface ProductGroupCardProps {
  group: ProductGroup;
  onSellProduct: (product: {
    id: string;
    name: string;
    image?: string;
    warehousePrice: number | null;
    availableStock: number;
  }) => void;
  onDeleteProduct?: (productId: string, productName: string) => void;
  canDelete?: boolean;
}

export function ProductGroupCard({ group, onSellProduct, onDeleteProduct, canDelete }: ProductGroupCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleImageSave = async (productId: string, newImageUrl: string | null) => {
    const { error } = await supabase
      .from('products')
      .update({ main_image_url: newImageUrl })
      .eq('id', productId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['tashkent-grouped-products'] });
  };
  const formatPrice = (price: number | null) => {
    if (!price) return "-";
    return new Intl.NumberFormat("uz-UZ").format(price) + " so'm";
  };

  const formatValue = (value: number) => {
    return new Intl.NumberFormat("uz-UZ").format(value) + " so'm";
  };

  // For single products without variants, show simplified view
  if (group.isSingleProduct) {
    const variant = group.variants[0];
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <InlineImageEdit
              productId={variant.productId || variant.id}
              currentImageUrl={variant.image || null}
              productName={variant.name}
              onSave={(url) => handleImageSave(variant.productId || variant.id, url)}
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{variant.name}</h3>
              {group.category && (
                <p className="text-sm text-muted-foreground truncate">
                  {group.category}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <Badge
                  variant={variant.stock > 5 ? "default" : "destructive"}
                  className={cn(
                    variant.stock > 5
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : ""
                  )}
                >
                  {variant.stock} dona
                </Badge>
                <span className="text-sm font-medium">
                  {formatPrice(variant.price)}
                </span>
                {variant.costPrice ? (
                  <span className="text-xs text-muted-foreground">
                    Tannarx: {formatCostPrice(variant.costPrice, variant.costPriceCurrency)}
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Tannarx kiritilmagan
                  </span>
                )}
                <VariantSkuMapping variantId={variant.id} autoSave />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                disabled={variant.stock <= 0}
                onClick={() =>
                  onSellProduct({
                    id: variant.id,
                    name: variant.name,
                    image: variant.image,
                    warehousePrice: variant.price,
                    availableStock: variant.stock,
                  })
                }
                className="gap-1"
              >
                <ShoppingCart className="h-4 w-4" />
                Sotish
              </Button>
              {canDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDeleteProduct?.(variant.id, variant.name)}
                  className="text-destructive border-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
        
        {/* Izoh ko'rsatish - single product uchun ham */}
        {group.notes && (
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 text-sm border-t">
            <span className="text-amber-700 dark:text-amber-400">
              📝 Izoh: {group.notes}
            </span>
          </div>
        )}
      </Card>
    );
  }

  // Multi-variant group with collapsible
  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="relative">
                <InlineImageEdit
                  productId={group.variants[0]?.productId || group.variants[0]?.id || ''}
                  currentImageUrl={group.representativeImage || null}
                  productName={group.displayName}
                  onSave={(url) => handleImageSave(group.variants[0]?.productId || group.variants[0]?.id || '', url)}
                />
                <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {group.variants.length}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary flex-shrink-0" />
                  <h3 className="font-semibold truncate">{group.displayName}</h3>
                </div>
                {/* Rang emoji'lari qo'shildi */}
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {group.variants.slice(0, 5).map((v, i) => {
                    const attrs = v.variantAttributes || {};
                    const colorStyle = getColorStyle(attrs.rang || v.variantName);
                    return (
                      <span 
                        key={i} 
                        className="inline-block w-4 h-4 rounded-full border-2 border-gray-400 dark:border-gray-500 shadow-sm" 
                        style={{ backgroundColor: colorStyle.color }}
                        title={attrs.rang || v.variantName || ''}
                      />
                    );
                  })}
                  {group.variants.length > 5 && (
                    <span className="text-xs text-muted-foreground">
                      +{group.variants.length - 5}
                    </span>
                  )}
                </div>
                {group.category && (
                  <p className="text-sm text-muted-foreground truncate">
                    {group.category}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <Badge variant="secondary" className="gap-1">
                    {group.variants.length} variant
                  </Badge>
                  <Badge
                    variant={group.totalStock > 10 ? "default" : "destructive"}
                    className={cn(
                      group.totalStock > 10
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : ""
                    )}
                  >
                    Jami: {group.totalStock} dona
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    O'rtacha: {formatPrice(group.avgPrice)}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform flex-shrink-0",
                  isOpen && "rotate-180"
                )}
              />
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            {/* Variant list */}
            <div className="divide-y">
              {group.variants.map((variant) => {
                const colorStyle = getColorStyle(variant.variantName);
                const attrs = variant.variantAttributes || {};
                const hasAttrs = Object.keys(attrs).length > 0;
                
                return (
                  <div
                    key={variant.id}
                    className="flex items-center gap-4 p-3 px-4 hover:bg-muted/30 transition-colors"
                  >
                    {/* Variant attributes yoki rang ko'rsatish */}
                    <div className="flex items-center gap-2 min-w-[150px] flex-wrap">
                      {hasAttrs ? (
                        <>
                          {attrs.rang && (
                            <Badge variant="outline" className="gap-1 items-center">
                              <span 
                                className="inline-block w-3 h-3 rounded-full border-2 border-gray-400 dark:border-gray-500" 
                                style={{ backgroundColor: getColorStyle(attrs.rang).color }}
                              />
                              <span className="capitalize">{attrs.rang}</span>
                            </Badge>
                          )}
                          {attrs.razmer && (
                            <Badge variant="secondary" className="text-xs">
                              {attrs.razmer}
                            </Badge>
                          )}
                          {attrs.material && (
                            <Badge variant="secondary" className="text-xs">
                              {attrs.material}
                            </Badge>
                          )}
                          {/* Boshqa atributlar */}
                          {Object.entries(attrs)
                            .filter(([key]) => !['rang', 'razmer', 'material'].includes(key))
                            .map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {value}
                              </Badge>
                            ))}
                        </>
                      ) : (
                        <>
                          <span 
                            className="inline-block w-5 h-5 rounded-full border-2 border-gray-400 dark:border-gray-500 shadow-sm" 
                            style={{ backgroundColor: colorStyle.color }}
                          />
                          <span className="font-medium text-sm capitalize">
                            {colorStyle.label}
                          </span>
                        </>
                      )}
                    </div>
                    
                    <InlineImageEdit
                      productId={variant.productId || variant.id}
                      currentImageUrl={variant.image || null}
                      productName={variant.name}
                      onSave={(url) => handleImageSave(variant.productId || variant.id, url)}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate text-muted-foreground">
                        {variant.name}
                      </p>
                      <div className="mt-1">
                        <VariantSkuMapping variantId={variant.id} autoSave />
                      </div>
                    </div>
                    
                    <Badge
                      variant={variant.stock > 5 ? "default" : "destructive"}
                      className={cn(
                        "min-w-[70px] justify-center",
                        variant.stock > 5
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : ""
                      )}
                    >
                      {variant.stock} dona
                    </Badge>
                    
                    <div className="flex flex-col items-end min-w-[100px]">
                      <span className="text-sm font-medium">
                        {formatPrice(variant.price)}
                      </span>
                      {variant.costPrice ? (
                        <span className="text-xs text-muted-foreground">
                          {formatCostPrice(variant.costPrice, variant.costPriceCurrency)}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400">Kiritilmagan</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={variant.stock <= 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSellProduct({
                            id: variant.id,
                            name: variant.name,
                            image: variant.image,
                            warehousePrice: variant.price,
                            availableStock: variant.stock,
                          });
                        }}
                        className="gap-1"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        Sotish
                      </Button>
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProduct?.(variant.id, variant.name);
                          }}
                          className="text-destructive border-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Izoh (agar bor bo'lsa) */}
            {group.notes && (
              <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 text-sm border-t">
                <span className="text-amber-700 dark:text-amber-400">
                  📝 Izoh: {group.notes}
                </span>
              </div>
            )}

            {/* Group statistics footer */}
            <div className="bg-muted/50 p-3 px-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">📊 Umumiy statistika</span>
              <span className="font-semibold">
                Jami qiymat: {formatValue(group.totalValue)}
              </span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
