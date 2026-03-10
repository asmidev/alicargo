import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { LucideIcon } from 'lucide-react';

export interface ActionSheetAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'primary';
  disabled?: boolean;
}

interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}

export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
  cancelLabel = 'Bekor qilish',
}: ActionSheetProps) {
  const { triggerHaptic } = useNativeFeatures();

  const handleAction = async (action: ActionSheetAction) => {
    if (action.disabled) return;
    
    await triggerHaptic(action.variant === 'destructive' ? 'warning' : 'light');
    action.onClick();
    onOpenChange(false);
  };

  const handleCancel = async () => {
    await triggerHaptic('light');
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Action Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-safe-bottom"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
          >
            {/* Main actions container */}
            <div className="bg-card/95 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl mb-2">
              {/* Header */}
              {(title || description) && (
                <div className="px-4 py-3 border-b border-border/50 text-center">
                  {title && (
                    <p className="text-sm font-medium text-foreground">{title}</p>
                  )}
                  {description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="divide-y divide-border/50">
                {actions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleAction(action)}
                      disabled={action.disabled}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-3.5",
                        "text-base font-medium transition-colors",
                        "active:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed",
                        action.variant === 'destructive' && "text-destructive",
                        action.variant === 'primary' && "text-primary",
                        !action.variant && "text-foreground"
                      )}
                    >
                      {Icon && <Icon className="h-5 w-5" />}
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cancel button */}
            <button
              onClick={handleCancel}
              className={cn(
                "w-full px-4 py-3.5 rounded-2xl",
                "bg-card/95 backdrop-blur-xl shadow-xl",
                "text-base font-semibold text-primary",
                "active:bg-muted/50 transition-colors"
              )}
            >
              {cancelLabel}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
