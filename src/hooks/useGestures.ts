import { useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNativeFeatures } from './useNativeFeatures';
import { usePlatform } from './usePlatform';

interface UseGesturesOptions {
  onSwipeBack?: () => void;
  onSwipeDown?: () => void;
  enableSwipeBack?: boolean;
  enableSwipeDown?: boolean;
  swipeBackThreshold?: number;
  swipeDownThreshold?: number;
  edgeWidth?: number;
}

interface GestureState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  isEdgeSwipe: boolean;
  direction: 'horizontal' | 'vertical' | null;
}

export function useGestures({
  onSwipeBack,
  onSwipeDown,
  enableSwipeBack = true,
  enableSwipeDown = false,
  swipeBackThreshold = 100,
  swipeDownThreshold = 80,
  edgeWidth = 20,
}: UseGesturesOptions = {}) {
  const navigate = useNavigate();
  const { triggerHaptic } = useNativeFeatures();
  const { isMobileDevice } = usePlatform();
  
  const gestureState = useRef<GestureState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
    isEdgeSwipe: false,
    direction: null,
  });

  const hasTriggeredHaptic = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isMobileDevice) return;
    
    const touch = e.touches[0];
    const isFromEdge = touch.clientX <= edgeWidth;
    
    gestureState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isDragging: true,
      isEdgeSwipe: isFromEdge,
      direction: null,
    };
    hasTriggeredHaptic.current = false;
  }, [isMobileDevice, edgeWidth]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!gestureState.current.isDragging) return;
    
    const touch = e.touches[0];
    const state = gestureState.current;
    
    state.currentX = touch.clientX;
    state.currentY = touch.clientY;
    
    const deltaX = state.currentX - state.startX;
    const deltaY = state.currentY - state.startY;
    
    // Determine direction on first significant movement
    if (!state.direction) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      
      if (absX > 10 || absY > 10) {
        state.direction = absX > absY ? 'horizontal' : 'vertical';
      }
    }
    
    // Haptic feedback when reaching threshold
    if (!hasTriggeredHaptic.current) {
      if (enableSwipeBack && state.isEdgeSwipe && state.direction === 'horizontal' && deltaX > swipeBackThreshold * 0.7) {
        triggerHaptic('light');
        hasTriggeredHaptic.current = true;
      } else if (enableSwipeDown && state.direction === 'vertical' && deltaY > swipeDownThreshold * 0.7) {
        triggerHaptic('light');
        hasTriggeredHaptic.current = true;
      }
    }
  }, [enableSwipeBack, enableSwipeDown, swipeBackThreshold, swipeDownThreshold, triggerHaptic]);

  const handleTouchEnd = useCallback(() => {
    const state = gestureState.current;
    if (!state.isDragging) return;
    
    const deltaX = state.currentX - state.startX;
    const deltaY = state.currentY - state.startY;
    
    // Handle swipe back from edge
    if (enableSwipeBack && state.isEdgeSwipe && state.direction === 'horizontal') {
      if (deltaX > swipeBackThreshold) {
        triggerHaptic('medium');
        if (onSwipeBack) {
          onSwipeBack();
        } else {
          navigate(-1);
        }
      }
    }
    
    // Handle swipe down
    if (enableSwipeDown && state.direction === 'vertical') {
      if (deltaY > swipeDownThreshold) {
        triggerHaptic('light');
        onSwipeDown?.();
      }
    }
    
    // Reset state
    gestureState.current = {
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      isDragging: false,
      isEdgeSwipe: false,
      direction: null,
    };
  }, [enableSwipeBack, enableSwipeDown, swipeBackThreshold, swipeDownThreshold, navigate, onSwipeBack, onSwipeDown, triggerHaptic]);

  // Get current gesture progress (0-1)
  const getSwipeProgress = useCallback(() => {
    const state = gestureState.current;
    if (!state.isDragging) return 0;
    
    const deltaX = state.currentX - state.startX;
    const deltaY = state.currentY - state.startY;
    
    if (state.direction === 'horizontal' && state.isEdgeSwipe) {
      return Math.min(1, Math.max(0, deltaX / swipeBackThreshold));
    }
    
    if (state.direction === 'vertical') {
      return Math.min(1, Math.max(0, deltaY / swipeDownThreshold));
    }
    
    return 0;
  }, [swipeBackThreshold, swipeDownThreshold]);

  // Bind gesture handlers to an element
  const bindGestures = useCallback(() => ({
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }), [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    bindGestures,
    getSwipeProgress,
    gestureState: gestureState.current,
  };
}

// Hook for swipe-to-dismiss modals/sheets
export function useSwipeToDismiss(
  onDismiss: () => void,
  threshold: number = 100
) {
  const { triggerHaptic } = useNativeFeatures();
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  const handleDragStart = useCallback((y: number) => {
    startY.current = y;
    currentY.current = y;
    isDragging.current = true;
  }, []);

  const handleDrag = useCallback((y: number) => {
    if (!isDragging.current) return 0;
    currentY.current = y;
    const delta = currentY.current - startY.current;
    return Math.max(0, delta); // Only allow dragging down
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return;
    
    const delta = currentY.current - startY.current;
    if (delta > threshold) {
      triggerHaptic('light');
      onDismiss();
    }
    
    isDragging.current = false;
    startY.current = 0;
    currentY.current = 0;
  }, [threshold, onDismiss, triggerHaptic]);

  return {
    handleDragStart,
    handleDrag,
    handleDragEnd,
    getProgress: () => {
      if (!isDragging.current) return 0;
      return Math.min(1, (currentY.current - startY.current) / threshold);
    },
  };
}
