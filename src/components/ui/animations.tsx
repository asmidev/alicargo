import React from 'react';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

// Fade in animation wrapper
interface FadeInProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

export function FadeIn({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.3,
  ...props 
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ delay, duration, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Scale in animation wrapper
export function ScaleIn({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.2,
  ...props 
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay, duration, type: 'spring', stiffness: 300, damping: 20 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Slide in from direction
interface SlideInProps extends FadeInProps {
  direction?: 'left' | 'right' | 'up' | 'down';
}

export function SlideIn({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.3,
  direction = 'up',
  ...props 
}: SlideInProps) {
  const directionMap = {
    left: { x: -20, y: 0 },
    right: { x: 20, y: 0 },
    up: { x: 0, y: 20 },
    down: { x: 0, y: -20 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...directionMap[direction] }}
      transition={{ delay, duration, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Staggered children animation
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({ children, className, staggerDelay = 0.05 }: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className={className}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
    >
      {children}
    </motion.div>
  );
}

// Presence wrapper for conditional rendering with animation
interface PresenceProps {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Presence({ show, children, className }: PresenceProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Pop animation for notifications/badges
export function Pop({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Pulse animation for attention
export function Pulse({ 
  children, 
  className,
  pulseColor = 'primary'
}: { 
  children: React.ReactNode; 
  className?: string;
  pulseColor?: 'primary' | 'destructive' | 'success';
}) {
  const colorMap = {
    primary: 'bg-primary/20',
    destructive: 'bg-destructive/20',
    success: 'bg-green-500/20',
  };

  return (
    <div className={cn('relative inline-flex', className)}>
      <motion.div
        className={cn('absolute inset-0 rounded-full', colorMap[pulseColor])}
        animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      {children}
    </div>
  );
}
