import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface WelcomeModalProps {
  userName?: string;
  onStartTour: () => void;
  onSkip: () => void;
}

export function WelcomeModal({ userName, onStartTour, onSkip }: WelcomeModalProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header with gradient */}
        <div className="relative h-32 bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <motion.div
            initial={{ rotate: -10, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center"
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>
          
          {/* Decorative circles */}
          <div className="absolute top-4 left-4 w-16 h-16 bg-white/10 rounded-full" />
          <div className="absolute bottom-0 right-4 w-24 h-24 bg-white/10 rounded-full translate-y-1/2" />
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl font-bold mb-2"
          >
            {userName 
              ? t('welcome.greeting', 'Xush kelibsiz, {{name}}!', { name: userName })
              : t('welcome.greetingGeneric', 'Xush kelibsiz!')
            }
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground text-sm mb-6"
          >
            {t('welcome.subtitle', 'AliBrand CRM ga xush kelibsiz. Keling, asosiy imkoniyatlarni ko\'rib chiqamiz.')}
          </motion.p>

          {/* Quick stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-lg font-bold text-primary">5+</div>
              <div className="text-xs text-muted-foreground">
                {t('welcome.features', 'Modullar')}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-lg font-bold text-green-500">24/7</div>
              <div className="text-xs text-muted-foreground">
                {t('welcome.support', 'Ali AI')}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-lg font-bold text-orange-500">100%</div>
              <div className="text-xs text-muted-foreground">
                {t('welcome.sync', 'Sinxron')}
              </div>
            </div>
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-3"
          >
            <Button 
              onClick={onStartTour} 
              className="w-full gap-2"
              size="lg"
            >
              {t('welcome.startTour', 'Ekskursiyani boshlash')}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              onClick={onSkip}
              className="w-full text-muted-foreground"
            >
              {t('welcome.skip', 'Keyinroq')}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
