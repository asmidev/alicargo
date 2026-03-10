import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Eye, 
  Edit, 
  Plus, 
  Trash2, 
  User,
  Flag,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz, ru, enUS, zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TaskActivityLogProps {
  taskId: string;
}

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

const actionIcons: Record<string, typeof Circle> = {
  created: Plus,
  status_changed: CheckCircle2,
  priority_changed: Flag,
  assigned: User,
  due_date_changed: Calendar,
  edited: Edit,
  comment_added: MessageSquare,
  deleted: Trash2,
};

const actionColors: Record<string, string> = {
  created: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
  status_changed: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
  priority_changed: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
  assigned: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
  due_date_changed: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400',
  edited: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  comment_added: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-400',
  deleted: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
};

export function TaskActivityLog({ taskId }: TaskActivityLogProps) {
  const { t, i18n } = useTranslation();

  const getLocale = () => {
    switch (i18n.language) {
      case 'uz': return uz;
      case 'ru': return ru;
      case 'zh': return zhCN;
      default: return enUS;
    }
  };

  // Fetch activity logs
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_activity_log')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set(data.map(a => a.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(activity => ({
          ...activity,
          profile: profileMap.get(activity.user_id) || null,
        })) as ActivityLog[];
      }

      return data as ActivityLog[];
    },
  });

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getActionDescription = (activity: ActivityLog) => {
    const userName = activity.profile?.full_name || t('unknown');
    
    switch (activity.action) {
      case 'created':
        return t('activity_created', { user: userName });
      case 'status_changed':
        return t('activity_status_changed', { 
          user: userName, 
          from: t(activity.old_value || ''), 
          to: t(activity.new_value || '') 
        });
      case 'priority_changed':
        return t('activity_priority_changed', { 
          user: userName, 
          from: t(activity.old_value || ''), 
          to: t(activity.new_value || '') 
        });
      case 'assigned':
        return t('activity_assigned', { user: userName, to: activity.new_value });
      case 'due_date_changed':
        return t('activity_due_date_changed', { user: userName });
      case 'edited':
        return t('activity_edited', { user: userName, field: activity.field_name });
      case 'comment_added':
        return t('activity_comment_added', { user: userName });
      default:
        return `${userName} ${activity.action}`;
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t('no_activity')}
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-6">
              {activities.map((activity, index) => {
                const Icon = actionIcons[activity.action] || Circle;
                const colorClass = actionColors[activity.action] || actionColors.edited;

                return (
                  <div key={activity.id} className="relative flex gap-4 pl-10">
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute left-2 w-5 h-5 rounded-full flex items-center justify-center -translate-x-1/2",
                      colorClass
                    )}>
                      <Icon className="h-3 w-3" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={activity.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(activity.profile?.full_name || null)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{activity.profile?.full_name || t('unknown')}</span>
                            {' '}
                            <span className="text-muted-foreground">
                              {activity.action === 'status_changed' && activity.old_value && activity.new_value && (
                                <>
                                  {t('changed_status_from')}{' '}
                                  <span className="font-medium">{t(activity.old_value)}</span>
                                  {' '}{t('to')}{' '}
                                  <span className="font-medium">{t(activity.new_value)}</span>
                                </>
                              )}
                              {activity.action === 'priority_changed' && activity.old_value && activity.new_value && (
                                <>
                                  {t('changed_priority_from')}{' '}
                                  <span className="font-medium">{t(activity.old_value)}</span>
                                  {' '}{t('to')}{' '}
                                  <span className="font-medium">{t(activity.new_value)}</span>
                                </>
                              )}
                              {activity.action === 'created' && t('created_task')}
                              {activity.action === 'comment_added' && t('added_comment')}
                              {activity.action === 'assigned' && (
                                <>
                                  {t('assigned_to')}{' '}
                                  <span className="font-medium">{activity.new_value}</span>
                                </>
                              )}
                              {activity.action === 'edited' && (
                                <>
                                  {t('edited')}{' '}
                                  {activity.field_name && <span className="font-medium">{activity.field_name}</span>}
                                </>
                              )}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(activity.created_at), { 
                              addSuffix: true,
                              locale: getLocale()
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
