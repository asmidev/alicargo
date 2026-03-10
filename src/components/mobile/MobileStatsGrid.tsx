import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  bgColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onTap?: () => void;
}

interface MobileStatsGridProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export function MobileStatsGrid({ stats, columns = 2, className }: MobileStatsGridProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "grid gap-3",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-4",
        className
      )}
    >
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={index}
            variants={itemVariants}
            whileTap={stat.onTap ? { scale: 0.95 } : undefined}
            onClick={stat.onTap}
            className={cn(
              "relative bg-card rounded-xl p-4 border border-border overflow-hidden",
              stat.onTap && "cursor-pointer active:bg-muted/50"
            )}
          >
            {/* Background icon */}
            <div className="absolute -right-2 -bottom-2 opacity-5">
              <Icon className="h-16 w-16" />
            </div>
            
            {/* Content */}
            <div className="relative z-10">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center mb-2",
                stat.bgColor || "bg-primary/10"
              )}>
                <Icon className={cn("h-4 w-4", stat.color || "text-primary")} />
              </div>
              <p className="text-xs text-muted-foreground mb-0.5">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
              
              {stat.trend && (
                <div className={cn(
                  "flex items-center gap-1 text-xs mt-1",
                  stat.trend.isPositive ? "text-green-500" : "text-red-500"
                )}>
                  <span>{stat.trend.isPositive ? '↑' : '↓'}</span>
                  <span>{Math.abs(stat.trend.value)}%</span>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
