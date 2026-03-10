import { useQuery, useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FBOInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  createdAt: string;
  acceptedAt?: string;
  productCount: number;
  totalQuantity: number;
  storeName?: string;
}

export interface FBOReturn {
  returnId: string;
  productId: string;
  productTitle: string;
  skuTitle: string;
  quantity: number;
  returnReason: string;
  status: string;
  createdAt: string;
  storeName?: string;
}

export interface FBOOrder {
  orderId: string;
  orderItemId: string;
  productId: string;
  productTitle: string;
  skuTitle: string;
  amount: number;
  sellerPrice: number;
  commission: number;
  sellerProfit: number;
  deliveryFee: number;
  status: string;
  dateIssued: string;
  storeName?: string;
}

export interface FBOSummary {
  invoices: FBOInvoice[];
  returns: FBOReturn[];
  orders: FBOOrder[];
  totals: {
    totalInvoices: number;
    totalReturns: number;
    totalReturnQuantity: number;
    defectedCount: number;
    lastDeliveryDate?: string;
    storeCount?: number;
    storeNames?: string[];
    totalOrders: number;
    totalOrderItems: number;
    totalRevenue: number;
    totalCommission: number;
    totalProfit: number;
  };
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isAggregated?: boolean;
}

interface UzumStore {
  id: string;
  name: string;
}

async function fetchFBOForStore(storeId: string, storeName?: string) {
  const { data, error } = await supabase.functions.invoke('uzum-finance', {
    body: { 
      store_id: storeId, 
      action: 'fbo_summary' 
    }
  });

  if (error) throw error;
  
  const result = data?.result || data;
  
  const invoices: FBOInvoice[] = (result?.invoices || []).map((inv: any) => ({
    id: inv.id?.toString() || '',
    invoiceNumber: inv.invoiceNumber || inv.externalNumber || `INV-${inv.id}`,
    status: inv.status || '',
    createdAt: inv.dateCreated ? new Date(inv.dateCreated).toISOString() : '',
    acceptedAt: inv.acceptedAt || inv.completedDate ? new Date(inv.completedDate).toISOString() : undefined,
    productCount: inv.productCount || 0,
    totalQuantity: inv.totalQuantity || 0,
    storeName,
  }));

  const returns: FBOReturn[] = (result?.returns || []).map((ret: any) => ({
    returnId: ret.id?.toString() || '',
    productId: ret.productId?.toString() || '',
    productTitle: ret.stock?.title || 'FBO Qaytarish',
    skuTitle: ret.type || '',
    quantity: 1,
    returnReason: ret.type || '',
    status: ret.status || '',
    createdAt: ret.dateCreated ? new Date(ret.dateCreated).toISOString() : '',
    storeName,
  }));

  const orders: FBOOrder[] = (result?.orders || []).map((ord: any) => ({
    orderId: ord.orderId?.toString() || '',
    orderItemId: ord.orderItemId?.toString() || '',
    productId: ord.productId?.toString() || '',
    productTitle: ord.productTitle || ord.skuTitle || '',
    skuTitle: ord.skuTitle || '',
    amount: ord.amount || 1,
    sellerPrice: ord.sellPrice || ord.sellerPrice || 0,
    commission: ord.commission || 0,
    sellerProfit: ord.sellerProfit || 0,
    deliveryFee: ord.logisticDeliveryFee || 0,
    status: ord.status || '',
    dateIssued: ord.date ? new Date(ord.date).toISOString() : (ord.dateIssued ? new Date(ord.dateIssued).toISOString() : ''),
    storeName,
  }));

  const ordersTotals = result?.orders_totals || { revenue: 0, commission: 0, profit: 0, deliveryFees: 0, itemCount: 0 };

  return { invoices, returns, orders, ordersTotals, storeName };
}

function buildSummary(
  invoices: FBOInvoice[],
  returns: FBOReturn[],
  orders: FBOOrder[],
  ordersTotals: any,
  isLoading: boolean,
  error: Error | null,
  refetch: () => void,
  isAggregated: boolean,
  storeNames?: string[],
): FBOSummary {
  const defectedCount = returns.filter(r => r.status === 'DEFECTED').length;
  const totalReturnQuantity = returns.reduce((sum, r) => sum + r.quantity, 0);

  const deliveredInvoices = invoices.filter(inv => inv.acceptedAt);
  const lastDeliveryDate = deliveredInvoices.length > 0
    ? deliveredInvoices.sort((a, b) =>
        new Date(b.acceptedAt!).getTime() - new Date(a.acceptedAt!).getTime()
      )[0].acceptedAt
    : undefined;

  return {
    invoices,
    returns,
    orders,
    totals: {
      totalInvoices: invoices.length,
      totalReturns: returns.length,
      totalReturnQuantity,
      defectedCount,
      lastDeliveryDate,
      storeCount: storeNames?.length,
      storeNames,
      totalOrders: orders.length,
      totalOrderItems: ordersTotals.itemCount || 0,
      totalRevenue: ordersTotals.revenue || 0,
      totalCommission: ordersTotals.commission || 0,
      totalProfit: ordersTotals.profit || 0,
    },
    isLoading,
    error,
    refetch,
    isAggregated,
  };
}

export function useFBOData(storeId: string | null, uzumStores?: UzumStore[]): FBOSummary {
  // Single store query
  const singleStoreQuery = useQuery({
    queryKey: ['fbo-summary', storeId],
    queryFn: () => fetchFBOForStore(storeId!),
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  // Aggregated queries for all Uzum stores
  const aggregatedQueries = useQueries({
    queries: (!storeId && uzumStores?.length) 
      ? uzumStores.map(store => ({
          queryKey: ['fbo-summary', store.id],
          queryFn: () => fetchFBOForStore(store.id, store.name),
          staleTime: 1000 * 60 * 5,
          gcTime: 1000 * 60 * 30,
        }))
      : [],
  });

  // Handle single store case
  if (storeId) {
    const result = singleStoreQuery.data;
    const invoices = result?.invoices || [];
    const returns = result?.returns || [];
    const orders = result?.orders || [];
    const ordersTotals = result?.ordersTotals || { revenue: 0, commission: 0, profit: 0, deliveryFees: 0, itemCount: 0 };

    return buildSummary(
      invoices, returns, orders, ordersTotals,
      singleStoreQuery.isLoading,
      singleStoreQuery.error as Error | null,
      () => { singleStoreQuery.refetch(); },
      false,
    );
  }

  // Handle aggregated case
  const isLoading = aggregatedQueries.some(q => q.isLoading);
  const error = aggregatedQueries.find(q => q.error)?.error as Error | null;
  
  const allInvoices: FBOInvoice[] = [];
  const allReturns: FBOReturn[] = [];
  const allOrders: FBOOrder[] = [];
  const storeNames: string[] = [];
  let aggregatedOrdersTotals = { revenue: 0, commission: 0, profit: 0, deliveryFees: 0, itemCount: 0 };

  aggregatedQueries.forEach(query => {
    if (query.data) {
      allInvoices.push(...query.data.invoices);
      allReturns.push(...query.data.returns);
      allOrders.push(...(query.data.orders || []));
      
      const ot = query.data.ordersTotals || { revenue: 0, commission: 0, profit: 0, deliveryFees: 0, itemCount: 0 };
      aggregatedOrdersTotals.revenue += ot.revenue;
      aggregatedOrdersTotals.commission += ot.commission;
      aggregatedOrdersTotals.profit += ot.profit;
      aggregatedOrdersTotals.deliveryFees += ot.deliveryFees;
      aggregatedOrdersTotals.itemCount += ot.itemCount;
      
      if (query.data.storeName && (query.data.invoices.length > 0 || query.data.returns.length > 0 || (query.data.orders?.length || 0) > 0)) {
        if (!storeNames.includes(query.data.storeName)) {
          storeNames.push(query.data.storeName);
        }
      }
    }
  });

  return buildSummary(
    allInvoices, allReturns, allOrders, aggregatedOrdersTotals,
    isLoading,
    error,
    () => { aggregatedQueries.forEach(q => q.refetch()); },
    true,
    storeNames,
  );
}
