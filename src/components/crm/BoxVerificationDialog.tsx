import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getColorStyle } from '@/lib/productGrouping';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ItemStatus {
  id: string;
  status: 'ok' | 'defective' | 'missing';
  notes: string;
}

interface BoxVerificationDialogProps {
  box: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BoxVerificationDialog({ box, open, onOpenChange }: BoxVerificationDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>({});

  // Fresh data pattern - fetch new data when dialog opens
  const { data: freshBox, isLoading: loadingBox } = useQuery({
    queryKey: ['box-detail', box?.id],
    queryFn: async () => {
      if (!box?.id) return null;
      const { data, error } = await supabase
        .from('boxes')
        .select(`
          *, 
          product_items(
            id, item_uuid, status, notes, variant_id,
            products(name, uuid, category),
            product_variants(variant_attributes, sku),
            verification_items(status, defect_type, notes)
          )
        `)
        .eq('id', box.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!box?.id && open,
    staleTime: 0,
  });

  // Use fresh data if available, fallback to prop
  const boxData = freshBox || box;

  // Initialize item statuses when box data changes - Xitoy tekshiruvi natijalarini hisobga olish
  useEffect(() => {
    if (boxData?.product_items) {
      const initialStatuses: Record<string, ItemStatus> = {};
      boxData.product_items.forEach((item: any) => {
        // Avval verification_items dan Xitoy tekshiruvi natijasini olish
        const chinaVerification = item.verification_items?.[0];
        
        let initialStatus: 'ok' | 'defective' | 'missing' = 'ok';
        if (chinaVerification) {
          // Xitoy tekshiruvida aniqlangan holatni o'rnatish
          if (chinaVerification.status === 'defective') initialStatus = 'defective';
          else if (chinaVerification.status === 'missing') initialStatus = 'missing';
          else if (chinaVerification.status === 'ok') initialStatus = 'ok';
        } else {
          // Agar Xitoy tekshiruvi bo'lmasa, product_items statusini tekshirish
          if (item.status === 'defective' || item.status === 'defective') initialStatus = 'defective';
          else if (item.status === 'missing') initialStatus = 'missing';
          else initialStatus = 'ok';
        }
        
        initialStatuses[item.id] = {
          id: item.id,
          status: initialStatus,
          notes: chinaVerification?.notes || item.notes || '',
        };
      });
      setItemStatuses(initialStatuses);
    }
  }, [boxData]);

  // Update item status
  const updateItemStatus = (itemId: string, status: 'ok' | 'defective' | 'missing') => {
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status },
    }));
  };

  // Update item notes
  const updateItemNotes = (itemId: string, notes: string) => {
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes },
    }));
  };

  // Verify box mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!boxData || !user) throw new Error('Box or user not found');

      // Update each product item - OK mahsulotlar uchun arrived_pending status
      const updates = Object.entries(itemStatuses).map(async ([itemId, status]) => {
        // TUZATISH: 'arrived' emas, 'arrived_pending' bo'lishi kerak
        const dbStatus = status.status === 'ok' ? 'arrived_pending' : status.status;
        const { error: itemError } = await supabase
          .from('product_items')
          .update({
            status: dbStatus,
            notes: status.notes || null,
            location: 'uzbekistan',
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId);
          
        if (itemError) throw itemError;
      });

      await Promise.all(updates);

      // Update box verification status AND box status to 'arrived'
      const { error: boxError } = await supabase
        .from('boxes')
        .update({
          // TEMPORARY FIX: Bypassing schema cache error. Relying on status update directly.
          location: 'uzbekistan',
          status: 'arrived', // Quti statusini ham yangilash
        })
        .eq('id', boxData.id);
        
      if (boxError) throw boxError;

      // Create tracking event
      const okCount = Object.values(itemStatuses).filter(s => s.status === 'ok').length;
      const damagedCount = Object.values(itemStatuses).filter(s => s.status === 'defective').length;
      const missingCount = Object.values(itemStatuses).filter(s => s.status === 'missing').length;

      await supabase
        .from('tracking_events')
        .insert({
          entity_type: 'box',
          entity_id: boxData.id,
          event_type: 'verified_uz',
          description: `O'zbekistonda tasdiqlandi: ${okCount} OK, ${damagedCount} brak, ${missingCount} yetishmayapti`,
          location: 'uzbekistan',
          created_by: user.id,
          metadata: { okCount, damagedCount, missingCount },
        });

      return { okCount, damagedCount, missingCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      queryClient.invalidateQueries({ queryKey: ['tracking'] });
      queryClient.invalidateQueries({ queryKey: ['box-detail'] });
      
      toast({
        title: 'Tasdiqlash yakunlandi!',
        description: `${result.okCount} OK, ${result.damagedCount} brak, ${result.missingCount} yetishmayapti`,
      });
      
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

  if (!box) return null;

  const isVerified = boxData?.verified_uz || boxData?.status === 'arrived' || boxData?.status === 'delivered' || boxData?.location === 'uzbekistan';
  const okCount = Object.values(itemStatuses).filter(s => s.status === 'ok').length;
  const damagedCount = Object.values(itemStatuses).filter(s => s.status === 'defective').length;
  const missingCount = Object.values(itemStatuses).filter(s => s.status === 'missing').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center transition-transform duration-200 hover:scale-105">
              <Package className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <span>Qutini Tasdiqlash</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                {boxData?.box_number}
              </p>
            </div>
            {isVerified && (
              <Badge className="bg-green-500 ml-auto animate-scale-in" role="status" aria-label="Tasdiqlangan">
                <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                Tasdiqlangan
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loadingBox ? (
          <LoadingSkeleton count={3} compact />
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
            {/* Box Info */}
            <div className="p-3 bg-muted rounded-lg text-sm animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Joylashuv:</span>
                  <span className="ml-1 text-foreground">{boxData?.location}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Holat:</span>
                  <span className="ml-1 text-foreground">{boxData?.status}</span>
                </div>
                {(boxData as any)?.weight_kg && (
                  <div>
                    <span className="text-muted-foreground">Vazn:</span>
                    <span className="ml-1 text-foreground">{(boxData as any).weight_kg} kg</span>
                  </div>
                )}
                {boxData?.sealed_at && (
                  <div>
                    <span className="text-muted-foreground">Yopilgan:</span>
                    <span className="ml-1 text-foreground">
                      {new Date(boxData.sealed_at).toLocaleDateString('uz-UZ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status summary */}
            <div 
              className="flex flex-wrap gap-2 text-xs" 
              role="group" 
              aria-label="Mahsulotlar holati"
            >
              <Badge 
                variant="outline" 
                className="border-green-500 text-green-500 transition-all duration-200"
                role="status"
                aria-label={`${okCount} ta mahsulot yaxshi holatda`}
              >
                OK: {okCount}
              </Badge>
              <Badge 
                variant="outline" 
                className="border-red-500 text-red-500 transition-all duration-200"
                role="status"
                aria-label={`${damagedCount} ta mahsulot buzilgan`}
              >
                Brak: {damagedCount}
              </Badge>
              <Badge 
                variant="outline" 
                className="border-yellow-500 text-yellow-500 transition-all duration-200"
                role="status"
                aria-label={`${missingCount} ta mahsulot yetishmayapti`}
              >
                Yo'q: {missingCount}
              </Badge>
            </div>

            {/* Products List */}
            {boxData?.product_items && boxData.product_items.length > 0 ? (
              <ScrollArea className="h-[45vh] sm:h-[40vh]">
                <div className="space-y-3 pr-3">
                  {boxData.product_items.map((item: any, index: number) => {
                    const currentStatus = itemStatuses[item.id]?.status || 'ok';
                    // Xitoy tekshiruvidan nuqsonli yoki yetishmayotgan sifatida kelganini aniqlash
                    const chinaVerification = item.verification_items?.[0];
                    const isMarkedFromChina = chinaVerification && 
                      (chinaVerification.status === 'defective' || chinaVerification.status === 'missing');
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`p-3 sm:p-4 rounded-lg border transition-all duration-200 animate-fade-in ${
                          currentStatus === 'ok' ? 'bg-green-500/5 border-green-500/20' :
                          currentStatus === 'defective' ? 'bg-red-500/5 border-red-500/20' :
                          'bg-yellow-500/5 border-yellow-500/20'
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                        role="group"
                        aria-label={`${item.products?.name || 'Mahsulot'} holati`}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground text-sm truncate">
                                {item.products?.name || 'Noma\'lum mahsulot'}
                              </p>
                              {(item as any).product_variants?.variant_attributes?.rang && (() => {
                                const colorStyle = getColorStyle((item as any).product_variants.variant_attributes.rang);
                                return (
                                  <Badge variant="outline" className="text-xs gap-1 items-center px-1.5 py-0">
                                    <span 
                                      className="inline-block w-2.5 h-2.5 rounded-full border-2 border-gray-400 shrink-0 shadow-sm" 
                                      style={{ backgroundColor: colorStyle.color }} 
                                    />
                                    {(item as any).product_variants.variant_attributes.rang}
                                  </Badge>
                                );
                              })()}
                              {isMarkedFromChina && (
                                <Badge 
                                  className="bg-orange-500 text-white text-xs px-1.5 py-0.5" 
                                  title={`Xitoy tekshiruvida aniqlangan: ${chinaVerification.status === 'defective' ? 'Nuqsonli' : 'Yetishmaydi'}`}
                                >
                                  Xitoyda aniqlangan
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.item_uuid}
                            </p>
                            {chinaVerification?.notes && (
                              <p className="text-xs text-orange-500 mt-1">
                                📝 Xitoy izohi: {chinaVerification.notes}
                              </p>
                            )}
                          </div>
                          
                          <div 
                            className="flex flex-wrap gap-2 justify-start"
                            role="radiogroup"
                            aria-label="Mahsulot holatini tanlang"
                          >
                            <Button
                              variant={currentStatus === 'ok' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateItemStatus(item.id, 'ok')}
                              disabled={isVerified}
                              className={`min-h-[44px] min-w-[70px] text-sm transition-all duration-200 hover:scale-[1.02] ${
                                currentStatus === 'ok' ? 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20' : ''
                              }`}
                              aria-pressed={currentStatus === 'ok'}
                              aria-label="Yaxshi holat"
                            >
                              <Check className="h-4 w-4 mr-1" aria-hidden="true" />
                              OK
                            </Button>
                            <Button
                              variant={currentStatus === 'defective' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateItemStatus(item.id, 'defective')}
                              disabled={isVerified}
                              className={`min-h-[44px] min-w-[70px] text-sm transition-all duration-200 hover:scale-[1.02] ${
                                currentStatus === 'defective' ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20' : ''
                              }`}
                              aria-pressed={currentStatus === 'defective'}
                              aria-label="Buzilgan"
                            >
                              <X className="h-4 w-4 mr-1" aria-hidden="true" />
                              Brak
                            </Button>
                            <Button
                              variant={currentStatus === 'missing' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateItemStatus(item.id, 'missing')}
                              disabled={isVerified}
                              className={`min-h-[44px] min-w-[70px] text-sm transition-all duration-200 hover:scale-[1.02] ${
                                currentStatus === 'missing' ? 'bg-yellow-500 hover:bg-yellow-600 shadow-lg shadow-yellow-500/20' : ''
                              }`}
                              aria-pressed={currentStatus === 'missing'}
                              aria-label="Yetishmayapti"
                            >
                              <AlertTriangle className="h-4 w-4 mr-1" aria-hidden="true" />
                              Yo'q
                            </Button>
                          </div>
                        </div>
                        
                        {/* Notes field for damaged/missing items */}
                        {(currentStatus === 'defective' || currentStatus === 'missing') && !isVerified && (
                          <div className="mt-3 animate-fade-in">
                            <Textarea
                              placeholder="Izoh qo'shing..."
                              value={itemStatuses[item.id]?.notes || ''}
                              onChange={(e) => updateItemNotes(item.id, e.target.value)}
                              className="bg-input border-border min-h-[60px] text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                              aria-label="Izoh"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 animate-fade-in">
                <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" aria-hidden="true" />
                <p className="text-muted-foreground text-sm">Bu qutida mahsulotlar yo'q</p>
              </div>
            )}
          </div>
        )}

        {/* Footer - Fixed at bottom */}
        <div className="flex-shrink-0 pt-4 border-t border-border mt-4">
          {/* Verify Button */}
          {boxData?.product_items && boxData.product_items.length > 0 && !isVerified && (
            <Button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending || loadingBox}
              className="w-full bg-gradient-to-r from-primary to-green-500 hover:from-primary/90 hover:to-green-600 min-h-[52px] font-medium transition-all duration-200 hover:scale-[1.01] hover:shadow-lg"
              aria-label="Qutini tasdiqlash"
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Tasdiqlanmoqda...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                  Qutini Tasdiqlash
                </>
              )}
            </Button>
          )}

          {isVerified && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg animate-scale-in">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
                <div>
                  <p className="font-medium text-green-500 text-sm">Bu quti allaqachon tasdiqlangan</p>
                  {(boxData as any)?.verified_uz_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date((boxData as any).verified_uz_at).toLocaleString('uz-UZ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
