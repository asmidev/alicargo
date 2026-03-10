import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Loader2, Ship, Package, Calculator, AlertCircle, Scale } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface ShipmentCostDistributionDialogProps {
  boxIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ItemWithWeight {
  id: string;
  item_uuid: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  weight_grams: number | null;
  saved_variant_weight: number | null;
  unit_cost_usd: number | null;
  domestic_shipping_cost: number | null;
}

export function ShipmentCostDistributionDialog({ 
  boxIds, 
  open, 
  onOpenChange 
}: ShipmentCostDistributionDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [totalShippingCost, setTotalShippingCost] = useState('');
  const [itemWeights, setItemWeights] = useState<Record<string, string>>({});

  // Fetch items in the selected boxes
  const { data: boxItems, isLoading } = useQuery({
    queryKey: ['shipment-items', boxIds],
    queryFn: async () => {
      if (boxIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('product_items')
        .select(`
          id,
          item_uuid,
          product_id,
          variant_id,
          weight_grams,
          unit_cost_usd,
          domestic_shipping_cost,
          products(name),
          product_variants(id, variant_attributes, weight)
        `)
        .in('box_id', boxIds);
      
      if (error) throw error;
      
      return (data || []).map(item => ({
        id: item.id,
        item_uuid: item.item_uuid,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: (item.products as any)?.name || t('bpk_unnamed'),
        variant_name: (item.product_variants as any)?.variant_attributes 
          ? Object.values((item.product_variants as any).variant_attributes).join(' / ')
          : null,
        weight_grams: item.weight_grams,
        saved_variant_weight: (item.product_variants as any)?.weight || null,
        unit_cost_usd: item.unit_cost_usd,
        domestic_shipping_cost: item.domestic_shipping_cost,
      })) as ItemWithWeight[];
    },
    enabled: open && boxIds.length > 0,
  });

  // Get effective weight for an item (from input, item, or variant)
  const getEffectiveWeight = (item: ItemWithWeight) => {
    const inputWeight = itemWeights[item.id];
    if (inputWeight) return parseFloat(inputWeight) || 0;
    if (item.weight_grams) return item.weight_grams;
    if (item.saved_variant_weight) return item.saved_variant_weight;
    return 0;
  };

  // Calculate totals
  const totalWeight = useMemo(() => {
    return boxItems?.reduce((sum, item) => sum + getEffectiveWeight(item), 0) || 0;
  }, [boxItems, itemWeights]);

  const itemsWithWeight = useMemo(() => {
    return boxItems?.filter(item => getEffectiveWeight(item) > 0) || [];
  }, [boxItems, itemWeights]);

  const itemsWithoutWeight = useMemo(() => {
    return boxItems?.filter(item => getEffectiveWeight(item) === 0) || [];
  }, [boxItems, itemWeights]);

  // Calculate distribution preview
  const distributionPreview = useMemo(() => {
    if (!totalShippingCost || !boxItems) return [];
    const shippingCost = parseFloat(totalShippingCost);
    
    if (totalWeight > 0) {
      // Distribute by weight
      return boxItems.map(item => {
        const weight = getEffectiveWeight(item);
        const share = (weight / totalWeight) * shippingCost;
        return { ...item, shippingShare: share, effectiveWeight: weight };
      });
    } else {
      // Equal distribution
      const equalShare = shippingCost / boxItems.length;
      return boxItems.map(item => ({ ...item, shippingShare: equalShare, effectiveWeight: 0 }));
    }
  }, [boxItems, itemWeights, totalShippingCost, totalWeight]);

  // Distribute costs mutation
  const distributeMutation = useMutation({
    mutationFn: async () => {
      if (!totalShippingCost) throw new Error(t('scd_no_cost'));
      
      const shippingCost = parseFloat(totalShippingCost);
      
      // First, update weights for items that have been edited
      for (const [itemId, weight] of Object.entries(itemWeights)) {
        if (weight) {
          const item = boxItems?.find(i => i.id === itemId);
          const { error: updateError } = await supabase
            .from('product_items')
            .update({ weight_grams: parseFloat(weight) })
            .eq('id', itemId);
          
          if (updateError) throw updateError;
          
          // Also save weight to variant for future use
          if (item?.variant_id) {
            await supabase
              .from('product_variants')
              .update({ weight: parseFloat(weight) })
              .eq('id', item.variant_id)
              .is('weight', null); // Only if not already set
          }
        }
      }
      
      // For items that have variant weight but no item weight, copy it
      for (const item of boxItems || []) {
        if (!item.weight_grams && !itemWeights[item.id] && item.saved_variant_weight) {
          await supabase
            .from('product_items')
            .update({ weight_grams: item.saved_variant_weight })
            .eq('id', item.id);
        }
      }
      
      // Call the database function to distribute international shipping by weight
      const { error } = await supabase.rpc('distribute_shipping_by_weight', {
        p_box_ids: boxIds,
        p_total_shipping_cost: shippingCost,
      });
      
      if (error) throw error;
      
      return shippingCost;
    },
    onSuccess: (cost) => {
      queryClient.invalidateQueries({ queryKey: ['product-items'] });
      queryClient.invalidateQueries({ queryKey: ['box-items'] });
      queryClient.invalidateQueries({ queryKey: ['shipment-items'] });
      toast({
        title: t('scd_success'),
        description: t('scd_success_desc', { cost: cost.toFixed(2) }),
      });
      onOpenChange(false);
      setTotalShippingCost('');
      setItemWeights({});
    },
    onError: (error: any) => {
      toast({
        title: 'Xato',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleWeightChange = (itemId: string, value: string) => {
    setItemWeights(prev => ({ ...prev, [itemId]: value }));
  };

  // Get display weight for input
  const getDisplayWeight = (item: ItemWithWeight) => {
    if (itemWeights[item.id] !== undefined) return itemWeights[item.id];
    if (item.weight_grams) return item.weight_grams.toString();
    if (item.saved_variant_weight) return item.saved_variant_weight.toString();
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95dvh] sm:max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-primary" />
            {t('scd_title')}
          </DialogTitle>
          <DialogDescription>
            {t('scd_desc', { count: boxIds.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Total shipping cost input */}
          <Card className="p-4 border-primary/20 bg-primary/5">
            <div className="grid gap-2">
              <Label htmlFor="totalShippingCost" className="font-medium">
                {t('scd_total_cost')}
              </Label>
              <div className="relative">
                <Input
                  id="totalShippingCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalShippingCost}
                  onChange={(e) => setTotalShippingCost(e.target.value)}
                  placeholder="0.00"
                  className="pr-12 text-lg h-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  USD
                </span>
              </div>
            </div>
          </Card>

          {/* Weight summary */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <Package className="h-3 w-3" />
              {t('scd_n_products', { count: boxItems?.length || 0 })}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Scale className="h-3 w-3" />
              {t('scd_total_weight', { weight: totalWeight.toLocaleString() })}
            </Badge>
            {itemsWithoutWeight.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {t('scd_no_weight', { count: itemsWithoutWeight.length })}
              </Badge>
            )}
          </div>

          {/* Items list with weight inputs */}
          <ScrollArea className="flex-1 border rounded-lg">
            {isLoading ? (
              <div className="p-4">
                <LoadingSkeleton count={3} compact />
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {boxItems?.map((item, index) => {
                  const preview = distributionPreview.find(p => p.id === item.id);
                  const currentWeight = getDisplayWeight(item);
                  const hasVariantWeight = item.saved_variant_weight && !item.weight_grams;
                  
                  return (
                    <div 
                      key={item.id} 
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/50 border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product_name}</p>
                        {item.variant_name && (
                          <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                        )}
                        {hasVariantWeight && (
                          <p className="text-xs text-primary">
                            ↳ {t('scd_from_variant', { weight: item.saved_variant_weight })}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            value={currentWeight}
                            onChange={(e) => handleWeightChange(item.id, e.target.value)}
                            placeholder="Gram"
                            className="h-9 text-sm"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-6">g</span>
                        
                        {preview && totalShippingCost && (
                          <Badge variant="secondary" className="min-w-[80px] justify-end">
                            ${preview.shippingShare.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Distribution preview */}
          {totalShippingCost && distributionPreview.length > 0 && (
            <Card className="p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">{t('scd_method')}</p>
              <p className="font-medium">
                {totalWeight > 0 
                  ? t('scd_by_weight', { weight: totalWeight.toLocaleString() })
                  : t('scd_equal')}
              </p>
            </Card>
          )}
        </div>

        <Separator />

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            {t('cancel')}
          </Button>
          <Button 
            onClick={() => distributeMutation.mutate()}
            disabled={!totalShippingCost || distributeMutation.isPending || !boxItems?.length}
            className="flex-1"
          >
            {distributeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('scd_distributing')}
              </>
            ) : (
              <>
                <Scale className="h-4 w-4 mr-2" />
                {t('scd_distribute')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
