import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogContentProps {
  children: React.ReactNode;
  className?: string;
  /** Full screen mode on mobile for complex forms */
  fullScreen?: boolean;
  /** Fixed max height with scroll */
  scrollable?: boolean;
}

interface ResponsiveDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

const ResponsiveDialogContext = React.createContext<{ 
  isMobile: boolean;
  fullScreen?: boolean;
}>({ isMobile: false });

export function ResponsiveDialog({ open, onOpenChange, children, className }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={{ isMobile: true }}>
        <Drawer open={open} onOpenChange={onOpenChange}>
          {children}
        </Drawer>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile: false }}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </ResponsiveDialogContext.Provider>
  );
}

export function ResponsiveDialogContent({ 
  children, 
  className, 
  fullScreen = false,
  scrollable = true 
}: ResponsiveDialogContentProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={{ isMobile: true, fullScreen }}>
        <DrawerContent 
          className={cn(
            "flex flex-col",
            fullScreen ? "h-[100dvh] max-h-[100dvh] rounded-none" : "max-h-[90dvh]",
            className
          )}
        >
          {children}
        </DrawerContent>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <DialogContent className={cn("max-h-[90vh] flex flex-col overflow-hidden", className)}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader({ children, className }: ResponsiveDialogHeaderProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return <DrawerHeader className={cn("text-left", className)}>{children}</DrawerHeader>;
  }

  return <DialogHeader className={className}>{children}</DialogHeader>;
}

export function ResponsiveDialogTitle({ children, className }: ResponsiveDialogTitleProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return <DrawerTitle className={cn("text-lg", className)}>{children}</DrawerTitle>;
  }

  return <DialogTitle className={className}>{children}</DialogTitle>;
}

export function ResponsiveDialogDescription({ children, className }: ResponsiveDialogDescriptionProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return <DrawerDescription className={className}>{children}</DrawerDescription>;
  }

  return <DialogDescription className={className}>{children}</DialogDescription>;
}

export function ResponsiveDialogBody({ children, className }: ResponsiveDialogBodyProps) {
  const { isMobile, fullScreen } = React.useContext(ResponsiveDialogContext);

  return (
    <div
      className={cn(
        "flex-1 min-h-0 overflow-auto scrollbar-none",
        isMobile
          ? fullScreen
            ? "h-[calc(100dvh-10rem)]"
            : "max-h-[60dvh]"
          : "max-h-[65vh]",
      )}
    >
      <div className={cn(isMobile ? "px-4 py-2" : "py-4 px-1", className)}>{children}</div>
    </div>
  );
}

export function ResponsiveDialogFooter({ children, className }: ResponsiveDialogFooterProps) {
  const { isMobile, fullScreen } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerFooter 
        className={cn(
          "flex-shrink-0 pt-4 flex-col-reverse sm:flex-row gap-2 bg-background border-t border-border",
          className
        )}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        {children}
      </DrawerFooter>
    );
  }

  return (
    <DialogFooter className={cn("flex-shrink-0 pt-4 border-t border-border", className)}>
      {children}
    </DialogFooter>
  );
}

export function ResponsiveDialogClose({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return <DrawerClose className={className}>{children}</DrawerClose>;
  }

  return <DialogClose className={className}>{children}</DialogClose>;
}
