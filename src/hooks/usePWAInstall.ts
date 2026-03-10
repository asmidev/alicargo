import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Opera') || ua.includes('OPR/')) return 'Opera';
  return 'Unknown';
}

function detectIsDesktop(): boolean {
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return !isMobile;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [browserName, setBrowserName] = useState<string>('');

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isIOSStandalone);

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Detect desktop
    setIsDesktop(detectIsDesktop());

    // Detect browser
    setBrowserName(detectBrowser());

    // Listen for beforeinstallprompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      // Clear any session dismissal
      sessionStorage.removeItem('pwa-install-dismissed');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      
      setDeferredPrompt(null);
      return outcome === 'accepted';
    } catch (error) {
      console.error('Error prompting install:', error);
      return false;
    }
  }, [deferredPrompt]);

  // Check if prompt can be shown (session-based with cooldown)
  const canShowPrompt = useCallback((): boolean => {
    if (isInstalled) return false;
    
    try {
      const lastDismissed = sessionStorage.getItem('pwa-install-dismissed');
      if (lastDismissed) {
        const dismissedAt = parseInt(lastDismissed, 10);
        const cooldownMs = 30 * 60 * 1000; // 30 minutes
        if (Date.now() - dismissedAt < cooldownMs) {
          return false;
        }
      }
    } catch {
      // sessionStorage not available - allow showing prompt
    }
    
    return isInstallable || isIOS;
  }, [isInstalled, isInstallable, isIOS]);

  const dismissPrompt = useCallback(() => {
    try {
      sessionStorage.setItem('pwa-install-dismissed', Date.now().toString());
    } catch {
      // sessionStorage not available - silently fail
    }
  }, []);

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isDesktop,
    browserName,
    promptInstall,
    canShowPrompt,
    dismissPrompt,
  };
}
