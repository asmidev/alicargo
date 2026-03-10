import { useEffect, useCallback, useState } from 'react';
import { usePlatform } from './usePlatform';

interface KeyboardInfo {
  isVisible: boolean;
  height: number;
}

/**
 * Hook that provides native-specific functionality when running in Capacitor.
 * Falls back gracefully to web APIs when not in native context.
 */
export function useNativeFeatures() {
  const { isNative, isIOS, isAndroid } = usePlatform();
  const [keyboardInfo, setKeyboardInfo] = useState<KeyboardInfo>({ isVisible: false, height: 0 });

  // Setup native behaviors
  useEffect(() => {
    if (!isNative) return;

    const setupNative = async () => {
      try {
        // Status bar styling
        if (isIOS || isAndroid) {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#1A1D29' });
        }
      } catch (e) {
        console.log('Native plugins not available');
      }
    };

    setupNative();
  }, [isNative, isIOS, isAndroid]);

  // Keyboard handling for native
  useEffect(() => {
    if (!isNative) {
      // Web fallback using visualViewport
      const handleResize = () => {
        if (window.visualViewport) {
          const heightDiff = window.innerHeight - window.visualViewport.height;
          setKeyboardInfo({
            isVisible: heightDiff > 100,
            height: heightDiff > 100 ? heightDiff : 0,
          });
        }
      };

      window.visualViewport?.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }

    // Native keyboard handling would be done via Capacitor Keyboard plugin
    const setupKeyboard = async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        
        Keyboard.addListener('keyboardWillShow', (info) => {
          setKeyboardInfo({ isVisible: true, height: info.keyboardHeight });
        });

        Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardInfo({ isVisible: false, height: 0 });
        });
      } catch {
        // Keyboard plugin not available
      }
    };

    setupKeyboard();
  }, [isNative]);

  // Haptic feedback helper
  const triggerHaptic = useCallback(async (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
    if (!isNative) {
      // Web vibration fallback
      if ('vibrate' in navigator) {
        const patterns = {
          light: [10],
          medium: [20],
          heavy: [30],
          success: [10, 50, 10],
          warning: [20, 50, 20],
          error: [30, 50, 30, 50, 30],
        };
        navigator.vibrate(patterns[type]);
      }
      return;
    }

    try {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      
      if (type === 'success' || type === 'warning' || type === 'error') {
        const notificationTypes = {
          success: NotificationType.Success,
          warning: NotificationType.Warning,
          error: NotificationType.Error,
        };
        await Haptics.notification({ type: notificationTypes[type] });
      } else {
        const impactStyles = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy,
        };
        await Haptics.impact({ style: impactStyles[type] });
      }
    } catch {
      // Haptics not available
    }
  }, [isNative]);

  // Share functionality
  const share = useCallback(async (data: { title: string; text?: string; url?: string; files?: File[] }) => {
    if (isNative) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: data.title,
          text: data.text,
          url: data.url,
          dialogTitle: data.title,
        });
        return true;
      } catch {
        // Fall through to web share
      }
    }

    // Web share fallback
    if (navigator.share) {
      try {
        const shareData: ShareData = {
          title: data.title,
          text: data.text,
          url: data.url,
        };
        if (data.files && navigator.canShare?.({ files: data.files })) {
          shareData.files = data.files;
        }
        await navigator.share(shareData);
        return true;
      } catch {
        return false;
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(data.url || data.text || data.title);
      return true;
    } catch {
      return false;
    }
  }, [isNative]);

  // Set status bar color dynamically
  const setStatusBarColor = useCallback(async (color: string, style: 'light' | 'dark' = 'dark') => {
    if (!isNative) return;

    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setBackgroundColor({ color });
      await StatusBar.setStyle({ style: style === 'dark' ? Style.Dark : Style.Light });
    } catch {
      // StatusBar not available
    }
  }, [isNative]);

  // Hide/show status bar
  const toggleStatusBar = useCallback(async (visible: boolean) => {
    if (!isNative) return;

    try {
      const { StatusBar } = await import('@capacitor/status-bar');
      if (visible) {
        await StatusBar.show();
      } else {
        await StatusBar.hide();
      }
    } catch {
      // StatusBar not available
    }
  }, [isNative]);

  // Copy to clipboard with haptic
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      await triggerHaptic('success');
      return true;
    } catch {
      return false;
    }
  }, [triggerHaptic]);

  // Open URL in browser
  const openInBrowser = useCallback(async (url: string) => {
    if (isNative) {
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url });
        return true;
      } catch {
        // Fall through to window.open
      }
    }
    
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }, [isNative]);

  return {
    isNative,
    isIOS,
    isAndroid,
    keyboardInfo,
    triggerHaptic,
    share,
    setStatusBarColor,
    toggleStatusBar,
    copyToClipboard,
    openInBrowser,
  };
}
