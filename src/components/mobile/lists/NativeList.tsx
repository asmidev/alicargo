import { ReactNode, useState, useCallback, useRef, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Check } from 'lucide-react';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface NativeListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isSelected: boolean) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  sectionHeader?: (item: T, index: number) => string | null;
  isLoading?: boolean;
  loadingCount?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  selectionMode?: boolean;
  selectedItems?: Set<string>;
  onSelectionChange?: (selectedItems: Set<string>) => void;
  emptyState?: ReactNode;
  className?: string;
  itemClassName?: string;
  stickyHeaders?: boolean;
}

export function NativeList<T>({
  items,
  renderItem,
  keyExtractor,
  sectionHeader,
  isLoading = false,
  loadingCount = 5,
  onLoadMore,
  hasMore = false,
  selectionMode = false,
  selectedItems = new Set(),
  onSelectionChange,
  emptyState,
  className,
  itemClassName,
  stickyHeaders = true,
}: NativeListProps<T>) {
  const { triggerHaptic } = useNativeFeatures();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Infinite scroll observer
  const lastItemRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || loadingMore) return;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!hasMore || !onLoadMore) return;

    observerRef.current = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        setLoadingMore(true);
        await onLoadMore();
        setLoadingMore(false);
      }
    }, { threshold: 0.5 });

    if (node) {
      observerRef.current.observe(node);
    }
  }, [isLoading, loadingMore, hasMore, onLoadMore]);

  const handleItemPress = async (key: string) => {
    if (!selectionMode || !onSelectionChange) return;
    
    await triggerHaptic('light');
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    onSelectionChange(newSelected);
  };

  const handleItemLongPress = async (key: string) => {
    if (!onSelectionChange) return;
    
    await triggerHaptic('medium');
    const newSelected = new Set(selectedItems);
    newSelected.add(key);
    onSelectionChange(newSelected);
  };

  // Group items by section
  const groupedItems = items.reduce<{ header: string | null; items: { item: T; index: number }[] }[]>((acc, item, index) => {
    const header = sectionHeader ? sectionHeader(item, index) : null;
    const lastGroup = acc[acc.length - 1];
    
    if (!lastGroup || lastGroup.header !== header) {
      acc.push({ header, items: [{ item, index }] });
    } else {
      lastGroup.items.push({ item, index });
    }
    
    return acc;
  }, []);

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: loadingCount }).map((_, i) => (
          <div key={i} className="p-4 bg-card rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn("space-y-0", className)}>
      {groupedItems.map((group, groupIndex) => (
        <div key={groupIndex}>
          {/* Section header */}
          {group.header && (
            <div
              className={cn(
                "px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50",
                stickyHeaders && "sticky top-0 z-10 backdrop-blur-sm"
              )}
            >
              {group.header}
            </div>
          )}

          {/* Items */}
          <div className="divide-y divide-border/50">
            {group.items.map(({ item, index }, itemIndex) => {
              const key = keyExtractor(item, index);
              const isSelected = selectedItems.has(key);
              const isLast = groupIndex === groupedItems.length - 1 && itemIndex === group.items.length - 1;

              return (
                <motion.div
                  key={key}
                  ref={isLast ? lastItemRef : undefined}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  onClick={selectionMode ? () => handleItemPress(key) : undefined}
                  className={cn(
                    "relative",
                    selectionMode && "cursor-pointer active:bg-muted/50",
                    itemClassName
                  )}
                >
                  {/* Selection indicator */}
                  <AnimatePresence>
                    {selectionMode && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-10"
                      >
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                            isSelected 
                              ? "bg-primary border-primary" 
                              : "border-muted-foreground/50 bg-background"
                          )}
                        >
                          {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className={cn(selectionMode && "pl-12")}>
                    {renderItem(item, index, isSelected)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Load more indicator */}
      {loadingMore && (
        <div className="p-4 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
