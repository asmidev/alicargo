import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Task } from '@/pages/crm/Tasks';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TaskComments } from './TaskComments';
import { TaskSubtasks } from './TaskSubtasks';
import { TaskActivityLog } from './TaskActivityLog';
import { 
  Calendar, 
  User, 
  Flag, 
  MapPin, 
  Clock, 
  CheckCircle2,
  Edit,
  MessageSquare,
  ListTodo,
  History,
  Package,
  Box,
  Truck,
  AlertTriangle
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onEdit: () => void;
}

const priorityConfig = {
  low: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', label: 'low' },
  medium: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'medium' },
  high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', label: 'high' },
  urgent: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'urgent' },
};

const statusConfig = {
  todo: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'todo' },
  in_progress: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'in_progress' },
  review: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', label: 'review' },
  done: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'done' },
  cancelled: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', label: 'cancelled' },
};

const entityIcons: Record<string, typeof Package> = {
  product: Package,
  box: Box,
  shipment: Truck,
  claim: AlertTriangle,
};

export function TaskDetailDialog({ open, onOpenChange, task, onEdit }: TaskDetailDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('details');

  // Fetch subtasks count
  const { data: subtasksCount = 0 } = useQuery({
    queryKey: ['subtasks-count', task?.id],
    queryFn: async () => {
      if (!task?.id) return 0;
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', task.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!task?.id,
  });

  // Fetch comments count
  const { data: commentsCount = 0 } = useQuery({
    queryKey: ['comments-count', task?.id],
    queryFn: async () => {
      if (!task?.id) return 0;
      const { count, error } = await supabase
        .from('task_comments')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', task.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!task?.id,
  });

  if (!task) return null;

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Safe date parsing helper
  const parseDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };

  const formatSafeDate = (dateString: string | null | undefined, formatStr: string): string => {
    const date = parseDate(dateString);
    return date ? format(date, formatStr) : '-';
  };

  const dueDate = parseDate(task.due_date);
  const isOverdue = dueDate && isPast(dueDate) && task.status !== 'done';
  const isDueToday = dueDate && isToday(dueDate);
  const EntityIcon = task.entity_type ? entityIcons[task.entity_type] : null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent fullScreen={isMobile} scrollable>
        <ResponsiveDialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <ResponsiveDialogTitle className="text-lg md:text-xl font-semibold leading-tight mb-2 pr-2">
                {task.title}
              </ResponsiveDialogTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("text-xs", statusConfig[task.status].color)}>
                  {t(task.status)}
                </Badge>
                <Badge variant="outline" className={cn("text-xs", priorityConfig[task.priority].color)}>
                  {task.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {task.priority === 'high' && <Flag className="h-3 w-3 mr-1" />}
                  {t(task.priority)}
                </Badge>
                {task.location && (
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    {t(task.location)}
                  </Badge>
                )}
              </div>
            </div>
            {!isMobile && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
            )}
          </div>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className={cn(
              "shrink-0",
              isMobile ? "grid grid-cols-4 w-full" : ""
            )}>
              <TabsTrigger value="details" className="text-xs">
                {isMobile ? t('details').slice(0, 6) : t('details')}
              </TabsTrigger>
              <TabsTrigger value="subtasks" className="text-xs">
                <ListTodo className="h-3.5 w-3.5 mr-1" />
                {subtasksCount > 0 && `${subtasksCount}`}
              </TabsTrigger>
              <TabsTrigger value="comments" className="text-xs">
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                {commentsCount > 0 && `${commentsCount}`}
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs">
                <History className="h-3.5 w-3.5 mr-1" />
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden mt-4">
              <TabsContent value="details" className="h-full m-0">
                <ScrollArea className="h-full">
                  <div className="space-y-4 pb-4">
                    {/* Description */}
                    {task.description && (
                      <div className="bg-muted/30 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">{t('description')}</h4>
                        <p className="text-sm whitespace-pre-wrap">{task.description}</p>
                      </div>
                    )}

                    {/* Details Grid */}
                    <div className={cn(
                      "grid gap-4",
                      isMobile ? "grid-cols-2" : "grid-cols-2"
                    )}>
                      {/* Assignee */}
                      <div className="bg-muted/30 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {t('assignee')}
                        </h4>
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className={cn(isMobile ? "h-8 w-8" : "h-8 w-8")}>
                              <AvatarImage src={task.assignee.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(task.assignee.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium truncate">{task.assignee.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('unassigned')}</span>
                        )}
                      </div>

                      {/* Due Date */}
                      <div className="bg-muted/30 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t('due_date')}
                        </h4>
                        {dueDate ? (
                          <div className={cn(
                            "text-sm font-medium",
                            isOverdue && "text-red-600 dark:text-red-400",
                            isDueToday && !isOverdue && "text-orange-600 dark:text-orange-400"
                          )}>
                            {format(dueDate, isMobile ? 'MMM d' : 'PPP')}
                            {isOverdue && (
                              <Badge variant="destructive" className="text-[10px] ml-1">{t('overdue')}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>

                      {/* Created By */}
                      <div className="bg-muted/30 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('created_by')}</h4>
                        {task.creator ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={task.creator.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(task.creator.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate">{task.creator.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>

                      {/* Created At */}
                      <div className="bg-muted/30 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {t('created')}
                        </h4>
                        <span className="text-sm">
                          {formatSafeDate(task.created_at, isMobile ? 'MMM d, HH:mm' : 'PPP p')}
                        </span>
                      </div>

                      {/* Linked Entity */}
                      {task.entity_type && EntityIcon && (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <EntityIcon className="h-3 w-3" />
                            {t('linked_entity')}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {t(task.entity_type)}
                          </Badge>
                        </div>
                      )}

                      {/* Completed */}
                      {task.status === 'done' && task.completed_at && (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {t('done')}
                          </h4>
                          <span className="text-sm text-green-600 dark:text-green-400">
                            {formatSafeDate(task.completed_at, isMobile ? 'MMM d, HH:mm' : 'PPP p')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="subtasks" className="h-full m-0">
                <TaskSubtasks taskId={task.id} />
              </TabsContent>

              <TabsContent value="comments" className="h-full m-0">
                <TaskComments taskId={task.id} />
              </TabsContent>

              <TabsContent value="activity" className="h-full m-0">
                <TaskActivityLog taskId={task.id} />
              </TabsContent>
            </div>
          </Tabs>
        </ResponsiveDialogBody>

        {isMobile && (
          <ResponsiveDialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
            <Button className="flex-1" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              {t('edit')}
            </Button>
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}