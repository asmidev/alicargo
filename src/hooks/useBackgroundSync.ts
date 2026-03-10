import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

interface SyncTask {
  id: string;
  type: string;
  data: any;
  createdAt: Date;
  retryCount: number;
  maxRetries: number;
}

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

const SYNC_STORAGE_KEY = 'pending-sync-tasks';
const MAX_RETRIES = 3;

export function useBackgroundSync() {
  const [isNative] = useState(Capacitor.isNativePlatform());
  const [pendingTasks, setPendingTasks] = useState<SyncTask[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const syncInProgress = useRef(false);

  // Load pending tasks from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SYNC_STORAGE_KEY);
      if (stored) {
        const tasks = JSON.parse(stored);
        setPendingTasks(tasks.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
        })));
      }
    } catch (error) {
      console.error('Failed to load pending sync tasks:', error);
    }
  }, []);

  // Save pending tasks to storage
  const savePendingTasks = useCallback((tasks: SyncTask[]) => {
    try {
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(tasks));
      setPendingTasks(tasks);
    } catch (error) {
      console.error('Failed to save pending sync tasks:', error);
    }
  }, []);

  // Add a task to sync queue
  const queueSync = useCallback((type: string, data: any): string => {
    const task: SyncTask = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      data,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    };

    savePendingTasks([...pendingTasks, task]);
    return task.id;
  }, [pendingTasks, savePendingTasks]);

  // Process a single sync task
  const processSyncTask = useCallback(async (task: SyncTask): Promise<boolean> => {
    try {
      switch (task.type) {
        case 'box_verification':
          // Sync box verification data
          // await supabase.from('boxes').update(task.data).eq('id', task.data.id);
          console.log('Syncing box verification:', task.data);
          break;
        
        case 'task_status':
          // Sync task status change
          // await supabase.from('tasks').update(task.data).eq('id', task.data.id);
          console.log('Syncing task status:', task.data);
          break;
        
        case 'product_update':
          // Sync product update
          // await supabase.from('products').update(task.data).eq('id', task.data.id);
          console.log('Syncing product update:', task.data);
          break;
        
        case 'defect_claim':
          // Sync defect claim
          // await supabase.from('defect_claims').insert(task.data);
          console.log('Syncing defect claim:', task.data);
          break;
        
        default:
          console.warn('Unknown sync task type:', task.type);
          return false;
      }
      
      return true;
    } catch (error) {
      console.error('Sync task failed:', task.id, error);
      return false;
    }
  }, []);

  // Run sync for all pending tasks
  const sync = useCallback(async (): Promise<SyncResult> => {
    if (syncInProgress.current || pendingTasks.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0, errors: [] };
    }

    syncInProgress.current = true;
    setIsSyncing(true);

    const results: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    const remainingTasks: SyncTask[] = [];

    for (const task of pendingTasks) {
      const success = await processSyncTask(task);

      if (success) {
        results.syncedCount++;
      } else {
        results.failedCount++;
        
        if (task.retryCount < task.maxRetries) {
          remainingTasks.push({
            ...task,
            retryCount: task.retryCount + 1,
          });
        } else {
          results.errors.push(`Task ${task.id} failed after ${task.maxRetries} retries`);
        }
      }
    }

    savePendingTasks(remainingTasks);
    setLastSyncAt(new Date());
    setIsSyncing(false);
    syncInProgress.current = false;

    results.success = results.failedCount === 0;
    return results;
  }, [pendingTasks, processSyncTask, savePendingTasks]);

  // Auto-sync when coming online
  useEffect(() => {
    const handleOnline = () => {
      console.log('Back online, triggering sync...');
      sync();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [sync]);

  // Register background sync (for PWA)
  useEffect(() => {
    if ('serviceWorker' in navigator && 'sync' in (window as any).ServiceWorkerRegistration?.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        // Register periodic background sync
        if ('periodicSync' in registration) {
          (registration as any).periodicSync.register('sync-data', {
            minInterval: 5 * 60 * 1000, // 5 minutes
          }).catch((e: Error) => console.log('Periodic sync registration failed:', e));
        }
      });
    }
  }, []);

  // Clear all pending tasks
  const clearPending = useCallback(() => {
    savePendingTasks([]);
  }, [savePendingTasks]);

  // Get count of pending tasks
  const getPendingCount = useCallback(() => pendingTasks.length, [pendingTasks]);

  return {
    pendingTasks,
    isSyncing,
    lastSyncAt,
    queueSync,
    sync,
    clearPending,
    getPendingCount,
  };
}
