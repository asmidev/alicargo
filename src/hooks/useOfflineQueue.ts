import { useState, useEffect, useCallback } from 'react';
import { safeParseJSON, safeStringifyJSON, safeRemoveItem } from '@/lib/safeStorage';

interface QueuedAction {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  retryCount: number;
}

const STORAGE_KEY = 'offline_action_queue';
const MAX_RETRIES = 3;

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    const stored = safeParseJSON<QueuedAction[]>(STORAGE_KEY, []);
    if (stored.length > 0) {
      setQueue(stored);
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    if (queue.length > 0) {
      safeStringifyJSON(STORAGE_KEY, queue);
    } else {
      safeRemoveItem(STORAGE_KEY);
    }
  }, [queue]);

  // Add action to queue
  const addToQueue = useCallback((type: string, payload: unknown) => {
    const action: QueuedAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    };
    setQueue(prev => [...prev, action]);
    return action.id;
  }, []);

  // Remove action from queue
  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(action => action.id !== id));
  }, []);

  // Clear entire queue
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // Process queue when online
  const processQueue = useCallback(async (
    handler: (action: QueuedAction) => Promise<boolean>
  ) => {
    if (queue.length === 0 || isSyncing) return;

    setIsSyncing(true);
    const failedActions: QueuedAction[] = [];

    for (const action of queue) {
      try {
        const success = await handler(action);
        if (!success && action.retryCount < MAX_RETRIES) {
          failedActions.push({
            ...action,
            retryCount: action.retryCount + 1,
          });
        }
      } catch {
        if (action.retryCount < MAX_RETRIES) {
          failedActions.push({
            ...action,
            retryCount: action.retryCount + 1,
          });
        }
      }
    }

    setQueue(failedActions);
    setIsSyncing(false);
  }, [queue, isSyncing]);

  return {
    queue,
    queueLength: queue.length,
    isSyncing,
    addToQueue,
    removeFromQueue,
    clearQueue,
    processQueue,
  };
}
