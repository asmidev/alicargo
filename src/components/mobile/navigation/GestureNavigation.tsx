import { ReactNode, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { usePlatform } from '@/hooks/usePlatform';
import { cn } from '@/lib/utils';

interface GestureNavigationProps {
  children: ReactNode;
  enableSwipeBack?: boolean;
  className?: string;
}

export function GestureNavigation({
  children,
  enableSwipeBack = true,
  className,
}: GestureNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { triggerHaptic } = useNativeFeatures();
  const { isMobileDevice, isIOS } = usePlatform();
  
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 100, 200], [1, 0.95, 0.9]);
  const scale = useTransform(x, [0, 200], [1, 0.95]);
  
  const isDragging = useRef(false);
  const startX = useRef(0);
  const hasHapticFired = useRef(false);
  
  const EDGE_THRESHOLD = 25; // Start drag only from edge
  const SWIPE_THRESHOLD = 100; // Distance to trigger navigation
  const VELOCITY_THRESHOLD = 500; // Velocity to trigger navigation

  useEffect(() => {
    if (!isMobileDevice || !enableSwipeBack) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      
      // Only start if touching from left edge
      if (touch.clientX <= EDGE_THRESHOLD) {
        isDragging.current = true;
        startX.current = touch.clientX;
        hasHapticFired.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      
      const touch = e.touches[0];
      const deltaX = Math.max(0, touch.clientX - startX.current);
      
      x.set(deltaX);
      
      // Haptic feedback when passing threshold
      if (!hasHapticFired.current && deltaX > SWIPE_THRESHOLD * 0.7) {
        triggerHaptic('light');
        hasHapticFired.current = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isDragging.current) return;
      
      const currentX = x.get();
      const velocity = getVelocity(e);
      
      // Navigate back if threshold or velocity met
      if (currentX > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        triggerHaptic('medium');
        
        // Animate out before navigating
        animate(x, window.innerWidth, {
          duration: 0.2,
          ease: 'easeOut',
          onComplete: () => {
            navigate(-1);
            x.set(0);
          },
        });
      } else {
        // Snap back
        animate(x, 0, {
          type: 'spring',
          stiffness: 400,
          damping: 30,
        });
      }
      
      isDragging.current = false;
    };

    // Calculate velocity from touch events
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;

    const trackVelocity = (e: TouchEvent) => {
      const touch = e.touches[0];
      const now = Date.now();
      
      if (lastTime) {
        const dt = now - lastTime;
        velocity = (touch.clientX - lastX) / dt * 1000;
      }
      
      lastX = touch.clientX;
      lastTime = now;
    };

    const getVelocity = (e: TouchEvent) => {
      return velocity;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', (e) => {
      handleTouchMove(e);
      trackVelocity(e);
    }, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove as any);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobileDevice, enableSwipeBack, navigate, triggerHaptic, x]);

  // Reset position on route change
  useEffect(() => {
    x.set(0);
  }, [location.pathname, x]);

  if (!isMobileDevice) {
    return <>{children}</>;
  }

  return (
    <motion.div
      style={{ x, opacity, scale }}
      className={cn("min-h-full", className)}
    >
      {children}
      
      {/* Edge indicator */}
      <motion.div
        style={{
          opacity: useTransform(x, [0, 30], [0, 1]),
          x: useTransform(x, [0, 100], [-20, 0]),
        }}
        className="fixed left-0 top-1/2 -translate-y-1/2 w-1.5 h-20 bg-primary/30 rounded-r-full pointer-events-none z-50"
      />
    </motion.div>
  );
}

// Hook to enable/disable gesture navigation
export function useGestureNavigation() {
  const enableRef = useRef(true);

  return {
    enable: () => { enableRef.current = true; },
    disable: () => { enableRef.current = false; },
    isEnabled: () => enableRef.current,
  };
}
