import { useState, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Camera, X, Upload, Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InlineVariantImageEditProps {
  variantId: string;
  currentImageUrl: string | null;
  variantLabel: string;
  onSave: (newImageUrl: string | null) => Promise<void>;
  disabled?: boolean;
}

export function InlineVariantImageEdit({
  variantId,
  currentImageUrl,
  variantLabel,
  onSave,
  disabled = false
}: InlineVariantImageEditProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imgError, setImgError] = useState(false);
  const [popoverImgError, setPopoverImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Faqat rasm fayllari qabul qilinadi");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Rasm hajmi 5MB dan oshmasligi kerak");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `variant-${variantId}-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const newImageUrl = await uploadImage(selectedFile);
      await onSave(newImageUrl);
      toast.success("Variant rasmi yangilandi");
      setIsOpen(false);
      resetState();
    } catch (error) {
      console.error('Variant image upload error:', error);
      toast.error("Rasm yuklashda xatolik");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    setIsUploading(true);
    try {
      await onSave(null);
      toast.success("Variant rasmi olib tashlandi");
      setIsOpen(false);
      resetState();
    } catch (error) {
      console.error('Remove variant image error:', error);
      toast.error("Rasmni olib tashlashda xatolik");
    } finally {
      setIsUploading(false);
    }
  };

  const resetState = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetState();
    }
  };

  const displayImage = previewUrl || currentImageUrl;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "relative group w-10 h-10 rounded overflow-hidden border border-border",
            "hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          title={`${variantLabel} rasmi`}
        >
          {currentImageUrl && !imgError ? (
            <img
              src={currentImageUrl}
              alt={variantLabel}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="h-3 w-3 text-white" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-60 p-3" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">"{variantLabel}" rasmi</p>

          {/* Current/Preview Image */}
          <div className="w-full aspect-square rounded-lg overflow-hidden border border-border bg-muted">
            {displayImage && !popoverImgError ? (
              <img
                src={displayImage}
                alt={variantLabel}
                className="w-full h-full object-cover"
                onError={() => setPopoverImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full justify-start"
            >
              <Upload className="h-4 w-4 mr-2" />
              Rasm yuklash
            </Button>

            {selectedFile && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Saqlash
              </Button>
            )}

            {currentImageUrl && !selectedFile && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveImage}
                disabled={isUploading}
                className="w-full justify-start"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Rasmni o'chirish
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
