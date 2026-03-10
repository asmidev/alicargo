import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Palette, Ruler, Plus, X, Lightbulb, AlertTriangle } from "lucide-react";

interface AttributeDefinition {
  id: string;
  name: string;
  attribute_key: string;
  attribute_type: string;
  options: string[] | null;
}

interface VariantSelectorProps {
  availableAttributes: AttributeDefinition[];
  selectedAttributes: string[];
  attributeValues: Record<string, string[]>;
  onAttributeToggle: (attrKey: string) => void;
  onValuesChange: (attrKey: string, values: string[]) => void;
}

export function VariantSelector({
  availableAttributes,
  selectedAttributes,
  attributeValues,
  onAttributeToggle,
  onValuesChange,
}: VariantSelectorProps) {
  const [customValue, setCustomValue] = useState<Record<string, string>>({});

  const getAttributeIcon = (type: string) => {
    switch (type) {
      case "color":
        return <Palette className="h-4 w-4" />;
      case "size":
        return <Ruler className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const handleAddCustomValue = (attrKey: string) => {
    const value = customValue[attrKey]?.trim();
    if (!value) return;
    
    const currentValues = attributeValues[attrKey] || [];
    if (!currentValues.includes(value)) {
      onValuesChange(attrKey, [...currentValues, value]);
    }
    setCustomValue(prev => ({ ...prev, [attrKey]: "" }));
  };

  const handleRemoveValue = (attrKey: string, value: string) => {
    const currentValues = attributeValues[attrKey] || [];
    onValuesChange(attrKey, currentValues.filter(v => v !== value));
  };

  const handleToggleOption = (attrKey: string, option: string) => {
    const currentValues = attributeValues[attrKey] || [];
    if (currentValues.includes(option)) {
      onValuesChange(attrKey, currentValues.filter(v => v !== option));
    } else {
      onValuesChange(attrKey, [...currentValues, option]);
    }
  };

  if (availableAttributes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Palette className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-center">
            Bu kategoriya uchun variant atributlari topilmadi
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Marketplace → Atributlar bo'limida "Variant atributi" ni yoqing
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Guidance Alert */}
      <Alert className="bg-primary/5 border-primary/20">
        <Lightbulb className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <p className="font-medium text-foreground mb-1">Variantlar qanday yaratiladi?</p>
          <div className="text-muted-foreground space-y-1">
            <p>✅ <span className="font-medium text-foreground">To'g'ri:</span> Atribut "Rang" → Qiymatlar: Qora, Qizil, Oq</p>
            <p>✅ <span className="font-medium text-foreground">To'g'ri:</span> Atribut "O'lcham" → Qiymatlar: S, M, L, XL</p>
            <p className="text-xs mt-2">
              Natija: 3 rang × 4 o'lcham = <strong className="text-foreground">12 ta alohida variant</strong>
            </p>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Variant atributlarini tanlang</CardTitle>
          <CardDescription>
            Har bir atribut - kategoriya (Rang, O'lcham). Qiymatlar - bu kategoriya ichidagi variantlar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableAttributes.map((attr) => {
            const isSelected = selectedAttributes.includes(attr.attribute_key);
            const values = attributeValues[attr.attribute_key] || [];

            return (
              <div key={attr.id} className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={attr.id}
                    checked={isSelected}
                    onCheckedChange={() => onAttributeToggle(attr.attribute_key)}
                  />
                  <label
                    htmlFor={attr.id}
                    className="flex items-center gap-2 text-sm font-medium cursor-pointer"
                  >
                    {getAttributeIcon(attr.attribute_type)}
                    {attr.name}
                    {attr.attribute_type === "color" && (
                      <Badge variant="secondary" className="text-xs">Rang</Badge>
                    )}
                    {attr.attribute_type === "size" && (
                      <Badge variant="secondary" className="text-xs">O'lcham</Badge>
                    )}
                  </label>
                </div>

                {isSelected && (
                  <div className="ml-7 space-y-2">
                    {/* Show predefined options if available */}
                    {attr.options && attr.options.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {attr.options.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={values.includes(option) ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleToggleOption(attr.attribute_key, option)}
                            className="h-8"
                          >
                            {attr.attribute_type === "color" && (
                              <span
                                className="w-3 h-3 rounded-full mr-1.5 border"
                                style={{ 
                                  backgroundColor: getColorCode(option) 
                                }}
                              />
                            )}
                            {option}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Custom value input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder={`Yangi ${attr.name.toLowerCase()} qo'shing...`}
                        value={customValue[attr.attribute_key] || ""}
                        onChange={(e) => setCustomValue(prev => ({ 
                          ...prev, 
                          [attr.attribute_key]: e.target.value 
                        }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomValue(attr.attribute_key);
                          }
                        }}
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddCustomValue(attr.attribute_key)}
                        className="h-8"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Selected values (custom ones) */}
                    {values.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {values.filter(v => !attr.options?.includes(v)).map((value) => (
                          <Badge
                            key={value}
                            variant="secondary"
                            className="gap-1 pr-1"
                          >
                            {attr.attribute_type === "color" && (
                              <span
                                className="w-2.5 h-2.5 rounded-full border"
                                style={{ backgroundColor: getColorCode(value) }}
                              />
                            )}
                            {value}
                            <button
                              type="button"
                              onClick={() => handleRemoveValue(attr.attribute_key, value)}
                              className="ml-1 hover:bg-muted rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Show count and warning */}
                    {values.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Tanlangan: {values.length} ta qiymat
                        </p>
                        {values.length === 1 && (
                          <div className="flex items-center gap-1.5 text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            <p className="text-xs">
                              Faqat 1 ta qiymat. Ko'proq qiymat qo'shing yoki atribut nomini tekshiring.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedAttributes.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Yaratilajak variantlar</p>
                <p className="text-xs text-muted-foreground">
                  {selectedAttributes.map(key => {
                    const attr = availableAttributes.find(a => a.attribute_key === key);
                    const count = attributeValues[key]?.length || 0;
                    return `${attr?.name}: ${count}`;
                  }).join(" × ")}
                </p>
              </div>
              <Badge variant="outline" className="text-lg font-mono">
                {calculateTotalVariants(selectedAttributes, attributeValues)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getColorCode(colorName: string): string {
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
    "jigarrang": "#92400e",
    "red": "#ef4444",
    "blue": "#3b82f6",
    "green": "#22c55e",
    "yellow": "#eab308",
    "black": "#171717",
    "white": "#ffffff",
    "gray": "#6b7280",
    "pink": "#ec4899",
    "purple": "#8b5cf6",
    "brown": "#92400e",
    "orange": "#f97316",
    "silver": "#c0c0c0",
    "gold": "#ffd700",
  };
  
  const normalized = colorName.toLowerCase().trim();
  return colors[normalized] || "#9ca3af";
}

function calculateTotalVariants(
  selectedAttributes: string[],
  attributeValues: Record<string, string[]>
): number {
  if (selectedAttributes.length === 0) return 0;
  
  return selectedAttributes.reduce((product, key) => {
    const count = attributeValues[key]?.length || 0;
    return product * (count || 1);
  }, 1);
}
