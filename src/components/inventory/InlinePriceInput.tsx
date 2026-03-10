import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlinePriceInputProps {
  value: number | null;
  onSave: (value: number) => Promise<void>;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Display a different value than what is saved (e.g. cost + shipping) */
  displayValue?: number | null;
  /** Currency symbol to show before the number (e.g. '¥', '$') */
  currencySymbol?: string;
  /** Show currency label after the number (e.g. "so'm") */
  currencyAfter?: string;
}

export function InlinePriceInput({ 
  value, 
  onSave, 
  className,
  disabled = false,
  placeholder = "Narx kiriting",
  displayValue,
  currencySymbol,
  currencyAfter,
}: InlinePriceInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setInputValue(value?.toString() || "");
  }, [value]);

  const handleSave = async () => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue) || numValue < 0) {
      setInputValue(value?.toString() || "");
      setIsEditing(false);
      return;
    }

    if (numValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(numValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving price:", error);
      setInputValue(value?.toString() || "");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setInputValue(value?.toString() || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const formatDisplay = (): string => {
    const shownValue = (displayValue !== undefined && displayValue !== null) ? displayValue : value;
    if (shownValue === null || shownValue === undefined) return "-";
    if (currencySymbol) {
      return `${currencySymbol}${shownValue.toFixed(2)}`;
    }
    if (currencyAfter) {
      return `${new Intl.NumberFormat('uz-UZ').format(Math.round(shownValue))} ${currencyAfter}`;
    }
    return new Intl.NumberFormat('uz-UZ').format(Math.round(shownValue)) + " so'm";
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1 justify-end", className)}>
        <Input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setTimeout(() => {
              if (!isSaving) handleCancel();
            }, 150);
          }}
          placeholder={placeholder}
          className="w-24 h-8 text-right"
          disabled={isSaving}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => !disabled && setIsEditing(true)}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm",
        value ? "text-foreground" : "text-muted-foreground",
        "hover:bg-muted/50 transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <span>{formatDisplay()}</span>
      <Pencil className="h-3 w-3 opacity-60" />
    </button>
  );
}
