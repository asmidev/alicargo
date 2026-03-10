import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Filter, X, Calendar as CalendarIcon, ChevronDown, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'date' | 'dateRange' | 'text' | 'number';
  options?: FilterOption[];
  placeholder?: string;
}

export interface FilterValues {
  [key: string]: string | Date | null | { from: Date | null; to: Date | null };
}

interface AdvancedFiltersPanelProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onReset: () => void;
  className?: string;
}

export function AdvancedFiltersPanel({
  filters,
  values,
  onChange,
  onReset,
  className
}: AdvancedFiltersPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const activeFiltersCount = Object.entries(values).filter(([key, value]) => {
    if (value === null || value === '' || value === 'all') return false;
    if (typeof value === 'object' && 'from' in value) {
      return value.from !== null || value.to !== null;
    }
    return true;
  }).length;

  const handleChange = (key: string, value: any) => {
    onChange({ ...values, [key]: value });
  };

  const handleDateRangeChange = (key: string, field: 'from' | 'to', date: Date | undefined) => {
    const current = (values[key] as { from: Date | null; to: Date | null }) || { from: null, to: null };
    onChange({
      ...values,
      [key]: { ...current, [field]: date || null }
    });
  };

  const renderFilter = (filter: FilterConfig) => {
    switch (filter.type) {
      case 'select':
        return (
          <div key={filter.key} className="space-y-2">
            <Label className="text-sm font-medium">{filter.label}</Label>
            <Select
              value={(values[filter.key] as string) || 'all'}
              onValueChange={(val) => handleChange(filter.key, val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={filter.placeholder || 'Tanlang'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                {filter.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'date':
        const dateValue = values[filter.key] as Date | null;
        return (
          <div key={filter.key} className="space-y-2">
            <Label className="text-sm font-medium">{filter.label}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateValue && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateValue ? format(dateValue, "dd.MM.yyyy") : filter.placeholder || "Sanani tanlang"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateValue || undefined}
                  onSelect={(date) => handleChange(filter.key, date || null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );

      case 'dateRange':
        const rangeValue = (values[filter.key] as { from: Date | null; to: Date | null }) || { from: null, to: null };
        return (
          <div key={filter.key} className="space-y-2">
            <Label className="text-sm font-medium">{filter.label}</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal text-xs",
                      !rangeValue.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {rangeValue.from ? format(rangeValue.from, "dd.MM") : "Dan"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeValue.from || undefined}
                    onSelect={(date) => handleDateRangeChange(filter.key, 'from', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal text-xs",
                      !rangeValue.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {rangeValue.to ? format(rangeValue.to, "dd.MM") : "Gacha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeValue.to || undefined}
                    onSelect={(date) => handleDateRangeChange(filter.key, 'to', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        );

      case 'text':
        return (
          <div key={filter.key} className="space-y-2">
            <Label className="text-sm font-medium">{filter.label}</Label>
            <Input
              placeholder={filter.placeholder}
              value={(values[filter.key] as string) || ''}
              onChange={(e) => handleChange(filter.key, e.target.value)}
            />
          </div>
        );

      case 'number':
        return (
          <div key={filter.key} className="space-y-2">
            <Label className="text-sm font-medium">{filter.label}</Label>
            <Input
              type="number"
              placeholder={filter.placeholder}
              value={(values[filter.key] as string) || ''}
              onChange={(e) => handleChange(filter.key, e.target.value)}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filterlar
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeFiltersCount}
              </Badge>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Tozalash
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-4">
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filters.map(renderFilter)}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Quick filter badges component
interface QuickFilterBadgeProps {
  label: string;
  value: string | boolean;
  onRemove: () => void;
}

export function QuickFilterBadge({ label, value, onRemove }: QuickFilterBadgeProps) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      <span className="text-muted-foreground">{label}:</span>
      <span>{String(value)}</span>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 rounded-full hover:bg-muted-foreground/20"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}
