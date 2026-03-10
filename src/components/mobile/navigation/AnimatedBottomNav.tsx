import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  QrCode, 
  ClipboardList, 
  Menu,
  LucideIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSidebar } from '@/components/ui/sidebar';
import { useTranslation } from 'react-i18next';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  isAction?: boolean;
  badgeCount?: number;
}

export function AnimatedBottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();
  const { triggerHaptic } = useNativeFeatures();
  const { user } = useAuth();
  
  const [longPressItem, setLongPressItem] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Get pending tasks count for badge
  const { data: pendingTasksCount } = useQuery({
    queryKey: ['pending-tasks-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .in('status', ['todo', 'in_progress']);
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: t('sidebar.dashboard'), path: '/crm' },
    { icon: Package, label: t('sidebar.boxes'), path: '/crm/boxes' },
    { icon: QrCode, label: 'QR', path: '/crm/boxes', isAction: true },
    { icon: ClipboardList, label: t('sidebar.tasks'), path: '/crm/tasks', badgeCount: pendingTasksCount },
    { icon: Menu, label: t('more', 'Ko\'proq'), path: '' },
  ];

  const getActiveIndex = () => {
    if (location.pathname === '/crm') return 0;
    if (location.pathname.startsWith('/crm/boxes')) return 1;
    if (location.pathname.startsWith('/crm/tasks')) return 3;
    return -1;
  };

  const activeIndex = getActiveIndex();

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  if (!isMobile) return null;

  const handleNavClick = async (item: NavItem, index: number) => {
    await triggerHaptic('light');

    if (item.path === '' && item.icon === Menu) {
      setOpenMobile(true);
    } else if (item.isAction) {
      navigate('/crm/boxes?scan=true');
    } else {
      // Double-tap to scroll to top
      if (activeIndex === index) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate(item.path);
      }
    }
  };

  const handleLongPressStart = async (item: NavItem) => {
    longPressTimer.current = setTimeout(async () => {
      await triggerHaptic('medium');
      setLongPressItem(item.path);
      
      // Auto-hide after 3 seconds
      setTimeout(() => setLongPressItem(null), 3000);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const isActive = (path: string, index: number) => {
    if (path === '/crm' && location.pathname === '/crm') return true;
    if (path !== '/crm' && path !== '' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Calculate indicator position
  const getIndicatorPosition = () => {
    const itemWidth = 100 / 5; // 5 items
    // Skip QR button (index 2) in calculation
    let visualIndex = activeIndex;
    if (activeIndex > 2) visualIndex = activeIndex;
    return `${visualIndex * itemWidth + itemWidth / 2}%`;
  };

  return (
    <nav 
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Animated indicator pill - don't show for QR button (index 2) or no active */}
      {activeIndex >= 0 && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute top-0 h-0.5 w-12 bg-primary rounded-full"
          style={{ left: getIndicatorPosition(), x: '-50%' }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 35,
          }}
        />
      )}

      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.path, index);
          const isQRButton = item.isAction;
          const showLongPressMenu = longPressItem === item.path;

          if (isQRButton) {
            return (
              <motion.button
                key={index}
                onClick={() => handleNavClick(item, index)}
                onTouchStart={() => handleLongPressStart(item)}
                onTouchEnd={handleLongPressEnd}
                whileTap={{ scale: 0.9 }}
                className="relative flex flex-col items-center justify-center -mt-5 touch-target"
                aria-label="QR Scanner"
              >
                <motion.div 
                  className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 ring-4 ring-background"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </motion.div>
                
                {/* Long press menu for QR */}
                <AnimatePresence>
                  {showLongPressMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      className="absolute bottom-20 bg-popover border border-border rounded-lg shadow-xl p-2 min-w-[140px]"
                    >
                      <button
                        onClick={() => {
                          navigate('/crm/boxes?scan=true&flashlight=true');
                          setLongPressItem(null);
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-muted rounded-md"
                      >
                        📸 With Flashlight
                      </button>
                      <button
                        onClick={() => {
                          navigate('/crm/boxes?create=true');
                          setLongPressItem(null);
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-muted rounded-md"
                      >
                        📦 New Box
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          }

          return (
            <motion.button
              key={index}
              onClick={() => handleNavClick(item, index)}
              onTouchStart={() => handleLongPressStart(item)}
              onTouchEnd={handleLongPressEnd}
              whileTap={{ scale: 0.9 }}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors touch-manipulation rounded-xl mx-0.5",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={item.label}
            >
              <motion.div 
                className="relative"
                animate={{ 
                  scale: active ? 1.1 : 1,
                  y: active ? -2 : 0,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Icon className="w-5 h-5" />
                
                {/* Badge */}
                <AnimatePresence>
                  {item.badgeCount && item.badgeCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1"
                    >
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              
              <motion.span 
                className={cn(
                  "text-[10px] truncate max-w-[56px]",
                  active ? "font-semibold" : "font-medium"
                )}
                animate={{ opacity: active ? 1 : 0.8 }}
              >
                {item.label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
