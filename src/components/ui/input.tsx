import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  // Additional mobile-friendly props
  mobileOptimized?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, mobileOptimized = true, ...props }, ref) => {
    // Auto-detect inputMode based on type
    const getInputMode = (): React.HTMLAttributes<HTMLInputElement>['inputMode'] => {
      if (props.inputMode) return props.inputMode;
      switch (type) {
        case 'email': return 'email';
        case 'tel': return 'tel';
        case 'url': return 'url';
        case 'number': return 'decimal';
        default: return undefined;
      }
    };

    return (
      <input
        type={type}
        inputMode={getInputMode()}
        className={cn(
          // Base styles with mobile-first sizing
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-200 ease-out",
          "hover:border-muted-foreground/50 focus:border-primary",
          // Mobile-optimized: taller touch targets
          mobileOptimized ? "h-12 md:h-10" : "h-10",
          // Responsive text size
          "md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
