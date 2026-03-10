import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TaskPriority, TaskStatus } from '@/pages/crm/Tasks';

interface TaskSubtasksProps {
  taskId: string;
}

interface Subtask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
}

const priorityColors = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function TaskSubtasks({ taskId }: TaskSubtasksProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskPriority, setNewSubtaskPriority] = useState<TaskPriority>('medium');
  const [isAdding, setIsAdding] = useState(false);

  // Fetch subtasks
  const { data: subtasks = [], isLoading } = useQuery({
    queryKey: ['subtasks', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, priority, created_at')
        .eq('parent_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Subtask[];
    },
  });

  // Create subtask mutation
  const createSubtaskMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !newSubtaskTitle.trim()) return;
      
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: newSubtaskTitle.trim(),
          parent_id: taskId,
          priority: newSubtaskPriority,
          status: 'todo' as TaskStatus,
          created_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
      queryClient.invalidateQueries({ queryKey: ['subtasks-count', taskId] });
      setNewSubtaskTitle('');
      setIsAdding(false);
      toast.success(t('task_created'));
    },
    onError: () => {
      toast.error(t('error_creating_task'));
    },
  });

  // Toggle subtask status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: TaskStatus }) => {
      const newStatus: TaskStatus = currentStatus === 'done' ? 'todo' : 'done';
      const updates: Record<string, unknown> = { status: newStatus };
      
      if (newStatus === 'done') {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = user?.id;
      } else {
        updates.completed_at = null;
        updates.completed_by = null;
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    },
  });

  // Delete subtask mutation
  const deleteSubtaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
      queryClient.invalidateQueries({ queryKey: ['subtasks-count', taskId] });
      toast.success(t('task_deleted'));
    },
    onError: () => {
      toast.error(t('error_deleting_task'));
    },
  });

  const completedCount = subtasks.filter(s => s.status === 'done').length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header with progress */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {t('subtasks')} ({completedCount}/{subtasks.length})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('add')}
          </Button>
        </div>
        {subtasks.length > 0 && (
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Add new subtask form */}
      {isAdding && (
        <div className="px-6 py-3 border-b bg-muted/30">
          <div className="flex gap-2">
            <Input
              placeholder={t('task_title')}
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                  createSubtaskMutation.mutate();
                }
              }}
              className="flex-1"
              autoFocus
            />
            <Select value={newSubtaskPriority} onValueChange={(v) => setNewSubtaskPriority(v as TaskPriority)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t('low')}</SelectItem>
                <SelectItem value="medium">{t('medium')}</SelectItem>
                <SelectItem value="high">{t('high')}</SelectItem>
                <SelectItem value="urgent">{t('urgent')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => createSubtaskMutation.mutate()}
              disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
            >
              {t('add')}
            </Button>
          </div>
        </div>
      )}

      {/* Subtasks list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : subtasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t('no_tasks')}
            </div>
          ) : (
            subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group",
                  subtask.status === 'done' && "opacity-60"
                )}
              >
                <Checkbox
                  checked={subtask.status === 'done'}
                  onCheckedChange={() => toggleStatusMutation.mutate({ 
                    id: subtask.id, 
                    currentStatus: subtask.status 
                  })}
                />
                <span className={cn(
                  "flex-1 text-sm",
                  subtask.status === 'done' && "line-through text-muted-foreground"
                )}>
                  {subtask.title}
                </span>
                <Badge variant="outline" className={cn("text-xs", priorityColors[subtask.priority])}>
                  {t(subtask.priority)}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
