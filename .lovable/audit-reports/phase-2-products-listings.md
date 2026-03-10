# Phase 2 Audit Report: Products/Listings Sync

**Audit Date:** 2026-02-04
**Status:** ✅ COMPLETED

---

## Executive Summary

Products and listings sync is **partially functional** with several critical issues identified:

| Metric | Value | Status |
|--------|-------|--------|
| Total Listings | 1,089 | ✅ Good |
| Linked to Products | 99 (9.1%) | 🔴 Critical |
| Unlinked Listings | 990 (90.9%) | 🔴 Critical |
| Internal Products | 8 | 🔴 Critical (too few) |
| Uzum Barcode Coverage | 93.5% (868/929) | ✅ Good |
| Yandex Barcode Coverage | 0% (0/160) | 🔴 Critical |

---

## 1. Product Sync Functions Test Results

### 1.1 Uzum Products Sync (`uzum-products`) ✅ WORKING

| Store | Products | SKUs | Synced | Failed |
|-------|----------|------|--------|--------|
| ALI BRAND MARKET | 107 | 247 | 242 | 5 |
| BM_store | 12 | 43 | 43 | 0 |

**Features Working:**
- ✅ Pagination (multi-page fetch)
- ✅ Barcode extraction (barCode/barcode fields)
- ✅ FBS/FBU stock separation
- ✅ Price extraction (sellPrice, fullPrice)
- ✅ Status mapping (ACTIVE → active)
- ✅ Sync logging

**Issues Found:**
- ⚠️ Duplicate barcode constraint violations (5 failed)
  - Error: `duplicate key value violates unique constraint "idx_listings_store_barcode_unique"`
  - Some SKUs share the same barcode within a store

### 1.2 Yandex Products Sync (`yandex-products`) 🟡 PARTIALLY WORKING

| Store | Offers | Synced | Failed |
|-------|--------|--------|--------|
| AliBrand.Market | 57 | 57 | 0 |
| Atlas Market | 59 | 59 | 0 |

**Issues Found:**
- 🔴 **No title extracted** - All Yandex listings have `title: null`
- 🔴 **No barcode extracted** - All Yandex listings have `external_barcode: null`
- 🔴 **No price extracted** - All listings have `price: null`
- 🔴 **All marked inactive** - Status mapping issue

**Root Cause:** The `yandex-products` function uses `offer.name` which may be undefined in the API response. The API likely returns `offerName` instead.

---

## 2. Listings Data Analysis

### 2.1 By Store - Barcode Coverage

| Store | Platform | Listings | With Barcode | Without | Coverage |
|-------|----------|----------|--------------|---------|----------|
| ALI BRAND MARKET | Uzum | 263 | 247 | 16 | 93.9% |
| Atlas Market | Uzum | 157 | 143 | 14 | 91.1% |
| Atlas.Market | Uzum | 78 | 78 | 0 | 100% |
| BM Store | Uzum | 46 | 46 | 0 | 100% |
| BM_store | Uzum | 43 | 43 | 0 | 100% |
| Uzum China Market | Uzum | 194 | 174 | 20 | 89.7% |
| Xit market | Uzum | 148 | 137 | 11 | 92.6% |
| AliBrand.Market | Yandex | 57 | 0 | 57 | 0% |
| Atlas Market | Yandex | 59 | 0 | 59 | 0% |
| BM_store | Yandex | 44 | 0 | 44 | 0% |

**Uzum Total:** 868/929 (93.4% with barcode)
**Yandex Total:** 0/160 (0% with barcode) ❌

### 2.2 Sample Yandex Listing Data

```
title: null
external_barcode: null
external_sku: "muzmar"
external_offer_id: "muzmar"
price: null
status: "inactive"
```

All 160 Yandex listings are missing critical data!

---

## 3. Product Linking Analysis

### 3.1 Current Link Status

```json
{
  "linked_count": 99,
  "unlinked_count": 990,
  "unlinked_with_barcode": 774,
  "link_rate": 9%,
  "by_strategy": {
    "title": 99
  }
}
```

**Observations:**
- All 99 linked listings used **title matching** strategy
- **0 linked by barcode** - because internal products have no barcodes
- 774 unlinked listings have barcodes but can't match

### 3.2 Internal Products Analysis

| Product Name | Barcode | Category | Cost Price | Tashkent Stock |
|--------------|---------|----------|------------|----------------|
| apple sumka | null | Bags | 30,450 | 61 |
| dfgdgd | null | - | - | 25,053 |
| Test Sumka 2025 | null | - | - | 5 |
| sumka | null | - | 10 | 20 |
| sumka A2 | null | Bags | - | 325 |
| Sumka A2 | null | Bags | - | 350 |
| sumka 2 | null | Bags | - | 85 |
| qora maska ekan | null | - | - | 5 |

**Critical Finding:** All 8 internal products have `barcode: null`!

### 3.3 Why Linking Fails

1. **Barcode matching fails** - Internal products have no barcodes
2. **Title matching is weak** - Generic names like "sumka" match too many listings
3. **Only 8 products** - Not enough to match 1,089 listings

---

## 4. Identified Issues Summary

### 🔴 Critical Issues

| # | Issue | Impact | Fix Required |
|---|-------|--------|--------------|
| 1 | Yandex listings have no title/barcode/price | Cannot link Yandex products | Fix `yandex-products` to use correct API fields |
| 2 | Internal products have no barcodes | Cannot do barcode matching | Add barcodes to products |
| 3 | Only 8 internal products | Cannot match 1,089 listings | Import product catalog |
| 4 | Duplicate barcode constraint | 5 SKUs fail to sync | Update upsert logic |

### 🟡 Medium Issues

| # | Issue | Impact | Fix Required |
|---|-------|--------|--------------|
| 1 | All Yandex listings marked "inactive" | UI shows wrong status | Fix status extraction |
| 2 | Title-only linking is weak | Poor match quality | Improve similarity algorithm |

---

## 5. Code Issues Found

### 5.1 `yandex-products/index.ts` - Lines 93-108

**Problem:** Using wrong field names

```typescript
// Current code (WRONG):
title: offer.name,  // undefined in API response
price: offer.price?.value,  // structure may differ

// Should be:
title: offer.offerName || offer.name || offer.title,
price: offer.price?.value || offer.prices?.[0]?.value,
```

### 5.2 `uzum-products/index.ts` - Line 305

**Problem:** Upsert conflict on `store_id,external_sku,fulfillment_type` but there's also a unique constraint on `store_id,external_barcode`

```typescript
// Current: onConflict: 'store_id,external_sku,fulfillment_type'
// Missing handling for barcode uniqueness
```

---

## 6. Recommendations

### Immediate Fixes Required

1. **Fix `yandex-products` function**
   - Use `offer.offerName` instead of `offer.name`
   - Extract barcode from offer data (if available)
   - Fix price extraction
   - Fix status mapping

2. **Fix barcode duplicate handling in `uzum-products`**
   - Handle SKUs that share barcodes
   - Either skip duplicates or use upsert on barcode

3. **Add barcodes to internal products**
   - Update the 8 existing products with actual barcodes
   - Or import products from marketplace listings

4. **Import product catalog**
   - Create products from marketplace listings
   - Bulk import from Excel with barcodes

---

## 7. Sync Functions Summary

| Function | Status | Issues |
|----------|--------|--------|
| `uzum-products` | 🟢 Working | Minor: duplicate barcode handling |
| `yandex-products` | 🔴 Broken | No title/barcode/price extracted |
| `marketplace-link-products` | 🟢 Working | Limited by missing product data |

---

## Phase 2 Conclusion

**Products Sync: 🟡 PARTIALLY FUNCTIONAL**

- Uzum product sync works well (93%+ barcode coverage)
- Yandex product sync is broken (missing all key data)
- Product linking works but is limited by:
  - No barcodes in internal products
  - Only 8 internal products vs 1,089 listings
  - Yandex listings have no linkable data

**Next Phase:** Phase 3 - Orders Sync Audit
