-- Phase A2: Backfill Yandex orders fulfillment_status based on raw status
-- This fixes the missing fulfillment_status for existing Yandex orders

UPDATE marketplace_orders mo
SET fulfillment_status = 
  CASE 
    -- Delivered states
    WHEN UPPER(mo.status) IN ('DELIVERED', 'PICKUP', 'PARTIALLY_DELIVERED', 'PICKUP_SERVICE_RECEIVED', 'PICKUP_USER_RECEIVED') THEN 'delivered'
    -- Cancelled states
    WHEN UPPER(mo.status) LIKE 'CANCELLED%' OR UPPER(mo.status) = 'CANCELED' THEN 'cancelled'
    -- Returned states
    WHEN UPPER(mo.status) IN ('RETURNED', 'RETURN_ARRIVED', 'RETURN_ARRIVED_DELIVERY') THEN 'returned'
    -- Shipped/In transit states
    WHEN UPPER(mo.status) IN ('PROCESSING', 'DELIVERY', 'SHIPPED', 'READY_TO_SHIP', 'SENDER_SENT') THEN 'shipped'
    ELSE 'pending'
  END
WHERE mo.store_id IN (
  SELECT id FROM marketplace_stores WHERE platform = 'yandex'
)
AND (mo.fulfillment_status IS NULL 
     OR mo.fulfillment_status = 'pending'
     OR mo.fulfillment_status = '');