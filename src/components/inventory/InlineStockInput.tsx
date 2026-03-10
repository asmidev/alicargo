import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineStockInputProps {
  value: number;
  onSave: (value: number) => Promise<void>;
  className?: string;
  disabled?: boolean;
}

export function InlineStockInput({ 
  value, 
  onSave, 
  className,
  disabled = false 
}: InlineStockInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleSave = async () => {
    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue) || numValue < 0) {
      setInputValue(value.toString());
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
      console.error("Error saving stock:", error);
      setInputValue(value.toString());
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setInputValue(value.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input
          ref={inputRef}
          type="number"
          min="0"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Small delay to allow button clicks
            setTimeout(() => {
              if (!isSaving) handleCancel();
            }, 150);
          }}
          className="w-20 h-8 text-center"
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
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md",
        "bg-green-100 text-green-800 font-medium",
        "hover:bg-green-200 transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <span>{value}</span>
      <Pencil className="h-3 w-3 opacity-60" />
    </button>
  );
}
