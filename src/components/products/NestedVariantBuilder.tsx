import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Trash2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface NestedVariantItem {
  rang: string;
  materiallar: string[];
}

export interface NestedVariantBuilderProps {
  nestedVariants: NestedVariantItem[];
  onNestedVariantsChange: (variants: NestedVariantItem[]) => void;
}

// Color name to hex mapping
function getColorCode(colorName: string): string | null {
  const colorMap: Record<string, string> = {
    // O'zbekcha
    qora: "#1a1a1a",
    oq: "#ffffff",
    qizil: "#ef4444",
    kok: "#3b82f6",
    yashil: "#22c55e",
    sariq: "#eab308",
    pushti: "#ec4899",
    binafsha: "#8b5cf6",
    jigarrang: "#92400e",
    kulrang: "#6b7280",
    oltin: "#f59e0b",
    kumush: "#94a3b8",
    moviy: "#06b6d4",
    bronza: "#b45309",
    // Inglizcha
    black: "#1a1a1a",
    white: "#ffffff",
    red: "#ef4444",
    blue: "#3b82f6",
    green: "#22c55e",
    yellow: "#eab308",
    pink: "#ec4899",
    purple: "#8b5cf6",
    brown: "#92400e",
    gray: "#6b7280",
    grey: "#6b7280",
    gold: "#f59e0b",
    silver: "#94a3b8",
    orange: "#f97316",
    cyan: "#06b6d4",
    // Ruscha kirill
    "черный": "#1a1a1a",
    "белый": "#ffffff",
    "красный": "#ef4444",
    "синий": "#3b82f6",
    "зеленый": "#22c55e",
    "желтый": "#eab308",
    "розовый": "#ec4899",
    "фиолетовый": "#8b5cf6",
    "коричневый": "#92400e",
    "серый": "#6b7280",
    "золотой": "#f59e0b",
    "серебряный": "#94a3b8",
    "оранжевый": "#f97316",
    "голубой": "#06b6d4",
    "бронзовый": "#b45309",
    // Ruscha lotin transliteratsiya
    cherniy: "#1a1a1a",
    chernyy: "#1a1a1a",
    chorny: "#1a1a1a",
    beliy: "#ffffff",
    belyy: "#ffffff",
    bely: "#ffffff",
    krasnyy: "#ef4444",
    krasniy: "#ef4444",
    krasni: "#ef4444",
    siniy: "#3b82f6",
    sinii: "#3b82f6",
    sini: "#3b82f6",
    zelonyy: "#22c55e",
    zelyoniy: "#22c55e",
    zeleni: "#22c55e",
    zeleniy: "#22c55e",
    jeltyy: "#eab308",
    jeltyj: "#eab308",
    jelti: "#eab308",
    zhyoltyy: "#eab308",
    rozoviy: "#ec4899",
    rozovi: "#ec4899",
    fioletoviy: "#8b5cf6",
    fioletovi: "#8b5cf6",
    korichneviy: "#92400e",
    korichnevi: "#92400e",
    korichnevoye: "#92400e",
    seryy: "#6b7280",
    seriy: "#6b7280",
    seri: "#6b7280",
    oranjeviy: "#f97316",
    oranzheviy: "#f97316",
    oranji: "#f97316",
    oranzhevi: "#f97316",
    goluboy: "#06b6d4",
    golubiy: "#06b6d4",
    goluboye: "#06b6d4",
    zolotoy: "#f59e0b",
    zoloti: "#f59e0b",
    zolotiye: "#f59e0b",
    serebryanyy: "#94a3b8",
    serebryani: "#94a3b8",
    serebri: "#94a3b8",
    bronzoviy: "#b45309",
    bronzovi: "#b45309",
    prozrachnyy: "#e5e7eb",
    prozrachni: "#e5e7eb",
  };
  return colorMap[colorName.toLowerCase()] || null;
}

export function NestedVariantBuilder({ 
  nestedVariants, 
  onNestedVariantsChange 
}: NestedVariantBuilderProps) {
  const { t } = useTranslation();
  const [newRang, setNewRang] = useState("");
  const [newMaterialInputs, setNewMaterialInputs] = useState<Record<string, string>>({});

  // Add a new color
  const handleAddRang = () => {
    const trimmed = newRang.trim();
    if (!trimmed) return;
    if (nestedVariants.some(v => v.rang.toLowerCase() === trimmed.toLowerCase())) {
      return; // Already exists
    }
    onNestedVariantsChange([...nestedVariants, { rang: trimmed, materiallar: [] }]);
    setNewRang("");
  };

  // Remove a color and all its materials
  const handleRemoveRang = (rang: string) => {
    onNestedVariantsChange(nestedVariants.filter(v => v.rang !== rang));
    const { [rang]: _, ...rest } = newMaterialInputs;
    setNewMaterialInputs(rest);
  };

  // Add a material to a specific color
  const handleAddMaterial = (rang: string) => {
    const value = newMaterialInputs[rang]?.trim();
    if (!value) return;
    
    onNestedVariantsChange(
      nestedVariants.map(v => {
        if (v.rang === rang && !v.materiallar.includes(value)) {
          return { ...v, materiallar: [...v.materiallar, value] };
        }
        return v;
      })
    );
    setNewMaterialInputs({ ...newMaterialInputs, [rang]: "" });
  };

  // Remove a material from a specific color
  const handleRemoveMaterial = (rang: string, material: string) => {
    onNestedVariantsChange(
      nestedVariants.map(v => {
        if (v.rang === rang) {
          return { ...v, materiallar: v.materiallar.filter(m => m !== material) };
        }
        return v;
      })
    );
  };

  // Get all unique materials across all colors for suggestions
  const allMaterials = Array.from(
    new Set(nestedVariants.flatMap(v => v.materiallar))
  );

  // Calculate total variants
  const totalVariants = nestedVariants.reduce((sum, v) => sum + v.materiallar.length, 0);

  return (
    <div className="space-y-3 min-w-0">
      {/* Add new color - compact */}
      <div className="flex gap-2">
        <Input
          placeholder={t('prod_new_color_placeholder')}
          value={newRang}
          onChange={(e) => setNewRang(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddRang()}
          className="h-9 flex-1 w-0 min-w-0"
        />
        <Button onClick={handleAddRang} variant="outline" size="sm" className="h-9 shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          {t('prod_add_color')}
        </Button>
      </div>

      {/* Quick color chips */}
      <div className="flex flex-wrap gap-1.5 min-w-0">
        {["qora", "oq", "qizil", "kok", "yashil", "sariq"].map((color) => {
          const isAdded = nestedVariants.some(v => v.rang.toLowerCase() === color);
          const colorCode = getColorCode(color);
          return (
            <Button
              key={color}
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2 gap-1"
              disabled={isAdded}
              onClick={() => {
                if (!isAdded) {
                  onNestedVariantsChange([...nestedVariants, { rang: color, materiallar: [] }]);
                }
              }}
            >
              {colorCode && (
                <span 
                  className="w-2.5 h-2.5 rounded-full border"
                  style={{ backgroundColor: colorCode }}
                />
              )}
              {color}
            </Button>
          );
        })}
      </div>

      {/* Color cards with nested materials - compact */}
      {nestedVariants.length > 0 && (
        <div className="space-y-2 max-h-[180px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-none">
          {nestedVariants.map((item) => {
            const colorCode = getColorCode(item.rang);
            return (
              <div 
                key={item.rang} 
                className="p-2.5 bg-muted/40 rounded-lg border-l-3 w-full min-w-0 overflow-hidden"
                style={{ borderLeftColor: colorCode || 'hsl(var(--primary))' }}
              >
                {/* Color header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {colorCode && (
                      <span 
                        className="w-3.5 h-3.5 rounded-full border shadow-sm"
                        style={{ backgroundColor: colorCode }}
                      />
                    )}
                    <span className="font-medium text-sm">{item.rang}</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                      {item.materiallar.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRang(item.rang)}
                    className="h-6 w-6 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Material input */}
                <div className="flex gap-1.5 mb-2 w-full min-w-0">
                  <Input
                    placeholder={t('prod_add_material_placeholder')}
                    value={newMaterialInputs[item.rang] || ""}
                    onChange={(e) => setNewMaterialInputs({ 
                      ...newMaterialInputs, 
                      [item.rang]: e.target.value 
                    })}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMaterial(item.rang)}
                    className="h-8 text-sm bg-background flex-1 w-0 min-w-0"
                  />
                  <Button 
                    onClick={() => handleAddMaterial(item.rang)} 
                    size="icon" 
                    variant="outline"
                    className="h-8 w-8 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Quick material suggestions from other colors */}
                {allMaterials.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {allMaterials
                      .filter(m => !item.materiallar.includes(m))
                      .slice(0, 4)
                      .map((material) => (
                        <Button
                          key={material}
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            onNestedVariantsChange(
                              nestedVariants.map(v => {
                                if (v.rang === item.rang && !v.materiallar.includes(material)) {
                                  return { ...v, materiallar: [...v.materiallar, material] };
                                }
                                return v;
                              })
                            );
                          }}
                        >
                          + {material}
                        </Button>
                      ))}
                  </div>
                )}

                {/* Materials list */}
                {item.materiallar.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 w-full min-w-0">
                    {item.materiallar.map((material) => (
                      <Badge 
                        key={material} 
                        variant="secondary" 
                        className="gap-1 text-xs bg-background h-6 max-w-full overflow-hidden"
                      >
                        <Layers className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{material}</span>
                        <button
                          onClick={() => handleRemoveMaterial(item.rang, material)}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-orange-500 dark:text-orange-400 italic">
                    ⚠️ {t('prod_add_material_warning')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary - compact */}
      {totalVariants > 0 && (
        <div className="flex items-center justify-between text-xs bg-primary/5 rounded-md px-3 py-2">
          <span className="text-muted-foreground">{t('prod_total_variants')}:</span>
          <Badge variant="secondary" className="font-semibold">
            {totalVariants}
          </Badge>
        </div>
      )}
    </div>
  );
}

// Generate variants from nested structure
export function generateVariantsFromNested(
  nestedVariants: NestedVariantItem[],
  productName: string
): Array<{
  sku: string;
  barcode: string;
  price: string;
  stock_quantity: string;
  weight: string;
  variant_attributes: Record<string, string>;
  is_active: boolean;
  cost_price: string;
  cost_price_currency: string;
}> {
  const variants: Array<{
    sku: string;
    barcode: string;
    price: string;
    stock_quantity: string;
    weight: string;
    variant_attributes: Record<string, string>;
    is_active: boolean;
    cost_price: string;
    cost_price_currency: string;
  }> = [];

  let index = 0;
  nestedVariants.forEach((item) => {
    const materials = item.materiallar.length > 0 ? item.materiallar : [''];
    
    materials.forEach((material) => {
      index++;
      const skuParts = [
        productName?.slice(0, 3).toUpperCase() || "PRD",
        item.rang.slice(0, 2).toUpperCase(),
        material ? material.slice(0, 2).toUpperCase() : "ST",
      ];
      const sku = skuParts.join("-") + "-" + index.toString().padStart(3, "0");

      const attrs: Record<string, string> = { rang: item.rang };
      if (material) {
        attrs.material = material;
      }

      variants.push({
        sku,
        barcode: "",
        price: "",
        stock_quantity: "0",
        weight: "",
        variant_attributes: attrs,
        is_active: true,
        cost_price: "",
        cost_price_currency: "CNY",
      });
    });
  });

  return variants;
}
