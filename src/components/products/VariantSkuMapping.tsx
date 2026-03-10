import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Store, Save, Loader2, Plus, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';

interface SkuMapping {
  store_id: string;
  external_sku: string;
}

interface VariantSkuMappingProps {
  variantId?: string;
  /** Local state for unsaved variants (keyed by store_id -> SKU array) */
  localMappings?: Record<string, string[]>;
  onLocalMappingsChange?: (mappings: Record<string, string[]>) => void;
  /** When true, component saves directly to DB */
  autoSave?: boolean;
}

export function VariantSkuMapping({
  variantId,
  localMappings: externalMappings,
  onLocalMappingsChange,
  autoSave = false,
}: VariantSkuMappingProps) {
  const [open, setOpen] = useState(false);
  const [internalMappings, setInternalMappings] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const queryClient = useQueryClient();

  const isStandalone = autoSave && !!variantId;
  const mappings = isStandalone ? internalMappings : (externalMappings || {});

  // Fetch all active marketplace stores
  const { data: stores = [] } = useQuery({
    queryKey: ['marketplace-stores-for-sku'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, name, platform')
        .eq('is_active', true)
        .order('platform')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch existing mappings if variant has an ID
  const { data: savedMappings = [] } = useQuery({
    queryKey: ['variant-sku-mappings', variantId],
    queryFn: async () => {
      if (!variantId) return [];
      const { data, error } = await supabase
        .from('variant_sku_mappings')
        .select('store_id, external_sku')
        .eq('variant_id', variantId);
      if (error) throw error;
      return (data || []) as SkuMapping[];
    },
    enabled: !!variantId && open,
    staleTime: 30 * 1000,
  });

  // Load saved mappings — group by store_id into arrays
  useEffect(() => {
    if (savedMappings.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const m of savedMappings) {
        if (!grouped[m.store_id]) grouped[m.store_id] = [];
        grouped[m.store_id].push(m.external_sku);
      }

      if (isStandalone) {
        setInternalMappings(grouped);
        setDirty(false);
      } else if (onLocalMappingsChange) {
        const merged = { ...(externalMappings || {}) };
        let changed = false;
        for (const [storeId, skus] of Object.entries(grouped)) {
          if (!merged[storeId] || merged[storeId].length === 0) {
            merged[storeId] = skus;
            changed = true;
          }
        }
        if (changed) onLocalMappingsChange(merged);
      }
    }
  }, [savedMappings, isStandalone]);

  // Count all filled SKUs across all stores
  const filledCount = Object.values(mappings).reduce(
    (sum, skus) => sum + (skus || []).filter(s => s.trim()).length, 0
  );

  // Auto-collapse when all stores have at least one SKU filled
  useEffect(() => {
    const storesWithSku = Object.values(mappings).filter(skus => skus?.some(s => s.trim())).length;
    if (userInteracted && open && stores.length > 0 && storesWithSku === stores.length) {
      const timer = setTimeout(() => setOpen(false), 400);
      return () => clearTimeout(timer);
    }
  }, [filledCount, stores.length, open, userInteracted, mappings]);

  const updateMappings = useCallback((storeId: string, newSkus: string[]) => {
    setUserInteracted(true);
    if (isStandalone) {
      setInternalMappings(prev => ({ ...prev, [storeId]: newSkus }));
      setDirty(true);
    } else {
      onLocalMappingsChange?.({ ...mappings, [storeId]: newSkus });
    }
  }, [isStandalone, mappings, onLocalMappingsChange]);

  const handleSkuChange = useCallback((storeId: string, index: number, value: string) => {
    const current = [...(mappings[storeId] || [''])];
    current[index] = value;
    updateMappings(storeId, current);
  }, [mappings, updateMappings]);

  const addSku = useCallback((storeId: string) => {
    const current = [...(mappings[storeId] || [])];
    current.push('');
    updateMappings(storeId, current);
  }, [mappings, updateMappings]);

  const removeSku = useCallback((storeId: string, index: number) => {
    const current = [...(mappings[storeId] || [])];
    current.splice(index, 1);
    updateMappings(storeId, current);
  }, [mappings, updateMappings]);

  const handleSave = async () => {
    if (!variantId || !isStandalone) return;
    setSaving(true);
    try {
      // Delete all existing mappings for this variant
      await supabase
        .from('variant_sku_mappings')
        .delete()
        .eq('variant_id', variantId);

      // Insert all non-empty SKUs
      const toInsert: { variant_id: string; store_id: string; external_sku: string }[] = [];
      for (const store of stores) {
        const skus = internalMappings[store.id] || [];
        for (const sku of skus) {
          if (sku.trim()) {
            toInsert.push({ variant_id: variantId, store_id: store.id, external_sku: sku.trim() });
          }
        }
      }

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('variant_sku_mappings')
          .insert(toInsert);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['variant-sku-mappings', variantId] });
      setDirty(false);
      toast({ title: "SKU mappinglar saqlandi ✅" });
    } catch (err: any) {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getPlatformColor = (platform: string) => {
    if (platform === 'uzum') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    if (platform === 'yandex') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    return 'bg-muted text-muted-foreground';
  };

  if (stores.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          onClick={(e) => e.stopPropagation()}
        >
          <Store className="h-3.5 w-3.5" />
          Do'kon SKU
          {filledCount > 0 && (
            <Badge variant="secondary" className="h-4 text-[9px] px-1">
              {filledCount}
            </Badge>
          )}
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-1.5 pl-2 border-l-2 border-muted">
          {stores.map(store => {
            const storeSkus = mappings[store.id] || [''];
            // Ensure at least one empty input
            const displaySkus = storeSkus.length === 0 ? [''] : storeSkus;

            return (
              <div key={store.id} className="space-y-0.5">
                {displaySkus.map((sku, skuIdx) => (
                  <div key={`${store.id}-${skuIdx}`} className="flex items-center gap-1">
                    {skuIdx === 0 ? (
                      <Badge 
                        variant="outline" 
                        className={`text-[9px] px-1 py-0 h-4 w-[90px] justify-center shrink-0 ${getPlatformColor(store.platform)}`}
                      >
                        {store.name.length > 12 ? store.name.slice(0, 12) + '…' : store.name}
                      </Badge>
                    ) : (
                      <div className="w-[90px] shrink-0" />
                    )}
                    <Input
                      value={sku}
                      onChange={(e) => handleSkuChange(store.id, skuIdx, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="SKU kod"
                      className="h-5 text-[10px] font-mono w-[100px]"
                    />
                    {displaySkus.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeSku(store.id, skuIdx); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                    {/* Show "+" button on the last filled SKU row */}
                    {skuIdx === displaySkus.length - 1 && sku.trim() && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 text-primary hover:text-primary/80"
                        onClick={(e) => { e.stopPropagation(); addSku(store.id); }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          {isStandalone && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="h-6 text-[10px] gap-1 mt-1"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Saqlash
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
