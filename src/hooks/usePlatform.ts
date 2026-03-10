import { useState, useEffect } from 'react';

type Platform = 'web' | 'ios' | 'android';
type DisplayMode = 'browser' | 'standalone' | 'fullscreen';

interface PlatformInfo {
  platform: Platform;
  displayMode: DisplayMode;
  isNative: boolean;
  isPWA: boolean;
  isMobileDevice: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  hasNotch: boolean;
}

// Detect platform synchronously for SSR/initial render
function getInitialPlatformInfo(): PlatformInfo {
  // Default values for SSR
  if (typeof window === 'undefined') {
    return {
      platform: 'web',
      displayMode: 'browser',
      isNative: false,
      isPWA: false,
      isMobileDevice: false,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      hasNotch: false,
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  
  // Detect platform
  const isIOS = /ipad|iphone|ipod/.test(userAgent) && !(window as any).MSStream;
  const isAndroid = /android/.test(userAgent);
  const isMobileDevice = isIOS || isAndroid || /mobile/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
  
  // Detect display mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isPWA = isStandalone || isIOSStandalone;
  
  let displayMode: DisplayMode = 'browser';
  if (isFullscreen) displayMode = 'fullscreen';
  else if (isStandalone || isIOSStandalone) displayMode = 'standalone';
  
  // Detect platform type
  let platform: Platform = 'web';
  if (isIOS) platform = 'ios';
  else if (isAndroid) platform = 'android';
  
  // Detect notch (rough heuristic based on viewport)
  const hasNotch = isIOS && window.screen.height >= 812 && isPWA;
  
  // Check for Capacitor (native)
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  
  return {
    platform,
    displayMode,
    isNative,
    isPWA,
    isMobileDevice,
    isIOS,
    isAndroid,
    isSafari,
    hasNotch,
  };
}

export function usePlatform(): PlatformInfo {
  // Initialize with actual values synchronously
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(getInitialPlatformInfo);

  useEffect(() => {
    // Re-check in case values changed (e.g., display mode changes)
    setPlatformInfo(getInitialPlatformInfo());
    
    // Listen for display mode changes
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => {
      setPlatformInfo(getInitialPlatformInfo());
    };
    
    standaloneQuery.addEventListener('change', handleChange);
    return () => standaloneQuery.removeEventListener('change', handleChange);
  }, []);

  return platformInfo;
}
