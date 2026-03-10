import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ImageOff } from 'lucide-react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
  placeholderSrc?: string;
  aspectRatio?: 'square' | 'video' | 'auto';
}

export function LazyImage({
  src,
  alt,
  className,
  fallback,
  placeholderSrc,
  aspectRatio = 'auto',
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(!src || src.trim() === '');
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset error/loaded state when src changes
  useEffect(() => {
    setHasError(!src || src.trim() === '');
    setIsLoaded(false);
  }, [src]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    auto: '',
  }[aspectRatio];

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-lg",
          aspectRatioClass,
          className
        )}
      >
        {fallback || (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImageOff className="w-6 h-6" />
            <span className="text-xs">Rasm yuklanmadi</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", aspectRatioClass, className)}>
      {/* Placeholder/skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 skeleton-shimmer rounded-lg" />
      )}
      
      {/* Actual image */}
      <img
        ref={imgRef}
        src={isInView ? src : placeholderSrc || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}
        alt={alt}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        loading="lazy"
        {...props}
      />
    </div>
  );
}
