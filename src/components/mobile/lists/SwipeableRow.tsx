import { ReactNode, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { LucideIcon } from 'lucide-react';

export interface SwipeAction {
  icon: LucideIcon;
  label: string;
  color: string; // Tailwind bg class like 'bg-destructive'
  textColor?: string;
  onClick: () => void;
}

interface SwipeableRowProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  disabled?: boolean;
}

const ACTION_WIDTH = 72;
const VELOCITY_THRESHOLD = 500;
const FULL_SWIPE_THRESHOLD = 0.6; // 60% of screen width triggers full action

export function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  className,
  disabled = false,
}: SwipeableRowProps) {
  const { triggerHaptic } = useNativeFeatures();
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const hasTriggeredHaptic = useRef(false);
  
  const leftActionsWidth = leftActions.length * ACTION_WIDTH;
  const rightActionsWidth = rightActions.length * ACTION_WIDTH;

  // Transform for action visibility
  const leftOpacity = useTransform(x, [0, leftActionsWidth], [0, 1]);
  const rightOpacity = useTransform(x, [-rightActionsWidth, 0], [1, 0]);
  
  // Scale effect for the first action when approaching full swipe
  const leftActionScale = useTransform(x, [leftActionsWidth, window.innerWidth * FULL_SWIPE_THRESHOLD], [1, 1.2]);
  const rightActionScale = useTransform(x, [-window.innerWidth * FULL_SWIPE_THRESHOLD, -rightActionsWidth], [1.2, 1]);

  const handleDragStart = () => {
    if (disabled) return;
    setIsDragging(true);
    hasTriggeredHaptic.current = false;
  };

  const handleDrag = async (_: any, info: PanInfo) => {
    if (disabled) return;
    
    const currentX = x.get();
    
    // Haptic feedback when revealing actions
    if (!hasTriggeredHaptic.current) {
      if ((currentX > ACTION_WIDTH && leftActions.length > 0) || 
          (currentX < -ACTION_WIDTH && rightActions.length > 0)) {
        await triggerHaptic('light');
        hasTriggeredHaptic.current = true;
      }
    }
  };

  const handleDragEnd = async (_: any, info: PanInfo) => {
    if (disabled) return;
    
    setIsDragging(false);
    const currentX = x.get();
    const velocity = info.velocity.x;
    
    // Full swipe to execute first action
    if (currentX > window.innerWidth * FULL_SWIPE_THRESHOLD && leftActions.length > 0) {
      await triggerHaptic('medium');
      leftActions[0].onClick();
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      return;
    }
    
    if (currentX < -window.innerWidth * FULL_SWIPE_THRESHOLD && rightActions.length > 0) {
      await triggerHaptic('medium');
      rightActions[0].onClick();
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      return;
    }

    // Fast swipe
    if (velocity > VELOCITY_THRESHOLD && leftActions.length > 0) {
      animate(x, leftActionsWidth, { type: 'spring', stiffness: 400, damping: 30 });
      return;
    }
    
    if (velocity < -VELOCITY_THRESHOLD && rightActions.length > 0) {
      animate(x, -rightActionsWidth, { type: 'spring', stiffness: 400, damping: 30 });
      return;
    }

    // Snap to position based on current offset
    if (currentX > leftActionsWidth / 2 && leftActions.length > 0) {
      animate(x, leftActionsWidth, { type: 'spring', stiffness: 400, damping: 30 });
    } else if (currentX < -rightActionsWidth / 2 && rightActions.length > 0) {
      animate(x, -rightActionsWidth, { type: 'spring', stiffness: 400, damping: 30 });
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  };

  const handleActionClick = async (action: SwipeAction) => {
    await triggerHaptic('light');
    action.onClick();
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Left actions (revealed on right swipe) */}
      {leftActions.length > 0 && (
        <motion.div 
          className="absolute left-0 top-0 bottom-0 flex"
          style={{ opacity: leftOpacity }}
        >
          {leftActions.map((action, index) => {
            const Icon = action.icon;
            const isFirst = index === 0;
            return (
              <motion.button
                key={index}
                onClick={() => handleActionClick(action)}
                style={{ scale: isFirst ? leftActionScale : 1, width: ACTION_WIDTH }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1",
                  action.color,
                  action.textColor || "text-white"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{action.label}</span>
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* Right actions (revealed on left swipe) */}
      {rightActions.length > 0 && (
        <motion.div 
          className="absolute right-0 top-0 bottom-0 flex"
          style={{ opacity: rightOpacity }}
        >
          {rightActions.map((action, index) => {
            const Icon = action.icon;
            const isFirst = index === 0;
            return (
              <motion.button
                key={index}
                onClick={() => handleActionClick(action)}
                style={{ scale: isFirst ? rightActionScale : 1, width: ACTION_WIDTH }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1",
                  action.color,
                  action.textColor || "text-white"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{action.label}</span>
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* Main content */}
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ 
          left: rightActions.length > 0 ? -rightActionsWidth * 1.5 : 0, 
          right: leftActions.length > 0 ? leftActionsWidth * 1.5 : 0 
        }}
        dragElastic={0.2}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn(
          "relative bg-background",
          isDragging && "cursor-grabbing"
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}
