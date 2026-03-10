import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useFirstLaunch } from '@/hooks/useFirstLaunch';
import { OnboardingCarousel } from './OnboardingCarousel';
import { WelcomeModal } from './WelcomeModal';
import { FeatureSpotlight } from './FeatureSpotlight';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';

interface OnboardingContextValue {
  startOnboarding: () => void;
  startFeatureTour: () => void;
  showWelcome: () => void;
  isOnboardingActive: boolean;
  isTourActive: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const {
    hasSeenOnboarding,
    hasSeenFeatureTour,
    isFirstVisit,
    markOnboardingComplete,
    markFeatureTourComplete,
  } = useFirstLaunch();

  const [showCarousel, setShowCarousel] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Auto-show onboarding for first-time mobile users
  useEffect(() => {
    if (isMobile && isFirstVisit && !hasSeenOnboarding) {
      // Small delay to let the app render first
      const timer = setTimeout(() => {
        setShowCarousel(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isMobile, isFirstVisit, hasSeenOnboarding]);

  const tourSteps = [
    {
      id: 'nav-dashboard',
      targetSelector: '[data-tour="dashboard"]',
      title: t('tour.dashboard.title', 'Dashboard'),
      description: t('tour.dashboard.description', 'Bu yerda barcha asosiy ko\'rsatkichlarni ko\'rasiz - sotuvlar, inventar va jo\'natmalar.'),
      position: 'bottom' as const,
    },
    {
      id: 'nav-boxes',
      targetSelector: '[data-tour="boxes"]',
      title: t('tour.boxes.title', 'Qutilar'),
      description: t('tour.boxes.description', 'Xitoydan kelayotgan qutilarni kuzating. QR kod skanerlang va tarkibini tekshiring.'),
      position: 'bottom' as const,
    },
    {
      id: 'nav-products',
      targetSelector: '[data-tour="products"]',
      title: t('tour.products.title', 'Mahsulotlar'),
      description: t('tour.products.description', 'Barcha mahsulotlar katalogi. Narxlar, stok va marketplace sinxronlash.'),
      position: 'bottom' as const,
    },
    {
      id: 'nav-ali-ai',
      targetSelector: '[data-tour="ali-ai"]',
      title: t('tour.aliAi.title', 'Ali AI'),
      description: t('tour.aliAi.description', 'Sun\'iy intellekt yordamchisi. Biznesingiz haqida savol bering - javob oling.'),
      position: 'top' as const,
    },
  ];

  const handleCarouselComplete = () => {
    setShowCarousel(false);
    markOnboardingComplete();
    
    // Show welcome modal after carousel
    setTimeout(() => {
      setShowWelcomeModal(true);
    }, 300);
  };

  const handleCarouselSkip = () => {
    setShowCarousel(false);
    markOnboardingComplete();
  };

  const handleWelcomeStartTour = () => {
    setShowWelcomeModal(false);
    setTimeout(() => {
      setShowTour(true);
    }, 300);
  };

  const handleWelcomeSkip = () => {
    setShowWelcomeModal(false);
    markFeatureTourComplete();
  };

  const handleTourComplete = () => {
    setShowTour(false);
    markFeatureTourComplete();
  };

  const value: OnboardingContextValue = {
    startOnboarding: () => setShowCarousel(true),
    startFeatureTour: () => setShowTour(true),
    showWelcome: () => setShowWelcomeModal(true),
    isOnboardingActive: showCarousel,
    isTourActive: showTour,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}

      <AnimatePresence>
        {showCarousel && (
          <OnboardingCarousel
            onComplete={handleCarouselComplete}
            onSkip={handleCarouselSkip}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWelcomeModal && (
          <WelcomeModal
            onStartTour={handleWelcomeStartTour}
            onSkip={handleWelcomeSkip}
          />
        )}
      </AnimatePresence>

      <FeatureSpotlight
        steps={tourSteps}
        isOpen={showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourComplete}
      />
    </OnboardingContext.Provider>
  );
}
