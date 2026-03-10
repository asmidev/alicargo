import { useState, useMemo } from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Package, Plus, Minus, Loader2, Layers, Trash2 } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';

interface BoxPackingDialogProps {
  box: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GroupedItem {
  groupKey: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  category: string | null;
  items: any[];
  count: number;
}

const formatVariantAttributes = (attrs: Record<string, any> | null) => {
  if (!attrs) return null;
  return Object.values(attrs).join(' / ');
};

export function BoxPackingDialog({ box, open, onOpenChange }: BoxPackingDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [removeQuantities, setRemoveQuantities] = useState<Record<string, number>>({});
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add');

  // Fetch available product items (not in any box, not sold/in_transit)
  const { data: availableItems, isLoading: loadingAvailable } = useQuery({
    queryKey: ['available-items', box?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_items')
        .select('*, products!inner(name, uuid, category, has_variants, source), product_variants(id, variant_attributes)')
        .is('box_id', null)
        .in('status', ['pending', 'arrived']) // Only items that can be packed
        .in('location', ['china', 'uzbekistan']) // Only items at packable locations
        .neq('products.source', 'marketplace_auto')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!box && open,
  });

  // Fetch all variants for products that have variants
  const { data: allVariants } = useQuery({
    queryKey: ['all-variants-for-packing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*, products(name)')
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!box && open,
  });

  // Fetch items already in this box
  const { data: boxItems, isLoading: loadingBoxItems } = useQuery({
    queryKey: ['box-items', box?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_items')
        .select('*, products(name, uuid, category, has_variants), product_variants(id, variant_attributes)')
        .eq('box_id', box.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!box && open,
  });

  // Get variants for a specific product
  const getVariantsForProduct = (productId: string) => {
    return allVariants?.filter(v => v.product_id === productId) || [];
  };

  // Group available items by product and variant
  const groupedAvailable = useMemo(() => {
    if (!availableItems) return [];
    
    const groups: Record<string, GroupedItem> = {};
    
    availableItems.forEach(item => {
      const productId = item.product_id;
      const variantId = item.variant_id || null;
      const hasVariants = item.products?.has_variants;
      
      // Create a unique key for product+variant combination
      const groupKey = variantId ? `${productId}__${variantId}` : `${productId}__no_variant`;
      
      if (!groups[groupKey]) {
        const variantAttrs = item.product_variants?.variant_attributes as Record<string, any> | null;
        groups[groupKey] = {
          groupKey,
          productId,
          variantId,
          productName: item.products?.name || t('bpk_unnamed'),
          variantName: variantAttrs ? formatVariantAttributes(variantAttrs) : null,
          category: item.products?.category,
          items: [],
          count: 0,
        };
      }
      groups[groupKey].items.push(item);
      groups[groupKey].count++;
    });
    
    return Object.values(groups).sort((a, b) => {
      // Sort by product name, then variant
      if (a.productName !== b.productName) return a.productName.localeCompare(b.productName);
      if (!a.variantName) return -1;
      if (!b.variantName) return 1;
      return a.variantName.localeCompare(b.variantName);
    });
  }, [availableItems]);

  // Group box items by product and variant
  const groupedBoxItems = useMemo(() => {
    if (!boxItems) return [];
    
    const groups: Record<string, GroupedItem> = {};
    
    boxItems.forEach(item => {
      const productId = item.product_id;
      const variantId = item.variant_id || null;
      const groupKey = variantId ? `${productId}__${variantId}` : `${productId}__no_variant`;
      
      if (!groups[groupKey]) {
        const variantAttrs = item.product_variants?.variant_attributes as Record<string, any> | null;
        groups[groupKey] = {
          groupKey,
          productId,
          variantId,
          productName: item.products?.name || t('bpk_unnamed'),
          variantName: variantAttrs ? formatVariantAttributes(variantAttrs) : null,
          category: item.products?.category,
          items: [],
          count: 0,
        };
      }
      groups[groupKey].items.push(item);
      groups[groupKey].count++;
    });
    
    return Object.values(groups).sort((a, b) => {
      if (a.productName !== b.productName) return a.productName.localeCompare(b.productName);
      if (!a.variantName) return -1;
      if (!b.variantName) return 1;
      return a.variantName.localeCompare(b.variantName);
    });
  }, [boxItems]);

  // Filter grouped products by search
  const filteredAvailable = useMemo(() => {
    if (!searchQuery) return groupedAvailable;
    const query = searchQuery.toLowerCase();
    return groupedAvailable.filter(g => 
      g.productName.toLowerCase().includes(query) ||
      g.category?.toLowerCase().includes(query) ||
      g.variantName?.toLowerCase().includes(query)
    );
  }, [groupedAvailable, searchQuery]);

  const filteredBoxItems = useMemo(() => {
    if (!searchQuery) return groupedBoxItems;
    const query = searchQuery.toLowerCase();
    return groupedBoxItems.filter(g => 
      g.productName.toLowerCase().includes(query) ||
      g.category?.toLowerCase().includes(query) ||
      g.variantName?.toLowerCase().includes(query)
    );
  }, [groupedBoxItems, searchQuery]);

  // Calculate total selected for adding
  const totalToAdd = useMemo(() => {
    return Object.values(selectedQuantities).reduce((sum, qty) => sum + qty, 0);
  }, [selectedQuantities]);

  // Calculate total selected for removing
  const totalToRemove = useMemo(() => {
    return Object.values(removeQuantities).reduce((sum, qty) => sum + qty, 0);
  }, [removeQuantities]);

  // Mutation to delete ghost items created by previous bugs
  const deleteGhostItemsMutation = useMutation({
    mutationFn: async (groupKey: string) => {
      const group = groupedAvailable.find(g => g.groupKey === groupKey);
      if (!group || group.items.length === 0) return 0;
      
      const itemIds = group.items.map(i => i.id);
      
      const { error } = await supabase
        .from('product_items')
        .delete()
        .in('id', itemIds);
        
      if (error) throw error;
      return itemIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['available-items'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory-overview'] });
      toast({
        title: t('inv_tash_deleted', 'O‘chirildi'),
        description: `${count} ta ortiqcha kutilayotgan mahsulot tizimdan o'chirildi.`,
      });
      setSelectedQuantities({});
    },
    onError: (error: any) => {
      toast({
        title: 'Xato',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Pack items mutation
  const packItemsMutation = useMutation({
    mutationFn: async () => {
      const itemIds: string[] = [];
      const variantUpdates: { itemId: string; variantId: string }[] = [];
      
      // Collect item IDs based on selected quantities
      Object.entries(selectedQuantities).forEach(([groupKey, quantity]) => {
        const group = groupedAvailable.find(g => g.groupKey === groupKey);
        if (group && quantity > 0) {
          const idsToAdd = group.items.slice(0, quantity).map(item => item.id);
          itemIds.push(...idsToAdd);
          
          // Check if we need to assign a variant
          const selectedVariantId = selectedVariants[group.productId];
          if (selectedVariantId && selectedVariantId !== 'no_variant') {
            idsToAdd.forEach(id => {
              variantUpdates.push({ itemId: id, variantId: selectedVariantId });
            });
          }
        }
      });

      if (itemIds.length === 0) throw new Error(t('bpk_no_product_selected'));

      // Update product_items with box_id and status
      const { error: itemsError } = await supabase
        .from('product_items')
        .update({ 
          box_id: box.id, 
          status: 'packed',
          location: 'china' 
        })
        .in('id', itemIds);
      
      if (itemsError) throw itemsError;

      // Update variant assignments if any
      for (const update of variantUpdates) {
        await supabase
          .from('product_items')
          .update({ variant_id: update.variantId })
          .eq('id', update.itemId);
      }

      // Create tracking events
      const trackingEvents = itemIds.map(itemId => ({
        entity_type: 'product_item',
        entity_id: itemId,
        event_type: 'packed',
        description: `Added to box: ${box.box_number}`,
        location: 'china',
      }));

      const { error: trackingError } = await supabase
        .from('tracking_events')
        .insert(trackingEvents);
      
      if (trackingError) throw trackingError;

      return itemIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['available-items'] });
      queryClient.invalidateQueries({ queryKey: ['box-items'] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      queryClient.invalidateQueries({ queryKey: ['product-items'] });
      queryClient.invalidateQueries({ queryKey: ['china-box-items'] }); // Refresh verification items
      queryClient.invalidateQueries({ queryKey: ['china-box-session-items'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory-overview'] });
      toast({
        title: t('bpk_packed_success'),
        description: t('bpk_packed_desc', { count }),
      });
      setSelectedQuantities({});
      setSelectedVariants({});
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Xato',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Remove items mutation
  const removeItemsMutation = useMutation({
    mutationFn: async () => {
      const itemIds: string[] = [];
      
      // Collect item IDs based on remove quantities
      Object.entries(removeQuantities).forEach(([groupKey, quantity]) => {
        const group = groupedBoxItems.find(g => g.groupKey === groupKey);
        if (group && quantity > 0) {
          const idsToRemove = group.items.slice(0, quantity).map(item => item.id);
          itemIds.push(...idsToRemove);
        }
      });

      if (itemIds.length === 0) throw new Error(t('bpk_no_product_selected'));

      // Update product_items - remove from box
      const { error: itemsError } = await supabase
        .from('product_items')
        .update({ 
          box_id: null, 
          status: 'pending',
        })
        .in('id', itemIds);
      
      if (itemsError) throw itemsError;

      // Create tracking events
      const trackingEvents = itemIds.map(itemId => ({
        entity_type: 'product_item',
        entity_id: itemId,
        event_type: 'unpacked',
        description: `Removed from box: ${box.box_number}`,
        location: 'china',
      }));

      const { error: trackingError } = await supabase
        .from('tracking_events')
        .insert(trackingEvents);
      
      if (trackingError) throw trackingError;

      return itemIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['available-items'] });
      queryClient.invalidateQueries({ queryKey: ['box-items'] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      queryClient.invalidateQueries({ queryKey: ['product-items'] });
      queryClient.invalidateQueries({ queryKey: ['china-box-items'] }); // Refresh verification items
      queryClient.invalidateQueries({ queryKey: ['china-box-session-items'] });
      toast({
        title: t('bpk_removed_success'),
        description: t('bpk_removed_desc', { count }),
      });
      setRemoveQuantities({});
    },
    onError: (error: any) => {
      toast({
        title: 'Xato',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleQuantityChange = (groupKey: string, value: number, max: number) => {
    const safeValue = Math.max(0, Math.min(value, max));
    setSelectedQuantities(prev => ({
      ...prev,
      [groupKey]: safeValue,
    }));
  };

  const handleRemoveQuantityChange = (groupKey: string, value: number, max: number) => {
    const safeValue = Math.max(0, Math.min(value, max));
    setRemoveQuantities(prev => ({
      ...prev,
      [groupKey]: safeValue,
    }));
  };

  const handleVariantChange = (productId: string, variantId: string) => {
    setSelectedVariants(prev => ({
      ...prev,
      [productId]: variantId,
    }));
  };

  if (!box) return null;

  const isPackingDisabled = box.status !== 'packing';

  // Render product item card
  const renderProductCard = (group: GroupedItem, index: number, isRemoveMode: boolean) => {
    const productVariants = getVariantsForProduct(group.productId);
    const hasUnassignedItems = !group.variantId && productVariants.length > 0;
    const quantity = isRemoveMode 
      ? removeQuantities[group.groupKey] || 0 
      : selectedQuantities[group.groupKey] || 0;
    const handleChange = isRemoveMode ? handleRemoveQuantityChange : handleQuantityChange;
    
    return (
      <div
        key={group.groupKey}
        className={`p-4 rounded-lg border bg-muted border-border transition-all duration-200 animate-fade-in ${
          isRemoveMode ? 'hover:border-destructive/30' : 'hover:border-primary/30'
        }`}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="flex flex-col gap-3">
          {/* Product info - now with proper text wrapping */}
          <div className="min-w-0">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div className="flex items-start gap-2 flex-wrap flex-1">
                <p className="font-medium text-foreground break-words">
                  {group.productName}
                </p>
                {group.variantName && (
                  <Badge variant="secondary" className="text-xs gap-1 flex-shrink-0">
                    <Layers className="h-3 w-3" />
                    {group.variantName}
                  </Badge>
                )}
                {group.category && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {group.category}
                  </Badge>
                )}
              </div>
              
              {/* Trash button for cleaning up phantom items */}
              {!isRemoveMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                  onClick={() => {
                    if (window.confirm("Haqiqatan ham ushbu qadoqlanmagan kutilayotgan tovarlarni o'chirmoqchimisiz? (Faqat xato qo'shilganlar uchun)")) {
                      deleteGhostItemsMutation.mutate(group.groupKey);
                    }
                  }}
                  disabled={deleteGhostItemsMutation.isPending}
                  title="Ortiqcha mahsulotlarni o'chirish"
                >
                  {deleteGhostItemsMutation.isPending && deleteGhostItemsMutation.variables === group.groupKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mt-1">
              {isRemoveMode ? t('bpk_in_box', { count: group.count }) : t('bpk_available', { count: group.count })}
              {!isRemoveMode && !group.variantId && productVariants.length > 0 && (
                <span className="text-yellow-500 ml-2">({t('bpk_no_variant')})</span>
              )}
            </p>
          </div>
          
          {/* Variant selector for unassigned items */}
          {!isRemoveMode && hasUnassignedItems && (
            <Select
              value={selectedVariants[group.productId] || 'no_variant'}
              onValueChange={(value) => handleVariantChange(group.productId, value)}
            >
              <SelectTrigger className="w-full bg-input border-border min-h-[44px]">
                <SelectValue placeholder={t('bpk_select_variant')} />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover text-popover-foreground border-border shadow-md">
                <SelectItem value="no_variant">{t('bpk_without_variant')}</SelectItem>
                {productVariants.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {formatVariantAttributes(v.variant_attributes as Record<string, any>)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {/* Quantity controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div 
              className="flex gap-1.5 justify-center sm:justify-start"
              role="group"
              aria-label="Tez tanlash tugmalari"
            >
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px] px-3 text-sm flex-1 sm:flex-none transition-all duration-200 hover:scale-[1.02]"
                onClick={() => handleChange(group.groupKey, 0, group.count)}
                aria-label="Tanlashni bekor qilish"
              >
                0
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px] px-3 text-sm flex-1 sm:flex-none transition-all duration-200 hover:scale-[1.02]"
                onClick={() => handleChange(group.groupKey, Math.floor(group.count / 2), group.count)}
                aria-label="Yarmini tanlash"
              >
                ½
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px] px-3 text-sm flex-1 sm:flex-none transition-all duration-200 hover:scale-[1.02]"
                onClick={() => handleChange(group.groupKey, group.count, group.count)}
                aria-label="Hammasini tanlash"
              >
                {t('bpk_select_all')}
              </Button>
            </div>
            <Input
              type="number"
              min={0}
              max={group.count}
              value={quantity}
              onChange={(e) => handleChange(group.groupKey, parseInt(e.target.value) || 0, group.count)}
              className="w-full sm:w-24 min-h-[44px] text-center bg-input border-border transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              aria-label={`${group.productName} miqdori`}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent fullScreen={isMobile} className="sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('bpk_title', { box: box.box_number })}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'add' | 'remove')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="add" className="gap-2 min-h-[44px]">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('bpk_tab_add')}
              </TabsTrigger>
              <TabsTrigger value="remove" className="gap-2 min-h-[44px]">
                <Minus className="h-4 w-4" aria-hidden="true" />
                {t('bpk_tab_remove')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Status warning */}
          {isPackingDisabled && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-4 py-3 rounded-lg animate-fade-in">
              <p className="text-sm font-medium">
                {t('bpk_packing_only')}
              </p>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={t('bpk_search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border min-h-[48px] transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              aria-label="Mahsulot qidirish"
            />
          </div>

          {/* Selection badge */}
          {activeTab === 'add' && totalToAdd > 0 && (
            <div className="flex items-center gap-2 text-sm animate-scale-in">
              <Badge variant="default" className="bg-primary" role="status">
                {t('bpk_will_add', { count: totalToAdd })}
              </Badge>
            </div>
          )}
          {activeTab === 'remove' && totalToRemove > 0 && (
            <div className="flex items-center gap-2 text-sm animate-scale-in">
              <Badge variant="destructive" role="status">
                {t('bpk_will_remove', { count: totalToRemove })}
              </Badge>
            </div>
          )}

          {/* Product list - Add tab */}
          {activeTab === 'add' && (
            <>
              {loadingAvailable ? (
                <LoadingSkeleton count={3} compact />
              ) : filteredAvailable.length > 0 ? (
                <div className="space-y-3">
                  {filteredAvailable.map((group, index) => renderProductCard(group, index, false))}
                </div>
              ) : (
                <div className="text-center py-12 animate-fade-in">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" aria-hidden="true" />
                  <p className="text-muted-foreground font-medium mb-2">
                    {t('bpk_no_products')}
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1 max-w-sm mx-auto">
                    <p>{t('bpk_no_products_reasons')}</p>
                    <ul className="text-left list-disc list-inside space-y-1 mt-2">
                      <li>{t('bpk_reason_packed')}</li>
                      <li>{t('bpk_reason_shipped')}</li>
                      <li>{t('bpk_reason_sync')}</li>
                    </ul>
                    <p className="mt-3 text-xs">
                      {t('bpk_sync_hint')}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Product list - Remove tab */}
          {activeTab === 'remove' && (
            <>
              {loadingBoxItems ? (
                <LoadingSkeleton count={3} compact />
              ) : filteredBoxItems.length > 0 ? (
                <div className="space-y-3">
                  {filteredBoxItems.map((group, index) => renderProductCard(group, index, true))}
                </div>
              ) : (
                <div className="text-center py-12 animate-fade-in">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" aria-hidden="true" />
                  <p className="text-muted-foreground">
                    {t('bpk_empty_box')}
                  </p>
                </div>
              )}
            </>
          )}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 min-h-[48px] transition-all duration-200 hover:scale-[1.01]"
          >
            {t('close')}
          </Button>
          {activeTab === 'add' ? (
            <Button
              onClick={() => packItemsMutation.mutate()}
              disabled={totalToAdd === 0 || packItemsMutation.isPending || isPackingDisabled}
              className="flex-1 bg-primary hover:bg-primary/90 min-h-[48px] transition-all duration-200 hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/20"
              aria-label={`${totalToAdd} ta mahsulot qo'shish`}
            >
              {packItemsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  {t('bpk_packing')}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t('bpk_add_n', { count: totalToAdd })}
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => removeItemsMutation.mutate()}
              disabled={totalToRemove === 0 || removeItemsMutation.isPending || isPackingDisabled}
              variant="destructive"
              className="flex-1 min-h-[48px] transition-all duration-200 hover:scale-[1.01]"
              aria-label={`${totalToRemove} ta mahsulot olib tashlash`}
            >
              {removeItemsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  {t('bpk_removing')}
                </>
              ) : (
                <>
                  <Minus className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t('bpk_remove_n', { count: totalToRemove })}
                </>
              )}
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
