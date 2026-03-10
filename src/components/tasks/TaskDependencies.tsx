import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/pages/crm/Tasks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Link2, Plus, X, ArrowRight, Loader2 } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';

interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
  created_at: string;
  dependsOnTask?: {
    id: string;
    title: string;
    status: string;
  };
}

interface TaskDependenciesProps {
  taskId: string;
  allTasks: Task[];
}

export function TaskDependencies({ taskId, allTasks }: TaskDependenciesProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');

  const { data: dependencies = [], isLoading } = useQuery({
    queryKey: ['task-dependencies', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_dependencies')
        .select('*')
        .eq('task_id', taskId);
      if (error) throw error;

      // Enrich with task data
      const dependsOnIds = data.map(d => d.depends_on_task_id);
      if (dependsOnIds.length === 0) return [];

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status')
        .in('id', dependsOnIds);

      const tasksMap = Object.fromEntries((tasks || []).map(t => [t.id, t]));

      return data.map(d => ({
        ...d,
        dependsOnTask: tasksMap[d.depends_on_task_id],
      })) as TaskDependency[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (dependsOnTaskId: string) => {
      const { error } = await supabase.from('task_dependencies').insert({
        task_id: taskId,
        depends_on_task_id: dependsOnTaskId,
        dependency_type: 'finish_to_start',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] });
      toast.success(t('dependency_added'));
      setSelectedTaskId('');
    },
    onError: () => {
      toast.error(t('error_adding_dependency'));
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (dependencyId: string) => {
      const { error } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('id', dependencyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] });
      toast.success(t('dependency_removed'));
    },
  });

  // Available tasks to add as dependencies (exclude current task and existing dependencies)
  const availableTasks = allTasks.filter(
    (task) =>
      task.id !== taskId &&
      !dependencies.some((d) => d.depends_on_task_id === task.id)
  );

  const statusColors: Record<string, string> = {
    todo: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
    done: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-medium text-sm">{t('dependencies')}</h4>
      </div>

      {/* Add dependency */}
      <div className="flex items-center gap-2">
        <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={t('select_blocking_task')} />
          </SelectTrigger>
          <SelectContent>
            {availableTasks.map((task) => (
              <SelectItem key={task.id} value={task.id}>
                <div className="flex items-center gap-2">
                  <span className="truncate">{task.title}</span>
                  <Badge variant="secondary" className={`text-xs ${statusColors[task.status]}`}>
                    {t(task.status)}
                  </Badge>
                </div>
              </SelectItem>
            ))}
            {availableTasks.length === 0 && (
              <div className="p-2 text-sm text-muted-foreground text-center">
                {t('no_available_tasks')}
              </div>
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => addMutation.mutate(selectedTaskId)}
          disabled={!selectedTaskId || addMutation.isPending}
        >
          {addMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Dependencies list */}
      {isLoading ? (
        <LoadingSkeleton count={2} compact />
      ) : dependencies.length > 0 ? (
        <div className="space-y-2">
          {dependencies.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">
                  {dep.dependsOnTask?.title || t('unknown_task')}
                </span>
                {dep.dependsOnTask && (
                  <Badge
                    variant="secondary"
                    className={`text-xs shrink-0 ${statusColors[dep.dependsOnTask.status]}`}
                  >
                    {t(dep.dependsOnTask.status)}
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => removeMutation.mutate(dep.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          {t('no_dependencies')}
        </p>
      )}

      {dependencies.some((d) => d.dependsOnTask?.status !== 'done') && (
        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <span>⚠️</span>
          {t('blocking_tasks_pending')}
        </div>
      )}
    </div>
  );
}
