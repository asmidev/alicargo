# FBU Finance API Diagnostic Report — BREAKTHROUGH

**Date:** 2026-02-10  
**Scope:** Uzum Finance API `/v1/finance/orders` — exhaustive parameter testing

---

## 🎉 ROOT CAUSE FOUND: Unix SECONDS, not MILLISECONDS

**The Finance API requires Unix timestamps in SECONDS, not milliseconds.**

All previous tests (16+ combinations, both sellers, over 1 year) used milliseconds — which silently returned 0 results with HTTP 200. Switching to **Unix seconds** immediately returned **hundreds of real finance records**.

---

## Test Matrix Results (BM Store, shop 89165)

| # | Test Case | Timestamp | Items | totalElements |
|---|-----------|-----------|-------|---------------|
| 1 | MS + statuses + 30d | milliseconds | **0** | **0** |
| 2 | MS + statuses + 365d | milliseconds | **0** | **0** |
| 3 | **SEC + statuses + 30d** | **seconds** | **10** | **486** |
| 4 | **SEC + statuses + 365d** | **seconds** | **10** | **834** |
| 5 | MS + NO statuses + 30d | milliseconds | **0** | **0** |
| 6 | **SEC + NO statuses + 30d** | **seconds** | **10** | **486** |
| 7 | MS + group=true + 30d | milliseconds | **0** | **0** |
| 8 | **SEC + group=true + 30d** | **seconds** | **10** | **12** (grouped) |
| 9 | MS + group=true + 365d | milliseconds | **0** | **0** |
| 10 | **SEC + group=true + 365d** | **seconds** | **10** | **12** (grouped) |
| 11 | MS + group=false + 365d | milliseconds | **0** | **0** |
| 12 | **SEC + group=false + 365d** | **seconds** | **10** | **834** |
| 13 | MS + statuses + 1d | milliseconds | **0** | **0** |
| 14 | MS + statuses + 7d | milliseconds | **0** | **0** |
| 15 | **SEC + statuses + 7d** | **seconds** | **10** | **107** |
| 16 | MS + TO_WITHDRAW only + 365d | milliseconds | **0** | **0** |
| 17 | MS + PROCESSING only + 365d | milliseconds | **0** | **0** |

### Expenses API

| # | Test Case | Timestamp | Items |
|---|-----------|-----------|-------|
| 18 | Expenses MS + 365d | milliseconds | **0** |
| 19 | **Expenses SEC + 365d** | **seconds** | **10+** (real logistics payments!) |

---

## Sample Finance Order Item (Real Data)

```json
{
  "id": 185294144,
  "status": "PROCESSING",
  "date": 1770725621728,
  "orderId": 92540747,
  "skuTitle": "BM77-LIPUCHKA-CЕРМЕЛ",
  "productId": 2185451,
  "productTitle": null,
  "purchasePrice": 50000,
  "sellPrice": 11200,
  "sellerProfit": 3960,
  "commission": 2240,
  "logisticDeliveryFee": 5000,
  "amount": 1,
  "amountReturns": 0,
  "shopId": 89165,
  "withdrawnProfit": 0,
  "productImage": { "photoKey": "d4rg8nbtqdhgicat3r80" }
}
```

## Sample Grouped Item (group=true)

```json
{
  "productId": 2311323,
  "shopId": 89165,
  "productTitle": "AirPods 3 pro simsiz quloqchinlar",
  "items": [{
    "skuTitle": "BM77-AIRPODS",
    "skuId": 8282146,
    "amount": 2,
    "commission": 54000,
    "sellPrice": 270000,
    "sellerProfit": 206000,
    "purchasePrice": 2000000,
    "logisticDeliveryFee": 10000
  }]
}
```

## Sample Expense Item

Logistics payment: "Buyurtma № 92365517 uchun logistika xizmatlari uchun to'lov." — 5000 UZS

---

## Key Findings

1. **SECONDS vs MILLISECONDS is the entire problem.** The OpenAPI spec says `int64` without specifying — it means Unix seconds.
2. **834 total finance items** for BM Store over 1 year — this includes ALL fulfillment types (FBS + FBU).
3. **`group=true` works** and returns product-grouped data with `productTitle` populated (unlike `group=false` where `productTitle` is null).
4. **Expenses API returns real logistics costs** — can be used for cost tracking.
5. **No permission issues** — the API keys have full finance access, we were just calling it wrong.

## Action Items

1. **Fix `uzum-finance` edge function** — change `buildFinanceParams()` to use `Math.floor(Date.now() / 1000)` instead of `Date.now()`
2. **Use `group=false`** for order-level sync (834 items = individual order items)
3. **Use `group=true`** for product analytics (12 grouped products with aggregated stats)
4. **Fix `marketplace-auto-sync`** — the `sync_fbu_orders` action will now return real data
5. **Update expenses sync** — also needs seconds timestamps
