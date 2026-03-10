import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineNameInputProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  className?: string;
  disabled?: boolean;
}

export function InlineNameInput({ 
  value, 
  onSave, 
  className,
  disabled = false 
}: InlineNameInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isButtonClickedRef = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSave = async () => {
    const trimmedValue = inputValue.trim();
    
    if (!trimmedValue) {
      setInputValue(value);
      setIsEditing(false);
      return;
    }
    
    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving name:", error);
      setInputValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setInputValue(value);
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
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setTimeout(() => {
              if (isButtonClickedRef.current) {
                isButtonClickedRef.current = false;
                return;
              }
              if (!isSaving) handleCancel();
            }, 150);
          }}
          className="w-48 h-8"
          disabled={isSaving}
          maxLength={200}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
          onMouseDown={() => { isButtonClickedRef.current = true; }}
          onClick={handleSave}
          disabled={isSaving}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
          onMouseDown={() => { isButtonClickedRef.current = true; }}
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
        "inline-flex items-center gap-1.5 text-left font-medium max-w-[200px]",
        "hover:text-primary transition-colors cursor-pointer group",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <span className="truncate">{value}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
    </button>
  );
}
