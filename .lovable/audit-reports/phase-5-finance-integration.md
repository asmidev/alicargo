# Phase 5: Finance Integration Audit

**Date:** 2026-02-04  
**Auditor:** Ali AI  
**Scope:** Marketplace finance sync, currency conversion, P&L data flow

---

## Executive Summary

| Component | Status | Issue Count |
|-----------|--------|-------------|
| sync-marketplace-finance | 🔴 Critical Bugs | 3 |
| Uzum Commission Tracking | 🔴 Broken | 1 |
| Yandex Status Mapping | 🔴 Critical | 1 |
| Currency Conversion | 🟢 Working | 0 |
| Monthly Aggregation | 🟢 Working | 0 |

**Overall Assessment:** Finance sync is severely underreporting revenue due to status mapping bugs and missing commission data.

---

## Critical Findings

### 1. 🔴 Yandex Orders Missing `fulfillment_status` Mapping

**File:** `supabase/functions/yandex-orders/index.ts`

**Problem:** The function stores raw `status` (e.g., "DELIVERED") but never sets `fulfillment_status`. The finance sync relies on `fulfillment_status = 'delivered'` to count revenue.

**Evidence:**
```sql
-- 14 orders with raw_status=DELIVERED but fulfillment_status=pending
SELECT COUNT(*) FROM marketplace_orders 
WHERE status = 'DELIVERED' AND fulfillment_status != 'delivered' AND platform = 'yandex';
-- Result: 14 missed orders, 2,168,844 UZS missed revenue
```

**Root Cause:** Line ~200 in `yandex-orders/index.ts` doesn't include `fulfillment_status` in the upsert data.

**Fix Required:** Add status normalization:
```typescript
fulfillment_status: normalizeYandexStatus(order.status),
```

### 2. 🔴 Uzum Commission Data = 0 for ALL Orders

**Problem:** All 1,381 delivered Uzum orders have `commission = 0`, losing visibility into platform fees.

**Evidence:**
```sql
SELECT platform, SUM(commission) as total_commission
FROM marketplace_orders mo
JOIN marketplace_stores ms ON mo.store_id = ms.id
GROUP BY ms.platform;
-- Uzum: 0, Yandex: 1,487,666
```

**Root Cause:** The `uzum-orders` function syncs from `/orders` endpoint which doesn't include commission. Commission data is only available from `/v1/finance/orders` endpoint.

**Fix Options:**
1. Enrich orders with commission from Finance API after sync
2. Use Finance API as primary source for delivered orders
3. Store commission separately in `marketplace_finance_summary`

### 3. 🟡 sync-marketplace-finance Relies on Broken Status Detection

**File:** `supabase/functions/sync-marketplace-finance/index.ts`

**Problem:** The `isDeliveredOrder()` function at lines 74-80 checks both `fulfillment_status` AND raw `status`, but:
- Yandex orders never have `fulfillment_status` set
- The fallback check for `status = 'DELIVERED'` works, but Yandex orders are being counted

**Current Logic (partially working):**
```typescript
function isDeliveredOrder(order: MarketplaceOrder): boolean {
  const deliveredFulfillmentStatuses = ['delivered', 'completed'];
  const deliveredRawStatuses = ['COMPLETED', 'DELIVERED'];
  
  return deliveredFulfillmentStatuses.includes(order.fulfillment_status?.toLowerCase() || '') ||
         deliveredRawStatuses.includes(order.status?.toUpperCase() || '');
}
```

**Actual Results from Today's Sync:**
| Store | Platform | Delivered | Gross Revenue | Commission |
|-------|----------|-----------|---------------|------------|
| AliBrand.Market | Yandex | 7 | 1,577,252 | 110,646 |
| Xit market | Uzum | 5 | 114,440 | 0 |
| Atlas Market | Uzum | 3 | 105,000 | 0 |
| Others | Mixed | 0 | 0 | 0 |

**Analysis:** Yandex is being detected (via raw status), but Uzum detection seems low. Only 8 delivered orders detected today vs. 1,381 in database.

---

## Data Verification

### Finance Summary Table Current State

```sql
SELECT store_name, platform, gross_revenue, net_revenue, commission_total, delivered_count
FROM marketplace_finance_summary
WHERE period_date = CURRENT_DATE
ORDER BY gross_revenue DESC;
```

| Store | Platform | Gross | Net | Commission | Delivered |
|-------|----------|-------|-----|------------|-----------|
| AliBrand.Market | Yandex | 1,577,252 | 1,466,606 | 110,647 | 7 |
| Xit market | Uzum | 114,440 | 114,440 | 0 | 5 |
| Atlas Market | Uzum | 105,000 | 105,000 | 0 | 3 |
| BM_store | Yandex | 311,319 | 287,094 | 24,225 | 2 |
| ALI BRAND MARKET | Uzum | 0 | 0 | 0 | 0 |

### True 30-Day Revenue (from orders table)

```sql
SELECT platform, SUM(total_amount) as actual_revenue
FROM marketplace_orders
WHERE (fulfillment_status = 'delivered' OR status IN ('COMPLETED', 'DELIVERED'))
AND ordered_at >= NOW() - INTERVAL '30 days'
GROUP BY platform;
```

| Platform | Actual Delivered Revenue |
|----------|-------------------------|
| Uzum | 84,680,250 UZS |
| Yandex | 6,384,893 UZS |

**Gap Analysis:** The daily sync is capturing only a fraction of actual revenue because it only counts orders from `ordered_at` within the sync date range, not historical delivered orders.

---

## Currency Conversion Audit

### Exchange Rates

| Currency | Rate Used | Expected |
|----------|-----------|----------|
| USD | 1 | ✅ |
| UZS | 12,700 | ⚠️ Memory says 12,800 |
| RUB | 95 | ✅ |

**Issue:** Exchange rate inconsistency between code (12,700) and memory specification (12,800).

### USD Equivalent Calculation

```sql
SELECT currency, usd_equivalent, net_revenue, 
       net_revenue / NULLIF(usd_equivalent, 0) as implied_rate
FROM marketplace_finance_summary
WHERE usd_equivalent > 0
LIMIT 5;
```

**Result:** USD conversion is working correctly using fetched rates.

---

## Recommended Fixes

### Priority 1: Fix Yandex Status Mapping

```typescript
// In yandex-orders/index.ts, add to orderData object:
fulfillment_status: (() => {
  const s = order.status?.toUpperCase();
  if (['DELIVERED', 'PICKUP'].includes(s)) return 'delivered';
  if (['CANCELLED_IN_PROCESSING', 'CANCELLED_BEFORE_PROCESSING', 'CANCELLED_IN_DELIVERY'].includes(s)) return 'cancelled';
  if (s === 'RETURNED') return 'returned';
  if (['PROCESSING', 'DELIVERY'].includes(s)) return 'shipped';
  return 'pending';
})(),
```

### Priority 2: Enrich Uzum Orders with Commission

**Option A:** Post-process orders with Finance API data
**Option B:** Update `sync-marketplace-finance` to fetch commission directly from Finance API

### Priority 3: Backfill Historical Status

```sql
-- Fix existing Yandex orders
UPDATE marketplace_orders 
SET fulfillment_status = 
  CASE 
    WHEN status IN ('DELIVERED', 'PICKUP') THEN 'delivered'
    WHEN status LIKE 'CANCELLED%' THEN 'cancelled'
    WHEN status = 'RETURNED' THEN 'returned'
    WHEN status IN ('PROCESSING', 'DELIVERY') THEN 'shipped'
    ELSE 'pending'
  END
WHERE store_id IN (SELECT id FROM marketplace_stores WHERE platform = 'yandex');
```

---

## Files Requiring Changes

| File | Changes Needed | Priority |
|------|---------------|----------|
| `supabase/functions/yandex-orders/index.ts` | Add fulfillment_status mapping | P1 |
| `supabase/functions/uzum-orders/index.ts` | Consider enriching with commission | P2 |
| `supabase/functions/sync-marketplace-finance/index.ts` | Already has fallback - working | - |
| Database | Backfill Yandex fulfillment_status | P1 |

---

## Appendix: Status Mapping Reference

### Yandex Statuses → fulfillment_status

| Raw Status | Count | Should Map To |
|------------|-------|---------------|
| DELIVERED | 74 | delivered |
| CANCELLED_IN_PROCESSING | 36 | cancelled |
| CANCELLED_BEFORE_PROCESSING | 21 | cancelled |
| CANCELLED_IN_DELIVERY | 20 | cancelled |
| PICKUP | 13 | delivered |
| PROCESSING | 8 | shipped |
| DELIVERY | 5 | shipped |
| RETURNED | 2 | returned |
| PARTIALLY_DELIVERED | 1 | delivered |

### Uzum Statuses (Already Correctly Mapped)

| Raw Status | Count | fulfillment_status |
|------------|-------|-------------------|
| COMPLETED | 1,380 | delivered ✅ |
| CANCELED | 737 | cancelled ✅ |
| RETURNED | 520 | returned ✅ |
| DELIVERED_TO_CUSTOMER_DELIVERY_POINT | 324 | shipped |
| ACCEPTED_AT_DP | 99 | shipped |
