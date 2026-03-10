import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface MobileCardSkeletonProps {
  variant?: 'task' | 'product' | 'box' | 'stat';
  count?: number;
  className?: string;
}

function TaskCardSkeleton() {
  return (
    <div className="bg-card rounded-xl p-4 border-l-4 border-l-muted">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex gap-1.5 mb-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex items-center gap-4 mb-3 pb-3 border-b border-border/50">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="flex-1 h-9 rounded-md" />
        <Skeleton className="w-9 h-9 rounded-md" />
      </div>
    </div>
  );
}

function BoxCardSkeleton() {
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-2 mb-3">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <Skeleton className="w-8 h-8 rounded-lg mb-2" />
      <Skeleton className="h-3 w-16 mb-1" />
      <Skeleton className="h-6 w-12" />
    </div>
  );
}

export function MobileCardSkeleton({ variant = 'task', count = 3, className }: MobileCardSkeletonProps) {
  const SkeletonComponent = {
    task: TaskCardSkeleton,
    product: ProductCardSkeleton,
    box: BoxCardSkeleton,
    stat: StatCardSkeleton,
  }[variant];

  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
}

export function MobileStatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}
