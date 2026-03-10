import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
}

export function CollapsibleSection({
  title,
  icon,
  badge,
  children,
  defaultOpen = true,
  className,
  headerClassName,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { triggerHaptic } = useNativeFeatures();

  const toggle = () => {
    triggerHaptic('light');
    setIsOpen(!isOpen);
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Header - always visible */}
      <button
        onClick={toggle}
        className={cn(
          "w-full flex items-center justify-between p-4 sm:p-6 text-left",
          "touch-manipulation active:bg-muted/50 transition-colors",
          headerClassName
        )}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            {title}
          </h2>
          {badge}
        </div>
        <ChevronDown 
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {/* Content - collapsible */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}