import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Truck, Calculator, Info, ShoppingCart, MapPin, Box, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { LazyImage } from '@/components/ui/lazy-image';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatUZS } from '@/lib/utils';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';

interface NewArrivalItem {
  id: string;
  item_uuid: string;
  product_id: string;
  box_id: string | null;
  status: string;
  unit_cost_usd: number | null;
  domestic_shipping_cost: number | null;
  international_shipping_cost: number | null;
  final_cost_usd: number | null;
  exchange_rate_at_purchase: number | null;
  cost_breakdown: Record<string, unknown> | null;
  updated_at: string;
  product: {
    id: string;
    name: string;
    main_image_url: string | null;
    category_id: string | null;
    price: number | null;
    purchase_currency: string | null;
  } | null;
  box: {
    box_number: string;
    actual_arrival: string | null;
    abusaxiy_receipt_number: string | null;
    shipping_cost: number | null;
    volume_m3: number | null;
  } | null;
}

// Grouped item interface for combining same product + box items
interface GroupedItem {
  key: string;
  product: NewArrivalItem['product'];
  box: NewArrivalItem['box'];
  quantity: number;
  itemIds: string[];
  totalPurchaseCost: number;
  totalDomesticShipping: number;
  totalInternationalShipping: number;
  totalFinalCost: number;
  updated_at: string;
  items: NewArrivalItem[];
  firstItem: NewArrivalItem;
}

// Group items by product_id + box_id
const groupItems = (items: NewArrivalItem[]): GroupedItem[] => {
  const grouped = items.reduce((acc, item) => {
    const key = `${item.product_id}_${item.box_id || 'no-box'}`;
    
    if (!acc[key]) {
      acc[key] = {
        key,
        product: item.product,
        box: item.box,
        quantity: 0,
        itemIds: [],
        totalPurchaseCost: 0,
        totalDomesticShipping: 0,
        totalInternationalShipping: 0,
        totalFinalCost: 0,
        updated_at: item.updated_at,
        items: [],
        firstItem: item,
      };
    }
    
    acc[key].quantity += 1;
    acc[key].itemIds.push(item.id);
    acc[key].totalPurchaseCost += item.unit_cost_usd || 0;
    acc[key].totalDomesticShipping += item.domestic_shipping_cost || 0;
    acc[key].totalInternationalShipping += item.international_shipping_cost || 0;
    acc[key].totalFinalCost += item.final_cost_usd || 0;
    acc[key].items.push(item);
    
    // Update to latest updated_at
    if (new Date(item.updated_at) > new Date(acc[key].updated_at)) {
      acc[key].updated_at = item.updated_at;
    }
    
    return acc;
  }, {} as Record<string, GroupedItem>);
  
  return Object.values(grouped).sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
};

export function NewArrivalsTab() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed'>('pending');

  // Live exchange rates from global context (sessiya override yoki DB)
  const { usdToUzs: usdRate, cnyToUzs: cnyRate } = useFinanceCurrency();

  // Convert USD to UZS using live context rate
  const usdToUzs = (usd: number) => usd * usdRate;
  
  // Convert CNY to UZS using live context rate
  const cnyToUzsConvert = (cny: number) => cny * cnyRate;

  // Fetch items awaiting confirmation (arrived_pending)
  const { data: pendingItems = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['tashkent-pending-arrivals'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from('product_items')
        .select(`
          id,
          item_uuid,
          product_id,
          box_id,
          status,
          unit_cost_usd,
          domestic_shipping_cost,
          international_shipping_cost,
          final_cost_usd,
          exchange_rate_at_purchase,
          cost_breakdown,
          updated_at,
          product:products!inner(id, name, main_image_url, category_id, price, purchase_currency),
          box:boxes(box_number, actual_arrival, abusaxiy_receipt_number, shipping_cost, volume_m3)
        `)
        .eq('status', 'arrived_pending')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as NewArrivalItem[];
    },
  });

  // Fetch confirmed items (in_tashkent) from last 7 days
  const { data: confirmedItems = [], isLoading: confirmedLoading } = useQuery({
    queryKey: ['tashkent-confirmed-arrivals'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from('product_items')
        .select(`
          id,
          item_uuid,
          product_id,
          box_id,
          status,
          unit_cost_usd,
          domestic_shipping_cost,
          international_shipping_cost,
          final_cost_usd,
          exchange_rate_at_purchase,
          cost_breakdown,
          updated_at,
          product:products!inner(id, name, main_image_url, category_id, price, purchase_currency),
          box:boxes(box_number, actual_arrival, abusaxiy_receipt_number, shipping_cost, volume_m3)
        `)
        .eq('status', 'in_tashkent')
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as NewArrivalItem[];
    },
  });

  // Confirm items mutation
  const confirmMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { data, error } = await supabase.rpc('confirm_arrived_products', {
        p_item_ids: itemIds
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const result = data as { confirmed_count?: number } | null;
      toast({
        title: '✅ Tasdiqlandi!',
        description: `${result?.confirmed_count || 0} ta mahsulot omborga qo'shildi`,
      });
      setSelectedItems([]);
      queryClient.invalidateQueries({ queryKey: ['tashkent-pending-arrivals'] });
      queryClient.invalidateQueries({ queryKey: ['tashkent-confirmed-arrivals'] });
      queryClient.invalidateQueries({ queryKey: ['tashkent-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tashkent-category-counts'] });
    },
    onError: (error) => {
      toast({
        title: 'Xatolik',
        description: 'Tasdiqlashda xatolik yuz berdi',
        variant: 'destructive',
      });
      console.error('Confirm error:', error);
    },
  });

  const handleConfirmSelected = () => {
    if (selectedItems.length === 0) return;
    confirmMutation.mutate(selectedItems);
  };

  const handleConfirmAll = () => {
    const allIds = pendingItems.map(item => item.id);
    if (allIds.length === 0) return;
    confirmMutation.mutate(allIds);
  };

  const handleConfirmSingle = (itemId: string) => {
    confirmMutation.mutate([itemId]);
  };

  // Group items for display
  const groupedPendingItems = groupItems(pendingItems);
  const groupedConfirmedItems = groupItems(confirmedItems);
  
  // Get all item IDs from grouped items
  const getAllItemIds = (groups: GroupedItem[]) => groups.flatMap(g => g.itemIds);

  const toggleSelectAll = () => {
    const allIds = getAllItemIds(groupedPendingItems);
    if (selectedItems.length === allIds.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(allIds);
    }
  };

  const toggleSelectGroup = (group: GroupedItem) => {
    const allSelected = group.itemIds.every(id => selectedItems.includes(id));
    if (allSelected) {
      // Deselect all items in this group
      setSelectedItems(prev => prev.filter(id => !group.itemIds.includes(id)));
    } else {
      // Select all items in this group
      setSelectedItems(prev => [...new Set([...prev, ...group.itemIds])]);
    }
  };

  const isGroupSelected = (group: GroupedItem) => 
    group.itemIds.every(id => selectedItems.includes(id));

  const isGroupPartiallySelected = (group: GroupedItem) => 
    group.itemIds.some(id => selectedItems.includes(id)) && !isGroupSelected(group);

  // Calculate totals for display
  const calculateTotals = (items: NewArrivalItem[]) => items.reduce((acc, item) => ({
    purchaseCost: acc.purchaseCost + (item.unit_cost_usd || 0),
    domesticShipping: acc.domesticShipping + (item.domestic_shipping_cost || 0),
    internationalShipping: acc.internationalShipping + (item.international_shipping_cost || 0),
    finalCost: acc.finalCost + (item.final_cost_usd || 0),
  }), { purchaseCost: 0, domesticShipping: 0, internationalShipping: 0, finalCost: 0 });

  const pendingTotals = calculateTotals(pendingItems);
  const confirmedTotals = calculateTotals(confirmedItems);

  // Format CNY to USD with rate
  const formatCostBreakdown = (item: NewArrivalItem) => {
    const exchangeRate = item.exchange_rate_at_purchase || 7.25;
    const purchasePrice = item.product?.price || 0;
    const purchaseCurrency = item.product?.purchase_currency || 'CNY';
    
    return {
      original: purchaseCurrency === 'CNY' ? `¥${purchasePrice.toFixed(2)}` : `$${purchasePrice.toFixed(2)}`,
      exchangeRate: exchangeRate.toFixed(2),
      purchaseUsd: item.unit_cost_usd?.toFixed(2) || '—',
      domesticUsd: item.domestic_shipping_cost?.toFixed(2) || '—',
      internationalUsd: item.international_shipping_cost?.toFixed(2) || '—',
      finalUsd: item.final_cost_usd?.toFixed(2) || '—',
    };
  };

  const isLoading = pendingLoading || confirmedLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const renderGroupedItemsTable = (groupedItems: GroupedItem[], originalItems: NewArrivalItem[], isPending: boolean, totals: ReturnType<typeof calculateTotals>) => (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPending ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
              {isPending ? <Clock className="h-5 w-5 text-amber-500" /> : <Package className="h-5 w-5 text-blue-500" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {isPending ? 'Kutilmoqda' : 'Tasdiqlangan'}
              </p>
              <p className="text-xl font-bold">{originalItems.length} ta</p>
              {groupedItems.length !== originalItems.length && (
                <p className="text-xs text-muted-foreground">({groupedItems.length} guruh)</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sotib olish</p>
              <p className="text-xl font-bold">{formatUZS(usdToUzs(totals.purchaseCost))}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Truck className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Yo'l haqi</p>
              <p className="text-lg font-bold">
                <span className="text-xs text-muted-foreground block">Xitoy: {formatUZS(cnyToUzsConvert(totals.domesticShipping))}</span>
                <span className="text-xs text-muted-foreground block">Xalqaro: {formatUZS(usdToUzs(totals.internationalShipping))}</span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-green-500/5 border-green-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Jami tannarx</p>
              <p className="text-xl font-bold text-green-600">{formatUZS(usdToUzs(totals.finalCost))}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Bulk Actions for Pending */}
      {isPending && originalItems.length > 0 && (
        <Card className="p-4 bg-amber-500/5 border-amber-500/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium">Tasdiqlash kutmoqda</p>
                <p className="text-sm text-muted-foreground">
                  {selectedItems.length > 0 
                    ? `${selectedItems.length} ta tanlangan` 
                    : `${originalItems.length} ta mahsulot yetib keldi`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedItems.length > 0 ? (
                <Button 
                  onClick={handleConfirmSelected}
                  disabled={confirmMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {confirmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Tanlanganlarni tasdiqlash ({selectedItems.length})
                </Button>
              ) : (
                <Button 
                  onClick={handleConfirmAll}
                  disabled={confirmMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {confirmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Barchasini tasdiqlash
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Items Table */}
      {groupedItems.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {isPending ? 'Tasdiqlash kutayotgan tovarlar yo\'q' : 'Oxirgi 7 kunda tasdiqlangan tovarlar yo\'q'}
          </p>
        </Card>
      ) : isMobile ? (
        <div className="space-y-2">
          {groupedItems.map((group) => {
            const item = group.firstItem;
            return (
              <Card key={group.key} className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  {isPending && (
                    <Checkbox
                      checked={isGroupSelected(group)}
                      onCheckedChange={() => toggleSelectGroup(group)}
                      className="mt-1"
                    />
                  )}
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {item.product?.main_image_url ? (
                      <LazyImage src={item.product.main_image_url} alt={item.product?.name || ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2">{item.product?.name || 'Noma\'lum'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge variant={group.quantity > 1 ? 'default' : 'secondary'} className="text-xs">{group.quantity} ta</Badge>
                      {item.box && <Badge variant="outline" className="text-xs"><Box className="h-3 w-3 mr-0.5" />{item.box.box_number}</Badge>}
                    </div>
                  </div>
                  {isPending && (
                    <Button size="sm" variant="outline" onClick={() => confirmMutation.mutate(group.itemIds)} disabled={confirmMutation.isPending} className="text-green-600 border-green-600 hover:bg-green-50 flex-shrink-0 h-8">
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Sotib olish</span>
                    <p className="font-medium">{formatUZS(usdToUzs(group.totalPurchaseCost / group.quantity))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Yo'l haqi</span>
                    <p className="font-medium">
                      {group.totalInternationalShipping > 0 
                        ? formatUZS(usdToUzs(group.totalInternationalShipping / group.quantity))
                        : 'Kutilmoqda'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tannarx</span>
                    <p className="font-bold text-amber-600">
                      {group.totalFinalCost > 0 
                        ? formatUZS(usdToUzs(group.totalFinalCost / group.quantity))
                        : '-'}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                {isPending && (
                  <TableHead className="w-12">
                    <Checkbox checked={selectedItems.length === originalItems.length && originalItems.length > 0} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                )}
                <TableHead>Tovar</TableHead>
                <TableHead className="text-center">Soni</TableHead>
                <TableHead>Quti / Trek</TableHead>
                <TableHead>Kelgan sana</TableHead>
                <TableHead className="text-right">
                  <Tooltip><TooltipTrigger className="flex items-center justify-end gap-1">Sotib olish (1 ta)<Info className="h-3 w-3" /></TooltipTrigger><TooltipContent><p>1 ta mahsulot narxi</p></TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip><TooltipTrigger className="flex items-center justify-end gap-1">Xitoy yo'l (1 ta)<MapPin className="h-3 w-3" /></TooltipTrigger><TooltipContent><p>1 ta mahsulot uchun Xitoy yo'l haqi</p></TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip><TooltipTrigger className="flex items-center justify-end gap-1">Xalqaro yo'l (1 ta)<Truck className="h-3 w-3" /></TooltipTrigger><TooltipContent><p>1 ta mahsulot uchun Xitoy → Toshkent</p></TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="text-right font-bold">
                  <Tooltip><TooltipTrigger className="flex items-center justify-end gap-1">Tannarx (1 ta)<Calculator className="h-3 w-3" /></TooltipTrigger><TooltipContent><p>1 ta mahsulot uchun: Sotib olish + Xitoy yo'l + Xalqaro yo'l</p></TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="text-right font-bold bg-green-500/10">
                  <Tooltip><TooltipTrigger className="flex items-center justify-end gap-1">Jami xarajat<Calculator className="h-3 w-3" /></TooltipTrigger><TooltipContent><p>Barcha mahsulotlar uchun jami xarajat</p></TooltipContent></Tooltip>
                </TableHead>
                {isPending && <TableHead className="text-right">Amal</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedItems.map((group) => {
                const item = group.firstItem;
                return (
                  <TableRow key={group.key}>
                    {isPending && (
                      <TableCell>
                        <Checkbox checked={isGroupSelected(group)} ref={(el) => { if (el && isGroupPartiallySelected(group)) { (el as HTMLButtonElement).dataset.state = 'indeterminate'; } }} onCheckedChange={() => toggleSelectGroup(group)} />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {item.product?.main_image_url ? (
                            <LazyImage src={item.product.main_image_url} alt={item.product?.name || 'Product'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm line-clamp-1">{item.product?.name || 'Noma\'lum'}</p>
                          <p className="text-xs text-muted-foreground">{group.quantity > 1 ? `${group.itemIds.length} ta item` : item.item_uuid.slice(0, 8)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={group.quantity > 1 ? 'default' : 'secondary'} className="font-bold">{group.quantity} ta</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {item.box ? (
                          <>
                            <Badge variant="outline" className="text-xs"><Box className="h-3 w-3 mr-1" />{item.box.box_number}</Badge>
                            {item.box.abusaxiy_receipt_number && <p className="text-[10px] text-primary">Trek: {item.box.abusaxiy_receipt_number}</p>}
                          </>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{item.box?.actual_arrival ? format(new Date(item.box.actual_arrival), 'dd.MM.yyyy') : format(new Date(group.updated_at), 'dd.MM.yyyy')}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip><TooltipTrigger><span className="text-sm font-medium">{formatUZS(usdToUzs(group.totalPurchaseCost / group.quantity))}</span></TooltipTrigger><TooltipContent><p>1 ta mahsulot sotib olish narxi</p>{group.quantity > 1 && <p className="text-muted-foreground">Jami {group.quantity} ta: {formatUZS(usdToUzs(group.totalPurchaseCost))}</p>}</TooltipContent></Tooltip>
                    </TableCell>
                    <TableCell className="text-right">
                      {group.totalDomesticShipping > 0 ? (
                        <Tooltip><TooltipTrigger><span className="text-sm">{formatUZS(cnyToUzsConvert(group.totalDomesticShipping / group.quantity))}</span></TooltipTrigger><TooltipContent><p>1 ta uchun Xitoy yo'l haqi</p><p className="text-muted-foreground">¥{(group.totalDomesticShipping / group.quantity).toFixed(2)} CNY</p></TooltipContent></Tooltip>
                      ) : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {group.totalInternationalShipping > 0 ? (
                        <Tooltip><TooltipTrigger><span className="text-sm">{formatUZS(usdToUzs(group.totalInternationalShipping / group.quantity))}</span></TooltipTrigger><TooltipContent><p>1 ta uchun xalqaro yo'l haqi</p></TooltipContent></Tooltip>
                      ) : <Badge variant="secondary" className="text-[10px]">Kutilmoqda</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {group.totalFinalCost > 0 ? (
                        <Tooltip><TooltipTrigger><span className="text-sm font-bold text-amber-600">{formatUZS(usdToUzs(group.totalFinalCost / group.quantity))}</span></TooltipTrigger><TooltipContent><p className="font-medium">1 ta mahsulot tannarxi</p></TooltipContent></Tooltip>
                      ) : <Badge variant="secondary" className="text-[10px]">Hisoblanmagan</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {group.totalFinalCost > 0 ? (
                        <Tooltip><TooltipTrigger><Badge variant="default" className="font-bold bg-green-500 hover:bg-green-600">{formatUZS(usdToUzs(group.totalFinalCost))}</Badge></TooltipTrigger><TooltipContent><p className="font-medium">Jami {group.quantity} ta mahsulot</p></TooltipContent></Tooltip>
                      ) : <Badge variant="secondary">Hisoblanmagan</Badge>}
                    </TableCell>
                    {isPending && (
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => confirmMutation.mutate(group.itemIds)} disabled={confirmMutation.isPending} className="text-green-600 border-green-600 hover:bg-green-50">
                          {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-1" />{group.quantity > 1 ? `${group.quantity} ta` : 'Tasdiqlash'}</>}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Formula explanation */}
        <Card className="p-4 bg-muted/50">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Tannarx hisoblash formulasi:</p>
              <code className="text-xs bg-background px-2 py-1 rounded">
                Tannarx = Sotib olish + Xitoy yo'l haqqi + Xalqaro yo'l haqqi
              </code>
              <p className="mt-2 text-xs">
                Yo'l haqqi quti jo'natilganda avtomatik taqsimlanadi (PDF import orqali)
              </p>
            </div>
          </div>
        </Card>

        {/* Sub-tabs for pending vs confirmed */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'confirmed')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Kutilmoqda
              {pendingItems.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {pendingItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Tasdiqlangan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6 space-y-6">
            {renderGroupedItemsTable(groupedPendingItems, pendingItems, true, pendingTotals)}
          </TabsContent>

          <TabsContent value="confirmed" className="mt-6 space-y-6">
            {renderGroupedItemsTable(groupedConfirmedItems, confirmedItems, false, confirmedTotals)}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
