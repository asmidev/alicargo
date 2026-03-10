import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ChevronDown, CheckSquare, Trash2, Play, Pause, Flag, MapPin, Loader2 } from 'lucide-react';
import { TaskStatus, TaskPriority } from '@/pages/crm/Tasks';

interface TaskBulkActionsProps {
  selectedIds: string[];
  onClear: () => void;
}

export function TaskBulkActions({ selectedIds, onClear }: TaskBulkActionsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (updates: { status?: TaskStatus; priority?: TaskPriority; location?: string }) => {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .in('id', selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(t('tasks_updated', { count: selectedIds.length }));
      onClear();
    },
    onError: () => {
      toast.error(t('error_updating_tasks'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(t('tasks_deleted', { count: selectedIds.length }));
      onClear();
      setShowDeleteDialog(false);
    },
    onError: () => {
      toast.error(t('error_deleting_tasks'));
    },
  });

  const isLoading = updateMutation.isPending || deleteMutation.isPending;

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg border border-primary/20">
        <CheckSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {t('selected_count', { count: selectedIds.length })}
        </span>

        <div className="flex items-center gap-1 ml-2">
          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                {t('status')}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ status: 'todo' })}>
                {t('todo')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ status: 'in_progress' })}>
                {t('in_progress')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ status: 'review' })}>
                {t('review')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ status: 'done' })}>
                {t('done')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => updateMutation.mutate({ status: 'cancelled' })}>
                {t('cancelled')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={isLoading}>
                <Flag className="h-4 w-4 mr-1" />
                {t('priority')}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ priority: 'low' })}>
                {t('low')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ priority: 'medium' })}>
                {t('medium')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ priority: 'high' })}>
                {t('high')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ priority: 'urgent' })}>
                {t('urgent')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Location dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={isLoading}>
                <MapPin className="h-4 w-4 mr-1" />
                {t('location')}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ location: 'china' })}>
                {t('china')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ location: 'uzbekistan' })}>
                {t('uzbekistan')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Delete button */}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t('delete')}
          </Button>

          {/* Clear selection */}
          <Button size="sm" variant="ghost" onClick={onClear}>
            {t('clear')}
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_tasks_confirmation', { count: selectedIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
