import { useMemo, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '@/pages/crm/Tasks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  getDay,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TaskCalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function TaskCalendarView({ tasks, onTaskClick }: TaskCalendarViewProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { triggerHaptic } = useNativeFeatures();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  // Swipe state for mobile week view
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // For mobile: week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // For desktop: month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOffset = getDay(monthStart);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      if (task.due_date) {
        const dateKey = format(parseISO(task.due_date), 'yyyy-MM-dd');
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(task);
      }
    });
    return grouped;
  }, [tasks]);

  const selectedDayTasks = selectedDate
    ? tasksByDate[format(selectedDate, 'yyyy-MM-dd')] || []
    : [];

  const priorityColors: Record<string, string> = {
    low: 'bg-gray-400',
    medium: 'bg-blue-500',
    high: 'bg-orange-500',
    urgent: 'bg-red-500',
  };

  const statusColors: Record<string, string> = {
    todo: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
    done: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200',
  };

  const weekDayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleDateSelect = async (day: Date) => {
    await triggerHaptic('light');
    setSelectedDate(day);
    if (isMobile) {
      setSheetOpen(true);
    }
  };

  const handlePrevious = async () => {
    await triggerHaptic('light');
    if (isMobile) {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = async () => {
    await triggerHaptic('light');
    if (isMobile) {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  // Swipe handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(async () => {
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      // Swipe left - next week
      await triggerHaptic('light');
      setCurrentDate(addWeeks(currentDate, 1));
    } else if (distance < -minSwipeDistance) {
      // Swipe right - previous week
      await triggerHaptic('light');
      setCurrentDate(subWeeks(currentDate, 1));
    }
  }, [currentDate, triggerHaptic]);

  // Mobile week view
  const MobileView = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 active:scale-95 transition-transform"
          onClick={handlePrevious}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h3 className="font-semibold">{format(currentDate, 'MMMM yyyy')}</h3>
          <p className="text-xs text-muted-foreground">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 active:scale-95 transition-transform"
          onClick={handleNext}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Week grid - swipeable */}
      <div
        className="grid grid-cols-7 gap-1 mb-4 shrink-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {weekDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateKey] || [];
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasUrgent = dayTasks.some(t => t.priority === 'urgent');
          const hasHigh = dayTasks.some(t => t.priority === 'high');

          return (
            <button
              key={dateKey}
              onClick={() => handleDateSelect(day)}
              className={cn(
                "flex flex-col items-center py-2 px-1 rounded-xl transition-all active:scale-95",
                isToday(day) && "bg-primary/10",
                isSelected && "bg-primary text-primary-foreground"
              )}
            >
              <span className="text-[10px] text-muted-foreground uppercase">
                {weekDayNames[getDay(day)]}
              </span>
              <span className={cn(
                "text-lg font-semibold",
                isToday(day) && !isSelected && "text-primary",
                isSelected && "text-primary-foreground"
              )}>
                {format(day, 'd')}
              </span>
              
              {/* Task indicators */}
              {dayTasks.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {hasUrgent && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  {hasHigh && !hasUrgent && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                  {!hasUrgent && !hasHigh && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  {dayTasks.length > 1 && (
                    <span className={cn(
                      "text-[8px]",
                      isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      +{dayTasks.length - 1}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Today's tasks preview */}
      <Card className="flex-1 overflow-hidden">
        <CardHeader className="py-3 px-4 border-b shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : t('today')}
            {selectedDayTasks.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedDayTasks.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1">
          <CardContent className="p-3">
            {selectedDate ? (
              selectedDayTasks.length > 0 ? (
                <div className="space-y-2">
                  {selectedDayTasks.slice(0, 5).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors active:scale-[0.98]"
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full mt-1.5 shrink-0',
                            priorityColors[task.priority]
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{task.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="secondary"
                              className={cn('text-xs', statusColors[task.status])}
                            >
                              {t(task.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  {selectedDayTasks.length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full text-xs"
                      onClick={() => setSheetOpen(true)}
                    >
                      {t('view_all')} ({selectedDayTasks.length})
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">{t('no_tasks_for_date')}</p>
                </div>
              )
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('select_date')}</p>
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Day detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[70vh]">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full py-4">
            {selectedDayTasks.length > 0 ? (
              <div className="space-y-3">
                {selectedDayTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      onTaskClick(task);
                      setSheetOpen(false);
                    }}
                    className="w-full text-left p-4 rounded-xl border hover:bg-muted/50 transition-colors active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full mt-1 shrink-0',
                          priorityColors[task.priority]
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-base">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {task.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge
                            variant="secondary"
                            className={cn('text-xs', statusColors[task.status])}
                          >
                            {t(task.status)}
                          </Badge>
                          {task.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {t(task.location)}
                            </span>
                          )}
                          {task.assignee && (
                            <div className="flex items-center gap-1">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={task.assignee.avatar_url || undefined} />
                                <AvatarFallback className="text-[8px]">
                                  {getInitials(task.assignee.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground">
                                {task.assignee.full_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <p>{t('no_tasks_for_date')}</p>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );

  // Desktop month view
  const DesktopView = () => (
    <div className="flex gap-4 h-full">
      {/* Calendar Grid */}
      <Card className="flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">
              {format(currentDate, 'MMMM yyyy')}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Week days header */}
          <div className="grid grid-cols-7 mb-2">
            {weekDayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Day cells */}
            {monthDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDate[dateKey] || [];
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={dateKey}
                  onClick={() => handleDateSelect(day)}
                  className={cn(
                    'aspect-square p-1 rounded-lg border transition-all relative',
                    'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50',
                    isToday(day) && 'border-primary',
                    isSelected && 'bg-primary/10 border-primary',
                    !isSameMonth(day, currentDate) && 'opacity-50'
                  )}
                >
                  <span
                    className={cn(
                      'text-sm',
                      isToday(day) && 'font-bold text-primary'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  
                  {/* Task indicators */}
                  {dayTasks.length > 0 && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayTasks.slice(0, 3).map((task, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            priorityColors[task.priority]
                          )}
                        />
                      ))}
                      {dayTasks.length > 3 && (
                        <span className="text-[8px] text-muted-foreground">
                          +{dayTasks.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Tasks */}
      <Card className="w-80 shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : t('select_date')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {selectedDate ? (
              selectedDayTasks.length > 0 ? (
                <div className="space-y-2 p-4">
                  {selectedDayTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full mt-1.5 shrink-0',
                            priorityColors[task.priority]
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{task.title}</h4>
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant="secondary"
                              className={cn('text-xs', statusColors[task.status])}
                            >
                              {t(task.status)}
                            </Badge>
                            {task.assignee?.full_name && (
                              <span className="text-xs text-muted-foreground">
                                {task.assignee.full_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">{t('no_tasks_for_date')}</p>
                </div>
              )
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('click_date_to_view_tasks')}</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  return isMobile ? <MobileView /> : <DesktopView />;
}