import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Task, TaskStatus } from '@/pages/crm/Tasks';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  Trash2, 
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Flag,
  AlertTriangle,
  Check,
  MapPin,
  Calendar
} from 'lucide-react';
import { format, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { Card, CardContent } from '@/components/ui/card';

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

const statusConfig: Record<TaskStatus, { icon: typeof Circle; color: string; bgColor: string }> = {
  todo: { icon: Circle, color: 'text-yellow-500', bgColor: 'bg-yellow-500' },
  in_progress: { icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-500' },
  review: { icon: Eye, color: 'text-purple-500', bgColor: 'bg-purple-500' },
  done: { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500' },
  cancelled: { icon: Circle, color: 'text-muted-foreground', bgColor: 'bg-muted-foreground' },
};

const priorityConfig = {
  low: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', borderColor: 'border-l-slate-400' },
  medium: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', borderColor: 'border-l-blue-500' },
  high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', borderColor: 'border-l-orange-500' },
  urgent: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', borderColor: 'border-l-red-500' },
};

export function TaskListView({ 
  tasks, 
  onTaskClick, 
  onStatusChange, 
  onDeleteTask,
  selectedIds = [],
  onSelectionChange,
}: TaskListViewProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { triggerHaptic } = useNativeFeatures();
  
  // Swipe state
  const [swipingTaskId, setSwipingTaskId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleToggleComplete = async (task: Task, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await triggerHaptic('medium');
    if (task.status === 'done') {
      onStatusChange(task.id, 'todo');
    } else {
      onStatusChange(task.id, 'done');
    }
  };

  const handleSelectTask = (taskId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, taskId]);
    } else {
      onSelectionChange(selectedIds.filter(id => id !== taskId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(tasks.map(t => t.id));
    } else {
      onSelectionChange([]);
    }
  };

  // Mobile swipe handlers
  const handleTouchStart = useCallback((taskId: string, e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setSwipingTaskId(taskId);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipingTaskId) return;
    
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    
    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
    }
    
    if (isHorizontalSwipe.current) {
      // Only allow left swipe (negative)
      const newOffset = Math.min(0, Math.max(-100, deltaX));
      setSwipeOffset(newOffset);
    }
  }, [swipingTaskId]);

  const handleTouchEnd = useCallback(async () => {
    if (!swipingTaskId) return;
    
    const task = tasks.find(t => t.id === swipingTaskId);
    
    // If swiped more than 60px, complete the task
    if (swipeOffset < -60 && task) {
      await triggerHaptic('heavy');
      handleToggleComplete(task);
    }
    
    setSwipingTaskId(null);
    setSwipeOffset(0);
    isHorizontalSwipe.current = null;
  }, [swipingTaskId, swipeOffset, tasks, triggerHaptic]);

  const allSelected = tasks.length > 0 && selectedIds.length === tasks.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < tasks.length;

  // Mobile card view
  if (isMobile) {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-2 p-1">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">{t('no_tasks')}</p>
            </div>
          ) : (
            tasks.map(task => {
              const status = statusConfig[task.status];
              const StatusIcon = status.icon;
              const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
              const isSelected = selectedIds.includes(task.id);
              const isSwiping = swipingTaskId === task.id;
              const swipeProgress = Math.min(1, Math.abs(swipeOffset) / 60);

              return (
                <div
                  key={task.id}
                  className="relative overflow-hidden rounded-lg"
                >
                  {/* Swipe action background */}
                  <div
                    className={cn(
                      "absolute inset-y-0 right-0 flex items-center justify-end px-4 transition-colors",
                      swipeProgress > 0.8 ? "bg-green-500" : "bg-green-500/70"
                    )}
                    style={{ width: Math.abs(swipeOffset) + 20 }}
                  >
                    <Check className="h-5 w-5 text-white" />
                  </div>

                  {/* Card content */}
                  <Card
                    className={cn(
                      "border-l-4 transition-all duration-200 cursor-pointer active:scale-[0.99]",
                      priorityConfig[task.priority].borderColor,
                      task.status === 'done' && "opacity-60",
                      isSelected && "bg-primary/5 ring-1 ring-primary/20",
                      isOverdue && "bg-red-50/50 dark:bg-red-950/20"
                    )}
                    style={{
                      transform: isSwiping ? `translateX(${swipeOffset}px)` : 'translateX(0)',
                      transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
                    }}
                    onClick={() => onTaskClick(task)}
                    onTouchStart={(e) => handleTouchStart(task.id, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div 
                          className="pt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={onSelectionChange ? isSelected : task.status === 'done'}
                            onCheckedChange={(checked) => 
                              onSelectionChange 
                                ? handleSelectTask(task.id, checked as boolean)
                                : handleToggleComplete(task)
                            }
                            className="h-5 w-5"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <h4 className={cn(
                            "font-medium text-sm",
                            task.status === 'done' && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </h4>

                          {/* Description */}
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {task.description}
                            </p>
                          )}

                          {/* Meta info */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {/* Status */}
                            <div className={cn("flex items-center gap-1", status.color)}>
                              <StatusIcon className="h-3 w-3" />
                              <span className="text-xs">{t(task.status)}</span>
                            </div>

                            {/* Priority */}
                            <Badge variant="outline" className={cn("text-xs px-1.5 py-0", priorityConfig[task.priority].color)}>
                              {task.priority === 'urgent' && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                              {task.priority === 'high' && <Flag className="h-2.5 w-2.5 mr-0.5" />}
                              {t(task.priority)}
                            </Badge>

                            {/* Location */}
                            {task.location && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {t(task.location)}
                              </span>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between mt-2">
                            {/* Due date */}
                            {task.due_date ? (
                              <span className={cn(
                                "text-xs flex items-center gap-1",
                                isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
                              )}>
                                <Calendar className="h-3 w-3" />
                                {format(new Date(task.due_date), 'MMM d')}
                              </span>
                            ) : (
                              <span />
                            )}

                            {/* Assignee */}
                            {task.assignee && (
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={task.assignee.avatar_url || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(task.assignee.full_name)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    );
  }

  // Desktop table view
  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              {onSelectionChange && (
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) (el as any).indeterminate = someSelected;
                  }}
                  onCheckedChange={handleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </TableHead>
            <TableHead>{t('task_title')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('status')}</TableHead>
            <TableHead className="hidden sm:table-cell">{t('priority')}</TableHead>
            <TableHead className="hidden lg:table-cell">{t('assignee')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('due_date')}</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {t('no_tasks')}
              </TableCell>
            </TableRow>
          ) : (
            tasks.map(task => {
              const status = statusConfig[task.status];
              const StatusIcon = status.icon;
              const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
              const isSelected = selectedIds.includes(task.id);

              return (
                <TableRow
                  key={task.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50",
                    task.status === 'done' && "opacity-60",
                    isSelected && "bg-primary/5"
                  )}
                  onClick={() => onTaskClick(task)}
                >
                  <TableCell>
                    {onSelectionChange ? (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <Checkbox
                        checked={task.status === 'done'}
                        onClick={(e) => handleToggleComplete(task, e as unknown as React.MouseEvent)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className={cn(
                        "font-medium",
                        task.status === 'done' && "line-through"
                      )}>
                        {task.title}
                      </span>
                      {task.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {task.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className={cn("h-4 w-4", status.color)} />
                      <span className="text-sm">{t(task.status)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className={cn("text-xs", priorityConfig[task.priority].color)}>
                      {task.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {task.priority === 'high' && <Flag className="h-3 w-3 mr-1" />}
                      {t(task.priority)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={task.assignee.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(task.assignee.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{task.assignee.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">{t('unassigned')}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {task.due_date ? (
                      <span className={cn(
                        "text-sm",
                        isOverdue && "text-red-600 dark:text-red-400 font-medium"
                      )}>
                        {format(new Date(task.due_date), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, 'todo'); }}>
                          <Circle className="h-4 w-4 mr-2 text-yellow-500" />
                          {t('todo')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, 'in_progress'); }}>
                          <Clock className="h-4 w-4 mr-2 text-blue-500" />
                          {t('in_progress')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, 'review'); }}>
                          <Eye className="h-4 w-4 mr-2 text-purple-500" />
                          {t('review')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, 'done'); }}>
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          {t('done')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}