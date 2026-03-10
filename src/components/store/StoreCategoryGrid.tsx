import { Link } from 'react-router-dom';
import { useStoreCategoriesWithCounts } from '@/hooks/useStoreCategoriesWithCounts';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Smartphone, Home, Shirt, Sparkles, Package, ShoppingBag,
  Baby, Dumbbell, BookOpen, Utensils, Car, Briefcase
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  smartphone: Smartphone, home: Home, shirt: Shirt, sparkles: Sparkles,
  package: Package, 'shopping-bag': ShoppingBag, baby: Baby, dumbbell: Dumbbell,
  'book-open': BookOpen, utensils: Utensils, car: Car, briefcase: Briefcase,
};

export function StoreCategoryGrid() {
  const { i18n } = useTranslation();
  const { data: categories, isLoading } = useStoreCategoriesWithCounts();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!categories || categories.length === 0) return null;

  const getName = (cat: any) => {
    if (i18n.language === 'ru' && cat.name_ru) return cat.name_ru;
    return cat.name_uz;
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {categories.map(cat => {
        const Icon = iconMap[cat.icon || ''] || Package;
        return (
          <Link
            key={cat.id}
            to={`/catalog/${cat.slug}`}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 transition-all text-center group hover:-translate-y-0.5 hover-glow-gold"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground line-clamp-2">
              {getName(cat)}
            </span>
            <span className="text-[10px] text-muted-foreground">{cat.product_count}</span>
          </Link>
        );
      })}
    </div>
  );
}
