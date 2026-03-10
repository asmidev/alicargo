import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ProductFilters {
  priceMin: string;
  priceMax: string;
  weightMin: string;
  weightMax: string;
  brand: string;
  dateFrom: string;
  dateTo: string;
  marketplaceReady: boolean | null;
  hasVariants: boolean | null;
}

interface ProductAdvancedFiltersProps {
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  brands: string[];
}

const initialFilters: ProductFilters = {
  priceMin: '',
  priceMax: '',
  weightMin: '',
  weightMax: '',
  brand: 'all',
  dateFrom: '',
  dateTo: '',
  marketplaceReady: null,
  hasVariants: null,
};

export function ProductAdvancedFilters({ filters, onFiltersChange, brands }: ProductAdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'brand') return value !== 'all';
    if (typeof value === 'boolean') return value !== null;
    return value !== '' && value !== null;
  }).length;

  const handleReset = () => {
    onFiltersChange(initialFilters);
  };

  const updateFilter = <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 min-h-[44px]">
            <Filter className="h-4 w-4" />
            Kengaytirilgan filtr
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeFiltersCount}
              </Badge>
            )}
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-muted-foreground">
            <X className="h-4 w-4" />
            Tozalash
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4 bg-card rounded-lg border border-border">
          {/* Price Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Narx oralig'i ($)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.priceMin}
                onChange={(e) => updateFilter('priceMin', e.target.value)}
                className="bg-background border-border"
              />
              <Input
                type="number"
                placeholder="Max"
                value={filters.priceMax}
                onChange={(e) => updateFilter('priceMax', e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          {/* Weight Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Vazn oralig'i (kg)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.weightMin}
                onChange={(e) => updateFilter('weightMin', e.target.value)}
                className="bg-background border-border"
              />
              <Input
                type="number"
                placeholder="Max"
                value={filters.weightMax}
                onChange={(e) => updateFilter('weightMax', e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          {/* Brand Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Brend</Label>
            <Select value={filters.brand} onValueChange={(v) => updateFilter('brand', v)}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Barcha brendlar" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">Barcha brendlar</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Sana oralig'i</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
                className="bg-background border-border text-sm"
              />
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
                className="bg-background border-border text-sm"
              />
            </div>
          </div>

          {/* Marketplace Ready Switch */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border border-border min-h-[76px]">
            <Label className="text-sm font-medium">Marketplace tayyor</Label>
            <div className="flex gap-2">
              <Button
                variant={filters.marketplaceReady === true ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateFilter('marketplaceReady', filters.marketplaceReady === true ? null : true)}
                className="h-9 px-3 text-sm min-w-[3rem]"
              >
                Ha
              </Button>
              <Button
                variant={filters.marketplaceReady === false ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateFilter('marketplaceReady', filters.marketplaceReady === false ? null : false)}
                className="h-9 px-3 text-sm min-w-[3rem]"
              >
                Yo'q
              </Button>
            </div>
          </div>

          {/* Has Variants Switch */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border border-border min-h-[76px]">
            <Label className="text-sm font-medium">Variantli</Label>
            <div className="flex gap-2">
              <Button
                variant={filters.hasVariants === true ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateFilter('hasVariants', filters.hasVariants === true ? null : true)}
                className="h-9 px-3 text-sm min-w-[3rem]"
              >
                Ha
              </Button>
              <Button
                variant={filters.hasVariants === false ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateFilter('hasVariants', filters.hasVariants === false ? null : false)}
                className="h-9 px-3 text-sm min-w-[3rem]"
              >
                Yo'q
              </Button>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { initialFilters };
