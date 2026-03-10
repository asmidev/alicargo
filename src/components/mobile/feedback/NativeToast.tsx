import { ReactNode, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, animate, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { usePlatform } from '@/hooks/usePlatform';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default';

export interface NativeToastProps {
  id: string;
  type?: ToastType;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  dismissible?: boolean;
  onDismiss: (id: string) => void;
}

const typeConfig: Record<ToastType, { icon: LucideIcon; className: string }> = {
  success: { icon: CheckCircle, className: 'text-green-500' },
  error: { icon: AlertCircle, className: 'text-destructive' },
  warning: { icon: AlertTriangle, className: 'text-amber-500' },
  info: { icon: Info, className: 'text-blue-500' },
  default: { icon: Info, className: 'text-muted-foreground' },
};

export function NativeToast({
  id,
  type = 'default',
  title,
  description,
  icon: CustomIcon,
  action,
  duration = 4000,
  dismissible = true,
  onDismiss,
}: NativeToastProps) {
  const { triggerHaptic } = useNativeFeatures();
  const { isIOS } = usePlatform();
  const x = useMotionValue(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const config = typeConfig[type];
  const Icon = CustomIcon || config.icon;

  // Auto dismiss
  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss(id);
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, id, onDismiss]);

  // Haptic on mount
  useEffect(() => {
    if (type === 'error') {
      triggerHaptic('error');
    } else if (type === 'warning') {
      triggerHaptic('warning');
    } else if (type === 'success') {
      triggerHaptic('success');
    } else {
      triggerHaptic('light');
    }
  }, [type, triggerHaptic]);

  const handleDragEnd = useCallback(async (_: any, info: PanInfo) => {
    if (!dismissible) return;
    
    const threshold = 100;
    const velocity = Math.abs(info.velocity.x);
    const offset = Math.abs(info.offset.x);

    if (offset > threshold || velocity > 500) {
      await triggerHaptic('light');
      onDismiss(id);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  }, [dismissible, id, onDismiss, triggerHaptic, x]);

  const handleAction = async () => {
    if (action) {
      await triggerHaptic('light');
      action.onClick();
      onDismiss(id);
    }
  };

  return (
    <motion.div
      initial={isIOS ? { y: -100, opacity: 0 } : { y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={isIOS ? { y: -100, opacity: 0 } : { y: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      drag={dismissible ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      style={{ x }}
      className={cn(
        "pointer-events-auto w-full max-w-sm",
        "bg-card/95 backdrop-blur-xl border border-border/50",
        "rounded-2xl shadow-2xl overflow-hidden",
        "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className={cn("shrink-0 mt-0.5", config.className)}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
          
          {/* Action button */}
          {action && (
            <Button
              variant="link"
              size="sm"
              onClick={handleAction}
              className="h-auto p-0 mt-1 text-primary font-medium"
            >
              {action.label}
            </Button>
          )}
        </div>

        {/* Close button */}
        {dismissible && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-6 w-6 rounded-full"
            onClick={() => onDismiss(id)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className="h-0.5 bg-primary origin-left"
        />
      )}
    </motion.div>
  );
}

// Toast Container Hook
interface ToastItem extends Omit<NativeToastProps, 'onDismiss'> {}

export function useNativeToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return { toasts, addToast, removeToast, clearAll };
}

// Need to import useState
import { useState } from 'react';

// Toast Container Component
interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  position?: 'top' | 'bottom';
}

export function ToastContainer({ 
  toasts, 
  onDismiss, 
  position = 'top' 
}: ToastContainerProps) {
  const { isIOS } = usePlatform();
  const actualPosition = position === 'top' ? 'top' : 'bottom';

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-[100] flex flex-col gap-2 p-4 pointer-events-none",
        actualPosition === 'top' 
          ? "top-0 pt-safe-top" 
          : "bottom-0 pb-safe-bottom"
      )}
      style={{
        paddingTop: actualPosition === 'top' ? 'max(env(safe-area-inset-top), 16px)' : undefined,
        paddingBottom: actualPosition === 'bottom' ? 'max(env(safe-area-inset-bottom), 16px)' : undefined,
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <NativeToast
            key={toast.id}
            {...toast}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
