import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Scan, Shield, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface BiometricSetupProps {
  onComplete?: () => void;
  showAsModal?: boolean;
}

export function BiometricSetup({ onComplete, showAsModal = false }: BiometricSetupProps) {
  const { t } = useTranslation();
  const { triggerHaptic } = useNativeFeatures();
  const {
    isAvailable,
    biometryType,
    isAuthenticating,
    authenticate,
    isBiometricLoginEnabled,
    setBiometricLoginEnabled,
  } = useBiometricAuth();

  const [isEnabled, setIsEnabled] = useState(isBiometricLoginEnabled());
  const [setupStep, setSetupStep] = useState<'intro' | 'verify' | 'success'>('intro');
  const [error, setError] = useState<string | null>(null);

  const biometricLabel = biometryType === 'face' 
    ? t('biometric.faceId', 'Face ID') 
    : t('biometric.touchId', 'Barmoq izi');

  const BiometricIcon = biometryType === 'face' ? Scan : Fingerprint;

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      setSetupStep('verify');
      await triggerHaptic('light');
      
      const result = await authenticate(t('biometric.verifyIdentity', 'Shaxsingizni tasdiqlang'));
      
      if (result.success) {
        setIsEnabled(true);
        setBiometricLoginEnabled(true);
        setSetupStep('success');
        await triggerHaptic('success');
        
        setTimeout(() => {
          onComplete?.();
        }, 1500);
      } else {
        setError(result.error || t('biometric.failed', 'Tekshirish muvaffaqiyatsiz'));
        setSetupStep('intro');
        await triggerHaptic('error');
      }
    } else {
      setIsEnabled(false);
      setBiometricLoginEnabled(false);
      await triggerHaptic('light');
    }
  };

  if (!isAvailable) {
    return (
      <div className="p-4 bg-muted/50 rounded-xl text-center">
        <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t('biometric.notAvailable', 'Biometrik autentifikatsiya mavjud emas')}
        </p>
      </div>
    );
  }

  const content = (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {setupStep === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <BiometricIcon className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{biometricLabel}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('biometric.quickLogin', 'Tez kirish uchun foydalaning')}
                </p>
              </div>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
              <div>
                <p className="font-medium text-sm">
                  {t('biometric.enableLogin', 'Biometrik kirish')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('biometric.enableDescription', 'Parol o\'rniga {{type}} ishlating', { type: biometricLabel })}
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={isAuthenticating}
              />
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
              >
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}

            {/* Benefits */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-green-500" />
                <span>{t('biometric.benefit1', 'Parol kiritmasdan kirish')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-green-500" />
                <span>{t('biometric.benefit2', 'Xavfsiz va shifrlangan')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-green-500" />
                <span>{t('biometric.benefit3', 'Faqat sizning qurilmangizda ishlaydi')}</span>
              </div>
            </div>
          </motion.div>
        )}

        {setupStep === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center py-8"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center"
            >
              <BiometricIcon className="w-10 h-10 text-primary" />
            </motion.div>
            <h3 className="font-semibold mb-2">
              {t('biometric.verifying', 'Tekshirilmoqda...')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {biometryType === 'face'
                ? t('biometric.lookAtCamera', 'Kameraga qarang')
                : t('biometric.touchSensor', 'Sensorga barmoq qo\'ying')
              }
            </p>
          </motion.div>
        )}

        {setupStep === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center"
            >
              <Check className="w-10 h-10 text-green-500" />
            </motion.div>
            <h3 className="font-semibold mb-2 text-green-600">
              {t('biometric.enabled', 'Yoqildi!')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('biometric.enabledDescription', '{{type}} sozlandi', { type: biometricLabel })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (showAsModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 relative"
        >
          <button
            onClick={onComplete}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {content}
        </motion.div>
      </div>
    );
  }

  return <div className="p-4 bg-card rounded-xl border border-border">{content}</div>;
}
