import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, QrCode, ClipboardList, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSidebar } from '@/components/ui/sidebar';
import { useTranslation } from 'react-i18next';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  isAction?: boolean;
  badgeCount?: number;
  tourId?: string;
}

export function MobileBottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();
  const { triggerHaptic } = useNativeFeatures();
  const { user } = useAuth();

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
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: t('sidebar.dashboard'), path: '/crm', tourId: 'dashboard' },
    { icon: Package, label: t('sidebar.boxes'), path: '/crm/boxes', tourId: 'boxes' },
    { icon: QrCode, label: 'QR', path: '/crm/boxes', isAction: true },
    { icon: ClipboardList, label: t('sidebar.tasks'), path: '/crm/tasks', badgeCount: pendingTasksCount, tourId: 'tasks' },
    { icon: Menu, label: t('more', 'Ko\'proq'), path: '' },
  ];

  if (!isMobile) return null;

  const handleNavClick = async (item: NavItem) => {
    // Trigger haptic feedback
    await triggerHaptic('light');

    if (item.path === '' && item.icon === Menu) {
      setOpenMobile(true);
    } else if (item.isAction) {
      navigate('/crm/boxes?scan=true');
    } else {
      navigate(item.path);
    }
  };

  const isActive = (path: string) => {
    if (path === '/crm' && location.pathname === '/crm') return true;
    if (path !== '/crm' && path !== '' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border/50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const isQRButton = item.isAction;

          if (isQRButton) {
            return (
              <button
                key={index}
                onClick={() => handleNavClick(item)}
                className="flex flex-col items-center justify-center -mt-5 touch-target active:scale-95 transition-transform"
                aria-label="QR Scanner"
              >
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 ring-4 ring-background">
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
              </button>
            );
          }

          return (
            <button
              key={index}
              onClick={() => handleNavClick(item)}
              data-tour={item.tourId}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all touch-manipulation",
                "active:scale-95 active:bg-muted/30 rounded-xl mx-0.5",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={item.label}
            >
              <div className="relative">
                <Icon className={cn(
                  "w-5 h-5 transition-transform",
                  active && "scale-110"
                )} />
                {/* Badge for pending items */}
                {item.badgeCount && item.badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium truncate max-w-[56px]",
                active && "font-semibold"
              )}>
                {item.label}
              </span>
              {/* Active indicator dot */}
              {active && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
