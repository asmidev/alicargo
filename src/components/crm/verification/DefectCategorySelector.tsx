import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { 
  Hammer, 
  Slash, 
  Palette, 
  Ruler, 
  PackageOpen, 
  Box, 
  Droplet, 
  HelpCircle 
} from 'lucide-react';

interface DefectCategorySelectorProps {
  selectedCategory: string | null;
  onSelect: (category: string) => void;
  disabled?: boolean;
}

const iconMap: Record<string, any> = {
  hammer: Hammer,
  slash: Slash,
  palette: Palette,
  ruler: Ruler,
  'package-open': PackageOpen,
  box: Box,
  droplet: Droplet,
  'help-circle': HelpCircle,
};

export function DefectCategorySelector({ 
  selectedCategory, 
  onSelect, 
  disabled 
}: DefectCategorySelectorProps) {
  const { t } = useTranslation();
  const { data: categories, isLoading } = useQuery({
    queryKey: ['defect-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('defect_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{t('vr_defect_type')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {categories?.map((category) => {
          const Icon = iconMap[category.icon || 'help-circle'] || HelpCircle;
          const isSelected = selectedCategory === category.name;
          
          return (
            <Button
              key={category.id}
              variant={isSelected ? 'default' : 'outline'}
              className={`h-auto py-3 flex flex-col gap-1 transition-all duration-200 ${
                isSelected 
                  ? 'bg-red-500 hover:bg-red-600 border-red-500 shadow-lg shadow-red-500/20' 
                  : 'hover:border-red-500/50'
              }`}
              onClick={() => onSelect(category.name)}
              disabled={disabled}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{category.name_uz}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
