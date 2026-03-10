import { useCallback, useRef } from 'react';

interface RippleStyle {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function useRipple<T extends HTMLElement = HTMLElement>() {
  const rippleRef = useRef<HTMLSpanElement | null>(null);

  const createRipple = useCallback((event: React.MouseEvent<T> | React.TouchEvent<T>) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    
    let clientX: number;
    let clientY: number;
    
    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const rippleSize = Math.max(rect.width, rect.height) * 2;
    
    const ripple = document.createElement('span');
    ripple.className = 'absolute rounded-full bg-white/20 pointer-events-none animate-ripple';
    ripple.style.width = `${rippleSize}px`;
    ripple.style.height = `${rippleSize}px`;
    ripple.style.left = `${x - rippleSize / 2}px`;
    ripple.style.top = `${y - rippleSize / 2}px`;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    rippleRef.current = ripple;
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }, []);

  const getRippleStyle = useCallback((event: React.MouseEvent<T> | React.TouchEvent<T>): RippleStyle => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    
    let clientX: number;
    let clientY: number;
    
    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    const size = Math.max(rect.width, rect.height) * 2;
    
    return {
      left: clientX - rect.left - size / 2,
      top: clientY - rect.top - size / 2,
      width: size,
      height: size,
    };
  }, []);

  return { createRipple, getRippleStyle };
}
