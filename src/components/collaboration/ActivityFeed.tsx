import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Package, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  MessageSquare,
  Clock,
  RefreshCw
} from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';

interface ActivityItem {
  id: string;
  user_id: string;
  activity_type: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  description: string | null;
  metadata: unknown;
  created_at: string;
}

const activityIcons: Record<string, React.ElementType> = {
  verification: CheckCircle2,
  box_created: Package,
  shipment_updated: Truck,
  defect_found: XCircle,
  missing_item: AlertTriangle,
  message: MessageSquare,
  handoff: Clock
};

const activityColors: Record<string, string> = {
  verification: 'text-green-500 bg-green-500/10',
  box_created: 'text-blue-500 bg-blue-500/10',
  shipment_updated: 'text-purple-500 bg-purple-500/10',
  defect_found: 'text-red-500 bg-red-500/10',
  missing_item: 'text-yellow-500 bg-yellow-500/10',
  message: 'text-muted-foreground bg-muted',
  handoff: 'text-orange-500 bg-orange-500/10'
};

export function ActivityFeed() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});

  const fetchActivities = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('activity_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      const userIds = [...new Set(data.map(a => a.user_id))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
        profileData?.forEach(p => {
          profileMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        });
        setProfiles(profileMap);
      }
      setActivities(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchActivities();

    const channel = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed'
        },
        async (payload) => {
          const newActivity = payload.new as ActivityItem;
          
          if (!profiles[newActivity.user_id]) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', newActivity.user_id)
              .single();
            
            if (profile) {
              setProfiles(prev => ({
                ...prev,
                [profile.id]: { full_name: profile.full_name, avatar_url: profile.avatar_url }
              }));
            }
          }
          
          setActivities(prev => [newActivity, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getIcon = (type: string) => {
    const Icon = activityIcons[type] || Activity;
    const colorClass = activityColors[type] || 'text-muted-foreground bg-muted';
    return (
      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
    );
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{t('collab_activity')}</span>
          </div>
        </div>
        <LoadingSkeleton count={4} compact />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{t('collab_activity')}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetchActivities}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 -mx-1 px-1">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('collab_no_activity')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('collab_activity_hint')}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {activities.map((activity) => {
              const profile = profiles[activity.user_id];
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {getIcon(activity.activity_type)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{profile?.full_name || t('collab_unknown_user')}</span>
                      {' · '}
                      <span className="text-muted-foreground">{activity.title}</span>
                    </p>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {activity.description}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), { 
                        addSuffix: true,
                        locale: uz
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}