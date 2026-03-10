import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { CheckCircle2, Circle, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileTaskCard } from './MobileTaskCard';
import { SwipeableRow } from '@/components/mobile/lists/SwipeableRow';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import type { Task, TaskStatus } from '@/pages/crm/Tasks';

interface MobileKanbanViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
}

const columns: { id: TaskStatus; label: string; icon: typeof Circle; color: string }[] = [
  { id: 'todo', label: 'Qilish kerak', icon: Circle, color: 'text-yellow-500' },
  { id: 'in_progress', label: 'Jarayonda', icon: Clock, color: 'text-blue-500' },
  { id: 'review', label: "Ko'rib chiqish", icon: AlertCircle, color: 'text-purple-500' },
  { id: 'done', label: 'Bajarildi', icon: CheckCircle2, color: 'text-green-500' },
];

export function MobileKanbanView({ tasks, onTaskClick, onStatusChange, onDeleteTask }: MobileKanbanViewProps) {
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const { triggerHaptic } = useNativeFeatures();
  
  const activeColumn = columns[activeColumnIndex];
  const columnTasks = useMemo(() => 
    tasks.filter(t => t.status === activeColumn.id),
    [tasks, activeColumn.id]
  );

  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    await triggerHaptic('light');
    if (direction === 'left' && activeColumnIndex < columns.length - 1) {
      setActiveColumnIndex(prev => prev + 1);
    } else if (direction === 'right' && activeColumnIndex > 0) {
      setActiveColumnIndex(prev => prev - 1);
    }
  }, [activeColumnIndex, triggerHaptic]);

  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (Math.abs(info.offset.x) > threshold) {
      handleSwipe(info.offset.x > 0 ? 'right' : 'left');
    }
  }, [handleSwipe]);

  const getNextStatus = (current: TaskStatus): TaskStatus => {
    const order: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
    const currentIndex = order.indexOf(current);
    return order[Math.min(currentIndex + 1, order.length - 1)];
  };

  const handleTaskComplete = async (task: Task) => {
    await triggerHaptic('success');
    const nextStatus = getNextStatus(task.status);
    onStatusChange(task.id, nextStatus);
  };

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Column tabs - horizontally scrollable */}
      <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        {columns.map((col, index) => {
          const Icon = col.icon;
          const count = tasks.filter(t => t.status === col.id).length;
          const isActive = index === activeColumnIndex;
          
          return (
            <button
              key={col.id}
              onClick={() => {
                triggerHaptic('light');
                setActiveColumnIndex(index);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium shrink-0 transition-all",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{col.label}</span>
              <span className={cn(
                "min-w-[20px] h-5 rounded-full text-xs flex items-center justify-center",
                isActive ? "bg-primary-foreground/20" : "bg-background"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Swipe navigation hints */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          {activeColumnIndex > 0 && (
            <>
              <ChevronLeft className="h-3 w-3" />
              <span>{columns[activeColumnIndex - 1].label}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeColumnIndex < columns.length - 1 && (
            <>
              <span>{columns[activeColumnIndex + 1].label}</span>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
        </div>
      </div>

      {/* Task list with swipe gestures */}
      <motion.div 
        className="flex-1 overflow-y-auto px-4 pb-20"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
      >
        <AnimatePresence mode="popLayout">
          {columnTasks.length > 0 ? (
            <div className="space-y-3 py-2">
              {columnTasks.map((task) => (
                <SwipeableRow
                  key={task.id}
                  leftActions={[
                    {
                      icon: CheckCircle2,
                      label: 'Bajarish',
                      color: 'bg-green-500',
                      onClick: () => handleTaskComplete(task),
                    }
                  ]}
                  rightActions={[
                    {
                      icon: AlertCircle,
                      label: "O'chirish",
                      color: 'bg-red-500',
                      onClick: () => onDeleteTask(task.id),
                    }
                  ]}
                >
                  <MobileTaskCard
                    task={task}
                    onTap={() => onTaskClick(task)}
                  />
                </SwipeableRow>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className={cn("p-4 rounded-full bg-muted mb-3", activeColumn.color)}>
                <activeColumn.icon className="h-8 w-8" />
              </div>
              <p className="text-muted-foreground">Bu ustunda vazifa yo'q</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Vazifalarni shu yerga sudrab olib keling
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
