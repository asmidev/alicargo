import { supabase } from '@/integrations/supabase/client';

export type TelegramEventType = 
  | 'box_sealed' 
  | 'shipment_departed' 
  | 'box_arrived' 
  | 'defect_found' 
  | 'daily_summary'
  | 'verification_complete'
  | 'new_message'
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'price_gap_alert'
  | 'new_marketplace_order'
  | 'low_marketplace_stock'
  | 'sync_failed'
  | 'marketplace_daily_digest'
  | 'new_store_order';

interface AlertData {
  [key: string]: unknown;
}

interface SendAlertOptions {
  eventType: TelegramEventType;
  data: AlertData;
  targetUserId?: string;
  targetRoles?: string[];
}

export function useTelegramAlert() {
  const sendAlert = async ({ eventType, data, targetUserId, targetRoles }: SendAlertOptions) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('send-telegram-alert', {
        body: {
          event_type: eventType,
          data,
          target_user_id: targetUserId,
          target_roles: targetRoles
        }
      });

      if (error) {
        console.error('Failed to send Telegram alert:', error);
        return { success: false, error };
      }

      console.log('Telegram alert sent:', result);
      return { success: true, result };
    } catch (error) {
      console.error('Error sending Telegram alert:', error);
      return { success: false, error };
    }
  };

  // Convenience methods for common events
  const notifyBoxSealed = (boxNumber: string, itemCount: number, sealedBy?: string) => {
    return sendAlert({
      eventType: 'box_sealed',
      data: { box_number: boxNumber, item_count: itemCount, sealed_by: sealedBy },
      targetRoles: ['rahbar', 'bosh_admin', 'xitoy_manager']
    });
  };

  const notifyShipmentDeparted = (shipmentNumber: string, boxCount: number, carrier?: string) => {
    return sendAlert({
      eventType: 'shipment_departed',
      data: { shipment_number: shipmentNumber, box_count: boxCount, carrier },
      targetRoles: ['rahbar', 'bosh_admin', 'xitoy_manager', 'uz_manager']
    });
  };

  const notifyBoxArrived = (boxNumber: string, shipmentNumber?: string) => {
    return sendAlert({
      eventType: 'box_arrived',
      data: { box_number: boxNumber, shipment_number: shipmentNumber },
      targetRoles: ['rahbar', 'bosh_admin', 'uz_manager', 'uz_receiver']
    });
  };

  const notifyDefectFound = (boxNumber: string, productName: string, defectType: string, photoCount: number) => {
    return sendAlert({
      eventType: 'defect_found',
      data: { box_number: boxNumber, product_name: productName, defect_type: defectType, photo_count: photoCount },
      targetRoles: ['rahbar', 'bosh_admin', 'xitoy_manager']
    });
  };

  const notifyVerificationComplete = (boxNumber: string, okCount: number, defectCount: number, missingCount: number) => {
    return sendAlert({
      eventType: 'verification_complete',
      data: { box_number: boxNumber, ok_count: okCount, defect_count: defectCount, missing_count: missingCount },
      targetRoles: ['rahbar', 'bosh_admin', 'xitoy_manager', 'uz_manager']
    });
  };

  const notifyNewMessage = (senderId: string, senderName: string, content: string, channel: string) => {
    return sendAlert({
      eventType: 'new_message',
      data: { sender_id: senderId, sender_name: senderName, content, channel }
    });
  };

  // Task notification methods
  const notifyTaskAssigned = (
    assigneeUserId: string,
    taskTitle: string,
    assignedByName: string,
    priority: string,
    location?: string,
    dueDate?: string
  ) => {
    return sendAlert({
      eventType: 'task_assigned',
      data: { 
        task_title: taskTitle, 
        assigned_by: assignedByName, 
        priority, 
        location: location || '-',
        due_date: dueDate || 'Belgilanmagan'
      },
      targetUserId: assigneeUserId
    });
  };

  const notifyTaskDueSoon = (
    assigneeUserId: string,
    taskTitle: string,
    dueDate: string,
    timeRemaining: string
  ) => {
    return sendAlert({
      eventType: 'task_due_soon',
      data: { task_title: taskTitle, due_date: dueDate, time_remaining: timeRemaining },
      targetUserId: assigneeUserId
    });
  };

  const notifyTaskOverdue = (
    assigneeUserId: string,
    taskTitle: string,
    dueDate: string,
    overdueBy: string
  ) => {
    return sendAlert({
      eventType: 'task_overdue',
      data: { task_title: taskTitle, due_date: dueDate, overdue_by: overdueBy },
      targetUserId: assigneeUserId
    });
  };

  // Price intelligence notification
  const notifyPriceGapAlert = (
    productName: string,
    ourPrice: number,
    competitorPrice: number,
    competitorName: string,
    priceGapPercent: number,
    suggestedPrice?: number
  ) => {
    return sendAlert({
      eventType: 'price_gap_alert',
      data: { 
        product_name: productName,
        our_price: ourPrice,
        competitor_price: competitorPrice,
        competitor_name: competitorName,
        price_gap_percent: priceGapPercent,
        suggested_price: suggestedPrice
      },
      targetRoles: ['rahbar', 'bosh_admin', 'manager', 'uz_manager']
    });
  };

  // Marketplace notification methods
  const notifyNewMarketplaceOrder = (
    platform: string,
    storeName: string,
    orderNumber: string,
    total: number,
    customerName: string,
    itemsCount: number
  ) => {
    return sendAlert({
      eventType: 'new_marketplace_order',
      data: { 
        platform,
        store_name: storeName,
        order_number: orderNumber,
        total,
        customer_name: customerName,
        items_count: itemsCount
      },
      targetRoles: ['rahbar', 'bosh_admin', 'manager']
    });
  };

  const notifyLowMarketplaceStock = (
    productName: string,
    platform: string,
    storeName: string,
    currentStock: number,
    threshold: number
  ) => {
    return sendAlert({
      eventType: 'low_marketplace_stock',
      data: { 
        product_name: productName,
        platform,
        store_name: storeName,
        current_stock: currentStock,
        threshold
      },
      targetRoles: ['rahbar', 'bosh_admin', 'manager']
    });
  };

  const notifySyncFailed = (
    platform: string,
    storeName: string,
    syncType: string,
    productName: string,
    error: string,
    attempts: number
  ) => {
    return sendAlert({
      eventType: 'sync_failed',
      data: { 
        platform,
        store_name: storeName,
        sync_type: syncType,
        product_name: productName,
        error,
        attempts
      },
      targetRoles: ['rahbar', 'bosh_admin']
    });
  };

  return {
    sendAlert,
    notifyBoxSealed,
    notifyShipmentDeparted,
    notifyBoxArrived,
    notifyDefectFound,
    notifyVerificationComplete,
    notifyNewMessage,
    notifyTaskAssigned,
    notifyTaskDueSoon,
    notifyTaskOverdue,
    notifyPriceGapAlert,
    notifyNewMarketplaceOrder,
    notifyLowMarketplaceStock,
    notifySyncFailed
  };
}