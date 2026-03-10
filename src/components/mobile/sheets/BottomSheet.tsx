import { ReactNode, useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SnapPoint = number | 'content'; // percentage (0-100) or 'content' for auto-height

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  snapPoints?: SnapPoint[];
  defaultSnapPoint?: number; // index of default snap point
  title?: string;
  description?: string;
  showHandle?: boolean;
  showCloseButton?: boolean;
  dismissible?: boolean;
  modal?: boolean;
  className?: string;
}

const VELOCITY_THRESHOLD = 500;
const DRAG_THRESHOLD = 50;

export function BottomSheet({
  open,
  onOpenChange,
  children,
  snapPoints = [50, 100],
  defaultSnapPoint = 0,
  title,
  description,
  showHandle = true,
  showCloseButton = true,
  dismissible = true,
  modal = true,
  className,
}: BottomSheetProps) {
  const { triggerHaptic } = useNativeFeatures();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(defaultSnapPoint);
  const [sheetHeight, setSheetHeight] = useState(0);
  
  const y = useMotionValue(0);
  const overlayOpacity = useTransform(y, [-500, 0], [0.5, 0]);

  // Calculate snap point heights
  const getSnapPointHeight = useCallback((snapPoint: SnapPoint): number => {
    if (snapPoint === 'content') {
      return sheetHeight;
    }
    return (window.innerHeight * snapPoint) / 100;
  }, [sheetHeight]);

  // Get sorted snap points (ascending order)
  const sortedSnapHeights = snapPoints
    .map((sp, i) => ({ height: getSnapPointHeight(sp), index: i }))
    .sort((a, b) => a.height - b.height);

  useEffect(() => {
    if (open && sheetRef.current) {
      setSheetHeight(sheetRef.current.scrollHeight);
    }
  }, [open, children]);

  useEffect(() => {
    if (open) {
      setCurrentSnapIndex(defaultSnapPoint);
      y.set(0);
    }
  }, [open, defaultSnapPoint, y]);

  const handleDragEnd = useCallback(async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;
    
    // Fast downward swipe - dismiss
    if (velocity > VELOCITY_THRESHOLD && dismissible) {
      await triggerHaptic('light');
      onOpenChange(false);
      return;
    }
    
    // Fast upward swipe - go to highest snap point
    if (velocity < -VELOCITY_THRESHOLD) {
      await triggerHaptic('light');
      setCurrentSnapIndex(snapPoints.length - 1);
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 });
      return;
    }

    // Calculate which snap point to go to based on current position
    const currentHeight = getSnapPointHeight(snapPoints[currentSnapIndex]);
    const newHeight = currentHeight - offset;
    
    // Find closest snap point
    let closestIndex = currentSnapIndex;
    let minDistance = Infinity;
    
    sortedSnapHeights.forEach(({ height, index }) => {
      const distance = Math.abs(height - newHeight);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    // If dragged down significantly below minimum snap, dismiss
    const minSnapHeight = sortedSnapHeights[0].height;
    if (newHeight < minSnapHeight - DRAG_THRESHOLD && dismissible) {
      await triggerHaptic('light');
      onOpenChange(false);
      return;
    }

    if (closestIndex !== currentSnapIndex) {
      await triggerHaptic('light');
    }
    
    setCurrentSnapIndex(closestIndex);
    animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 });
  }, [currentSnapIndex, dismissible, getSnapPointHeight, onOpenChange, snapPoints, sortedSnapHeights, triggerHaptic, y]);

  const handleClose = async () => {
    await triggerHaptic('light');
    onOpenChange(false);
  };

  const currentHeight = getSnapPointHeight(snapPoints[currentSnapIndex]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          {modal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dismissible ? handleClose : undefined}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              style={{ opacity: useTransform(y, [0, currentHeight], [1, 0]) }}
            />
          )}

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            style={{ 
              y,
              height: currentHeight,
              maxHeight: '95dvh',
            }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50",
              "bg-background rounded-t-[20px] shadow-2xl",
              "flex flex-col overflow-hidden",
              "safe-area-bottom",
              className
            )}
          >
            {/* Handle */}
            {showHandle && (
              <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-4 pb-2">
                <div className="flex-1">
                  {title && (
                    <h3 className="text-lg font-semibold">{title}</h3>
                  )}
                  {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
                {showCloseButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={handleClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto px-4 pb-4">
              {children}
            </div>

            {/* Snap point indicators */}
            {snapPoints.length > 1 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
                {snapPoints.map((_, index) => (
                  <motion.div
                    key={index}
                    className={cn(
                      "w-1 h-1 rounded-full transition-colors",
                      index === currentSnapIndex 
                        ? "bg-primary" 
                        : "bg-muted-foreground/30"
                    )}
                    animate={{ scale: index === currentSnapIndex ? 1.2 : 1 }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
