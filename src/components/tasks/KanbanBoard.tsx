import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Task, TaskStatus } from '@/pages/crm/Tasks';
import { TaskCard } from './TaskCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
}

const columns: { id: TaskStatus; color: string; bgColor: string }[] = [
  { id: 'todo', color: 'border-yellow-500', bgColor: 'bg-yellow-500' },
  { id: 'in_progress', color: 'border-blue-500', bgColor: 'bg-blue-500' },
  { id: 'review', color: 'border-purple-500', bgColor: 'bg-purple-500' },
  { id: 'done', color: 'border-green-500', bgColor: 'bg-green-500' },
];

export function KanbanBoard({ tasks, onTaskClick, onStatusChange, onDeleteTask }: KanbanBoardProps) {
  const { t } = useTranslation();
  const { triggerHaptic } = useNativeFeatures();
  const [activeColumn, setActiveColumn] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter(task => task.status === status);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setDraggedTaskId(taskId);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      await triggerHaptic('medium');
      onStatusChange(taskId, status);
    }
    handleDragEnd();
  };

  // Mobile swipe navigation
  const onTouchStart = (e: React.TouchEvent) => {
    if (isDragging) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (isDragging) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = async () => {
    if (isDragging) return;
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && activeColumn < columns.length - 1) {
      await triggerHaptic('light');
      setActiveColumn(prev => prev + 1);
    }
    if (isRightSwipe && activeColumn > 0) {
      await triggerHaptic('light');
      setActiveColumn(prev => prev - 1);
    }
  };

  // Long press for mobile drag
  const handleTaskTouchStart = useCallback((taskId: string) => {
    longPressTimer.current = setTimeout(async () => {
      await triggerHaptic('heavy');
      setDraggedTaskId(taskId);
      setIsDragging(true);
    }, 500);
  }, [triggerHaptic]);

  const handleTaskTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleMobileDropZone = async (status: TaskStatus) => {
    if (isDragging && draggedTaskId) {
      await triggerHaptic('medium');
      onStatusChange(draggedTaskId, status);
      setDraggedTaskId(null);
      setIsDragging(false);
    }
  };

  const goToColumn = async (index: number) => {
    if (index !== activeColumn) {
      await triggerHaptic('light');
    }
    setActiveColumn(index);
  };

  const goToPrev = async () => {
    if (activeColumn > 0) {
      await triggerHaptic('light');
      setActiveColumn(prev => prev - 1);
    }
  };

  const goToNext = async () => {
    if (activeColumn < columns.length - 1) {
      await triggerHaptic('light');
      setActiveColumn(prev => prev + 1);
    }
  };

  // Desktop view - grid layout
  const DesktopView = () => (
    <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-3 h-full min-h-0">
      {columns.map(column => {
        const columnTasks = getTasksByStatus(column.id);
        
        return (
          <div
            key={column.id}
            className={cn(
              "flex flex-col bg-muted/30 rounded-lg border-t-4 min-h-0 overflow-hidden transition-all duration-200",
              column.color,
              isDragging && "ring-2 ring-primary/20"
            )}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="p-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm truncate">{t(column.id)}</h3>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0">
                  {columnTasks.length}
                </span>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-2">
                {columnTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t('no_tasks')}
                  </div>
                ) : (
                  columnTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDelete={() => onDeleteTask(task.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );

  // Mobile view - single column with swipe
  const MobileView = () => {
    const column = columns[activeColumn];
    const columnTasks = getTasksByStatus(column.id);

    return (
      <div className="md:hidden flex flex-col h-full min-h-0">
        {/* Column tabs - compact version */}
        <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-lg mb-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
            onClick={goToPrev}
            disabled={activeColumn === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 flex justify-center gap-1">
            {columns.map((col, index) => (
              <button
                key={col.id}
                onClick={() => goToColumn(index)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all active:scale-95",
                  activeColumn === index
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", col.bgColor)} />
                <span className="text-muted-foreground text-xs">
                  {getTasksByStatus(col.id).length}
                </span>
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
            onClick={goToNext}
            disabled={activeColumn === columns.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile drop zones when dragging */}
        {isDragging && (
          <div className="grid grid-cols-4 gap-1 mb-3 shrink-0">
            {columns.map((col) => (
              <button
                key={col.id}
                onClick={() => handleMobileDropZone(col.id)}
                className={cn(
                  "py-2 px-1 rounded-lg text-xs font-medium transition-all border-2 border-dashed",
                  "flex flex-col items-center gap-1",
                  col.color.replace('border-', 'border-'),
                  "bg-muted/50 active:bg-muted"
                )}
              >
                <span className={cn("w-3 h-3 rounded-full", col.bgColor)} />
                <span className="text-muted-foreground truncate text-[10px]">
                  {t(col.id)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Swipeable column content */}
        <div
          ref={containerRef}
          className={cn(
            "flex-1 flex flex-col bg-muted/30 rounded-lg border-t-4 min-h-0 overflow-hidden",
            "transition-all duration-300 ease-out",
            column.color,
            isDragging && "opacity-50"
          )}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <div className="p-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{t(column.id)}</h3>
              <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {columnTasks.length}
              </span>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-2">
              {columnTasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">{t('no_tasks')}</p>
                  <p className="text-xs mt-1 opacity-70">← {t('swipe_to_navigate')} →</p>
                </div>
              ) : (
                columnTasks.map(task => (
                  <div
                    key={task.id}
                    onTouchStart={() => handleTaskTouchStart(task.id)}
                    onTouchEnd={handleTaskTouchEnd}
                    onTouchCancel={handleTaskTouchEnd}
                    className={cn(
                      "transition-all duration-200",
                      draggedTaskId === task.id && "scale-105 opacity-70 rotate-2"
                    )}
                  >
                    <TaskCard
                      task={task}
                      onClick={() => !isDragging && onTaskClick(task)}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDelete={() => onDeleteTask(task.id)}
                    />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Swipe indicator dots */}
        <div className="flex justify-center gap-2 pt-3 shrink-0">
          {columns.map((col, index) => (
            <button
              key={col.id}
              onClick={() => goToColumn(index)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                activeColumn === index
                  ? cn("w-6", col.bgColor)
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50 active:scale-110"
              )}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full min-h-0">
      <DesktopView />
      <MobileView />
    </div>
  );
}