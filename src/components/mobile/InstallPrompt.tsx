import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useTranslation } from 'react-i18next';

export function InstallPrompt() {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, isIOS, promptInstall, canShowPrompt, dismissPrompt } = usePWAInstall();
  const [showBanner, setShowBanner] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Delay initialization to prevent blocking initial render
  useEffect(() => {
    const readyTimer = setTimeout(() => {
      setIsReady(true);
    }, 3000); // Wait 3 seconds before even checking

    return () => clearTimeout(readyTimer);
  }, []);

  useEffect(() => {
    // Don't check until ready
    if (!isReady) return;

    // Check if we should show the prompt
    if (canShowPrompt()) {
      // Additional delay after ready check
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isReady, canShowPrompt]);

  const handleDismiss = () => {
    setShowBanner(false);
    dismissPrompt();
  };

  const handleInstall = async () => {
    if (!isIOS) {
      const installed = await promptInstall();
      if (installed) {
        setShowBanner(false);
      }
    }
  };

  if (!showBanner || isInstalled) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:bottom-4 md:w-80"
      >
        <div className="bg-card border rounded-xl shadow-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm">
                    {t('install.installApp', 'Install AliBrand CRM')}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isIOS 
                      ? t('install.iosBannerText', 'Add to home screen for quick access')
                      : t('install.bannerText', 'Install for faster access & offline use')
                    }
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 -mr-1 -mt-1"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {isIOS ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Share className="h-3 w-3" /> {t('install.tapShare', 'Tap Share')}
                  </span>
                  <span>→</span>
                  <span className="flex items-center gap-1">
                    <Plus className="h-3 w-3" /> {t('install.addToHome', 'Add to Home')}
                  </span>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="mt-3 w-full h-8 text-xs"
                  onClick={handleInstall}
                >
                  <Download className="h-3 w-3 mr-1.5" />
                  {t('install.installNow', 'Install Now')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
