import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

interface LocalNotification {
  id: number;
  title: string;
  body: string;
  schedule?: {
    at?: Date;
    every?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
    count?: number;
  };
  extra?: Record<string, any>;
  smallIcon?: string;
  largeIcon?: string;
  actionTypeId?: string;
}

interface NotificationPermission {
  display: 'granted' | 'denied' | 'prompt';
}

export function useLocalNotifications() {
  const [isNative] = useState(Capacitor.isNativePlatform());
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [pendingNotifications, setPendingNotifications] = useState<LocalNotification[]>([]);

  // Check current permission status
  useEffect(() => {
    const checkPermission = async () => {
      if (isNative) {
        // Would use LocalNotifications.checkPermissions()
        setPermission('granted');
        return;
      }

      // Web: Check Notification API
      if ('Notification' in window) {
        setPermission(Notification.permission as any);
      } else {
        setPermission('denied');
      }
    };

    checkPermission();
  }, [isNative]);

  // Request notification permissions
  const requestPermissions = useCallback(async (): Promise<NotificationPermission> => {
    if (isNative) {
      // Would use LocalNotifications.requestPermissions()
      setPermission('granted');
      return { display: 'granted' };
    }

    // Web: Request permission
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result as any);
      return { display: result as any };
    }

    return { display: 'denied' };
  }, [isNative]);

  // Schedule a notification
  const schedule = useCallback(async (notification: LocalNotification): Promise<boolean> => {
    try {
      if (permission !== 'granted') {
        const result = await requestPermissions();
        if (result.display !== 'granted') return false;
      }

      if (isNative) {
        // Would use LocalNotifications.schedule()
        console.log('Native notification scheduled:', notification);
        setPendingNotifications(prev => [...prev, notification]);
        return true;
      }

      // Web: Use Notification API with setTimeout for scheduling
      const delay = notification.schedule?.at 
        ? notification.schedule.at.getTime() - Date.now()
        : 0;

      if (delay > 0) {
        setTimeout(() => {
          new Notification(notification.title, {
            body: notification.body,
            icon: '/pwa-192x192.png',
            tag: notification.id.toString(),
            data: notification.extra,
          });
        }, delay);
      } else {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/pwa-192x192.png',
          tag: notification.id.toString(),
          data: notification.extra,
        });
      }

      setPendingNotifications(prev => [...prev, notification]);
      return true;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return false;
    }
  }, [permission, requestPermissions, isNative]);

  // Cancel a specific notification
  const cancel = useCallback(async (notificationId: number): Promise<void> => {
    if (isNative) {
      // Would use LocalNotifications.cancel({ notifications: [{ id: notificationId }] })
    }
    setPendingNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, [isNative]);

  // Cancel all notifications
  const cancelAll = useCallback(async (): Promise<void> => {
    if (isNative) {
      // Would use LocalNotifications.cancel({ notifications: pendingNotifications })
    }
    setPendingNotifications([]);
  }, [isNative]);

  // Get pending notifications
  const getPending = useCallback(async (): Promise<LocalNotification[]> => {
    if (isNative) {
      // Would use LocalNotifications.getPending()
    }
    return pendingNotifications;
  }, [isNative, pendingNotifications]);

  // Schedule common notification types
  const scheduleReminder = useCallback(async (
    title: string,
    body: string,
    atDate: Date,
    extra?: Record<string, any>
  ): Promise<boolean> => {
    return schedule({
      id: Date.now(),
      title,
      body,
      schedule: { at: atDate },
      extra,
    });
  }, [schedule]);

  const scheduleTaskReminder = useCallback(async (
    taskId: string,
    taskTitle: string,
    dueDate: Date
  ): Promise<boolean> => {
    // Remind 1 hour before due
    const reminderTime = new Date(dueDate.getTime() - 60 * 60 * 1000);
    
    return schedule({
      id: parseInt(taskId.replace(/\D/g, '').slice(0, 9)) || Date.now(),
      title: 'Vazifa eslatmasi',
      body: `"${taskTitle}" 1 soatdan keyin tugaydi`,
      schedule: { at: reminderTime },
      extra: { taskId, type: 'task_reminder' },
    });
  }, [schedule]);

  const scheduleShipmentArrival = useCallback(async (
    shipmentId: string,
    eta: Date
  ): Promise<boolean> => {
    return schedule({
      id: parseInt(shipmentId.replace(/\D/g, '').slice(0, 9)) || Date.now(),
      title: 'Jo\'natma kelmoqda',
      body: 'Jo\'natmangiz bugun yetib kelishi kutilmoqda',
      schedule: { at: eta },
      extra: { shipmentId, type: 'shipment_arrival' },
    });
  }, [schedule]);

  return {
    permission,
    pendingNotifications,
    requestPermissions,
    schedule,
    cancel,
    cancelAll,
    getPending,
    scheduleReminder,
    scheduleTaskReminder,
    scheduleShipmentArrival,
  };
}
