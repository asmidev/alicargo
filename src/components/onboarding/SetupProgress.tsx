import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetupStep {
  id: string;
  title: string;
  description?: string;
  isComplete: boolean;
  isActive?: boolean;
}

interface SetupProgressProps {
  steps: SetupStep[];
  currentStep?: number;
  onStepClick?: (stepId: string) => void;
  className?: string;
}

export function SetupProgress({ 
  steps, 
  currentStep = 0, 
  onStepClick,
  className 
}: SetupProgressProps) {
  const completedCount = steps.filter(s => s.isComplete).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className={cn("bg-card rounded-xl border border-border p-4", className)}>
      {/* Progress header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Boshlang'ich sozlamalar</h3>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{steps.length} tugallangan
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-primary rounded-full"
        />
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <motion.button
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onStepClick?.(step.id)}
            disabled={step.isComplete}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
              step.isComplete 
                ? "bg-green-500/10 cursor-default" 
                : step.isActive 
                  ? "bg-primary/10 hover:bg-primary/20" 
                  : "hover:bg-muted"
            )}
          >
            {/* Step indicator */}
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
              step.isComplete 
                ? "bg-green-500 text-white" 
                : step.isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
            )}>
              {step.isComplete ? (
                <Check className="w-4 h-4" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                step.isComplete && "line-through text-muted-foreground"
              )}>
                {step.title}
              </p>
              {step.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {step.description}
                </p>
              )}
            </div>

            {/* Arrow indicator for active step */}
            {step.isActive && !step.isComplete && (
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-primary"
              >
                →
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// Compact version for mobile
interface CompactSetupProgressProps {
  completedSteps: number;
  totalSteps: number;
  onPress?: () => void;
  className?: string;
}

export function CompactSetupProgress({ 
  completedSteps, 
  totalSteps, 
  onPress,
  className 
}: CompactSetupProgressProps) {
  const progress = (completedSteps / totalSteps) * 100;
  const isComplete = completedSteps === totalSteps;

  if (isComplete) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onPress}
      className={cn(
        "w-full bg-primary/10 border border-primary/20 rounded-xl p-3",
        "flex items-center gap-3 hover:bg-primary/15 transition-colors",
        className
      )}
    >
      {/* Circular progress */}
      <div className="relative w-10 h-10">
        <svg className="w-10 h-10 -rotate-90">
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="text-muted"
          />
          <motion.circle
            cx="20"
            cy="20"
            r="16"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            className="text-primary"
            initial={{ strokeDasharray: '100 100', strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 100 - progress }}
            transition={{ duration: 0.5 }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {completedSteps}/{totalSteps}
        </span>
      </div>

      {/* Text */}
      <div className="flex-1 text-left">
        <p className="text-sm font-medium">Sozlamalarni tugallang</p>
        <p className="text-xs text-muted-foreground">
          {totalSteps - completedSteps} ta qadam qoldi
        </p>
      </div>

      {/* Arrow */}
      <motion.span
        animate={{ x: [0, 4, 0] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="text-primary text-lg"
      >
        →
      </motion.span>
    </motion.button>
  );
}
