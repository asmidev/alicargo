import { SidebarTrigger } from '@/components/ui/sidebar';
import { User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationBell } from './NotificationBell';
import { DesktopInstallButton } from './DesktopInstallButton';
import { CollaborationTrigger } from '@/components/collaboration/CollaborationTrigger';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useUserRole } from '@/hooks/useUserRole';
import { getRoleLabel } from '@/lib/roleUtils';
import { useIsMobile } from '@/hooks/use-mobile';

export function CRMHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userRoles } = useUserRole();
  const isMobile = useIsMobile();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="h-12 sm:h-14 md:h-16 border-b border-border bg-card/95 backdrop-blur-sm flex items-center justify-between px-2 sm:px-4 md:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-2 sm:gap-4">
        <SidebarTrigger className="h-9 w-9 sm:h-10 sm:w-10 touch-target" />
        <h1 className="hidden md:block text-xl font-semibold text-foreground">
          {t('welcome')}
        </h1>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-2">
        {userRoles.length > 0 && (
          <Badge variant="secondary" className="text-xs font-medium hidden md:inline-flex">
            {getRoleLabel(userRoles[0], t)}
          </Badge>
        )}
        
        {/* Show compact language switcher on mobile */}
        <LanguageSwitcher />
        
        <DesktopInstallButton />
        
        <NotificationBell />
        
        <CollaborationTrigger />

        {/* Hide user dropdown on mobile - accessible via bottom nav Menu */}
        {!isMobile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full" />
                ) : (
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border w-56">
              <DropdownMenuLabel className="text-foreground">
                <div className="flex flex-col">
                  <span className="font-medium">{profile?.full_name || t('auth_user_fallback')}</span>
                  <span className="text-xs text-muted-foreground font-normal">{user?.email?.split('@')[0]}</span>
                  {userRoles.length > 0 && (
                    <span className="text-xs text-primary font-medium mt-1">
                      {userRoles.join(', ')}
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
