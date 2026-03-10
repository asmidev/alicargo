import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface InlineCategorySelectProps {
  currentCategoryId: string | null;
  currentCategoryName: string | null;
  categories: Category[];
  onSave: (categoryId: string | null) => Promise<void>;
  disabled?: boolean;
}

export function InlineCategorySelect({
  currentCategoryId,
  currentCategoryName,
  categories,
  onSave,
  disabled = false,
}: InlineCategorySelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string>(currentCategoryId || "none");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newCategoryId = selectedValue === "none" ? null : selectedValue;
      if (newCategoryId !== currentCategoryId) {
        await onSave(newCategoryId);
      }
      setIsEditing(false);
    } catch (error) {
      // Reset on error
      setSelectedValue(currentCategoryId || "none");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedValue(currentCategoryId || "none");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Select
          value={selectedValue}
          onValueChange={setSelectedValue}
          disabled={isSaving}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Kategoriya..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">Kategoriyasiz</span>
            </SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <button
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors text-sm",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={() => !disabled && setIsEditing(true)}
      disabled={disabled}
    >
      <span className={cn(!currentCategoryName && "text-muted-foreground")}>
        {currentCategoryName || "-"}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}
