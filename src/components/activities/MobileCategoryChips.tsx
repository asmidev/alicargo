import { motion } from 'framer-motion';
import { 
  Activity, 
  Package, 
  ArrowRightLeft, 
  ShoppingBag, 
  DollarSign,
  RefreshCw,
  ShieldCheck,
  ListChecks,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActivityCategory, ActivityStats } from '@/lib/unifiedActivities';

interface CategoryChip {
  id: ActivityCategory | 'all';
  label: string;
  icon: LucideIcon;
  count: number;
  color: string;
  activeColor: string;
}

interface MobileCategoryChipsProps {
  stats: ActivityStats;
  activeCategory: ActivityCategory | 'all';
  onCategoryChange: (category: ActivityCategory | 'all') => void;
}

export function MobileCategoryChips({ 
  stats, 
  activeCategory, 
  onCategoryChange,
}: MobileCategoryChipsProps) {
  const chips: CategoryChip[] = [
    { id: 'all', label: 'Barchasi', icon: Activity, count: stats.total, color: 'text-primary', activeColor: 'bg-primary text-primary-foreground' },
    { id: 'box', label: 'Quti', icon: Package, count: stats.box, color: 'text-blue-600', activeColor: 'bg-blue-500 text-white' },
    { id: 'product', label: 'Mahsulot', icon: ArrowRightLeft, count: stats.product, color: 'text-purple-600', activeColor: 'bg-purple-500 text-white' },
    { id: 'sale', label: 'Sotuv', icon: ShoppingBag, count: stats.sale, color: 'text-green-600', activeColor: 'bg-green-500 text-white' },
    { id: 'finance', label: 'Moliya', icon: DollarSign, count: stats.finance, color: 'text-amber-600', activeColor: 'bg-amber-500 text-white' },
    { id: 'system', label: 'Tizim', icon: RefreshCw, count: stats.system, color: 'text-slate-600', activeColor: 'bg-slate-500 text-white' },
    { id: 'verification', label: 'Tekshirish', icon: ShieldCheck, count: stats.verification, color: 'text-rose-600', activeColor: 'bg-rose-500 text-white' },
    { id: 'task', label: 'Vazifa', icon: ListChecks, count: stats.task, color: 'text-pink-600', activeColor: 'bg-pink-500 text-white' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
      {chips.map((chip) => {
        const Icon = chip.icon;
        const isActive = activeCategory === chip.id;
        
        return (
          <motion.button
            key={chip.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onCategoryChange(chip.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
              "border touch-manipulation",
              isActive 
                ? cn(chip.activeColor, "border-transparent") 
                : cn("bg-card border-border", chip.color)
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{chip.label}</span>
            <span className={cn(
              "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]",
              isActive ? "bg-white/20" : "bg-muted"
            )}>
              {chip.count > 999 ? '999+' : chip.count}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
