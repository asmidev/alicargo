import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageIcon, X, Camera, Upload, Loader2 } from "lucide-react";
import { NestedVariantItem } from "./NestedVariantBuilder";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [uploadingColor, setUploadingColor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedColorRef = useRef<string | null>(null);

  const allColors = Array.from(new Set(nestedVariants.map(v => v.rang).filter(Boolean)));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const color = selectedColorRef.current;
    if (!file || !color) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Faqat rasm fayllari qabul qilinadi");
      return;
    }

    setUploadingColor(color);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${color}-${Math.random()}.${fileExt}`;
      const filePath = `variants/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      onVariantImagesChange({ ...variantImages, [color]: publicUrl });
      toast.success(`${color} uchun rasm yuklandi`);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(`Rasm yuklashda xatolik: ${error.message}`);
    } finally {
      setUploadingColor(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (rang: string) => {
    const next = { ...variantImages };
    delete next[rang];
    onVariantImagesChange(next);
  };

  const triggerUpload = (rang: string) => {
    selectedColorRef.current = rang;
    fileInputRef.current?.click();
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
          Har bir rang uchun alohida rasm yuklang
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleUpload}
        />

        {allColors.map((rang) => {
          const imageUrl = variantImages[rang];
          const dotColor = getColorDot(rang);
          const isUploading = uploadingColor === rang;

          return (
            <div key={rang} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              {/* Color dot */}
              <div
                className="w-5 h-5 rounded-full border border-border shrink-0"
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

              {/* Color name + Upload controls */}
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-medium capitalize">{rang}</Label>
                
                <div className="flex items-center gap-2 mt-1">
                  {imageUrl ? (
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                      Rasm yuklangan
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/60 italic">Rasm yo'q</span>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2 shrink-0 gap-1.5"
                    disabled={isUploading}
                    onClick={() => triggerUpload(rang)}
                  >
                    {isUploading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    {imageUrl ? "O'zgartirish" : "Rasm yuklash"}
                  </Button>

                  {imageUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn("h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive")}
                      onClick={() => handleRemove(rang)}
                      disabled={isUploading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
