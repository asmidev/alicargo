-- Phase 14: Remove duplicate cron job (jobid 8 is the duplicate marketplace-daily-digest)
SELECT cron.unschedule(8);

-- Phase 15: Populate variant barcodes from marketplace listings
UPDATE product_variants pv
SET barcode = ml.external_barcode
FROM marketplace_listings ml
WHERE pv.sku = ml.external_sku
AND ml.external_barcode IS NOT NULL
AND ml.external_barcode != ''
AND (pv.barcode IS NULL OR pv.barcode = '');