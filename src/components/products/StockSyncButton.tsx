import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, Check, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StockSyncButtonProps {
  productId: string;
  productUuid: string;
  hasVariants: boolean;
  className?: string;
}

export function StockSyncButton({ 
  productId, 
  productUuid, 
  hasVariants,
  className 
}: StockSyncButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncResult, setSyncResult] = useState<'success' | 'error' | null>(null);

  const syncMutation = useMutation({
    mutationFn: async () => {
      let createdCount = 0;

      if (hasVariants) {
        // Fetch all active variants for this product
        const { data: variants, error: variantsError } = await supabase
          .from('product_variants')
          .select('id, sku, stock_quantity, price')
          .eq('product_id', productId)
          .eq('is_active', true);

        if (variantsError) throw variantsError;

        for (const variant of variants || []) {
          if (!variant.stock_quantity || variant.stock_quantity <= 0) continue;

          // Count existing free items for this variant
          const { count: existingCount, error: countError } = await supabase
            .from('product_items')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', productId)
            .eq('variant_id', variant.id)
            .is('box_id', null);

          if (countError) throw countError;

          const needed = variant.stock_quantity - (existingCount || 0);

          if (needed > 0) {
            const itemsToCreate = Array.from({ length: needed }, (_, i) => ({
              item_uuid: `${productUuid}-${variant.sku}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${i}`,
              product_id: productId,
              variant_id: variant.id,
              status: 'pending',
              location: 'china',
              unit_cost: variant.price,
              unit_cost_currency: 'CNY',
            }));

            const { error: insertError } = await supabase
              .from('product_items')
              .insert(itemsToCreate);

            if (insertError) throw insertError;
            createdCount += needed;
          }
        }
      } else {
        // Non-variant product
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('quantity, price, purchase_currency')
          .eq('id', productId)
          .single();

        if (productError) throw productError;

        if (product?.quantity && product.quantity > 0) {
          const { count: existingCount, error: countError } = await supabase
            .from('product_items')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', productId)
            .is('variant_id', null)
            .is('box_id', null);

          if (countError) throw countError;

          const needed = product.quantity - (existingCount || 0);

          if (needed > 0) {
            const itemsToCreate = Array.from({ length: needed }, (_, i) => ({
              item_uuid: `${productUuid}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${i}`,
              product_id: productId,
              status: 'pending',
              location: 'china',
              unit_cost: product.price,
              unit_cost_currency: product.purchase_currency || 'USD',
            }));

            const { error: insertError } = await supabase
              .from('product_items')
              .insert(itemsToCreate);

            if (insertError) throw insertError;
            createdCount += needed;
          }
        }
      }

      return { createdCount };
    },
    onSuccess: ({ createdCount }) => {
      setSyncResult('success');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['available-items'] });
      
      if (createdCount > 0) {
        toast({
          title: "Zaxira sinxronlandi",
          description: `${createdCount} ta yangi element yaratildi`,
        });
      } else {
        toast({
          title: "Zaxira tekshirildi",
          description: "Barcha elementlar mavjud, qo'shimcha yaratish kerak emas",
        });
      }

      // Reset status after 3 seconds
      setTimeout(() => setSyncResult(null), 3000);
    },
    onError: (error: any) => {
      setSyncResult('error');
      console.error('Stock sync error:', error);
      toast({
        title: "Xatolik",
        description: error.message || "Zaxirani sinxronlashda xatolik yuz berdi",
        variant: "destructive",
      });
      setTimeout(() => setSyncResult(null), 3000);
    },
  });

  const getIcon = () => {
    if (syncMutation.isPending) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (syncResult === 'success') {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (syncResult === 'error') {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    return <RefreshCw className="h-4 w-4" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className={className}
          >
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Zaxirani sinxronlash</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
