import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <motion.div
        className={cn(
          'rounded-full border-2 border-muted border-t-primary',
          sizeClasses[size]
        )}
        animate={{ rotate: 360 }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
}

// Skeleton loading for cards
interface CardSkeletonProps {
  className?: string;
  lines?: number;
  showImage?: boolean;
  showActions?: boolean;
}

export function CardSkeleton({ 
  className, 
  lines = 3, 
  showImage = false,
  showActions = false 
}: CardSkeletonProps) {
  return (
    <div className={cn('rounded-lg bg-card border border-border p-4 space-y-3', className)}>
      {showImage && (
        <div className="h-32 bg-muted rounded-md animate-pulse" />
      )}
      
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
        {Array.from({ length: lines - 1 }).map((_, i) => (
          <div 
            key={i}
            className="h-3 bg-muted rounded animate-pulse"
            style={{ width: `${Math.random() * 30 + 60}%` }}
          />
        ))}
      </div>

      {showActions && (
        <div className="flex gap-2 pt-2">
          <div className="h-8 w-20 bg-muted rounded animate-pulse" />
          <div className="h-8 w-20 bg-muted rounded animate-pulse" />
        </div>
      )}
    </div>
  );
}

// Page loading state
interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = 'Yuklanmoqda...' }: PageLoadingProps) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

// Inline loading dots
export function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </span>
  );
}

// Shimmer effect overlay
export function ShimmerOverlay({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]', className)}>
      <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
