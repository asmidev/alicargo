
## Tuzatish: Variantlar tabi faqat bitta do'kon uchun ishlashi kerak

### Muammo
`ListingVariantsTab` komponenti variantlarni faqat `product_id` bo'yicha qidiradi (45-qator), `store_id` ni hisobga olmaydi. Natijada bir xil mahsulotning barcha do'konlardagi listinglari bitta ro'yxatda aralash ko'rinadi (rasmda ko'rsatilganidek — "ALI BRAND MARKET" bir necha marta takrorlanmoqda).

### Yechim
`ListingVariantsTab` ga `storeId` prop qo'shish va so'rovga `.eq('store_id', storeId)` filtri qo'shish. Faqat shu do'konning variantlari ko'rinadi.

### O'zgarishlar

**1. `src/components/marketplace/ListingVariantsTab.tsx`**
- Interface ga `storeId: string` qo'shish
- Supabase so'roviga `.eq('store_id', storeId)` filtri qo'shish
- `queryKey` ga `storeId` qo'shish

**2. `src/components/marketplace/ListingAnalyticsSheet.tsx`**
- `ListingVariantsTab` ga `storeId={listing.store_id}` prop uzatish

### Natija
- Variantlar tabi faqat tanlangan do'konning variantlarini ko'rsatadi
- Boshqa do'konlar aralashtirilmaydi
- Cross-Store tabi esa barcha do'konlarni ko'rsatishda davom etadi (u alohida maqsadga xizmat qiladi)
