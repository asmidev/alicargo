# Yandex Market API — To'liq Texnik Ma'lumotnoma

> **Oxirgi yangilanish:** 2026-02-19  
> **Loyiha:** AliCargo CRM  
> **Manba:** Edge funksiyalar kodi + DB konfiguratsiyasi (haqiqiy qiymatlar)

---

## Bo'lim 1: Do'konlar Konfiguratsiyasi

Quyidagi ma'lumotlar `marketplace_stores` jadvalidan olingan haqiqiy qiymatlar:

| Do'kon | Platform | Fulfillment | Campaign ID | FBS Campaign ID | FBY Campaign ID | Business ID | API Key Secret |
|--------|----------|-------------|-------------|-----------------|-----------------|-------------|----------------|
| AliBrand.Market | yandex | fby | — | — | 148843590 | 216469176 | YANDEX_ABDUMANNON_API_KEY |
| Atlas Market | yandex | fbs | 148987777 | — | — | 216469176 | YANDEX_ATLAS_MARKET_API_KEY |
| BM_store | yandex | fby_fbs | — | 148916383 | 148939239 | 216515645 | YANDEX_BM_STORE_API_KEY |

> ⚠️ **Muhim:** AliBrand.Market va Atlas Market bir xil `business_id` (216469176) ulashadi — bu ular bir Yandex biznesiga tegishli ekanini bildiradi. BM_store esa alohida biznesga (216515645) tegishli.

### 1.1 Fulfillment Turlari

| Tur | Tavsif | Qo'llaniladigan do'kon |
|-----|--------|------------------------|
| `fby` | Fulfillment by Yandex — Yandex omboridan jo'natiladi | AliBrand.Market |
| `fbs` | Fulfillment by Seller — sotuvchi omboridan jo'natiladi | Atlas Market |
| `fby_fbs` | Gibrid — ikkala kampaniya ham faol | BM_store |

---

## Bo'lim 2: API Asoslari

```
Base URL:  https://api.partner.market.yandex.ru
Auth:      Header "Api-Key: <secret_value>"
Format:    JSON (Content-Type: application/json)
Encoding:  UTF-8
```

### 2.1 Autentifikatsiya

Barcha so'rovlar HTTP header orqali autentifikatsiya qilinadi:

```http
Api-Key: <YANDEX_*_API_KEY qiymati>
Content-Type: application/json
```

Secret nomlar Supabase (Lovable Cloud) Vault'da saqlanadi va edge funksiyalarda `Deno.env.get(store.api_key_secret_name)` orqali olinadi.

### 2.2 Asosiy Xato Kodlari

| HTTP Kod | Ma'no | Harakat |
|----------|-------|---------|
| 200 | Muvaffaqiyatli | — |
| 400 | Noto'g'ri so'rov | Request body ni tekshiring |
| 401 | Autentifikatsiya xatosi | API kalit muddati o'tgan yoki noto'g'ri |
| 403 | Ruxsat yo'q | API kalit bu businessga ruxsat bermaydi |
| 404 | Topilmadi | `business_id` yoki `campaign_id` noto'g'ri |
| 429 | Ko'p so'rov | Rate limit — kechikish qo'shing |
| 500 | Server xatosi | Qayta urinib ko'ring |

### 2.3 Pagination

Ko'pgina endpoint'lar `pageToken` (yoki `page_token`) asosida pagination qiladi:

```json
{
  "result": {
    "paging": {
      "nextPageToken": "abc123..."
    }
  }
}
```

`nextPageToken` mavjud bo'lsa — keyingi sahifani so'rang. `undefined` yoki `null` bo'lsa — oxirgi sahifa.

---

## Bo'lim 3: Edge Funksiyalar (12 ta)

### 3.1 `yandex-products` — Mahsulotlar Sinxronizatsiyasi

**Fayl:** `supabase/functions/yandex-products/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;    // marketplace_stores.id (UUID)
  page?: number;       // (ishlatilmaydi, pagination avtomatik)
  page_size?: number;  // (ishlatilmaydi, limit=50 qattiq belgilangan)
}
```

#### API chaqiruvi
```http
POST /businesses/{businessId}/offer-mappings
Content-Type: application/json

{
  "archived": false,
  "limit": 50,
  "page_token": "..."   // keyingi sahifalar uchun
}
```

#### Muhim parametrlar
- **Max offers:** 1500 ta (MAX_OFFERS sababi: edge function timeout)
- **Sahifalar orasida kechikish:** 100ms (API_DELAY_MS)
- **Batch upsert hajmi:** 200 ta listing bir vaqtda

#### Response tuzilmasi
```typescript
{
  result: {
    offerMappings: YandexOfferMapping[];
    paging?: { nextPageToken?: string };
  }
}
```

#### Qaytariladigan natija
```typescript
{
  success: boolean;
  store: string;
  business_id: string;
  campaign_id: string;
  api_key_secret: string;
  offers_received: number;
  pages_fetched: number;
  synced: number;
  failed: number;
  // Xato holati:
  error_code?: number;
  error?: string;
  diagnosis?: string;
}
```

#### DB operatsiyasi
```sql
-- Conflict key: (store_id, external_sku, fulfillment_type)
UPSERT INTO marketplace_listings (
  store_id, external_sku, external_product_id, external_offer_id,
  external_barcode, fulfillment_type, title, price, currency,
  status, moderation_status, last_synced_at, product_rank, image_url
)
```

#### Muhim biznes mantiqi
1. **FBY+FBS do'konlar:** Har bir `offerId` uchun 2 ta listing yaratiladi (`fbs` + `fby` fulfillment_type)
2. **CDN filter:** `wbcontent.net` va `ozone.ru` URL'lari bloklangan (hotlinking ruxsat bermaydi)
3. **Deduplikatsiya:** `store_id|external_sku|fulfillment_type` kalit orqali bir xil offerlar olib tashlanadi
4. **Stock maydonlari:** `yandex-products` `stock` ustunini YOZMAYDI — bu `yandex-stocks` ishi (ma'lumot yo'qolishini oldini olish)
5. **Arxivlangan:** `archived: false` filtr API darajasida qo'llanadi; arxivlangan offerlar `status: 'inactive'` sifatida saqlanadi

#### Autentifikatsiya xatosi holati
```typescript
// API 401/403 qaytarsa — exception emas, informativ response:
{
  success: false,
  error_code: 401,
  error: "Authentication failed (HTTP 401). API key '...' may be expired...",
  diagnosis: "Check YANDEX_ATLAS_MARKET_API_KEY secret..."
}
```

---

### 3.2 `yandex-orders` — Buyurtmalar Sinxronizatsiyasi

**Fayl:** `supabase/functions/yandex-orders/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;
  days?: number;      // default: 30
  dateFrom?: string;  // ISO format: "2024-01-01"
  dateTo?: string;    // ISO format: "2024-01-31"
}
```

#### API chaqiruvi
```http
POST /v2/campaigns/{campaignId}/stats/orders
Content-Type: application/json

{
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-14",
  "limit": 200,
  "pageToken": "..."
}
```

#### Muhim parametrlar
- **Date chunking:** 14 kunlik oynalar (`CHUNK_DAYS=14`) — katta oraliqlar timeout beradi
- **Max execution:** 50 sekund (`MAX_EXECUTION_MS=50000`)
- **Sahifalar orasida kechikish:** 150ms

#### Qaytariladigan natija
```typescript
{
  success: boolean;
  store: string;
  synced: number;
  failed: number;
  skipped: number;
  campaigns_processed: number[];
  date_range: { from: string; to: string };
}
```

#### DB operatsiyasi
```sql
-- Conflict key: (store_id, external_order_id)
UPSERT INTO marketplace_orders (
  store_id, external_order_id, order_date, status,
  total_amount, commission, delivery_cost,
  items_count, fulfillment_type, ...
)
```

#### Status Normalizatsiyasi

| Yandex statusi | Normalized status |
|----------------|-------------------|
| `DELIVERED` | `delivered` |
| `PICKUP` | `delivered` |
| `PARTIALLY_DELIVERED` | `delivered` |
| `PICKUP_SERVICE_RECEIVED` | `delivered` |
| `PICKUP_USER_RECEIVED` | `delivered` |
| `CANCELLED` | `cancelled` |
| `CANCELLED_IN_DELIVERY` | `cancelled` |
| `TOO_MANY_DELIVERY_DATE_CHANGES` | `cancelled` |
| `TOO_LONG_DELIVERY` | `cancelled` |
| `PICKUP_EXPIRED` | `cancelled` |
| `USER_CHANGED_MIND` (substatus) | `cancelled` |
| `USER_REFUSED_DELIVERY` (substatus) | `cancelled` |
| `USER_REFUSED_QUALITY` (substatus) | `cancelled` |
| `SHOP_FAILED` (substatus) | `cancelled` |
| `DELIVERY_SERVICE_FAILED` (substatus) | `cancelled` |
| `PROCESSING` | `shipped` |
| `DELIVERY` | `shipped` |
| `SHIPPED` | `shipped` |
| `READY_TO_SHIP` | `shipped` |
| `SENDER_SENT` | `shipped` |
| `RETURNED` | `returned` |
| `RETURN_ARRIVED` | `returned` |
| `RETURN_ARRIVED_DELIVERY` | `returned` |
| `INCORRECT_PERSONAL_DATA` (substatus) | `pending` |
| Boshqa barcha | `pending` |

#### Komissiya Hisoblash

```
commission.type ∈ {
  DELIVERY_TO_CUSTOMER,
  EXPRESS_DELIVERY_TO_CUSTOMER
}  →  delivery_cost ustuniga qo'shiladi

Barcha boshqa commission.type  →  commission ustuniga qo'shiladi

Agar commission = 0 AND status = "delivered":
  commission = total_amount × 0.05  (5% fallback)
```

#### FBS Stok Dekrementi (muhim biznes mantiqi)

Yangi FBS buyurtma (`fulfillment_type = 'fbs'`) kelganda avtomatik:

```
1. marketplace_listings → product_id topiladi (external_sku yoki external_barcode orqali)
2. variant_sku_mappings → variant_id aniqlanadi
3. decrement_tashkent_stock(product_id, variant_id, quantity) RPC → Tashkent ombori kamayadi
4. Bekor bo'lsa (cancelled/returned) → qarama-qarshi: inkrement
```

#### Dual Campaign (BM_store uchun)

```
BM_store (fby_fbs):
  - fbs_campaign_id = 148916383  → FBS buyurtmalar
  - fby_campaign_id = 148939239  → FBY buyurtmalar
  
Har ikki kampaniya alohida itiratsiya qilinadi va natijalar birlashtiriladi.
```

---

### 3.3 `yandex-stocks` — Stok Sinxronizatsiyasi

**Fayl:** `supabase/functions/yandex-stocks/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;
  action?: string;  // (hozircha faqat 'get', future use)
}
```

#### API chaqiruvi
```http
POST /v2/campaigns/{campaignId}/offers/stocks
Content-Type: application/json

{
  "limit": 200,
  "pageToken": "..."
}
```

#### Response tuzilmasi
```typescript
{
  result: {
    warehouses: Array<{
      warehouseId: number;
      warehouseName: string;
      offers: Array<{
        offerId: string;
        stocks: Array<{ type: string; count: number }>;
      }>;
    }>;
    paging?: { nextPageToken?: string };
  }
}
```

- **Max offers:** 2000 ta
- **Sahifalar orasida kechikish:** 300ms

#### Qaytariladigan natija
```typescript
{
  success: boolean;
  store: string;
  records_processed: number;
  warehouses_count: number;
  offers_processed: number;
  synced: number;
  failed: number;
}
```

#### Stock Mapping Mantiqi (kritik!)

```
FBY kampaniya → stock_fby ustuni  (Yandex ombori)
              → stock_fbu = null   ← Uzum FBU bilan ARALASHMASLIGI uchun
              → stock_fbs = null   ← cross-contamination oldini olish

FBS kampaniya → stock ustuni
              → stock_fbs ustuni
              → stock_fbu = null   ← Uzum FBU bilan aralashmasligi uchun
              → stock_fby = null   ← cross-contamination oldini olish
```

> ⚠️ **Nima uchun?** `stock_fbu` Uzum FBU ombori uchun maxsus. Yandex FBY zaxirasi u bilan aralashib ketsa, kross-do'kon analitika noto'g'ri ko'rsatiladi.

#### Rank Yangilash

```
stock > 20  →  product_rank = 'B'
stock > 0   →  product_rank = 'C'
stock = 0   →  product_rank = 'D'
```

---

### 3.4 `yandex-finance` — Moliyaviy Hisobot

**Fayl:** `supabase/functions/yandex-finance/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;
  days?: number;          // default: 30
  report_type?: string;   // 'summary' | 'detailed' | 'by_campaign'
}
```

#### API chaqiruvi (orders statistikasi asosida)
```http
POST /v2/campaigns/{campaignId}/stats/orders
```

#### Qaytariladigan natija
```typescript
{
  summary: {
    total_orders: number;
    total_revenue: number;          // Jami daromad
    total_commissions: number;      // Platform komissiyasi
    total_delivery_fees: number;    // Yetkazib berish to'lovlari
    net_profit: number;             // Sof foyda
    avg_order_value: number;        // O'rtacha buyurtma qiymati
    commission_rate_percent: number; // Komissiya foizi
  };
  breakdown: {
    by_status: Record<string, { count: number; revenue: number }>;
    by_commission_type: Record<string, number>;
    by_campaign: Record<string, { orders: number; revenue: number }>;
  };
}
```

- **Valyuta:** RUB (Yandex Russia platformasi)
- **Dual campaign:** FBY+FBS do'konlar uchun ikkala kampaniya agregatsiya qilinadi

---

### 3.5 `yandex-returns` — Qaytarishlar

**Fayl:** `supabase/functions/yandex-returns/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;
  days?: number;        // default: 30
  page_token?: string;
  dateFrom?: string;
  dateTo?: string;
}
```

#### API chaqiruvi
```http
GET /v2/campaigns/{campaignId}/returns?fromDate=2024-01-01&toDate=2024-01-31&pageToken=...
```

#### Return item maydonlari (muhim o'zgarishlar)

| Maydon | Holati | Tavsif |
|--------|--------|--------|
| `offerId` | ✅ Asosiy | Primary SKU identifikatori |
| `marketSku` | ✅ Faol | Yandex market SKU |
| `count` | ✅ Faol | Qaytarilgan miqdor |
| `amount` | ✅ Yangi (2024+) | Qaytarish summasi |
| `partnerCompensationAmount` | ✅ Faol | Sotuvchi kompensatsiyasi |
| `decisionType` | ✅ Faol | Qaror turi |
| `shopSku` | ⚠️ DEPRECATED | Eski SKU — faqat legacy |
| `refundAmount` | ⚠️ DEPRECATED | `amount` bilan almashtirildi |

#### Qaytariladigan natija
```typescript
{
  returns_count: number;
  total_refund_amount: number;
  total_compensation: number;
  pending_decisions: number;    // 48 soat ichida qaror kerak
  returns: YandexReturn[];
}
```

---

### 3.6 `yandex-questions` — Savol-Javoblar

**Fayl:** `supabase/functions/yandex-questions/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;
  action: 'list' | 'answer' | 'update';
  question_id?: number;
  answer_text?: string;
  page?: number;
}
```

#### Actions va API endpointlar

**`list` — Savollar ro'yxati:**
```http
POST /businesses/{businessId}/goods-questions
{
  "pageSize": 50,
  "pageToken": "..."
}
```

**`answer` — Javob yuborish:**
```http
POST /businesses/{businessId}/goods-questions/answers
{
  "questionId": 12345,
  "text": "Javob matni..."
}
```

**`update` — Javob yangilash:**
```http
POST /businesses/{businessId}/goods-questions/update
{
  "questionId": 12345,
  "text": "Yangilangan javob..."
}
```

#### Qaytariladigan natija
```typescript
{
  questions: Array<{
    id: number;
    productId: number;
    text: string;
    author: string;
    createdAt: string;
    answer?: string;
    answeredAt?: string;
  }>;
  unanswered_count: number;
  paging?: { nextPageToken?: string };
}
```

---

### 3.7 `yandex-warehouses` — Omborlar

**Fayl:** `supabase/functions/yandex-warehouses/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;
  action: 'list' | 'slots' | 'partner';
  fulfillment_type?: 'fby' | 'fbs';
}
```

#### Actions va API endpointlar

**`list` — Barcha omborlar (yangi v2 API, Feb 2026):**
```http
POST /businesses/{businessId}/warehouses
{}
```

**`slots` — FBY ombor slotlari:**
```http
GET /v2/campaigns/{fby_campaign_id}/first-mile/warehouses
```

**`partner` — FBS partner omborlari:**
```http
POST /businesses/{businessId}/warehouses
{
  "partnerType": "FBS"
}
```

#### Qaytariladigan natija
```typescript
{
  warehouses: Array<{
    id: number;
    name: string;
    type: string;         // 'FBY' | 'FBS' | 'DROPSHIP'
    partner_id?: number;
    address?: string;
  }>;
}
```

---

### 3.8 `yandex-supply-requests` — Ta'minot So'rovlari

**Fayl:** `supabase/functions/yandex-supply-requests/index.ts`

> ⚠️ **Faqat FBY uchun** — `fby_campaign_id` yoki `campaign_id` ishlatiladi.

#### Kirish parametrlari
```typescript
{
  store_id: string;
  action: 'list' | 'get' | 'create' | 'confirm';
  supply_request_id?: number;
  items?: Array<{ offerId: string; count: number }>;
  warehouse_id?: number;
  page?: number;
}
```

#### Actions va API endpointlar

**`list` — So'rovlar ro'yxati:**
```http
POST /v2/campaigns/{campaignId}/first-mile/supply-requests
{
  "pageSize": 50,
  "pageToken": "..."
}
```

**`get` — Bitta so'rov:**
```http
GET /v2/campaigns/{campaignId}/first-mile/supply-requests/{id}
```

**`create` — Yangi so'rov:**
```http
PUT /v2/campaigns/{campaignId}/first-mile/supply-requests
{
  "warehouseId": 123456,
  "items": [{ "offerId": "SKU-001", "count": 10 }]
}
```

**`confirm` — So'rovni tasdiqlash:**
```http
POST /v2/campaigns/{campaignId}/first-mile/supply-requests/{id}/confirm
```

#### Status turlari
- `CREATED` — Yaratilgan
- `CONFIRMED` — Tasdiqlangan
- `IN_TRANSIT` — Yo'lda

---

### 3.9 `yandex-competitor-analysis` — Raqobat Tahlili

**Fayl:** `supabase/functions/yandex-competitor-analysis/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;
  action: 'get_price_position' | 'analyze_category' | 'ai_competitor_strategy' | 'track_competitor' | 'sync_price_history';
  listing_id?: string;
  category_id?: string;
  limit?: number;
  competitor_sku?: string;
  competitor_name?: string;
  competitor_url?: string;
  competitor_shop?: string;
}
```

#### Actions

**`get_price_position` — 3 bosqichli narx tahlili:**

```
1. POST /v2/businesses/{businessId}/offer-prices
   → Joriy narxlar

2. POST /v2/businesses/{businessId}/offers/recommendations
   → Raqobat tavsiyalari
   ⚠️ Yandex Go Market (O'zbekiston) uchun mavjud EMAS

3. Fallback: POST /v2/campaigns/{campaignId}/stats/skus
   → SKU statistikasi (raqobat narxi yo'q bo'lsa)
```

**`analyze_category` — Kategoriya tahlili:**
- Kategoriya bo'yicha barcha offerlar narx tahlili

**`ai_competitor_strategy` — AI strategiya:**
- **Model:** Lovable AI gateway (`google/gemini-3-flash-preview`)
- Buyurtmalar va narx tarixi asosida AI tavsiyalar

**`track_competitor` — Raqobatchi qo'shish:**
```sql
INSERT INTO marketplace_competitors (store_id, sku, name, url, shop, ...)
```

**`sync_price_history` — Narx tarixi saqlash:**
```sql
INSERT INTO marketplace_competitor_prices (competitor_id, price, date, ...)
```

#### ⚠️ Platform Cheklovi: Yandex Go Market (O'zbekiston)

```
Muammo: Yandex Go Market raqobat narx ma'lumotini bermaydi
  - offers/recommendations → 404 yoki bo'sh
  - stats/skus → priceCompetition.averagePrice = 0

Natija: platform_limitation: true bayrog'i qaytariladi
Bu BUG emas — Yandex platformasi siyosati!
```

---

### 3.10 `yandex-sale-boost` — Sotuv Tahlili va Tavsiyalar

**Fayl:** `supabase/functions/yandex-sale-boost/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;
  action: 'analyze_store' | 'analyze_listing' | 'get_recommendations';
  listing_id?: string;
  days?: number;   // default: 30
}
```

#### AI Model
- **Provider:** Lovable AI gateway
- **Model:** `google/gemini-3-flash-preview`
- **DB so'rovlari:** `marketplace_listings` + `marketplace_orders`

#### Qaytariladigan natija
```typescript
{
  analysis: string;         // AI tahlil matni
  recommendations: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    expected_impact: string;
  }>;
  metrics: {
    total_revenue: number;
    orders_count: number;
    avg_order_value: number;
    top_products: Array<{ sku: string; revenue: number }>;
  };
}
```

---

### 3.11 `yandex-seo-optimizer` — SEO Optimizatsiya

**Fayl:** `supabase/functions/yandex-seo-optimizer/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;
  action: 'analyze_listing' | 'batch_analyze' | 'generate_optimized';
  listing_id?: string;
  title?: string;
  description?: string;
  category?: string;
}
```

#### SEO Ball Tizimi (0-100)

| Komponent | Og'irlik | Tekshiruv |
|-----------|---------|-----------|
| Title | 30% | Uzunlik, kalit so'zlar, aniqligi |
| Description | 25% | Uzunlik, to'liqlik, foydalilik |
| Images | 20% | Soni, sifati, alt matnlar |
| Keywords | 15% | Mos kalit so'zlar |
| Attributes | 10% | To'ldirish darajasi |

#### AI Model
- **Provider:** Lovable AI gateway
- **Yaratilgan kontent:** Ruscha (Yandex Market auditoriyasi uchun)

---

### 3.12 `yandex-demand-forecast` — Talab Prognozi

**Fayl:** `supabase/functions/yandex-demand-forecast/index.ts`

#### Kirish parametrlari
```typescript
{
  store_id: string;
  action: 'forecast' | 'stock_recommendations' | 'seasonal_analysis';
  listing_id?: string;
  days?: number;   // prognoz davri
}
```

#### AI Model
- **Provider:** Lovable AI gateway
- **Manba:** Tarixiy `marketplace_orders` ma'lumotlari

#### Qaytariladigan natija
```typescript
{
  forecasts: Array<{
    listing_id: string;
    sku: string;
    predicted_orders: number;
    predicted_revenue: number;
    confidence: number;          // 0-1
    period: string;
  }>;
  stock_recommendations: Array<{
    listing_id: string;
    sku: string;
    current_stock: number;
    recommended_stock: number;
    days_until_stockout: number;
    urgency: 'critical' | 'high' | 'medium' | 'low';
  }>;
}
```

---

## Bo'lim 4: Ma'lumot Modellari (TypeScript Interfeyslari)

### 4.1 YandexOfferMapping

```typescript
interface YandexOfferMapping {
  offer: {
    offerId: string;           // Primary SKU identifikatori
    name?: string;             // Mahsulot nomi
    barcodes?: string[];       // Shtrix kodlar
    basicPrice?: {
      value: number;
      currencyId: string;      // 'RUB' | 'UZS'
    };
    vendor?: string;           // Brend nomi
    vendorCode?: string;       // Brend kodi
    description?: string;      // Tavsif
    pictures?: string[];       // Rasm URL'lari (CDN)
    urls?: string[];           // Mahsulot sahifasi URL'lari
    archived?: boolean;        // true = faol emas
  };
  mapping?: {
    marketSku?: number;        // Yandex Market SKU
    categoryId?: number;       // Kategoriya ID
    categoryName?: string;     // Kategoriya nomi
  };
}
```

### 4.2 YandexOrder

```typescript
interface YandexOrder {
  id: number;                          // Yandex buyurtma ID
  creationDate: string;                // ISO datetime
  statusUpdateDate?: string;           // Oxirgi status yangilanish vaqti
  status: string;                      // Asosiy status
  substatus?: string;                  // Qo'shimcha status
  partnerOrderId?: string;             // Sotuvchi buyurtma ID
  externalOrderId?: string;            // Tashqi tizim ID
  paymentType?: string;                // To'lov turi
  currency?: string;                   // 'RUB'
  fake?: boolean;                      // true = TEST buyurtma (haqiqiy emas!)
  deliveryRegion?: {
    id: number;
    name: string;
  };
  buyer?: {
    type?: string;
    trusted?: boolean;
  };
  items?: YandexOrderItem[];
  payments?: Array<{
    id: number;
    date: string;
    type: string;
    source: string;
    total: number;
  }>;
  commissions?: Array<{
    type: string;
    actual: number;
  }>;
}
```

### 4.3 YandexOrderItem

```typescript
interface YandexOrderItem {
  offerName: string;           // Mahsulot nomi
  marketSku?: number;          // Yandex Market SKU
  offerId: string;             // ✅ ASOSIY identifikator (2024+)
  shopSku?: string;            // ⚠️ DEPRECATED — eski tizimlar uchun
  count: number;               // Miqdor
  prices?: Array<{
    type: 'BUYER' | string;    // BUYER = xaridor narxi
    costPerItem: number;       // Bitta narxi
    total: number;             // Umumiy summa
  }>;
  subsidies?: Array<{
    type: string;
    amount: number;
  }>;
  tags?: string[];             // ['ULTIMA', 'SAFE_TAG', 'TURBO']
  countryCode?: string;        // ISO 3166-1 alpha-2
}
```

### 4.4 YandexReturn

```typescript
interface YandexReturn {
  id: number;
  orderId: number;
  creationDate: string;
  updateDate?: string;
  refundStatus: string;
  returnType?: string;
  fastReturn?: boolean;
  decisionRequired?: boolean;    // true → 48 soat ichida qaror kerak!
  decisionDeadline?: string;
  pickupTillDate?: string;
  items?: Array<{
    marketSku: number;
    offerId: string;              // ✅ ASOSIY identifikator
    shopSku?: string;             // ⚠️ DEPRECATED
    count: number;
    decisionType?: string;
    amount?: number;              // ✅ Yangi (2024+) — qaytarish summasi
    refundAmount?: number;        // ⚠️ DEPRECATED — amount bilan almashtirildi
    partnerCompensationAmount?: number; // Sotuvchi kompensatsiyasi
  }>;
}
```

### 4.5 SupplyRequest

```typescript
interface SupplyRequest {
  id: number;
  status: 'CREATED' | 'CONFIRMED' | 'IN_TRANSIT' | string;
  createdAt: string;
  updatedAt?: string;
  warehouseId: number;
  warehouseName?: string;
  type: string;
  shipmentDate?: string;
  destination?: {
    address?: string;
  };
  items?: Array<{
    offerId: string;
    name?: string;
    count: number;
    defects?: Array<{
      type: string;
      count: number;
    }>;
  }>;
}
```

---

## Bo'lim 5: Biznes Mantiqi

### 5.1 Status Normalizatsiyasi (To'liq Xarita)

```
# DELIVERED statusi guruhi
DELIVERED                    → "delivered"
PICKUP                       → "delivered"
PARTIALLY_DELIVERED          → "delivered"
PICKUP_SERVICE_RECEIVED      → "delivered"
PICKUP_USER_RECEIVED         → "delivered"

# CANCELLED statusi guruhi
CANCELLED                    → "cancelled"
CANCELLED_IN_DELIVERY        → "cancelled"
TOO_MANY_DELIVERY_DATE_CHANGES → "cancelled"
TOO_LONG_DELIVERY            → "cancelled"
PICKUP_EXPIRED               → "cancelled"
USER_CHANGED_MIND (sub)      → "cancelled"
USER_REFUSED_DELIVERY (sub)  → "cancelled"
USER_REFUSED_QUALITY (sub)   → "cancelled"
SHOP_FAILED (sub)            → "cancelled"
DELIVERY_SERVICE_FAILED (sub)→ "cancelled"

# SHIPPED statusi guruhi
PROCESSING                   → "shipped"
DELIVERY                     → "shipped"
SHIPPED                      → "shipped"
READY_TO_SHIP                → "shipped"
SENDER_SENT                  → "shipped"

# RETURNED statusi guruhi
RETURNED                     → "returned"
RETURN_ARRIVED               → "returned"
RETURN_ARRIVED_DELIVERY      → "returned"

# PENDING statusi guruhi
INCORRECT_PERSONAL_DATA (sub)→ "pending"
Barcha boshqalar             → "pending"
```

### 5.2 Komissiya Hisoblash Algoritmi

```typescript
let commission = 0;
let delivery_cost = 0;

for (const c of order.commissions || []) {
  if (
    c.type === 'DELIVERY_TO_CUSTOMER' ||
    c.type === 'EXPRESS_DELIVERY_TO_CUSTOMER'
  ) {
    delivery_cost += c.actual;
  } else {
    commission += c.actual;
  }
}

// 5% fallback — agar komissiya 0 bo'lsa va yetkazilgan bo'lsa
if (commission === 0 && normalizedStatus === 'delivered') {
  commission = total_amount * 0.05;
}
```

### 5.3 Stock Mapping (FBY vs FBS — Cross-Contamination Oldini Olish)

```typescript
if (campaign.type === 'fby') {
  // Yandex ombori → faqat stock_fby
  updateData.stock = totalStock;
  updateData.stock_fby = totalStock;
  updateData.stock_fbu = null;   // Uzum FBU tozalanadi
  updateData.stock_fbs = null;   // FBS tozalanadi
} else {
  // Sotuvchi ombori → stock va stock_fbs
  updateData.stock = totalStock;
  updateData.stock_fbs = totalStock;
  updateData.stock_fbu = null;   // Uzum FBU tozalanadi
  updateData.stock_fby = null;   // FBY tozalanadi
}
```

### 5.4 Dual Campaign Arxitekturasi (BM_store)

```
BM_store (fby_fbs):
  fbs_campaign_id = 148916383
  fby_campaign_id = 148939239

Barcha funksiyalar (orders, stocks, finance, returns) quyidagi tartibda ishlaydi:

1. store.fulfillment_type === 'fby_fbs' ni tekshiradi
2. campaignsToFetch = [
     { id: store.fbs_campaign_id, type: 'fbs' },
     { id: store.fby_campaign_id, type: 'fby' }
   ]
3. Har bir kampaniya uchun API chaqiriladi (alohida loop)
4. Natijalar birlashtiriladi (synced, failed, stockData)
5. store.last_sync_at yangilanadi
```

### 5.5 Mahsulot Sinxronizatsiyasi — Deduplikatsiya Algoritmi

```typescript
// FBY+FBS do'konlar uchun har bir offerId → 2 listing
const fulfillmentTypes = store.fulfillment_type === 'fby_fbs'
  ? ['fbs', 'fby']
  : [store.fulfillment_type || 'fbs'];

// Deduplikatsiya (API bir xil offerId qaytarishi mumkin)
const seen = new Set<string>();
const dedupedListings = allListings.filter(l => {
  const key = `${l.store_id}|${l.external_sku}|${l.fulfillment_type}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Batch upsert (200 ta bir vaqtda)
for (let i = 0; i < dedupedListings.length; i += 200) {
  const batch = dedupedListings.slice(i, i + 200);
  await supabase.from('marketplace_listings').upsert(batch, {
    onConflict: 'store_id,external_sku,fulfillment_type'
  });
}
```

### 5.6 FBS Stok Dekrementi Jarayoni

```
Yangi buyurtma keldi (status: PROCESSING/shipped, fulfillment_type: fbs)
  ↓
marketplace_listings WHERE store_id = X AND (
  external_sku = offerId OR external_barcode = barcode
)
  ↓
variant_sku_mappings WHERE store_id = X AND external_sku = offerId
  ↓
decrement_tashkent_stock(
  product_id: listing.product_id,
  variant_id: mapping.variant_id,
  quantity: item.count
)
  ↓
products.tashkent_stock -= quantity (RPC orqali)

Bekor bo'lsa (cancelled):
  increment_tashkent_stock(...) — teskari jarayon
```

### 5.7 Date Chunking Sababi

Yandex `stats/orders` API katta vaqt oraliqlarida timeout beradi:

```typescript
const CHUNK_DAYS = 14;  // 14 kunlik oynalar

// 30 kunlik so'rov → 2-3 ta chunk:
// Chunk 1: Jan 01 → Jan 14
// Chunk 2: Jan 15 → Jan 28
// Chunk 3: Jan 29 → Jan 30

for each chunk:
  await delay(150ms)  // Rate limit
  fetch orders for chunk
  upsert to database
```

---

## Bo'lim 6: API Endpoint'lar To'liq Ro'yxati

| # | Method | Endpoint | Funksiya | Tavsif |
|---|--------|----------|----------|--------|
| 1 | POST | `/businesses/{bId}/offer-mappings` | yandex-products | Mahsulotlar (business darajasi) |
| 2 | POST | `/v2/campaigns/{cId}/stats/orders` | yandex-orders, yandex-finance | Buyurtma statistikasi |
| 3 | POST | `/v2/campaigns/{cId}/offers/stocks` | yandex-stocks | Stok ma'lumotlari |
| 4 | GET | `/v2/campaigns/{cId}/returns` | yandex-returns | Qaytarishlar ro'yxati |
| 5 | POST | `/businesses/{bId}/goods-questions` | yandex-questions | Savollar ro'yxati |
| 6 | POST | `/businesses/{bId}/goods-questions/answers` | yandex-questions | Javob yuborish |
| 7 | POST | `/businesses/{bId}/goods-questions/update` | yandex-questions | Javob yangilash |
| 8 | POST | `/businesses/{bId}/warehouses` | yandex-warehouses | Omborlar ro'yxati (v2, Feb 2026) |
| 9 | GET | `/v2/campaigns/{cId}/first-mile/warehouses` | yandex-warehouses | FBY ombor slotlari |
| 10 | POST | `/v2/campaigns/{cId}/first-mile/supply-requests` | yandex-supply-requests | Ta'minot so'rovlari ro'yxati |
| 11 | GET | `/v2/campaigns/{cId}/first-mile/supply-requests/{id}` | yandex-supply-requests | Bitta so'rov |
| 12 | PUT | `/v2/campaigns/{cId}/first-mile/supply-requests` | yandex-supply-requests | Yangi so'rov yaratish |
| 13 | POST | `/v2/campaigns/{cId}/first-mile/supply-requests/{id}/confirm` | yandex-supply-requests | So'rovni tasdiqlash |
| 14 | POST | `/v2/businesses/{bId}/offer-prices` | yandex-competitor-analysis | Joriy narxlar |
| 15 | POST | `/v2/businesses/{bId}/offers/recommendations` | yandex-competitor-analysis | Narx tavsiyalari (Go Market'da yo'q) |
| 16 | POST | `/v2/campaigns/{cId}/stats/skus` | yandex-competitor-analysis, yandex-sale-boost | SKU statistikasi |

> `{bId}` = `business_id`, `{cId}` = `campaign_id`

---

## Bo'lim 7: Cron Avtomatizatsiya

### 7.1 Mavjud Cron Joblar

| Job nomi | Jadval (UTC) | Funksiya | Maqsad |
|----------|-------------|----------|--------|
| `yandex-products-sync-6h` | `0 */6 * * *` | `marketplace-auto-sync` | Har 6 soatda mahsulotlar sinxronizatsiyasi |

### 7.2 `marketplace-auto-sync` Mexanizmi

```
1. Barcha faol yandex do'konlarini oladi (status = 'active')
2. Har bir do'kon uchun:
   - yandex-products chaqiradi
   - yandex-stocks chaqiradi (opsional)
3. Natijalarni loglaydi
4. store.last_sync_at yangilanadi
```

---

## Bo'lim 8: DB Jadvallar (Yandex Ma'lumotlari)

### 8.1 `marketplace_stores`

Yandex do'konlari uchun muhim ustunlar:

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| `id` | UUID | Asosiy kalit |
| `platform` | text | `'yandex'` |
| `fulfillment_type` | text | `'fby'` \| `'fbs'` \| `'fby_fbs'` |
| `campaign_id` | text | Asosiy kampaniya ID |
| `fbs_campaign_id` | text | FBS kampaniya ID (dual uchun) |
| `fby_campaign_id` | text | FBY kampaniya ID (dual uchun) |
| `business_id` | text | Yandex business ID |
| `api_key_secret_name` | text | Supabase secret nomi |
| `last_sync_at` | timestamptz | Oxirgi sinxronizatsiya |
| `sync_status` | text | `'success'` \| `'partial'` \| `'error'` |
| `sync_error` | text | Oxirgi xato xabari |

### 8.2 `marketplace_listings`

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| `store_id` | UUID | Do'kon (conflict key qismi) |
| `external_sku` | text | `offerId` (conflict key qismi) |
| `fulfillment_type` | text | `'fbs'` \| `'fby'` (conflict key qismi) |
| `external_product_id` | text | `marketSku` |
| `external_barcode` | text | Birinchi barcode |
| `stock` | integer | Asosiy stok (FBS) |
| `stock_fbs` | integer | FBS stoki |
| `stock_fby` | integer | FBY stoki (Yandex ombori) |
| `stock_fbu` | integer | Uzum FBU stoki (yandex bunni NULL qiladi) |
| `price` | numeric | Joriy narx |
| `product_rank` | text | `'A'` \| `'B'` \| `'C'` \| `'D'` |
| `last_synced_at` | timestamptz | Oxirgi sinxronizatsiya |

### 8.3 `marketplace_orders`

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| `store_id` | UUID | Do'kon (conflict key qismi) |
| `external_order_id` | text | Yandex `order.id` (conflict key qismi) |
| `order_date` | date | Buyurtma sanasi |
| `status` | text | Normalized status |
| `total_amount` | numeric | Umumiy summa |
| `commission` | numeric | Platform komissiyasi |
| `delivery_cost` | numeric | Yetkazib berish to'lovi |
| `fulfillment_type` | text | `'fbs'` \| `'fby'` |

---

## Bo'lim 9: Ma'lum Muammolar va Yechimlar

### 9.1 Yandex Go Market (O'zbekiston) Cheklovlari

```
❌ Muammo: Raqobat narx ma'lumoti berilmaydi

Simptomlar:
  - /offers/recommendations → HTTP 404 yoki bo'sh javob
  - /stats/skus → priceCompetition.averagePrice = 0

Sabab: Yandex Go Market (Uzbekistan) — Yandex Russia bilan farqli platforma
Bu PLATFORM SIYOSATI, kod xatosi emas!

Yechim: platform_limitation: true bayrog'ini tekshiring
```

### 9.2 API Autentifikatsiya Xatolari

```
HTTP 401 → API kalit muddati o'tgan yoki noto'g'ri
HTTP 403 → API kalit bu businessga/campaignга ruxsat bermaydi
HTTP 404 → business_id noto'g'ri yoki kampaniyaga tegishli emas

Funksiya xulqi: exception emas, informativ response qaytaradi:
{
  success: false,
  error_code: 401,
  error: "Authentication failed...",
  diagnosis: "Check YANDEX_*_API_KEY secret..."
}

Tekshirish tartibi:
1. Secret nomini tekshiring: store.api_key_secret_name
2. Supabase Vault'dagi qiymatni tekshiring
3. Yandex Kabinet'da API kalitning amal qilish muddatini tekshiring
4. API kalitning business/campaign ruxsatlarini tekshiring
```

### 9.3 shopSku Deprecated (2024+)

```
ESKI (deprecated):
  item.shopSku → sotuvchi SKU kodi

YANGI (2024+):
  item.offerId → asosiy identifikator

Kod barcha joyda offerId → shopSku fallback qiladi:
  const sku = item.offerId || item.shopSku
```

### 9.4 Date Chunking — Timeout Oldini Olish

```
Muammo: stats/orders API katta vaqt oraliqlarida (30+ kun) timeout beradi
Yechim: 14 kunlik oynalarda iteratsiya qilish

Agar ham timeout bo'lsa:
1. days parametrini 14 ga kamaytiring
2. dateFrom/dateTo bilan aniq oraliq bering
3. MAX_EXECUTION_MS = 50000 (50 sekund)
```

### 9.5 CDN URL Bloklash

```
Bloklangan domenlar (hotlinking ruxsat bermaydi):
  - *.wbcontent.net  (Wildberries CDN)
  - *.ozone.ru       (Ozon CDN)

Bu URLlar image_url ga SAQLANMAYDI.
Yechim: mirror-product-images edge funksiyasi orqali ko'chirish
```

---

## Bo'lim 10: Tezkor Yo'riqnoma (Quick Reference)

### 10.1 Yangi Do'kon Qo'shish Ketma-Ketligi

```
1. marketplace_stores jadvaliga qo'shish:
   - platform = 'yandex'
   - fulfillment_type = 'fby' | 'fbs' | 'fby_fbs'
   - business_id (Yandex Kabineti → Profil → Biznes ID)
   - campaign_id YOKI fbs_campaign_id + fby_campaign_id
   - api_key_secret_name = 'YANDEX_NEWSTORE_API_KEY'

2. Supabase Vault'ga secret qo'shish:
   - Nom: YANDEX_NEWSTORE_API_KEY
   - Qiymat: Yandex Kabinetidan olingan API kalit

3. yandex-products chaqirish:
   POST /functions/v1/yandex-products
   { "store_id": "..." }

4. yandex-stocks chaqirish:
   POST /functions/v1/yandex-stocks
   { "store_id": "..." }

5. yandex-orders chaqirish:
   POST /functions/v1/yandex-orders
   { "store_id": "...", "days": 30 }
```

### 10.2 Debugging Checklist

```
Mahsulotlar ko'rinmayapdi:
  □ store.business_id to'g'rimi?
  □ API kalit business'ga ruxsati bormi?
  □ offer-mappings response'da offerMappings bormi?
  □ marketplace_listings jadvalida store_id bilan qidiring

Buyurtmalar sinxronlanmayapdi:
  □ campaign_id/fbs_campaign_id/fby_campaign_id to'g'rimi?
  □ dateFrom/dateTo formatiga e'tibor (YYYY-MM-DD)
  □ fake: true buyurtmalar filtrlanmaydi! (test buyurtmalar)

Stok noto'g'ri:
  □ fulfillment_type to'g'ri kampaniyaga mos kelishini tekshiring
  □ stock_fby va stock_fbs ni alohida tekshiring
  □ stock_fbu = null bo'lishi kerak (yandex do'konlarida)

Komissiya 0:
  □ 5% fallback ishlayaptimi? (delivered status kerak)
  □ commissions array bo'shmi? → yandex API masalasi
```

---

*Ushbu hujjat loyihadagi barcha Yandex Market edge funksiyalari va DB konfiguratsiyasidan avtomatik to'plangan. Har qanday o'zgarishda yangilash tavsiya etiladi.*
