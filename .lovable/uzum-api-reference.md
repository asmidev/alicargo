# Uzum Seller Open API — Complete Reference

**Source:** Official OpenAPI spec from `https://api-seller.uzum.uz/api/seller-openapi/swagger/api-docs`  
**Last updated:** 2026-02-10

---

## All Endpoints

### DBS (Stock Management)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v2/fbs/sku/stocks` | Get FBS/DBS stock levels |
| POST | `/v2/fbs/sku/stocks` | Update FBS/DBS stock levels |

### FBS (Orders + Stock)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/fbs/order/{orderId}` | Get single order by ID |
| POST | `/v1/fbs/order/{orderId}/cancel` | Cancel order |
| POST | `/v1/fbs/order/{orderId}/confirm` | Confirm order |
| GET | `/v1/fbs/order/{orderId}/labels/print` | Print label |
| GET | `/v1/fbs/order/return-reasons` | Return reasons |
| GET | `/v2/fbs/orders` | Get orders by status (**FBS+DBS ONLY**, no FBU) |
| GET | `/v2/fbs/orders/count` | Count orders |

### FBS Invoice (Delivery invoices)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/fbs/invoice` | Get FBS invoices (with status filter) |
| POST | `/v1/fbs/invoice` | Create invoice |
| GET | `/v1/fbs/invoice/{id}` | Get invoice by ID |
| POST | `/v1/fbs/invoice/{id}/cancel` | Cancel invoice |
| GET | `/v1/fbs/invoice/{id}/closing-documents` | Print acceptance act |
| GET | `/v1/fbs/invoice/{id}/orders` | Get orders by invoice |
| GET | `/v1/fbs/invoice/{id}/print` | Print supply act |
| POST | `/v1/fbs/invoice/{id}/update-content` | Update invoice |
| GET | `/v1/fbs/invoice/dop/drop-off-points` | Drop-off points |
| GET | `/v1/fbs/invoice/dop/time-slot` | Time slots |
| POST | `/v1/fbs/invoice/dop/time-slot` | Update time slot |

### Finance (Sales/Settlements)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/finance/expenses` | Seller expenses |
| GET | `/v1/finance/orders` | Sales/order settlements (ALL fulfillment types) |

#### `/v1/finance/orders` Parameters
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `shopIds` | int64 (repeatable) | Yes | Shop IDs to filter |
| `dateFrom` | int64 | Yes | Start date (Unix ms) |
| `dateTo` | int64 | Yes | End date (Unix ms) |
| `statuses` | string (repeatable) | No | `TO_WITHDRAW`, `PROCESSING`, `CANCELED`, `PARTIALLY_CANCELLED` |
| `group` | boolean | No | Default `false`. When `true`, returns `ProductGroupedSellerItem` instead of `SellerOrderItemDto` |
| `size` | int32 | No | Page size |
| `page` | int32 | No | Page number |

#### Response Schema
- `group=false`: `{ totalElements, orderItems: SellerOrderItemDto[] }`
- `group=true`: `{ totalElements, items: ProductGroupedSellerItem[] }`

### Invoice (Supply + Return invoices)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/invoice` | **Seller-level** invoices (all shops) |
| GET | `/v1/return` | **Seller-level** returns (all shops) |
| GET | `/v1/shop/{shopId}/invoice` | Shop-specific invoices |
| GET | `/v1/shop/{shopId}/invoice/products` | Invoice products |
| GET | `/v1/shop/{shopId}/return` | Shop-specific returns |
| GET | `/v1/shop/{shopId}/return/{returnId}` | Return details |

### Product
| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/product/{shopId}/sendPriceData` | Update prices |
| GET | `/v1/product/shop/{shopId}` | Get products |

### Shop
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/shops` | List seller shops |

---

## Key Findings

1. **No FBU order endpoint exists.** `/v2/fbs/orders` only supports `FBS` and `DBS` schemes.
2. **Finance API is the ONLY source for FBU order data** — shows settled sales for all fulfillment types.
3. **`group` parameter** changes response schema entirely — must be tested.
4. **Seller-level endpoints** (`/v1/invoice`, `/v1/return`) aggregate across all shops without needing shopId.
5. **`/v1/finance/expenses`** — never tested, may contain FBU-related cost data.
