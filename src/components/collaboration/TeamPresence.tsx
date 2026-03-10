import { useTranslation } from 'react-i18next';
import { useUserPresence } from '@/hooks/useUserPresence';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { 
  Circle, 
  Package, 
  CheckCircle2,
  Clock,
  Users
} from 'lucide-react';

const STATUS_LABEL_KEYS: Record<string, string> = {
  online: 'collab_status_online',
  away: 'collab_status_away',
  busy: 'collab_status_busy',
  offline: 'collab_status_offline',
};

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-muted-foreground',
};

const ACTIVITY_LABEL_KEYS: Record<string, string> = {
  verifying_box: 'collab_act_verifying',
  packing: 'collab_act_packing',
  idle: 'collab_act_idle',
  scanning: 'collab_act_scanning',
};

export function TeamPresence() {
  const { t } = useTranslation();
  const { onlineUsers, isLoading } = useUserPresence();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getActivityIcon = (activity: string | null) => {
    switch (activity) {
      case 'verifying_box':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'packing':
        return <Package className="h-3 w-3 text-blue-500" />;
      case 'scanning':
        return <Clock className="h-3 w-3 text-orange-500" />;
      default:
        return null;
    }
  };

  const chinaUsers = onlineUsers.filter(u => u.location === 'china');
  const uzbekUsers = onlineUsers.filter(u => u.location === 'uzbekistan');

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{t('collab_team')}</span>
        </div>
        <LoadingSkeleton count={3} compact />
      </div>
    );
  }

  const renderUserGroup = (users: typeof onlineUsers, title: string) => {
    if (users.length === 0) return null;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>{title}</span>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{users.length}</span>
        </div>
        {users.map((user) => {
          const statusColor = STATUS_COLORS[user.status as string] || STATUS_COLORS.offline;
          return (
            <div
              key={user.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="relative">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.profile?.avatar_url || ''} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(user.profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span 
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${statusColor}`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.profile?.full_name || t('collab_unknown_user')}
                </p>
                {user.current_activity && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {getActivityIcon(user.current_activity)}
                    <span>{t(ACTIVITY_LABEL_KEYS[user.current_activity] || 'collab_act_idle')}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{t('collab_team')}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {onlineUsers.length} {t('collab_online')}
        </Badge>
      </div>

      <ScrollArea className="flex-1 -mx-1 px-1">
        {onlineUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('collab_no_online')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('collab_online_hint')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {renderUserGroup(chinaUsers, t('collab_ch_china'))}
            {renderUserGroup(uzbekUsers, t('collab_ch_uzbekistan'))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}