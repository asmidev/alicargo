import { useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
  Package, 
  BarChart3, 
  Truck, 
  ShoppingBag, 
  Bell,
  ChevronRight,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface OnboardingSlide {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

interface OnboardingCarouselProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function OnboardingCarousel({ onComplete, onSkip }: OnboardingCarouselProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const slides: OnboardingSlide[] = [
    {
      id: 'inventory',
      icon: <Package className="w-16 h-16" />,
      title: t('onboarding.inventory.title', 'Inventarizatsiya boshqaruvi'),
      description: t('onboarding.inventory.description', 'Barcha mahsulotlaringizni bir joyda kuzating. QR kodlar orqali tez qidirish va real vaqtda yangilanishlar.'),
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'shipments',
      icon: <Truck className="w-16 h-16" />,
      title: t('onboarding.shipments.title', 'Jo\'natmalarni kuzatish'),
      description: t('onboarding.shipments.description', 'Xitoydan O\'zbekistongacha jo\'natmalarni real vaqtda kuzating. ETA bashoratlar va avtomatik bildirishnomalar.'),
      color: 'from-green-500 to-emerald-500',
    },
    {
      id: 'marketplace',
      icon: <ShoppingBag className="w-16 h-16" />,
      title: t('onboarding.marketplace.title', 'Marketplace integratsiya'),
      description: t('onboarding.marketplace.description', 'Uzum va Yandex Market bilan sinxronlash. Buyurtmalar, narxlar va inventarni bir joydan boshqaring.'),
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'analytics',
      icon: <BarChart3 className="w-16 h-16" />,
      title: t('onboarding.analytics.title', 'AI Analytics'),
      description: t('onboarding.analytics.description', 'Ali AI yordamida biznesingizni tahlil qiling. Savol bering, javob oling - oddiy va tez.'),
      color: 'from-orange-500 to-red-500',
    },
    {
      id: 'notifications',
      icon: <Bell className="w-16 h-16" />,
      title: t('onboarding.notifications.title', 'Telegram bildirishnomalar'),
      description: t('onboarding.notifications.description', 'Muhim yangilanishlarni Telegram orqali oling. Jo\'natma keldi, buyurtma tushdi - darhol xabar.'),
      color: 'from-indigo-500 to-violet-500',
    },
  ];

  const paginate = useCallback((newDirection: number) => {
    const newIndex = currentIndex + newDirection;
    if (newIndex >= 0 && newIndex < slides.length) {
      setDirection(newDirection);
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, slides.length]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x > threshold) {
      paginate(-1);
    } else if (info.offset.x < -threshold) {
      paginate(1);
    }
  }, [paginate]);

  const isLastSlide = currentIndex === slides.length - 1;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Skip button */}
      {onSkip && !isLastSlide && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-muted-foreground"
          >
            {t('onboarding.skip', 'O\'tkazib yuborish')}
          </Button>
        </div>
      )}

      {/* Slides */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex flex-col items-center justify-center px-8"
          >
            {/* Icon with gradient background */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className={cn(
                "w-32 h-32 rounded-3xl flex items-center justify-center mb-8",
                "bg-gradient-to-br shadow-lg",
                slides[currentIndex].color
              )}
            >
              <div className="text-white">
                {slides[currentIndex].icon}
              </div>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-center mb-4"
            >
              {slides[currentIndex].title}
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-muted-foreground text-center max-w-sm leading-relaxed"
            >
              {slides[currentIndex].description}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom section */}
      <div className="px-8 pb-8 pt-4 safe-area-bottom">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setDirection(index > currentIndex ? 1 : -1);
                setCurrentIndex(index);
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "w-8 bg-primary"
                  : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {currentIndex > 0 && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => paginate(-1)}
              className="flex-1"
            >
              {t('onboarding.back', 'Orqaga')}
            </Button>
          )}
          
          <Button
            size="lg"
            onClick={() => {
              if (isLastSlide) {
                onComplete();
              } else {
                paginate(1);
              }
            }}
            className={cn(
              "flex-1 gap-2",
              currentIndex === 0 && "w-full"
            )}
          >
            {isLastSlide ? (
              <>
                <Check className="w-5 h-5" />
                {t('onboarding.start', 'Boshlash')}
              </>
            ) : (
              <>
                {t('onboarding.next', 'Keyingi')}
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
