import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Filter, LayoutGrid, List, Calendar, FileText, BarChart3 } from 'lucide-react';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskListView } from '@/components/tasks/TaskListView';
import { TaskCalendarView } from '@/components/tasks/TaskCalendarView';
import { TaskBulkActions } from '@/components/tasks/TaskBulkActions';
import { TaskTemplatesDialog } from '@/components/tasks/TaskTemplatesDialog';
import { TaskAnalytics } from '@/components/tasks/TaskAnalytics';
import { MobileKanbanView } from '@/components/tasks/MobileKanbanView';
import { MobileHeader, MobileCardSkeleton } from '@/components/mobile';
import { toast } from 'sonner';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  entity_type: string | null;
  entity_id: string | null;
  location: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
  assignee?: { full_name: string | null; avatar_url: string | null } | null;
  creator?: { full_name: string | null; avatar_url: string | null } | null;
}

export default function Tasks() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isManager, isChinaManager, isChinaStaff } = useUserRole();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar' | 'analytics'>('kanban');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterLocation, setFilterLocation] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const userLocation = (isChinaManager || isChinaStaff) ? 'china' : 'uzbekistan';

  // Fetch tasks (only parent tasks, not subtasks)
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', filterLocation],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*')
        .is('parent_id', null) // Only fetch parent tasks
        .order('created_at', { ascending: false });

      if (filterLocation) {
        query = query.eq('location', filterLocation);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });

  // Fetch profiles for task assignees and creators
  const { data: profiles = {} } = useQuery({
    queryKey: ['profiles-for-tasks', tasks],
    queryFn: async () => {
      const userIds = new Set<string>();
      tasks.forEach(task => {
        if (task.assigned_to) userIds.add(task.assigned_to);
        if (task.created_by) userIds.add(task.created_by);
      });

      if (userIds.size === 0) return {};

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', Array.from(userIds));

      if (error) throw error;

      const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      data.forEach(p => {
        profileMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
      });
      return profileMap;
    },
    enabled: tasks.length > 0,
  });

  // Enrich tasks with profile data
  const enrichedTasks = tasks.map(task => ({
    ...task,
    assignee: task.assigned_to ? profiles[task.assigned_to] : null,
    creator: task.created_by ? profiles[task.created_by] : null,
  }));

  // Update task mutation with activity logging
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates, oldTask }: { id: string; updates: Partial<Task>; oldTask?: Task }) => {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id);
      if (error) throw error;

      // Log activity for status changes
      if (oldTask && updates.status && updates.status !== oldTask.status && user?.id) {
        await supabase.from('task_activity_log').insert({
          task_id: id,
          user_id: user.id,
          action: 'status_changed',
          field_name: 'status',
          old_value: oldTask.status,
          new_value: updates.status,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-activity'] });
      toast.success(t('task_updated'));
    },
    onError: () => {
      toast.error(t('error_updating_task'));
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(t('task_deleted'));
    },
    onError: () => {
      toast.error(t('error_deleting_task'));
    },
  });

  // Filter tasks by search query
  const filteredTasks = enrichedTasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleEditTask = () => {
    setIsDetailOpen(false);
    setIsFormOpen(true);
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    const oldTask = enrichedTasks.find(t => t.id === taskId);
    const updates: Partial<Task> = { status: newStatus };
    if ((newStatus as string) === 'done') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = user?.id;
    } else {
      updates.completed_at = null;
      updates.completed_by = null;
    }
    updateTaskMutation.mutate({ id: taskId, updates, oldTask });
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTaskMutation.mutate(taskId);
  };

  const taskStats = {
    total: filteredTasks.length,
    todo: filteredTasks.filter(t => t.status === 'todo').length,
    inProgress: filteredTasks.filter(t => t.status === 'in_progress').length,
    review: filteredTasks.filter(t => t.status === 'review').length,
    done: filteredTasks.filter(t => (t.status as string) === 'done').length,
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{t('tasks')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('manage_tasks_and_assignments')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats badges */}
            <div className="hidden md:flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs font-medium">
                {t('total')}: {taskStats.total}
              </Badge>
              <Badge variant="secondary" className="text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800">
                {t('todo')}: {taskStats.todo}
              </Badge>
              <Badge variant="secondary" className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-200 dark:border-blue-800">
                {t('in_progress')}: {taskStats.inProgress}
              </Badge>
              <Badge variant="secondary" className="text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 border-purple-200 dark:border-purple-800">
                {t('review')}: {taskStats.review}
              </Badge>
              <Badge variant="secondary" className="text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-green-200 dark:border-green-800">
                {t('done')}: {taskStats.done}
              </Badge>
            </div>

            {isManager && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsTemplatesOpen(true)}>
                  <FileText className="h-4 w-4 mr-1" />
                  {t('task_templates')}
                </Button>
                <Button onClick={() => { setSelectedTask(null); setIsFormOpen(true); }} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  {t('new_task')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedTaskIds.length > 0 && (
          <div className="mt-3">
            <TaskBulkActions
              selectedIds={selectedTaskIds}
              onClear={() => setSelectedTaskIds([])}
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search_tasks')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={filterLocation || 'all'} onValueChange={(v) => setFilterLocation(v === 'all' ? null : v)}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs">{t('all')}</TabsTrigger>
                <TabsTrigger value="china" className="text-xs">{t('china')}</TabsTrigger>
                <TabsTrigger value="uzbekistan" className="text-xs">{t('uzbekistan')}</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode('kanban')}
                title="Kanban"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none border-x"
                onClick={() => setViewMode('list')}
                title="List"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none border-r"
                onClick={() => setViewMode('calendar')}
                title={t('calendar')}
              >
                <Calendar className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'analytics' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode('analytics')}
                title={t('analytics')}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 p-4 overflow-hidden">
        {isLoading ? (
          isMobile ? (
            <MobileCardSkeleton variant="task" count={5} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )
        ) : isMobile && viewMode === 'kanban' ? (
          <MobileKanbanView
            tasks={filteredTasks}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
            onDeleteTask={handleDeleteTask}
          />
        ) : viewMode === 'kanban' ? (
          <KanbanBoard
            tasks={filteredTasks}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
            onDeleteTask={handleDeleteTask}
          />
        ) : viewMode === 'calendar' ? (
          <TaskCalendarView
            tasks={filteredTasks}
            onTaskClick={handleTaskClick}
          />
        ) : viewMode === 'analytics' ? (
          <div className="h-full overflow-y-auto">
            <TaskAnalytics />
          </div>
        ) : (
          <TaskListView
            tasks={filteredTasks}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
            onDeleteTask={handleDeleteTask}
            selectedIds={selectedTaskIds}
            onSelectionChange={setSelectedTaskIds}
          />
        )}
      </div>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        task={selectedTask}
        onEdit={handleEditTask}
      />

      {/* Task Form Dialog */}
      <TaskFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        task={selectedTask}
        userLocation={userLocation}
      />

      {/* Task Templates Dialog */}
      <TaskTemplatesDialog
        open={isTemplatesOpen}
        onOpenChange={setIsTemplatesOpen}
        onUseTemplate={(template) => {
          try {
            const newTask: Task = {
              id: '',
              title: template.title_template || '',
              description: template.description_template || null,
              assigned_to: null,
              created_by: user?.id || '',
              due_date: null,
              priority: (template.default_priority as TaskPriority) || 'medium',
              status: 'todo',
              entity_type: template.default_entity_type || null,
              entity_id: null,
              location: template.default_location || null,
              completed_at: null,
              completed_by: null,
              created_at: '',
              updated_at: '',
              parent_id: null,
            };
            setSelectedTask(newTask);
            setIsFormOpen(true);
          } catch (error) {
            console.error('Error applying template:', error);
            toast.error(t('error_applying_template') || 'Shablon qo\'llashda xatolik');
          }
        }}
      />
    </div>
  );
}
