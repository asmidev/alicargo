import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, AlertCircle, User, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import type { Task, TaskStatus, TaskPriority } from '@/pages/crm/Tasks';

interface MobileTaskCardProps {
  task: Task;
  onTap: () => void;
  onSwipeComplete?: () => void;
  isSelected?: boolean;
}

const statusConfig: Record<TaskStatus, { icon: typeof Circle; color: string; bg: string }> = {
  todo: { icon: Circle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  in_progress: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  review: { icon: AlertCircle, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  done: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
  cancelled: { icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted' },
};

const priorityConfig: Record<TaskPriority, { color: string; border: string; label: string }> = {
  low: { color: 'text-slate-500', border: 'border-l-slate-400', label: 'Past' },
  medium: { color: 'text-blue-500', border: 'border-l-blue-500', label: "O'rta" },
  high: { color: 'text-orange-500', border: 'border-l-orange-500', label: 'Yuqori' },
  urgent: { color: 'text-red-500', border: 'border-l-red-500', label: 'Shoshilinch' },
};

export function MobileTaskCard({ task, onTap, onSwipeComplete, isSelected }: MobileTaskCardProps) {
  const StatusIcon = statusConfig[task.status]?.icon || Circle;
  const statusColors = statusConfig[task.status] || statusConfig.todo;
  const priorityColors = priorityConfig[task.priority] || priorityConfig.medium;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isToday(date)) return 'Bugun';
    if (isTomorrow(date)) return 'Ertaga';
    if (isPast(date)) return format(date, 'dd.MM');
    return format(date, 'dd.MM');
  };

  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className={cn(
        "relative bg-card rounded-xl p-4 border-l-4 transition-all active:bg-muted/50",
        priorityColors.border,
        isSelected && "ring-2 ring-primary bg-primary/5",
        isOverdue && "bg-red-50/50 dark:bg-red-950/20"
      )}
    >
      {/* Top row: Status icon + Title */}
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg shrink-0", statusColors.bg)}>
          <StatusIcon className={cn("h-4 w-4", statusColors.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "font-medium text-sm line-clamp-2",
            task.status === 'done' && "line-through text-muted-foreground"
          )}>
            {task.title}
          </h3>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Bottom row: Meta info */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          {/* Assignee */}
          {task.assignee ? (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={task.assignee.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {getInitials(task.assignee.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                {task.assignee.full_name?.split(' ')[0]}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="text-xs">Tayinlanmagan</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Due date */}
          {task.due_date && (
            <div className={cn(
              "flex items-center gap-1 text-xs",
              isOverdue ? "text-red-500" : "text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              <span>{formatDueDate(task.due_date)}</span>
            </div>
          )}
          
          {/* Priority badge */}
          <Badge 
            variant="outline" 
            className={cn("text-[10px] px-1.5 py-0", priorityColors.color)}
          >
            {priorityColors.label}
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}
