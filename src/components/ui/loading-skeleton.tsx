import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  count?: number;
  compact?: boolean;
  className?: string;
}

export function LoadingSkeleton({ count = 5, compact = false, className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card 
          key={i} 
          className={cn(
            "bg-muted border-border card-enter",
            compact ? "p-3" : "p-4"
          )}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-center gap-4">
            <Skeleton className={cn("rounded-lg", compact ? "h-10 w-10" : "h-12 w-12")} />
            <div className="flex-1 space-y-2">
              <Skeleton className={cn(compact ? "h-4 w-3/4" : "h-5 w-3/4")} />
              <Skeleton className={cn(compact ? "h-3 w-1/2" : "h-4 w-1/2")} />
            </div>
            <div className="hidden sm:flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

interface DashboardLoadingSkeletonProps {
  cardCount?: number;
  className?: string;
}

export function DashboardLoadingSkeleton({ cardCount = 4, className }: DashboardLoadingSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6", className)}>
      {Array.from({ length: cardCount }).map((_, i) => (
        <Card 
          key={i} 
          className="p-4 md:p-6 bg-card border-border card-enter"
          style={{ animationDelay: `${i * 75}ms` }}
        >
          <div className="flex items-center gap-3 md:gap-4">
            <Skeleton className="h-10 w-10 md:h-12 md:w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 md:h-4 w-16 md:w-20" />
              <Skeleton className="h-6 md:h-8 w-12 md:w-16" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TableLoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 p-3 bg-muted/50 rounded-lg">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div 
          key={i} 
          className="flex gap-4 p-3 border-b border-border card-enter"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function MobileCardLoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card 
          key={i} 
          className="p-4 bg-card border-border card-enter"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
