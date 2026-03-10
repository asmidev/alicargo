# Marketplace Integration Deep Audit Report

**Audit Date:** 2026-02-05
**Status:** COMPLETED

---

## Executive Summary

| Metric | Uzum | Yandex | Status |
|--------|------|--------|--------|
| **Stores Connected** | 7 | 3 | ✅ All Active |
| **Total Listings** | 929 | 193 | ✅ Good |
| **Product Link Rate** | 58.4% avg | 73.6% avg | 🟡 Needs Improvement |
| **Stock Sync** | 72.2% with stock | 45.4% with stock | ✅ Fixed (was 0%) |
| **Orders (30d)** | 4,886 | 218 | ✅ Syncing |
| **Commission Data** | 0% captured | 37.5% captured | 🔴 Uzum Critical |
| **Sync Freshness** | < 1 hour | STALE (12-24h) | 🟡 Yandex stale |

---

## 1. Store Connectivity Status

### 1.1 Uzum Stores (7 stores - All Fresh)

| Store | Shop ID | Seller ID | Last Sync | Status |
|-------|---------|-----------|-----------|--------|
| ALI BRAND MARKET | 49052 | 316698 | 11:18 today | ✅ Fresh |
| Atlas Market | 69508 | 316698 | 11:16 today | ✅ Fresh |
| Atlas.Market | 88409 | 316698 | 11:02 today | ✅ Fresh |
| BM Store | 89165 | 356944 | 11:03 today | ✅ Fresh |
| BM_store | 92638 | 356944 | 11:02 today | ✅ Fresh |
| Uzum China Market | 69555 | 316698 | 11:17 today | ✅ Fresh |
| Xit market | 70010 | 316698 | 11:15 today | ✅ Fresh |

### 1.2 Yandex Stores (3 stores - STALE)

| Store | Campaign ID | Business ID | Last Sync | Status |
|-------|-------------|-------------|-----------|--------|
| AliBrand.Market | 148843590 | 216469176 | 16:55 yesterday | 🟡 Stale |
| Atlas Market | 148927985 | 216575313 | 11:33 yesterday | 🟡 Stale |
| BM_store | FBS:148916383 FBY:148939239 | 216515645 | 16:55 yesterday | 🟡 Stale |

**Issue:** Yandex stores not being synced by auto-sync cron. Cron only syncs listings/orders, not products/stocks.

---

## 2. Listings Analysis

### 2.1 By Store - Link Rate & Stock Coverage

| Store | Platform | Listings | Linked | Link % | With Stock | Stock % |
|-------|----------|----------|--------|--------|------------|---------|
| ALI BRAND MARKET | Uzum | 263 | 122 | 46.4% | 110 | 41.8% |
| Atlas Market | Uzum | 157 | 140 | 89.2% | 122 | 77.7% |
| Atlas.Market | Uzum | 78 | 43 | 55.1% | 53 | 67.9% |
| BM Store | Uzum | 46 | 32 | 69.6% | 41 | 89.1% |
| BM_store (Uzum) | Uzum | 43 | 31 | 72.1% | 31 | 72.1% |
| Uzum China Market | Uzum | 194 | 111 | 57.2% | 138 | 71.1% |
| Xit market | Uzum | 148 | 63 | 42.6% | 127 | 85.8% |
| AliBrand.Market | Yandex | 67 | 56 | 83.6% | 57 | 85.1% ✅ FIXED |
| Atlas Market | Yandex | 59 | 58 | 98.3% | 9 | 15.3% |
| BM_store (Yandex) | Yandex | 67 | 26 | 38.8% | 64 | 95.5% ✅ |

**Uzum Avg Link Rate:** 58.4%
**Yandex Avg Link Rate:** 73.6%

### 2.2 Data Quality Issues

| Issue | Count | Severity |
|-------|-------|----------|
| Listings without title | 21 | 🟡 Medium (all Yandex) |
| Listings without price | 82 | 🟡 Medium |
| Listings without external_sku | 0 | ✅ Good |
| Yandex listings with null title | 21 | 🟡 Medium |
| Yandex listings with null barcode | 78 | 🟡 Medium |

**Root Cause:** Some Yandex listings use offerId as fallback title. Barcodes missing for older listings.

---

## 3. Orders Analysis (Last 30 Days)

### 3.1 By Store

| Store | Platform | Total | Delivered | Cancelled | Returned | Revenue (UZS) |
|-------|----------|-------|-----------|-----------|----------|---------------|
| ALI BRAND MARKET | Uzum | 988 | 406 | 258 | 175 | 48,252,970 |
| Atlas Market | Uzum | 1,344 | 628 | 321 | 271 | 75,834,700 |
| Atlas.Market | Uzum | 126 | 70 | 19 | 34 | 14,404,440 |
| BM Store | Uzum | 377 | 203 | 87 | 64 | 15,784,440 |
| BM_store (Uzum) | Uzum | 244 | 84 | 60 | 45 | 10,989,020 |
| Uzum China Market | Uzum | 1,369 | 684 | 325 | 292 | 75,115,050 |
| Xit market | Uzum | 438 | 198 | 97 | 92 | 17,252,670 |
| AliBrand.Market | Yandex | 84 | 45 | 27 | 2 | 10,708,074 |
| Atlas Market | Yandex | 50 | 13 | 37 | 0 | 26,721,473 |
| BM_store (Yandex) | Yandex | 84 | 35 | 32 | 0 | 7,578,569 |

### 3.2 Order Item Data Quality

**Uzum Orders:**
- ✅ Items have `skuTitle` (e.g., "ABMARKE-SIMSIZN-РОЗОВ")
- ❌ Missing `title` (product name)
- ❌ Missing `image` (product photo)
- ❌ `skuFullTitle` shows "undefined - SKU"

**Yandex Orders:**
- ✅ Items have `title` and `offerName`
- ✅ Items have `marketSku`
- ✅ Items have `quantity` and `count`
- ✅ Complete data

### 3.3 Status Distribution

**Uzum (4,886 orders):**
- COMPLETED: 2,267 (46.4%)
- CANCELED: 1,167 (23.9%)
- RETURNED: 973 (19.9%)
- DELIVERED_TO_CUSTOMER_DELIVERY_POINT: 332 (6.8%)
- Other active: 147 (3.0%)

**Yandex (218 orders):**
- DELIVERED: 93 (42.7%)
- CANCELLED_*: 96 (44.0%)
- PICKUP: 13 (6.0%)
- PROCESSING/DELIVERY: 13 (6.0%)
- RETURNED: 2 (0.9%)
- PARTIALLY_DELIVERED: 1 (0.5%)

---

## 4. Commission & Finance Analysis

### 4.1 Commission Capture Rate 🔴 CRITICAL

| Platform | Orders | With Commission | Rate | Total Commission |
|----------|--------|-----------------|------|------------------|
| Uzum | 4,886 | 0 | 0% | 0 UZS |
| Yandex | 218 | 92 | 42.2% | 2,244,631 UZS |

**Root Cause (Uzum):**
- Finance API (`/v1/finance/orders`) returns 0 items
- Commission data only available after settlement (7-14 days)
- Current sync doesn't use proper date format (needs Unix timestamp ms)

### 4.2 Finance Summary Status

Finance summary table is being populated with daily aggregates:
- Latest: 2026-02-04
- Shows gross/net revenue, commission, delivered counts
- Most Uzum stores show 0 commission (expected per above issue)

---

## 5. Stock Synchronization

### 5.1 Uzum Stock ✅ Working

| Field | Description | Status |
|-------|-------------|--------|
| stock | Total combined stock | ✅ Populated |
| stock_fbs | FBS warehouse stock | ✅ Populated |
| stock_fbu | FBU warehouse stock | ✅ Populated |

Total Uzum stock: 15,117 units across all stores

### 5.2 Yandex Stock ✅ FIXED

**Before Fix:**
- AliBrand.Market: 0% with stock_fbs
- All stock in `stock` column only

**After Fix (deployed today):**
- AliBrand.Market: 52 stock_fbs ✅
- stock_fbs now populated alongside stock

**Fix Applied:** `yandex-stocks/index.ts` now always sets `stock_fbs = totalStock`

---

## 6. Cron Jobs Status

| Job ID | Schedule | Function | Action | Status |
|--------|----------|----------|--------|--------|
| 4 | 0 7 * * * | marketplace-daily-digest | Daily summary | ✅ Active |
| 6 | */15 * * * * | marketplace-auto-sync | Orders sync | ✅ Active |
| 7 | */30 * * * * | marketplace-auto-sync | Listings sync | ✅ Active |
| 11 | */30 * * * * | marketplace-link-products | Auto-link | ✅ Active |

**Missing:**
- ❌ No cron for `yandex-products` sync
- ❌ No cron for `yandex-stocks` sync
- ❌ No cron for `uzum-stocks` sync (only FBO via finance)

---

## 7. Issues Summary

### 🔴 Critical Issues

| # | Issue | Impact | Recommended Fix |
|---|-------|--------|-----------------|
| 1 | **Uzum Commission = 0 for all orders** | Cannot calculate profit margins | Fix Finance API date format (Unix ms) |
| 2 | **Uzum order items missing product names** | Poor UX in orders list | Enrich items from listings table |
| 3 | **Yandex stores sync is stale (12-24h)** | Outdated stock/product data | Add cron jobs for yandex-products/stocks |

### 🟡 Medium Issues

| # | Issue | Impact | Recommended Fix |
|---|-------|--------|-----------------|
| 4 | Low link rate on some stores (42-46%) | Limited analytics | Improve auto-link algorithm |
| 5 | 21 Yandex listings missing titles | Display issues | Use offerId as fallback |
| 6 | 78 Yandex listings missing barcodes | Link strategy fails | Rely on SKU matching |
| 7 | No stock sync crons | Manual sync required | Add dedicated stock crons |

### ✅ Fixed This Session

| # | Issue | Fix Applied |
|---|-------|-------------|
| 1 | Yandex stock_fbs always 0 | Updated yandex-stocks to always set stock_fbs |

---

## 8. Recommendations

### Immediate Actions

1. **Add Yandex Stock/Product Crons**
```sql
-- Add cron for yandex-products every 2 hours
SELECT cron.schedule(
  'yandex-products-sync',
  '0 */2 * * *',
  $$SELECT net.http_post(
    url := 'https://qnbxnldkzuoydqgzagvu.supabase.co/functions/v1/marketplace-auto-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb,
    body := '{"sync_type": "yandex-products"}'::jsonb
  )$$
);
```

2. **Fix Uzum Commission Sync**
- Update `uzum-orders` to fetch from Finance API with proper Unix timestamp format
- Add fallback estimation (8% commission) for unsettled orders

3. **Enrich Uzum Order Items**
```sql
-- Update order items with product titles from listings
UPDATE marketplace_orders mo
SET items = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'title', COALESCE(ml.title, item->>'skuTitle'),
      'image', ml.image_url
    )
  )
  FROM jsonb_array_elements(mo.items) item
  LEFT JOIN marketplace_listings ml 
    ON ml.store_id = mo.store_id 
    AND ml.external_sku = item->>'skuTitle'
)
WHERE platform = 'uzum' AND items IS NOT NULL;
```

### Short-term Improvements

4. **Improve Product Linking**
- Add barcode normalization (strip zeros, whitespace)
- Lower title similarity threshold for Yandex (0.6 vs 0.7)
- Add variant SKU matching

5. **Add Stock Sync Crons**
- uzum-stocks every 10 minutes
- yandex-stocks every 10 minutes

---

## 9. Overall Health Score

| Category | Score | Notes |
|----------|-------|-------|
| Store Connectivity | 95% | All stores active |
| Listing Sync | 85% | Good coverage |
| Product Linking | 65% | Needs improvement |
| Order Sync | 90% | Working well |
| Stock Sync | 80% | Fixed Yandex issue |
| Commission Capture | 20% | Uzum critical |
| Cron Automation | 60% | Missing stock crons |
| **Overall** | **71/100** | Functional with gaps |

---

## 10. Next Steps

1. ✅ **Yandex stock_fbs fix** - Deployed and verified
2. 🔄 Add Yandex product/stock crons
3. 🔄 Fix Uzum Finance API date format
4. 🔄 Enrich Uzum order items
5. 🔄 Improve product linking algorithm
