import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, AnimatePresence } from 'framer-motion';

export function DesktopInstallButton() {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const isMobile = useIsMobile();

  // Only show on desktop when installable and not already installed
  if (isMobile || !isInstallable || isInstalled) {
    return null;
  }

  const handleInstall = async () => {
    await promptInstall();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleInstall}
          className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
        >
          <Download className="h-4 w-4" />
          <span className="hidden lg:inline">{t('install.installApp', 'Install App')}</span>
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
