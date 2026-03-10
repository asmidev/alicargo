import { useState, useEffect } from 'react';
import { AlertTriangle, Wifi, WifiOff, RefreshCw, Cloud, CloudOff, X } from 'lucide-react';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

export function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline, wasOffline } = useOfflineStatus();
  const { queueLength, isSyncing } = useOfflineQueue();
  const { triggerHaptic } = useNativeFeatures();
  const [showDetails, setShowDetails] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-hide success banner after 3 seconds
  useEffect(() => {
    if (isOnline && wasOffline) {
      triggerHaptic('light');
      const timer = setTimeout(() => {
        setDismissed(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setDismissed(false);
    }
  }, [isOnline, wasOffline, triggerHaptic]);

  if ((isOnline && !wasOffline) || (isOnline && dismissed && queueLength === 0)) return null;

  const handleRetry = () => {
    triggerHaptic('medium');
    window.dispatchEvent(new CustomEvent('app:retry-sync'));
  };

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] transition-all duration-300",
        isOnline 
          ? "bg-success/95 text-success-foreground animate-slide-in-up"
          : "bg-destructive/95 text-destructive-foreground"
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Main banner */}
      <div className="px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                {t('offline.backOnline', 'Aloqa tiklandi')}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
              <span className="text-sm font-medium">
                {t('offline.noConnection', 'Internet aloqasi yo\'q')}
              </span>
            </>
          )}
          
          {/* Cached data indicator */}
          {!isOnline && (
            <span className="text-xs opacity-80 hidden sm:inline">
              • {t('offline.usingCached', 'Keshdan foydalanilmoqda')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Pending actions indicator */}
          {queueLength > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 text-xs font-medium hover:bg-white/30 transition-colors"
            >
              <Cloud className="w-3 h-3" />
              <span>{queueLength}</span>
            </button>
          )}

          {/* Retry button */}
          {!isOnline && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRetry}
              disabled={isSyncing}
              className="h-7 px-2 text-xs bg-white/20 hover:bg-white/30 text-current"
            >
              <RefreshCw className={cn("w-3 h-3 mr-1", isSyncing && "animate-spin")} />
              {t('common.retry', 'Qayta urinish')}
            </Button>
          )}

          {/* Dismiss button for success state */}
          {isOnline && wasOffline && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded details panel */}
      {showDetails && queueLength > 0 && (
        <div className="px-4 py-2 border-t border-white/20 bg-black/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <CloudOff className="w-3 h-3" />
              <span>
                {t('offline.pendingActions', '{{count}} ta amal kutmoqda', { count: queueLength })}
              </span>
            </div>
            {isOnline && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRetry}
                disabled={isSyncing}
                className="h-6 px-2 text-xs bg-white/20 hover:bg-white/30"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    {t('offline.syncing', 'Sinxronlanmoqda...')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {t('offline.syncNow', 'Hozir sinxronlash')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Cached data indicator component for use in pages
export function CachedDataIndicator({ className }: { className?: string }) {
  const { isOnline } = useOfflineStatus();
  const { t } = useTranslation();

  if (isOnline) return null;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs",
      className
    )}>
      <CloudOff className="w-3 h-3" />
      <span>{t('offline.cachedData', 'Kesh ma\'lumotlari')}</span>
    </div>
  );
}
