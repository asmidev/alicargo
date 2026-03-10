import { ReactNode, useCallback, useRef, useState } from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  className?: string;
  indicatorText?: string;
  refreshingText?: string;
}

const THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ 
  children, 
  onRefresh, 
  disabled, 
  className,
  indicatorText = "Yangilash uchun torting",
  refreshingText = "Yangilanmoqda..."
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const { triggerHaptic } = useNativeFeatures();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
    setHasTriggeredHaptic(false);
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current || disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      setPullDistance(0);
      return;
    }
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, (currentY - startYRef.current) * 0.5);
    
    if (distance > 0) {
      e.preventDefault();
      const clampedDistance = Math.min(distance, MAX_PULL);
      setPullDistance(clampedDistance);
      
      // Trigger haptic at threshold
      if (clampedDistance >= THRESHOLD && !hasTriggeredHaptic) {
        triggerHaptic('medium');
        setHasTriggeredHaptic(true);
      }
    }
  }, [disabled, isRefreshing, hasTriggeredHaptic, triggerHaptic]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    
    isPullingRef.current = false;
    
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      triggerHaptic('heavy');
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullDistance(0);
    setHasTriggeredHaptic(false);
  }, [pullDistance, isRefreshing, onRefresh, triggerHaptic]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;
  const isReady = progress >= 1;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto no-overscroll", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Enhanced pull indicator with spring animation */}
      <div 
        className={cn(
          "absolute left-0 right-0 flex flex-col items-center justify-center z-10",
          showIndicator ? "opacity-100" : "opacity-0",
          "transition-opacity duration-200"
        )}
        style={{ 
          top: 0,
          height: Math.max(0, pullDistance),
          paddingTop: 8
        }}
      >
        <div className={cn(
          "flex flex-col items-center gap-1",
          isReady && "animate-bounce-in"
        )}
        style={{
          transform: `scale(${0.8 + progress * 0.2})`,
          transition: isReady ? 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
        }}
        >
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
            isReady || isRefreshing 
              ? "bg-primary text-primary-foreground shadow-primary/30" 
              : "bg-card border border-border text-muted-foreground"
          )}>
            {isRefreshing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowDown 
                className="w-5 h-5 transition-transform duration-200"
                style={{ 
                  transform: isReady ? 'rotate(180deg)' : `rotate(${progress * 180}deg)` 
                }}
              />
            )}
          </div>
          <span className={cn(
            "text-xs font-medium transition-all duration-200",
            isReady || isRefreshing ? "text-primary" : "text-muted-foreground"
          )}>
            {isRefreshing ? refreshingText : isReady ? "Qo'yib yuboring" : indicatorText}
          </span>
        </div>
      </div>

      {/* Content with enhanced pull offset */}
      <div 
        style={{ 
          transform: isRefreshing ? 'translateY(60px)' : `translateY(${pullDistance}px)`,
          transition: isPullingRef.current ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {children}
      </div>
    </div>
  );
}
