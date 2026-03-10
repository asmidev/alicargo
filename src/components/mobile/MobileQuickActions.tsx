import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface QuickAction {
  label: string;
  icon: LucideIcon;
  onTap: () => void;
  color?: string;
  bgColor?: string;
  badge?: string | number;
  disabled?: boolean;
}

interface MobileQuickActionsProps {
  actions: QuickAction[];
  className?: string;
  scrollable?: boolean;
}

export function MobileQuickActions({ actions, className, scrollable = true }: MobileQuickActionsProps) {
  const { triggerHaptic } = useNativeFeatures();

  const handleTap = async (action: QuickAction) => {
    if (action.disabled) return;
    await triggerHaptic('light');
    action.onTap();
  };

  const content = actions.map((action, index) => {
    const Icon = action.icon;
    return (
      <motion.button
        key={index}
        whileTap={!action.disabled ? { scale: 0.95 } : undefined}
        onClick={() => handleTap(action)}
        disabled={action.disabled}
        className={cn(
          "relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
          "bg-card border border-border min-w-[90px]",
          action.disabled ? "opacity-50" : "active:bg-muted/50",
          scrollable && "shrink-0 snap-start"
        )}
      >
        {/* Badge */}
        {action.badge !== undefined && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center px-1">
            {action.badge}
          </span>
        )}
        
        {/* Icon */}
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          action.bgColor || "bg-primary/10"
        )}>
          <Icon className={cn("h-5 w-5", action.color || "text-primary")} />
        </div>
        
        {/* Label */}
        <span className="text-xs font-medium text-center whitespace-nowrap">
          {action.label}
        </span>
      </motion.button>
    );
  });

  if (scrollable) {
    return (
      <div className={cn(
        "flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory",
        className
      )}>
        {content}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-4 gap-3", className)}>
      {content}
    </div>
  );
}
