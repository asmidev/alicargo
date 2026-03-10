import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineSectionInputProps {
  value: string | null;
  onSave: (value: string | null) => Promise<void>;
  className?: string;
  disabled?: boolean;
}

export function InlineSectionInput({ 
  value, 
  onSave, 
  className,
  disabled = false 
}: InlineSectionInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const handleSave = async () => {
    const trimmedValue = inputValue.trim();
    
    if (trimmedValue === (value || "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedValue || null);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving section:", error);
      setInputValue(value || "");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setInputValue(value || "");
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
          type="text"
          placeholder="Bo'lim..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
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
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer",
        value 
          ? "bg-blue-100 text-blue-800 font-medium hover:bg-blue-200" 
          : "bg-muted text-muted-foreground hover:bg-muted/80",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <MapPin className="h-3 w-3 opacity-60" />
      <span>{value || "-"}</span>
      <Pencil className="h-3 w-3 opacity-60" />
    </button>
  );
}
