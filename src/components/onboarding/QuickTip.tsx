import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lightbulb, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickTipProps {
  tipId: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'success' | 'warning' | 'info';
  onDismiss: (tipId: string) => void;
  className?: string;
}

export function QuickTip({
  tipId,
  title,
  description,
  action,
  variant = 'default',
  onDismiss,
  className,
}: QuickTipProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(tipId), 300);
  };

  const variantStyles = {
    default: 'bg-muted/50 border-border',
    success: 'bg-green-500/10 border-green-500/30',
    warning: 'bg-yellow-500/10 border-yellow-500/30',
    info: 'bg-blue-500/10 border-blue-500/30',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          className={cn(
            "relative border rounded-xl p-4 overflow-hidden",
            variantStyles[variant],
            className
          )}
        >
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-background/50 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          <div className="flex gap-3 pr-6">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              variant === 'default' ? 'bg-primary/10' : 'bg-background/50'
            )}>
              <Lightbulb className={cn("w-4 h-4", iconStyles[variant])} />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm mb-1">{title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                {description}
              </p>

              {action && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={action.onClick}
                  className="h-7 px-2 -ml-2 text-xs gap-1"
                >
                  {action.label}
                  <ChevronRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Container for multiple tips
interface QuickTipsContainerProps {
  tips: Array<{
    id: string;
    title: string;
    description: string;
    variant?: 'default' | 'success' | 'warning' | 'info';
    action?: {
      label: string;
      onClick: () => void;
    };
  }>;
  onDismiss: (tipId: string) => void;
  className?: string;
}

export function QuickTipsContainer({ tips, onDismiss, className }: QuickTipsContainerProps) {
  const [dismissedTips, setDismissedTips] = useState<string[]>([]);

  const handleDismiss = (tipId: string) => {
    setDismissedTips(prev => [...prev, tipId]);
    onDismiss(tipId);
  };

  const visibleTips = tips.filter(tip => !dismissedTips.includes(tip.id));

  if (visibleTips.length === 0) return null;

  return (
    <div className={className}>
      {visibleTips.map(tip => (
        <QuickTip
          key={tip.id}
          tipId={tip.id}
          title={tip.title}
          description={tip.description}
          variant={tip.variant}
          action={tip.action}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
