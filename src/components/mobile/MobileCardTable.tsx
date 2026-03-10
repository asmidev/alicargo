import { ReactNode, useState, useRef } from 'react';
import { ChevronRight, ChevronDown, Edit, Trash2, Eye, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { Button } from '@/components/ui/button';

interface SwipeAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'warning';
}

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
  mobileHidden?: boolean;
  mobilePrimary?: boolean;
  mobileSecondary?: boolean;
}

interface MobileCardTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
  actions?: (item: T) => SwipeAction[];
  emptyMessage?: string;
  className?: string;
  expandable?: boolean;
}

export function MobileCardTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  onEdit,
  onDelete,
  onView,
  actions,
  emptyMessage = "Ma'lumot topilmadi",
  className,
  expandable = false,
}: MobileCardTableProps<T>) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [swipedItem, setSwipedItem] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const { triggerHaptic } = useNativeFeatures();
  
  const primaryColumn = columns.find(c => c.mobilePrimary) || columns[0];
  const secondaryColumns = columns.filter(c => c.mobileSecondary);
  const detailColumns = columns.filter(c => !c.mobilePrimary && !c.mobileSecondary && !c.mobileHidden);

  const getValue = (item: T, column: Column<T>): ReactNode => {
    if (column.render) {
      return column.render(item);
    }
    const value = item[column.key as keyof T];
    return value != null ? String(value) : '-';
  };

  const toggleExpand = (id: string) => {
    triggerHaptic('light');
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, id: string) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    
    if (diff > 50 && !swipedItem) {
      triggerHaptic('light');
      setSwipedItem(id);
    } else if (diff < -50 && swipedItem === id) {
      setSwipedItem(null);
    }
  };

  const handleTouchEnd = () => {
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  };

  const getDefaultActions = (item: T): SwipeAction[] => {
    const defaultActions: SwipeAction[] = [];
    if (onView) {
      defaultActions.push({ icon: Eye, label: 'Ko\'rish', onClick: () => onView(item), variant: 'default' });
    }
    if (onEdit) {
      defaultActions.push({ icon: Edit, label: 'Tahrirlash', onClick: () => onEdit(item), variant: 'default' });
    }
    if (onDelete) {
      defaultActions.push({ icon: Trash2, label: 'O\'chirish', onClick: () => onDelete(item), variant: 'destructive' });
    }
    return defaultActions;
  };

  const hasActions = onEdit || onDelete || onView || actions;

  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-12 text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {data.map((item) => {
        const itemId = keyExtractor(item);
        const isExpanded = expandedItems.has(itemId);
        const isSwiped = swipedItem === itemId;
        const itemActions = actions ? actions(item) : getDefaultActions(item);

        return (
          <div
            key={itemId}
            className="relative overflow-hidden rounded-xl"
          >
            {/* Swipe actions background */}
            {hasActions && (
              <div className={cn(
                "absolute right-0 top-0 bottom-0 flex items-center gap-1 px-2 bg-card transition-opacity",
                isSwiped ? "opacity-100" : "opacity-0 pointer-events-none"
              )}>
                {itemActions.map((action, idx) => (
                  <Button
                    key={idx}
                    size="icon"
                    variant={action.variant === 'destructive' ? 'destructive' : 'secondary'}
                    className="h-10 w-10 touch-target"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('medium');
                      action.onClick();
                      setSwipedItem(null);
                    }}
                  >
                    <action.icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            )}

            {/* Main card content */}
            <div
              onTouchStart={hasActions ? (e) => handleTouchStart(e, itemId) : undefined}
              onTouchMove={hasActions ? (e) => handleTouchMove(e, itemId) : undefined}
              onTouchEnd={hasActions ? handleTouchEnd : undefined}
              onClick={() => {
                if (isSwiped) {
                  setSwipedItem(null);
                } else if (expandable && detailColumns.length > 0) {
                  toggleExpand(itemId);
                } else if (onRowClick) {
                  onRowClick(item);
                }
              }}
              className={cn(
                "mobile-card relative bg-card transition-transform touch-manipulation",
                (onRowClick || expandable) && "cursor-pointer active:scale-[0.98]",
                isSwiped && "-translate-x-28"
              )}
              style={{
                transition: 'transform 0.2s ease-out'
              }}
            >
              {/* Primary row */}
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-foreground truncate flex-1">
                  {getValue(item, primaryColumn)}
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  {hasActions && !isSwiped && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('light');
                        setSwipedItem(isSwiped ? null : itemId);
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  )}
                  {expandable && detailColumns.length > 0 ? (
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )} />
                  ) : onRowClick && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Secondary info */}
              {secondaryColumns.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                  {secondaryColumns.map((column) => (
                    <div key={String(column.key)} className="text-sm text-muted-foreground">
                      <span className="text-xs opacity-70">{column.header}: </span>
                      <span>{getValue(item, column)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Expandable detail fields */}
              {(!expandable || isExpanded) && detailColumns.length > 0 && (
                <div className={cn(
                  "grid grid-cols-2 gap-2 pt-2 border-t border-border/50",
                  expandable && "animate-in"
                )}>
                  {detailColumns.slice(0, expandable ? undefined : 4).map((column) => (
                    <div key={String(column.key)} className="text-xs">
                      <div className="text-muted-foreground/70 mb-0.5">{column.header}</div>
                      <div className="text-foreground truncate">{getValue(item, column)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
