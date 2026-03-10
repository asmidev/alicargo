import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Store, TrendingDown, TrendingUp, AlertTriangle, AlertCircle, RefreshCw, DollarSign, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CompetitorAnalysis from '@/components/analytics/CompetitorAnalysis';

const num = (val: any) => {
    if (!val) return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
};

export default function StoreAnalytics() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { cnyToUzs, usdToUzs, isRatesLoading } = useFinanceCurrency();

    const today = new Date();
    const startDate = format(startOfMonth(today), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(today), 'yyyy-MM-dd') + 'T23:59:59';
    const displayPeriod = `${format(startOfMonth(today), 'dd.MM.yyyy')} - ${format(today, 'dd.MM.yyyy')}`;

    const { data: analyticsData, isLoading, error, refetch } = useQuery({
        queryKey: ['store-analytics-comprehensive', startDate, endDate, cnyToUzs, usdToUzs],
        enabled: !isRatesLoading && cnyToUzs > 0,
        queryFn: async () => {
            const { data: storesList, error: storesError } = await supabase
                .from('marketplace_stores')
                .select('*')
                .order('name');
            if (storesError) throw storesError;

            const stores = storesList || [];
            if (stores.length === 0) return { stores: [], totalRevenue: 0, totalProfit: 0 };
            const storeIds = stores.map(s => s.id);

            // Fetch all delivered orders for the period
            const orders = await fetchAllRows(
                supabase.from('marketplace_orders')
                    .select('store_id, items, total_amount')
                    .in('store_id', storeIds)
                    .eq('fulfillment_status', 'delivered')
                    .gte('delivered_at', startDate)
                    .lte('delivered_at', endDate)
            );

            // Extract unique SKUs and tally quantities per store
            const storeSkuStats: Record<string, Record<string, { qty: number, revenue: number, comm: number }>> = {};
            const uniqueSkus = new Set<string>();

            orders.forEach(order => {
                const storeId = order.store_id;
                if (!storeSkuStats[storeId]) storeSkuStats[storeId] = {};

                if (order.items && Array.isArray(order.items)) {
                    order.items.forEach(item => {
                        const sku = item.skuTitle || item.offerId;
                        if (!sku) return;

                        uniqueSkus.add(sku);
                        if (!storeSkuStats[storeId][sku]) {
                            storeSkuStats[storeId][sku] = { qty: 0, revenue: 0, comm: 0 };
                        }

                        const qty = num(item.quantity) || 1;
                        storeSkuStats[storeId][sku].qty += qty;
                        storeSkuStats[storeId][sku].revenue += num(item.price) * qty;
                        storeSkuStats[storeId][sku].comm += (num(item.commission) || (num(item.price) * qty * 0.2));
                    });
                }
            });

            const skusArray = Array.from(uniqueSkus);

            // Fetch mappings and listings
            const skuMappings = skusArray.length > 0 ? await fetchAllRows(
                supabase.from('variant_sku_mappings').select('external_sku, variant_id').in('external_sku', skusArray)
            ) : [];

            const listings = skusArray.length > 0 ? await fetchAllRows(
                supabase.from('marketplace_listings').select('external_sku, external_offer_id, title, product_id, price').in('store_id', storeIds)
            ) : [];

            const resolvedMapping: Record<string, { variantId?: string; productId?: string, listingPrice?: number }> = {};

            skuMappings.forEach((m: any) => {
                resolvedMapping[m.external_sku] = { variantId: m.variant_id };
            });

            skusArray.forEach(sku => {
                if (!resolvedMapping[sku] || (!resolvedMapping[sku].variantId && !resolvedMapping[sku].productId)) {
                    const matched = listings.find(l => l.external_sku === sku || l.external_offer_id === sku || l.title === sku);
                    if (matched) {
                        resolvedMapping[sku] = { productId: matched.product_id, listingPrice: num(matched.price) };
                    }
                }
            });

            const variantIds = [...new Set(Object.values(resolvedMapping).map(m => m.variantId).filter(Boolean))] as string[];
            let productIds = [...new Set(Object.values(resolvedMapping).map(m => m.productId).filter(Boolean))] as string[];

            // Fetch cost and cargo data
            const variantsMap: Record<string, { cost: number, currency: string, pId: string }> = {};
            if (variantIds.length > 0) {
                const variants = await fetchAllRows(
                    supabase.from('product_variants').select('id, cost_price, cost_price_currency, product_id').in('id', variantIds)
                );
                variants.forEach(v => {
                    variantsMap[v.id] = { cost: num(v.cost_price), currency: v.cost_price_currency || 'UZS', pId: v.product_id };
                    if (v.product_id && !productIds.includes(v.product_id)) productIds.push(v.product_id);
                });
            }

            const productsMap: Record<string, { cost: number, shipToChina: number, qty: number }> = {};
            if (productIds.length > 0) {
                const productsList = await fetchAllRows(
                    supabase.from('products').select('id, cost_price, shipping_cost_to_china, quantity').in('id', productIds)
                );
                productsList.forEach(p => {
                    productsMap[p.id] = { cost: num(p.cost_price), shipToChina: num(p.shipping_cost_to_china), qty: Math.max(num(p.quantity), 1) };
                });
            }

            const avgShipping: Record<string, { dom: number, intl: number, count: number }> = {};
            if (productIds.length > 0) {
                const pItems = await fetchAllRows(
                    supabase.from('product_items')
                        .select('product_id, variant_id, domestic_shipping_cost, international_shipping_cost')
                        .in('product_id', productIds)
                );
                pItems.forEach(item => {
                    const keys = [item.variant_id, item.product_id].filter(Boolean) as string[];
                    keys.forEach(k => {
                        if (!avgShipping[k]) avgShipping[k] = { dom: 0, intl: 0, count: 0 };
                        avgShipping[k].dom += num(item.domestic_shipping_cost);
                        avgShipping[k].intl += num(item.international_shipping_cost);
                        avgShipping[k].count += 1;
                    });
                });
            }

            // Calculate store totals
            const storeResults = stores.map(store => {
                let totalRevenue = 0;
                let totalCost = 0;
                let totalSales = 0;
                let pureCommission = 0;

                const stats = storeSkuStats[store.id] || {};

                Object.entries(stats).forEach(([sku, metric]) => {
                    totalRevenue += metric.revenue;
                    pureCommission += metric.comm;
                    totalSales += metric.qty;

                    const map = resolvedMapping[sku] || {};
                    const vId = map.variantId;
                    const pId = map.productId;

                    // China price calc
                    let chinaPrice = 0;
                    const v = vId ? variantsMap[vId] : null;
                    const p = pId ? productsMap[pId] : null;

                    if (v && v.cost > 0) {
                        if (v.currency === 'CNY') chinaPrice = v.cost * cnyToUzs;
                        else if (v.currency === 'USD') chinaPrice = v.cost * usdToUzs;
                        else chinaPrice = v.cost;
                    } else if (p && p.cost > 0) {
                        chinaPrice = p.cost;
                    } else if (map.listingPrice) {
                        chinaPrice = map.listingPrice * 0.4; // fallback estimation 40%
                    }

                    // Cargo price calc
                    let cargoPrice = 0;
                    let dCny = 0, iUsd = 0;
                    const s = (vId ? avgShipping[vId] : null) || (pId ? avgShipping[pId] : null);

                    if (s && s.count > 0) {
                        dCny = s.dom / s.count;
                        iUsd = s.intl / s.count;
                    } else if (p && p.shipToChina > 0) {
                        dCny = p.shipToChina / p.qty;
                    }

                    cargoPrice = (dCny * cnyToUzs) + (iUsd * usdToUzs);
                    const tanNarx = (chinaPrice + cargoPrice) * metric.qty;
                    totalCost += tanNarx;
                });

                const totalExpenses = totalCost + pureCommission;
                const profit = totalRevenue - totalExpenses;
                const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

                const isLoss = profit < 0;
                const isLowRevenue = totalRevenue > 0 && totalRevenue < 500000;

                return {
                    ...store,
                    totalRevenue,
                    totalExpenses,
                    profit,
                    margin,
                    totalSales,
                    isLoss,
                    isLowRevenue
                };
            });

            storeResults.sort((a, b) => b.profit - a.profit);
            const tRev = storeResults.reduce((sum, s) => sum + s.totalRevenue, 0);
            const tProf = storeResults.reduce((sum, s) => sum + s.profit, 0);

            return { stores: storeResults, totalRevenue: tRev, totalProfit: tProf };
        }
    });

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

    return (
        <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-[1600px] mx-auto">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Store className="h-8 w-8 text-primary" />
                        Umumiy Do'konlar Analitikasi
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm md:text-base">
                        Barcha ulangan do'konlaringiz oylik foyda va ziyonlari bitta joyda ({displayPeriod})
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button onClick={handleRefresh} disabled={isRefreshing || isLoading || isRatesLoading} className="shadow-sm transition-all hover:shadow-md">
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                        Yangilash
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="my-stores" className="w-full mt-4">
                <TabsList className="mb-6 h-11 bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-lg">
                    <TabsTrigger value="my-stores" className="px-6 h-9 rounded-md">Mening Do'konlarim</TabsTrigger>
                    <TabsTrigger value="competitors" className="px-6 h-9 rounded-md">Raqobatchilar (Uzum.uz)</TabsTrigger>
                </TabsList>

                <TabsContent value="my-stores" className="space-y-6">
                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg">
                            Xatolik yuz berdi: {(error as Error).message}
                        </div>
                    )}
                    <div className="grid gap-4 md:gap-6 md:grid-cols-3">
                        {isLoading || isRatesLoading ? (
                            Array(3).fill(0).map((_, i) => (
                                <Card key={i} className="shadow-sm border-slate-200 dark:border-slate-800">
                                    <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                                    <CardContent><Skeleton className="h-8 w-32" /></CardContent>
                                </Card>
                            ))
                        ) : (
                            <>
                                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Jami Tushum ({displayPeriod})</CardTitle>
                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                                            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{fmt(analyticsData?.totalRevenue || 0)}</div>
                                    </CardContent>
                                </Card>
                                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Sof Foyda (Tannarx va Kargo olingan)</CardTitle>
                                        <div className="p-2 bg-primary/10 rounded-full">
                                            <TrendingUp className="h-4 w-4 text-primary" />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className={`text-2xl font-bold ${(analyticsData?.totalProfit || 0) < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {fmt(analyticsData?.totalProfit || 0)}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Oylik Buyurtmalar (yetkazilgan)</CardTitle>
                                        <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-full">
                                            <Package className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {analyticsData?.stores.reduce((sum, s) => sum + s.totalSales, 0) || 0} dona
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    {(!isLoading && !isRatesLoading && analyticsData?.stores.length) ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-6">
                            {analyticsData.stores.map(store => (
                                <Card
                                    key={store.id}
                                    className={`overflow-hidden transition-all hover:shadow-md ${store.isLoss ? 'border-destructive/60 bg-red-50/50 dark:bg-red-950/20' : store.isLowRevenue ? 'border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-800'}`}
                                >
                                    <CardHeader className={`pb-3 border-b ${store.isLoss ? 'bg-red-100/50 dark:bg-red-900/40' : store.isLowRevenue ? 'bg-amber-100/50 dark:bg-amber-900/40' : 'bg-slate-50/50 dark:bg-slate-900/50'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg line-clamp-1 flex items-center gap-2">
                                                    {store.name}
                                                    {store.isLoss && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                                                    {store.isLowRevenue && !store.isLoss && <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />}
                                                </CardTitle>
                                                <CardDescription className="uppercase mt-1 text-xs font-semibold">{store.platform}</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4 space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Tushum</span>
                                            <span className="font-semibold">{fmt(store.totalRevenue)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Xarajat & Kargo</span>
                                            <span className="font-medium">{fmt(store.totalExpenses)}</span>
                                        </div>
                                        <div className="pt-2 border-t flex justify-between items-center">
                                            <span className="text-sm font-medium">Sof Foyda</span>
                                            <Badge variant={store.isLoss ? "destructive" : "default"} className={!store.isLoss ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                                                {store.profit > 0 ? "+" : ""}{fmt(store.profit)}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        !isLoading && !isRatesLoading && (
                            <div className="text-center py-12 px-4 rounded-xl border border-dashed text-muted-foreground">
                                Do'konlar bo'yicha ma'lumot topilmadi yoki buyurtmalar yo'q.
                            </div>
                        )
                    )}
                </TabsContent>

                <TabsContent value="competitors">
                    <CompetitorAnalysis />
                </TabsContent>
            </Tabs>
        </div>
    );
}
