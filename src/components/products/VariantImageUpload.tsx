import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageIcon, X, Camera } from "lucide-react";
import { NestedVariantItem } from "./NestedVariantBuilder";
import { cn } from "@/lib/utils";

interface VariantImageUploadProps {
  nestedVariants: NestedVariantItem[];
  variantImages: Record<string, string>;
  onVariantImagesChange: (images: Record<string, string>) => void;
}

// Color name to approximate hex for the dot
function getColorDot(colorName: string): string {
  const colorMap: Record<string, string> = {
    qora: "#1a1a1a", black: "#1a1a1a", "черный": "#1a1a1a", cherniy: "#1a1a1a", chernyy: "#1a1a1a",
    oq: "#f5f5f5", white: "#f8f8f8", "белый": "#f8f8f8", beliy: "#f8f8f8", belyy: "#f8f8f8",
    qizil: "#ef4444", red: "#ef4444", "красный": "#ef4444", krasnyy: "#ef4444", krasniy: "#ef4444",
    kok: "#3b82f6", blue: "#3b82f6", "синий": "#3b82f6", siniy: "#3b82f6",
    yashil: "#22c55e", green: "#22c55e", "зеленый": "#22c55e", zelonyy: "#22c55e",
    sariq: "#eab308", yellow: "#eab308", "желтый": "#eab308", jeltyy: "#eab308",
    pushti: "#ec4899", pink: "#ec4899", "розовый": "#ec4899", rozoviy: "#ec4899",
    binafsha: "#8b5cf6", purple: "#8b5cf6", "фиолетовый": "#8b5cf6", fioletoviy: "#8b5cf6",
    jigarrang: "#92400e", brown: "#92400e", "коричневый": "#92400e", korichneviy: "#92400e",
    kulrang: "#6b7280", gray: "#6b7280", grey: "#6b7280", "серый": "#6b7280", seryy: "#6b7280", seriy: "#6b7280",
    oltin: "#f59e0b", gold: "#f59e0b", "золотой": "#f59e0b", zolotoy: "#f59e0b",
    kumush: "#94a3b8", silver: "#94a3b8", "серебряный": "#94a3b8", serebryanyy: "#94a3b8",
    moviy: "#06b6d4", cyan: "#06b6d4", "голубой": "#06b6d4", goluboy: "#06b6d4",
    orange: "#f97316", "оранжевый": "#f97316", oranjeviy: "#f97316",
    bronza: "#b45309", bronzoviy: "#b45309",
  };
  return colorMap[colorName.toLowerCase().trim()] || "#9ca3af";
}

export function VariantImageUpload({ nestedVariants, variantImages, onVariantImagesChange }: VariantImageUploadProps) {
  const [editingRang, setEditingRang] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");

  const allColors = nestedVariants.map(v => v.rang).filter(Boolean);

  const handleSetUrl = (rang: string) => {
    if (!urlInput.trim()) return;
    onVariantImagesChange({ ...variantImages, [rang]: urlInput.trim() });
    setEditingRang(null);
    setUrlInput("");
  };

  const handleRemove = (rang: string) => {
    const next = { ...variantImages };
    delete next[rang];
    onVariantImagesChange(next);
  };

  const startEdit = (rang: string) => {
    setEditingRang(rang);
    setUrlInput(variantImages[rang] || "");
  };

  if (allColors.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Rang rasmlari
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Har bir rang uchun alohida rasm URL kiriting
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {allColors.map((rang) => {
          const imageUrl = variantImages[rang];
          const dotColor = getColorDot(rang);
          const isEditing = editingRang === rang;

          return (
            <div key={rang} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              {/* Color dot */}
              <div
                className="w-5 h-5 rounded-full border border-border shrink-0 mt-0.5"
                style={{ backgroundColor: dotColor }}
                title={rang}
              />

              {/* Image preview or placeholder */}
              <div className="shrink-0">
                {imageUrl ? (
                  <div className="relative w-12 h-12 group">
                    <img
                      src={imageUrl}
                      alt={rang}
                      className="w-12 h-12 rounded-md object-cover border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/50">
                    <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                )}
              </div>

              {/* Color name + URL editing */}
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-medium capitalize">{rang}</Label>

                {isEditing ? (
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="h-8 text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSetUrl(rang);
                        if (e.key === "Escape") { setEditingRang(null); setUrlInput(""); }
                      }}
                    />
                    <Button size="sm" className="h-8 shrink-0" onClick={() => handleSetUrl(rang)}>
                      Saqlash
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => { setEditingRang(null); setUrlInput(""); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    {imageUrl ? (
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">{imageUrl}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">Rasm qo'shilmagan</span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 shrink-0"
                      onClick={() => startEdit(rang)}
                    >
                      {imageUrl ? "O'zgartirish" : "URL qo'shish"}
                    </Button>
                    {imageUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn("h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive")}
                        onClick={() => handleRemove(rang)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
