# Phase 3: Orders Sync Audit Report
**Date**: 2026-02-04
**Status**: COMPLETED

---

## Executive Summary

| Platform | Total Orders | Last 30 Days | Pagination | Data Quality |
|----------|-------------|--------------|------------|--------------|
| **Uzum** | 4,842 | 3,143 | ✅ Working | ⚠️ Missing Data |
| **Yandex** | 218 | 178 | ✅ Working | ✅ Complete |

---

## 1. Sync Function Testing

### 1.1 Uzum Orders (`uzum-orders`)
**Status**: 🟢 Pagination Working, 🟡 Data Incomplete

**Test Results**:
- ✅ Multi-status pagination: Tested all 11 statuses with multiple pages per status
- ✅ Rate limiting: Handling 429 errors with exponential backoff (1000ms retry)
- ✅ Deduplication: Using Map to prevent duplicate order entries
- ✅ FBS/FBU detection: Correctly identifies fulfillment type from `scheme` field

**Pagination Logs** (ALI BRAND MARKET):
```
Status COMPLETED page 0-7: 392 orders total (8 pages)
Status CANCELED page 0-5: 257 orders (6 pages)  
Status RETURNED page 0-3: 164 orders (4 pages)
Status DELIVERED_TO_CUSTOMER_DELIVERY_POINT page 0-2: 109 orders (3 pages)
Total: 982 unique orders processed
```

### 1.2 Yandex Orders (`yandex-orders`)
**Status**: 🟢 Fully Working

**Test Results**:
- ✅ Dual campaign support (FBY+FBS): BM_store processed 2 campaigns, 63 orders
- ✅ Pagination: Using pageToken with limit 200
- ✅ Data mapping: `offerName` → `title`, `count` → `quantity`
- ✅ Commission tracking: 92 orders have commission data

**Sample Response**:
```json
{
  "campaigns_processed": 2,
  "orders_received": 63,
  "synced": 63,
  "failed": 0
}
```

---

## 2. Data Quality Analysis

### 2.1 Uzum Order Items - ⚠️ CRITICAL ISSUE

**Problem**: Uzum order items are **missing critical fields**:
- ❌ `title` / `productTitle`: NULL for all orders
- ❌ `photoKey` / `productImage`: NULL for all orders  
- ✅ `skuTitle`: Only field with product identifier (e.g., "ABMARKE-SHIDISH-ЧЕРН")
- ✅ `quantity`: Present and correct

**Sample Order Item (database)**:
```json
{
  "id": 183654777,
  "quantity": 1,
  "skuTitle": "ABMARKE-SHIDISH-ЧЕРН"
}
```

**Root Cause Analysis**:
Looking at `uzum-orders/index.ts` lines 623-639, the code correctly maps:
```typescript
items: order.orderItems?.map(item => ({
  title: item.productTitle,      // Should come from API
  image: item.productImage?.photoKey, // Should come from API
  ...
}))
```

The API (`/v2/fbs/orders`) is not returning `productTitle` or `productImage` fields. The `/v2/fbs/orders` endpoint appears to return minimal item data.

**Impact**: 
- Order list UI cannot show product names (only SKU codes)
- Product images not displayed
- Users cannot easily identify what was ordered

### 2.2 Uzum Commission Data - ⚠️ CRITICAL ISSUE

**Problem**: All 4,842 Uzum orders have `commission = 0`

| Store | Orders | Has Commission | Total Commission |
|-------|--------|----------------|------------------|
| Atlas Market | 1,337 | 0 | 0 |
| Uzum China Market | 1,358 | 0 | 0 |
| ALI BRAND MARKET | 983 | 0 | 0 |
| Xit market | 428 | 0 | 0 |
| BM Store | 373 | 0 | 0 |
| BM_store | 237 | 0 | 0 |
| Atlas.Market | 126 | 0 | 0 |

**Root Cause**:
From logs: `[uzum-orders] Finance API page 0: 0 items`

The Finance API (`/v1/finance/orders`) is returning 0 items, meaning:
1. Either the API endpoint requires different parameters
2. Or there's no financial settlement data yet for recent orders

**Note**: Finance API only shows orders after settlement is complete (can take days).

### 2.3 Yandex Order Items - ✅ WORKING

**Yandex orders have complete data**:
```json
{
  "title": "Планшет S-linda ZT11 Ultra Pro 16gb+512gb",
  "offerName": "Планшет S-linda ZT11 Ultra Pro 16gb+512gb",
  "quantity": 1,
  "count": 1,
  "price": 1200000,
  "marketSku": 4741507716
}
```

| Store | Orders | Has Commission |
|-------|--------|----------------|
| AliBrand.Market | 84 | 44 (52%) |
| BM_store | 82 | 32 (39%) |
| Atlas Market | 50 | 16 (32%) |

---

## 3. Status Mapping Validation

### 3.1 Uzum Statuses (11 unique)
| Status | Count | Mapping |
|--------|-------|---------|
| COMPLETED | 2,230 | → delivered ✅ |
| CANCELED | 1,160 | → cancelled ✅ |
| RETURNED | 939 | → returned ✅ |
| DELIVERED_TO_CUSTOMER_DELIVERY_POINT | 324 | → shipped ✅ |
| ACCEPTED_AT_DP | 100 | → shipped ✅ |
| PENDING_DELIVERY | 44 | → pending ✅ |
| DELIVERING | 37 | → shipped ✅ |
| DELIVERED | 6 | → delivered ✅ |
| PACKING | 1 | → pending ✅ |
| CREATED | 1 | → pending ✅ |

### 3.2 Yandex Statuses (9 unique)
| Status | Count | Notes |
|--------|-------|-------|
| DELIVERED | 93 | ✅ |
| CANCELLED_IN_PROCESSING | 42 | ✅ |
| CANCELLED_IN_DELIVERY | 27 | ✅ |
| CANCELLED_BEFORE_PROCESSING | 27 | ✅ |
| PICKUP | 13 | ✅ |
| PROCESSING | 8 | ✅ |
| DELIVERY | 5 | ✅ |
| RETURNED | 2 | ✅ |
| PARTIALLY_DELIVERED | 1 | ✅ |

---

## 4. Fulfillment Type Breakdown

### 4.1 Uzum
| Fulfillment | Orders | Avg Amount |
|-------------|--------|------------|
| FBS | 4,842 | ~50,000 UZS |
| FBU | 0 | - |

**Note**: No FBU orders synced because Finance API returns 0 items.

### 4.2 Yandex (BM_store)
| Fulfillment | Orders | Avg Amount |
|-------------|--------|------------|
| FBS | 70 | 90,260 UZS |
| FBY | 11 | 93,162 UZS |
| fby_fbs (hybrid) | 1 | 105,945 UZS |

---

## 5. Issues Found

### Critical Issues 🔴

1. **Uzum Order Items Missing Product Data**
   - **Impact**: UI cannot show product names or images
   - **Root Cause**: `/v2/fbs/orders` API doesn't return `productTitle` or `productImage`
   - **Proposed Fix**: Enrich order items by cross-referencing with `marketplace_listings` table using `productId`

2. **Uzum Commission Data Not Syncing**
   - **Impact**: Cannot calculate profit margins for Uzum orders
   - **Root Cause**: Finance API returns 0 items
   - **Proposed Fix**: Check Finance API parameters; may need date range adjustment

### Medium Issues 🟡

3. **FBU Orders Not Syncing**
   - **Impact**: Missing warehouse-fulfilled orders
   - **Root Cause**: Same as #2 - depends on Finance API
   - **Note**: FBU orders only appear after settlement

---

## 6. Code Quality Assessment

### uzum-orders/index.ts (796 lines)
- ✅ Proper pagination with MAX_PAGES_PER_STATUS = 20
- ✅ Rate limiting with exponential backoff
- ✅ Deduplication using Map
- ✅ FBS stock decrement logic for linked products
- ⚠️ Large file - consider refactoring
- ⚠️ Finance API enrichment returning 0 items

### yandex-orders/index.ts (271 lines)
- ✅ Multi-campaign support (FBY+FBS)
- ✅ Pagination with pageToken
- ✅ Unified field mapping (title, quantity)
- ✅ Commission tracking from API response
- ✅ Reasonable file size

---

## 7. Recommendations

### Immediate Fixes Required

1. **Enrich Uzum Order Items with Product Data**
   ```sql
   -- After order sync, enrich items with listing data
   UPDATE marketplace_orders mo
   SET items = (
     SELECT jsonb_agg(
       item || jsonb_build_object(
         'title', ml.title,
         'image', ml.image_url
       )
     )
     FROM jsonb_array_elements(mo.items) item
     LEFT JOIN marketplace_listings ml 
       ON ml.store_id = mo.store_id 
       AND ml.external_product_id = item->>'productId'
   )
   WHERE mo.store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'uzum');
   ```

2. **Debug Uzum Finance API**
   - Test with explicit date range (Unix timestamps in milliseconds)
   - Check if orders are settled (typically 7-14 days after delivery)

3. **Add Fallback Product Title**
   - Use `skuTitle` as fallback when `title` is null
   - Update UI to display: `title || skuTitle || 'Unknown Product'`

---

## 8. Test Summary

| Test Case | Uzum | Yandex |
|-----------|------|--------|
| API Connectivity | ✅ | ✅ |
| Pagination | ✅ | ✅ |
| Multi-campaign (Yandex) | N/A | ✅ |
| Status Mapping | ✅ | ✅ |
| Item Data Complete | ❌ | ✅ |
| Commission Data | ❌ | ✅ |
| Fulfillment Type | ✅ | ✅ |
| Date Range Filtering | ✅ | ✅ |

**Overall Score**: 
- **Uzum**: 6/8 (75%) - needs product data enrichment
- **Yandex**: 8/8 (100%) - fully operational

---

## Next Steps

Proceed to **Phase 4: Stock Sync Audit** to verify bidirectional stock synchronization.
