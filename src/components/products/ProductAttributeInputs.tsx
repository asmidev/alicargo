import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Layers } from "lucide-react";

interface AttributeDefinition {
  id: string;
  name: string;
  name_ru?: string | null;
  name_en?: string | null;
  attribute_key: string;
  attribute_type: string;
  is_required: boolean;
  options: string[] | null;
  unit: string | null;
}

interface ProductAttributeInputsProps {
  attributes: AttributeDefinition[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}

export function ProductAttributeInputs({
  attributes,
  values,
  onChange,
}: ProductAttributeInputsProps) {
  const handleChange = (key: string, value: any) => {
    onChange({ ...values, [key]: value });
  };

  const handleMultiSelectToggle = (key: string, option: string) => {
    const current = values[key] || [];
    const newValue = current.includes(option)
      ? current.filter((v: string) => v !== option)
      : [...current, option];
    handleChange(key, newValue);
  };

  if (attributes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Layers className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-center">
            Bu kategoriya uchun qo'shimcha xususiyatlar topilmadi
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group attributes by type for better organization
  const requiredAttributes = attributes.filter(attr => attr.is_required);
  const optionalAttributes = attributes.filter(attr => !attr.is_required);

  return (
    <div className="space-y-4">
      {requiredAttributes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Majburiy xususiyatlar</CardTitle>
            <CardDescription>Bu maydonlar to'ldirilishi shart</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {requiredAttributes.map((attr) => (
              <AttributeInput
                key={attr.id}
                attribute={attr}
                value={values[attr.attribute_key]}
                onChange={(value) => handleChange(attr.attribute_key, value)}
                onMultiSelectToggle={(option) => handleMultiSelectToggle(attr.attribute_key, option)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {optionalAttributes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Qo'shimcha xususiyatlar</CardTitle>
            <CardDescription>Ixtiyoriy maydonlar</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {optionalAttributes.map((attr) => (
              <AttributeInput
                key={attr.id}
                attribute={attr}
                value={values[attr.attribute_key]}
                onChange={(value) => handleChange(attr.attribute_key, value)}
                onMultiSelectToggle={(option) => handleMultiSelectToggle(attr.attribute_key, option)}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface AttributeInputProps {
  attribute: AttributeDefinition;
  value: any;
  onChange: (value: any) => void;
  onMultiSelectToggle: (option: string) => void;
}

function AttributeInput({ attribute, value, onChange, onMultiSelectToggle }: AttributeInputProps) {
  const { name, attribute_key, attribute_type, is_required, options, unit } = attribute;

  switch (attribute_type) {
    case "text":
      return (
        <div className="grid gap-2">
          <Label htmlFor={attribute_key}>
            {name}
            {is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={attribute_key}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`${name} kiriting...`}
          />
        </div>
      );

    case "number":
      return (
        <div className="grid gap-2">
          <Label htmlFor={attribute_key}>
            {name}
            {unit && <span className="text-muted-foreground ml-1">({unit})</span>}
            {is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={attribute_key}
            type="number"
            step="0.01"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0"
          />
        </div>
      );

    case "select":
      return (
        <div className="grid gap-2">
          <Label htmlFor={attribute_key}>
            {name}
            {is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={`${name} tanlang`} />
            </SelectTrigger>
            <SelectContent>
              {options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "multi_select":
      return (
        <div className="grid gap-2">
          <Label>
            {name}
            {is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <div className="flex flex-wrap gap-2">
            {options?.map((option) => {
              const isChecked = Array.isArray(value) && value.includes(option);
              return (
                <div
                  key={option}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                    isChecked ? "bg-primary/10 border-primary" : "hover:bg-muted"
                  }`}
                  onClick={() => onMultiSelectToggle(option)}
                >
                  <Checkbox checked={isChecked} />
                  <span className="text-sm">{option}</span>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between">
          <Label htmlFor={attribute_key}>
            {name}
            {is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Switch
            id={attribute_key}
            checked={value === true}
            onCheckedChange={onChange}
          />
        </div>
      );

    case "date":
      return (
        <div className="grid gap-2">
          <Label htmlFor={attribute_key}>
            {name}
            {is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={attribute_key}
            type="date"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case "color":
      return (
        <div className="grid gap-2">
          <Label htmlFor={attribute_key}>
            {name}
            {is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {options && options.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChange(option)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors ${
                    value === option ? "bg-primary/10 border-primary" : "hover:bg-muted"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: getColorCode(option) }}
                  />
                  <span className="text-sm">{option}</span>
                </button>
              ))}
            </div>
          ) : (
            <Input
              id={attribute_key}
              type="color"
              value={value || "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="h-10 w-20"
            />
          )}
        </div>
      );

    case "size":
      return (
        <div className="grid gap-2">
          <Label htmlFor={attribute_key}>
            {name}
            {is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {options && options.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChange(option)}
                  className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                    value === option 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "hover:bg-muted"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <Input
              id={attribute_key}
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="O'lcham kiriting"
            />
          )}
        </div>
      );

    default:
      return (
        <div className="grid gap-2">
          <Label htmlFor={attribute_key}>
            {name}
            {is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={attribute_key}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`${name} kiriting...`}
          />
        </div>
      );
  }
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
  return colors[colorName.toLowerCase().trim()] || "#9ca3af";
}
