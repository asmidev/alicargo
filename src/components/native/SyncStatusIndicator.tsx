import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface SyncStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function SyncStatusIndicator({ className, showDetails = false }: SyncStatusIndicatorProps) {
  const { t } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const { pendingTasks, isSyncing, lastSyncAt, sync, getPendingCount } = useBackgroundSync();
  const [expanded, setExpanded] = useState(false);

  const pendingCount = getPendingCount();
  const hasErrors = pendingTasks.some(t => t.retryCount > 0);

  // Determine status
  const status = !isOnline 
    ? 'offline' 
    : isSyncing 
      ? 'syncing' 
      : pendingCount > 0 
        ? hasErrors ? 'error' : 'pending'
        : 'synced';

  const statusConfig = {
    offline: {
      icon: CloudOff,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      label: t('sync.offline', 'Oflayn'),
    },
    syncing: {
      icon: RefreshCw,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      label: t('sync.syncing', 'Sinxronlanmoqda...'),
    },
    pending: {
      icon: Cloud,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      label: t('sync.pending', '{{count}} ta kutmoqda', { count: pendingCount }),
    },
    error: {
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      label: t('sync.error', 'Sinxronlash xatosi'),
    },
    synced: {
      icon: Check,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      label: t('sync.synced', 'Sinxronlangan'),
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  // Compact version
  if (!showDetails) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "relative flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors",
          config.bgColor,
          className
        )}
      >
        <Icon className={cn(
          "w-4 h-4",
          config.color,
          status === 'syncing' && "animate-spin"
        )} />
        
        {pendingCount > 0 && status !== 'syncing' && (
          <span className={cn("text-xs font-medium", config.color)}>
            {pendingCount}
          </span>
        )}

        {/* Expanded details dropdown */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl p-4 z-50"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">{config.label}</span>
                {!isOnline && pendingCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t('sync.willSyncOnline', 'Onlayn bo\'lganda sinxronlanadi')}
                  </span>
                )}
              </div>

              {lastSyncAt && (
                <p className="text-xs text-muted-foreground mb-3">
                  {t('sync.lastSync', 'Oxirgi sinxronlash')}: {' '}
                  {new Date(lastSyncAt).toLocaleTimeString()}
                </p>
              )}

              {pendingCount > 0 && isOnline && (
                <button
                  onClick={() => sync()}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                  {t('sync.syncNow', 'Hozir sinxronlash')}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  }

  // Detailed version
  return (
    <div className={cn("p-4 bg-card rounded-xl border border-border", className)}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", config.bgColor)}>
          <Icon className={cn("w-5 h-5", config.color, status === 'syncing' && "animate-spin")} />
        </div>
        <div>
          <p className="font-medium text-sm">{config.label}</p>
          {lastSyncAt && (
            <p className="text-xs text-muted-foreground">
              {t('sync.lastSync', 'Oxirgi')}: {new Date(lastSyncAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {pendingTasks.length > 0 && (
        <div className="space-y-2 mb-3">
          {pendingTasks.slice(0, 3).map(task => (
            <div
              key={task.id}
              className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded-lg"
            >
              <span className="text-muted-foreground truncate flex-1">
                {task.type}
              </span>
              {task.retryCount > 0 && (
                <span className="text-destructive">
                  {t('sync.retry', 'Qayta urinish')}: {task.retryCount}
                </span>
              )}
            </div>
          ))}
          {pendingTasks.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              +{pendingTasks.length - 3} {t('sync.more', 'ta yana')}
            </p>
          )}
        </div>
      )}

      {pendingCount > 0 && isOnline && (
        <button
          onClick={() => sync()}
          disabled={isSyncing}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
          {t('sync.syncNow', 'Hozir sinxronlash')}
        </button>
      )}
    </div>
  );
}
