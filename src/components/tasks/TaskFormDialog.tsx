import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTelegramAlert } from '@/hooks/useTelegramAlert';
import { Task, TaskPriority, TaskStatus } from '@/pages/crm/Tasks';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  CalendarIcon, 
  Loader2, 
  Flag, 
  AlertTriangle,
  Circle,
  Clock,
  Eye,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TaskComments } from './TaskComments';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  userLocation: string;
}

interface FormData {
  title: string;
  description: string;
  assigned_to: string;
  due_date: Date | null;
  priority: TaskPriority;
  status: TaskStatus;
  location: string;
  entity_type: string;
}

const priorityOptions = [
  { value: 'low', label: 'low', icon: null, color: 'text-slate-500' },
  { value: 'medium', label: 'medium', icon: null, color: 'text-blue-500' },
  { value: 'high', label: 'high', icon: Flag, color: 'text-orange-500' },
  { value: 'urgent', label: 'urgent', icon: AlertTriangle, color: 'text-red-500' },
];

const statusOptions = [
  { value: 'todo', label: 'todo', icon: Circle, color: 'text-yellow-500' },
  { value: 'in_progress', label: 'in_progress', icon: Clock, color: 'text-blue-500' },
  { value: 'review', label: 'review', icon: Eye, color: 'text-purple-500' },
  { value: 'done', label: 'done', icon: CheckCircle2, color: 'text-green-500' },
  { value: 'cancelled', label: 'cancelled', icon: XCircle, color: 'text-muted-foreground' },
];

export function TaskFormDialog({ open, onOpenChange, task, userLocation }: TaskFormDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { notifyTaskAssigned } = useTelegramAlert();
  const isMobile = useIsMobile();

  const form = useForm<FormData>({
    defaultValues: {
      title: '',
      description: '',
      assigned_to: 'unassigned',
      due_date: null,
      priority: 'medium',
      status: 'todo',
      location: userLocation,
      entity_type: 'none',
    },
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || '',
        assigned_to: task.assigned_to || 'unassigned',
        due_date: task.due_date ? new Date(task.due_date) : null,
        priority: task.priority,
        status: task.status,
        location: task.location || userLocation,
        entity_type: task.entity_type || 'none',
      });
    } else {
      form.reset({
        title: '',
        description: '',
        assigned_to: 'unassigned',
        due_date: null,
        priority: 'medium',
        status: 'todo',
        location: userLocation,
        entity_type: 'none',
      });
    }
  }, [task, form, userLocation]);

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const assignedTo = data.assigned_to && data.assigned_to !== 'unassigned' ? data.assigned_to : null;
      const entityType = data.entity_type && data.entity_type !== 'none' ? data.entity_type : null;
      
      const isNewAssignment = !task && assignedTo;
      const isReassignment = task && assignedTo && assignedTo !== task.assigned_to;
      
      if (task) {
        const { error } = await supabase
          .from('tasks')
          .update({
            title: data.title,
            description: data.description || null,
            assigned_to: assignedTo,
            due_date: data.due_date?.toISOString() || null,
            priority: data.priority,
            status: data.status,
            location: data.location || null,
            entity_type: entityType,
          })
          .eq('id', task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert({
            title: data.title,
            description: data.description || null,
            assigned_to: assignedTo,
            due_date: data.due_date?.toISOString() || null,
            priority: data.priority,
            status: data.status,
            location: data.location || null,
            entity_type: entityType,
            created_by: user?.id!,
          });
        if (error) throw error;
      }

      if ((isNewAssignment || isReassignment) && assignedTo) {
        const assignerProfile = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user?.id!)
          .single();
        
        const assignerName = assignerProfile.data?.full_name || 'Foydalanuvchi';
        const formattedDueDate = data.due_date ? format(data.due_date, 'dd.MM.yyyy') : undefined;
        
        notifyTaskAssigned(
          assignedTo,
          data.title,
          assignerName,
          data.priority,
          data.location,
          formattedDueDate
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(task ? t('task_updated') : t('task_created'));
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Task error:', error);
      toast.error(task ? t('error_updating_task') : t('error_creating_task'));
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent fullScreen={isMobile} scrollable>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {task ? t('edit_task') : t('new_task')}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          <Form {...form}>
            <form id="task-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                rules={{ required: t('title_required') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('title')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('task_title_placeholder')} 
                        {...field} 
                        mobileOptimized
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('task_description_placeholder')}
                        className="min-h-[100px] md:min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quick Priority Selector for Mobile */}
              {isMobile && (
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('priority')}</FormLabel>
                      <div className="grid grid-cols-4 gap-2">
                        {priorityOptions.map((option) => {
                          const Icon = option.icon;
                          const isSelected = field.value === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => field.onChange(option.value)}
                              className={cn(
                                "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all active:scale-95",
                                isSelected 
                                  ? "border-primary bg-primary/10" 
                                  : "border-muted hover:border-muted-foreground/30"
                              )}
                            >
                              {Icon ? (
                                <Icon className={cn("h-5 w-5", option.color)} />
                              ) : (
                                <div className={cn("h-5 w-5 rounded-full", 
                                  option.value === 'low' ? 'bg-slate-400' : 'bg-blue-500'
                                )} />
                              )}
                              <span className="text-xs font-medium">{t(option.label)}</span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Quick Status Selector for Mobile */}
              {isMobile && (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('status')}</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((option) => {
                          const Icon = option.icon;
                          const isSelected = field.value === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => field.onChange(option.value)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-full border-2 transition-all active:scale-95",
                                isSelected 
                                  ? "border-primary bg-primary/10" 
                                  : "border-muted hover:border-muted-foreground/30"
                              )}
                            >
                              <Icon className={cn("h-4 w-4", option.color)} />
                              <span className="text-xs font-medium">{t(option.label)}</span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assigned To */}
                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('assigned_to')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={cn(isMobile && "h-12")}>
                            <SelectValue placeholder={t('select_user')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">{t('unassigned')}</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={u.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(u.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{u.full_name || u.id}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Due Date */}
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('due_date')}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                isMobile && "h-12",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, 'PPP') : t('select_date')}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Priority - Desktop only */}
                {!isMobile && (
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('priority')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {priorityOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  {option.icon && <option.icon className={cn("h-4 w-4", option.color)} />}
                                  {t(option.label)}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Status - Desktop only */}
                {!isMobile && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('status')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <option.icon className={cn("h-4 w-4", option.color)} />
                                  {t(option.label)}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Location */}
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('location')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={cn(isMobile && "h-12")}>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="china">{t('china')}</SelectItem>
                          <SelectItem value="uzbekistan">{t('uzbekistan')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Entity Type */}
                <FormField
                  control={form.control}
                  name="entity_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('related_to')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={cn(isMobile && "h-12")}>
                            <SelectValue placeholder={t('none')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t('none')}</SelectItem>
                          <SelectItem value="product">{t('products')}</SelectItem>
                          <SelectItem value="box">{t('boxes')}</SelectItem>
                          <SelectItem value="shipment">{t('shipments')}</SelectItem>
                          <SelectItem value="claim">{t('claims')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>

          {/* Comments section for existing tasks */}
          {task && (
            <div className="mt-6 pt-6 border-t">
              <TaskComments taskId={task.id} />
            </div>
          )}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button type="submit" form="task-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {task ? t('save_changes') : t('create_task')}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}