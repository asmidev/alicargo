import { useTranslation } from 'react-i18next';
import { Task } from '@/pages/crm/Tasks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Calendar, 
  MoreVertical, 
  Trash2, 
  Flag, 
  MapPin,
  Package,
  Box,
  Truck,
  AlertTriangle
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDelete: () => void;
}

const priorityConfig = {
  low: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: null },
  medium: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: null },
  high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: Flag },
  urgent: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: AlertTriangle },
};

const entityIcons: Record<string, typeof Package> = {
  product: Package,
  box: Box,
  shipment: Truck,
  claim: AlertTriangle,
};

export function TaskCard({ task, onClick, onDragStart, onDragEnd, onDelete }: TaskCardProps) {
  const { t } = useTranslation();
  const priority = priorityConfig[task.priority];
  const PriorityIcon = priority.icon;
  const EntityIcon = task.entity_type ? entityIcons[task.entity_type] : null;

  const isDueSoon = task.due_date && (isToday(new Date(task.due_date)) || isPast(new Date(task.due_date)));
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-pointer hover:shadow-md transition-all duration-200 group",
        "border-l-4",
        task.priority === 'urgent' && "border-l-red-500",
        task.priority === 'high' && "border-l-orange-500",
        task.priority === 'medium' && "border-l-blue-500",
        task.priority === 'low' && "border-l-slate-300",
        isOverdue && "bg-red-50/50 dark:bg-red-950/20"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header with title and menu */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2 flex-1">{task.title}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className={cn("text-xs", priority.color)}>
            {PriorityIcon && <PriorityIcon className="h-3 w-3 mr-1" />}
            {t(task.priority)}
          </Badge>

          {task.location && (
            <Badge variant="outline" className="text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              {t(task.location)}
            </Badge>
          )}

          {task.entity_type && EntityIcon && (
            <Badge variant="outline" className="text-xs">
              <EntityIcon className="h-3 w-3 mr-1" />
              {t(task.entity_type)}
            </Badge>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          {/* Due date */}
          {task.due_date && (
            <div className={cn(
              "flex items-center gap-1 text-xs",
              isOverdue ? "text-red-600 dark:text-red-400" : 
              isDueSoon ? "text-orange-600 dark:text-orange-400" : 
              "text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date), 'MMM d')}
            </div>
          )}

          {/* Assignee */}
          {task.assignee && (
            <Avatar className="h-6 w-6">
              <AvatarImage src={task.assignee.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(task.assignee.full_name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
