import { ReactNode, useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, X, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  searchValue?: string;
  actions?: ReactNode;
  rightAction?: ReactNode;
  className?: string;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  largeTitle?: boolean;
}

export function MobileHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  showSearch = false,
  searchPlaceholder = 'Search...',
  onSearch,
  searchValue = '',
  actions,
  rightAction,
  className,
  scrollContainerRef,
  largeTitle = true,
}: MobileHeaderProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { triggerHaptic } = useNativeFeatures();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Track scroll for large title shrink effect
  const { scrollY } = useScroll({
    container: scrollContainerRef,
  });
  
  // Transform values for the large title effect
  const largeTitleOpacity = useTransform(scrollY, [0, 60], [1, 0]);
  const largeTitleY = useTransform(scrollY, [0, 60], [0, -10]);
  const smallTitleOpacity = useTransform(scrollY, [40, 80], [0, 1]);
  const headerHeight = useTransform(scrollY, [0, 60], [largeTitle ? 96 : 56, 56]);

  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  const handleBack = async () => {
    await triggerHaptic('light');
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleSearchToggle = async () => {
    await triggerHaptic('light');
    setIsSearchOpen(!isSearchOpen);
    if (!isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setLocalSearchValue('');
      onSearch?.('');
    }
  };

  const handleSearchChange = (value: string) => {
    setLocalSearchValue(value);
    onSearch?.(value);
  };

  if (!isMobile) return null;

  return (
    <motion.header
      ref={headerRef}
      style={{ height: largeTitle ? headerHeight : 56 }}
      className={cn(
        "sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50",
        "safe-area-top",
        className
      )}
    >
      {/* Main header bar */}
      <div className="flex items-center h-14 px-2 gap-1">
        {/* Left section */}
        <div className="flex items-center gap-1">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={handleBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center section - Small title (visible on scroll) */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {isSearchOpen ? (
              <motion.div
                key="search"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2"
              >
                <Input
                  ref={searchInputRef}
                  type="search"
                  placeholder={searchPlaceholder}
                  value={localSearchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="h-9 bg-muted/50 border-0 focus-visible:ring-1"
                />
              </motion.div>
            ) : (
              <motion.div
                key="title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {largeTitle ? (
                  <motion.h1
                    style={{ opacity: smallTitleOpacity }}
                    className="font-semibold text-base truncate"
                  >
                    {title}
                  </motion.h1>
                ) : (
                  <h1 className="font-semibold text-base truncate">{title}</h1>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1">
          {showSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={handleSearchToggle}
            >
              {isSearchOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Search className="h-5 w-5" />
              )}
            </Button>
          )}
          {rightAction}
          {actions && (
            <div className="flex items-center">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Large title section (iOS-style) */}
      {largeTitle && !isSearchOpen && (
        <motion.div
          style={{ opacity: largeTitleOpacity, y: largeTitleY }}
          className="px-4 pb-2"
        >
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </motion.div>
      )}
    </motion.header>
  );
}
