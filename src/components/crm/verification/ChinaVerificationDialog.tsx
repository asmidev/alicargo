import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { 
  Package, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  AlertTriangle,
  Flag,
  ChevronLeft,
  ChevronRight,
  Tag
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ItemVerificationCard, ItemVerificationStatus } from './ItemVerificationCard';
import { VerificationProgress } from './VerificationProgress';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface ChinaVerificationDialogProps {
  box: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChinaVerificationDialog({ 
  box, 
  open, 
  onOpenChange 
}: ChinaVerificationDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { triggerHaptic } = useNativeFeatures();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemVerificationStatus>>({});
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  
  const [showTrackCodeDialog, setShowTrackCodeDialog] = useState(false);
  const [trackCode, setTrackCode] = useState('');
  const [pendingVerificationResult, setPendingVerificationResult] = useState<{okCount: number, defectiveCount: number, missingCount: number} | null>(null);
  
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const getExistingTrackCode = useCallback(() => {
    if (!box) return '';
    if (box.box_track_codes && Array.isArray(box.box_track_codes) && box.box_track_codes.length > 0) {
      const primaryCode = box.box_track_codes.find((tc: any) => tc.is_primary);
      if (primaryCode?.track_code) return primaryCode.track_code;
      return box.box_track_codes[0]?.track_code || '';
    }
    if (box.store_number) return box.store_number;
    return '';
  }, [box]);

  useEffect(() => {
    if (showTrackCodeDialog && !trackCode) {
      const existingCode = getExistingTrackCode();
      if (existingCode) {
        setTrackCode(existingCode);
      }
    }
  }, [showTrackCodeDialog, getExistingTrackCode]);

  const boxData = box ? {
    id: box.id,
    box_number: box.box_number,
    verification_complete: box.verification_complete,
    china_verified_at: box.china_verified_at,
    china_verified_by: box.china_verified_by,
  } : null;

  const { data: productItems, isLoading: loadingItems } = useQuery({
    queryKey: ['china-box-items', box?.id],
    queryFn: async () => {
      if (!box?.id) return [];
      const { data, error } = await supabase
        .from('product_items')
        .select('id, item_uuid, product_id, variant_id, products(name, uuid), product_variants(variant_attributes, sku)')
        .eq('box_id', box.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!box?.id && open,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: sessionWithItems, isLoading: loadingSession } = useQuery({
    queryKey: ['china-box-session-items', box?.id],
    queryFn: async () => {
      if (!box?.id) return null;
      const { data: session, error: sessionError } = await supabase
        .from('verification_sessions')
        .select('id, status, total_items, verified_count, ok_count, defective_count, missing_count')
        .eq('box_id', box.id)
        .eq('status', 'in_progress')
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!session) return { session: null, items: [] };
      const { data: items, error: itemsError } = await supabase
        .from('verification_items')
        .select('product_item_id, status, defect_type, notes, photo_urls')
        .eq('session_id', session.id);
      if (itemsError) throw itemsError;
      return { session, items: items || [] };
    },
    enabled: !!box?.id && open,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const existingSession = sessionWithItems?.session;
  const isLoading = loadingItems || loadingSession;

  useEffect(() => {
    if (productItems && productItems.length > 0 && open) {
      if (existingSession && sessionWithItems?.items) {
        setSessionId(existingSession.id);
        const loadedStatuses: Record<string, ItemVerificationStatus> = {};
        sessionWithItems.items.forEach((item: any) => {
          loadedStatuses[item.product_item_id] = {
            status: item.status,
            defectType: item.defect_type,
            notes: item.notes || '',
            photoUrls: item.photo_urls || [],
          };
        });
        productItems.forEach((item: any) => {
          if (!loadedStatuses[item.id]) {
            loadedStatuses[item.id] = { status: 'pending', defectType: null, notes: '', photoUrls: [] };
          }
        });
        setItemStatuses(loadedStatuses);
      } else {
        const initialStatuses: Record<string, ItemVerificationStatus> = {};
        productItems.forEach((item: any) => {
          initialStatuses[item.id] = { status: 'pending', defectType: null, notes: '', photoUrls: [] };
        });
        setItemStatuses(initialStatuses);
        setSessionId(null);
      }
      setCurrentItemIndex(0);
    }
  }, [productItems, existingSession, sessionWithItems, open]);

  useEffect(() => {
    if (open && productItems && productItems.length > 0 && !sessionId && !existingSession && !box?.verification_complete && !loadingItems && !loadingSession) {
      startSession();
    }
  }, [open, productItems, sessionId, existingSession, box?.verification_complete, loadingItems, loadingSession]);

  const startSession = async () => {
    if (!box || !user || startSessionMutation.isPending) return;
    startSessionMutation.mutate();
  };

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      if (!boxData || !user) throw new Error('Box or user not found');
      const { data, error } = await supabase
        .from('verification_sessions')
        .insert({
          box_id: boxData.id, verified_by: user.id, status: 'in_progress',
          total_items: productItems?.length || 0, verified_count: 0, ok_count: 0, defective_count: 0, missing_count: 0,
        })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSessionId(data.id);
      toast({ title: t('vr_started'), description: t('vr_check_each') });
    },
    onError: (error: any) => {
      toast({ title: t('auth_error'), description: error.message, variant: 'destructive' });
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: ItemVerificationStatus }) => {
      if (!sessionId || !user) throw new Error('Session not started');
      const { error } = await supabase.from('verification_items').upsert({
        session_id: sessionId, product_item_id: itemId, status: status.status,
        defect_type: status.defectType, notes: status.notes || null, photo_urls: status.photoUrls,
        verified_at: status.status !== 'pending' ? new Date().toISOString() : null,
        verified_by: status.status !== 'pending' ? user.id : null,
      }, { onConflict: 'session_id,product_item_id' });
      if (error) throw error;

      if (status.status === 'missing') {
        await supabase.from('product_items').update({ 
          status: 'missing',
          notes: status.notes || 'Tekshiruvda yetishmaydi deb belgilandi'
        }).eq('id', itemId);
        queryClient.invalidateQueries({ queryKey: ['boxes'] });
      }

      const counts = Object.values(itemStatuses);
      await supabase.from('verification_sessions').update({
        verified_count: counts.filter(s => s.status !== 'pending').length,
        ok_count: counts.filter(s => s.status === 'ok').length,
        defective_count: counts.filter(s => s.status === 'defective').length,
        missing_count: counts.filter(s => s.status === 'missing').length,
      }).eq('id', sessionId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['boxes'] }); },
  });

   const completeMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId || !user || !boxData) throw new Error('Session or user not found');
      const pendingItems = Object.entries(itemStatuses).filter(([_, s]) => s.status === 'pending');
      if (pendingItems.length > 0) {
        const pendingRecords = pendingItems.map(([itemId]) => ({
          session_id: sessionId, product_item_id: itemId, status: 'ok',
          defect_type: null, notes: null, photo_urls: [],
          verified_at: new Date().toISOString(), verified_by: user.id,
        }));
        const { error: bulkError } = await supabase.from('verification_items').upsert(pendingRecords, { onConflict: 'session_id,product_item_id' });
        if (bulkError) throw bulkError;
      }
      const counts = Object.values(itemStatuses);
      const pendingCount = counts.filter(s => s.status === 'pending').length;
      const okCount = counts.filter(s => s.status === 'ok').length + pendingCount;
      const defectiveCount = counts.filter(s => s.status === 'defective').length;
      const missingCount = counts.filter(s => s.status === 'missing').length;

      // 🔑 Explicitly update product_items status for all missing/defective items
      // This ensures DB is accurate even if per-click saveItemMutation was missed
      const missingItemIds = Object.entries(itemStatuses)
        .filter(([_, s]) => s.status === 'missing')
        .map(([id]) => id);
      const defectiveItemIds = Object.entries(itemStatuses)
        .filter(([_, s]) => s.status === 'defective')
        .map(([id]) => id);

      if (missingItemIds.length > 0) {
        await supabase.from('product_items')
          .update({ status: 'missing' })
          .in('id', missingItemIds);
      }
      if (defectiveItemIds.length > 0) {
        await supabase.from('product_items')
          .update({ status: 'defective' })
          .in('id', defectiveItemIds);
      }

      const { error: sessionError } = await supabase.from('verification_sessions').update({
        status: 'completed', completed_at: new Date().toISOString(),
        verified_count: counts.length, ok_count: okCount, defective_count: defectiveCount, missing_count: missingCount,
      }).eq('id', sessionId);
      if (sessionError) throw sessionError;
      return { okCount, defectiveCount, missingCount };
    },
    onSuccess: async (result) => {
      await triggerHaptic('heavy');
      const existingTrackCode = getExistingTrackCode();
      if (existingTrackCode) {
        setPendingVerificationResult(result);
        saveTrackCodeMutation.mutate(existingTrackCode);
      } else {
        setPendingVerificationResult(result);
        setShowTrackCodeDialog(true);
      }
    },
    onError: (error: any) => {
      toast({ title: t('auth_error'), description: error.message, variant: 'destructive' });
    },
  });

  const saveTrackCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!boxData || !user) throw new Error('Box or user not found');
      const { error: boxError } = await supabase.from('boxes').update({
        abusaxiy_receipt_number: code || null, status: 'sealed',
        sealed_at: new Date().toISOString(), sealed_by: user.id,
        verification_complete: true, china_verified_at: new Date().toISOString(), china_verified_by: user.id,
      }).eq('id', boxData.id);
      if (boxError) throw boxError;

      await supabase.from('tracking_events').insert({
        entity_type: 'box', entity_id: boxData.id, event_type: 'china_verified',
        description: `Xitoyda tekshirildi va yopildi${code ? `. Trek: ${code}` : ''}`,
        location: 'china', created_by: user.id,
        metadata: { 
          okCount: pendingVerificationResult?.okCount, 
          defectiveCount: pendingVerificationResult?.defectiveCount, 
          missingCount: pendingVerificationResult?.missingCount, trackCode: code || null,
        },
      });
      return code;
    },
    onSuccess: async (code) => {
      await queryClient.invalidateQueries({ queryKey: ['boxes'] });
      await queryClient.invalidateQueries({ queryKey: ['china-box-detail'] });
      await queryClient.invalidateQueries({ queryKey: ['china-dashboard-stats'] });

      const wasExistingTrackCode = !showTrackCodeDialog;
      toast({
        title: t('vr_completed_msg'),
        description: wasExistingTrackCode 
          ? `${pendingVerificationResult?.okCount || 0} OK, ${pendingVerificationResult?.defectiveCount || 0} ${t('vr_defective').toLowerCase()}. Trek: ${code}`
          : `${pendingVerificationResult?.okCount || 0} OK, ${pendingVerificationResult?.defectiveCount || 0} ${t('vr_defective').toLowerCase()}. ${code ? `Trek: ${code}` : ''}`,
      });

      setShowTrackCodeDialog(false);
      setTrackCode('');
      setPendingVerificationResult(null);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: t('auth_error'), description: error.message, variant: 'destructive' });
    },
  });

  const handleTrackCodeSubmit = () => { saveTrackCodeMutation.mutate(trackCode.trim()); };
  const handleSkipTrackCode = () => { saveTrackCodeMutation.mutate(''); };

  const handleItemStatusChange = async (itemId: string, newStatus: ItemVerificationStatus) => {
    await triggerHaptic('medium');
    setItemStatuses(prev => ({ ...prev, [itemId]: newStatus }));
    if (sessionId && newStatus.status !== 'pending') {
      saveItemMutation.mutate({ itemId, status: newStatus });
      if (isMobile && productItems && currentItemIndex < productItems.length - 1) {
        setTimeout(() => { setCurrentItemIndex(prev => prev + 1); }, 300);
      }
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; }, []);
  const handleTouchEnd = useCallback(async () => {
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance && productItems && currentItemIndex < productItems.length - 1) {
      await triggerHaptic('light'); setCurrentItemIndex(prev => prev + 1);
    } else if (distance < -minSwipeDistance && currentItemIndex > 0) {
      await triggerHaptic('light'); setCurrentItemIndex(prev => prev - 1);
    }
  }, [currentItemIndex, productItems, triggerHaptic]);

  const goToItem = async (index: number) => { await triggerHaptic('light'); setCurrentItemIndex(index); };

  const counts = Object.values(itemStatuses);
  const totalItems = counts.length;
  const verifiedCount = counts.filter(s => s.status !== 'pending').length;
  const okCount = counts.filter(s => s.status === 'ok').length;
  const defectiveCount = counts.filter(s => s.status === 'defective').length;
  const missingCount = counts.filter(s => s.status === 'missing').length;
  const pendingCount = counts.filter(s => s.status === 'pending').length;
  const canComplete = totalItems > 0;
  const isAlreadyVerified = boxData?.verification_complete;

  if (!box) return null;
  const currentItem = productItems?.[currentItemIndex];

  return (
    <>
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent fullScreen={isMobile} scrollable={true} className="sm:max-w-2xl lg:max-w-4xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Flag className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="flex items-center gap-2">
                🇨🇳 {t('vr_china_title')}
              </span>
              <p className="text-sm font-normal text-muted-foreground truncate">
                {boxData?.box_number}
              </p>
            </div>
            {isAlreadyVerified && (
              <Badge className="bg-green-500 shrink-0 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t('vr_confirmed')}
              </Badge>
            )}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          {isLoading ? (
            <LoadingSkeleton count={3} compact />
          ) : (
            <div className="flex-1 flex flex-col gap-4">
              <div className="shrink-0">
                <VerificationProgress total={totalItems} verified={verifiedCount} okCount={okCount} defectiveCount={defectiveCount} missingCount={missingCount} />
              </div>

              {!sessionId && !isAlreadyVerified && totalItems > 0 && startSessionMutation.isPending && (
                <div className="flex items-center justify-center gap-2 p-4 bg-primary/10 rounded-lg shrink-0">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-primary">{t('vr_starting')}</span>
                </div>
              )}

              {sessionId && isMobile && productItems && productItems.length > 0 && currentItem && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => goToItem(currentItemIndex - 1)} disabled={currentItemIndex === 0}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="text-center">
                      <span className="font-medium">{currentItemIndex + 1}</span>
                      <span className="text-muted-foreground"> / {productItems.length}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => goToItem(currentItemIndex + 1)} disabled={currentItemIndex === productItems.length - 1}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="flex-1 min-h-0" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                    <ItemVerificationCard key={currentItem.id} item={currentItem} sessionId={sessionId}
                      status={itemStatuses[currentItem.id] || { status: 'pending', defectType: null, notes: '', photoUrls: [] }}
                      onStatusChange={(status) => handleItemStatusChange(currentItem.id, status)}
                      disabled={isAlreadyVerified} index={currentItemIndex} isMobileFullView />
                  </div>

                  <div className="flex justify-center gap-1.5 py-3 shrink-0">
                    {productItems.slice(Math.max(0, currentItemIndex - 4), Math.min(productItems.length, currentItemIndex + 5)).map((item: any, relIndex) => {
                      const actualIndex = Math.max(0, currentItemIndex - 4) + relIndex;
                      const status = itemStatuses[item.id]?.status || 'pending';
                      return (
                        <button key={item.id} onClick={() => goToItem(actualIndex)}
                          className={cn("w-2 h-2 rounded-full transition-all",
                            actualIndex === currentItemIndex ? "w-4 bg-primary"
                              : status === 'ok' ? "bg-green-500"
                              : status === 'defective' ? "bg-amber-500"
                              : status === 'missing' ? "bg-red-500"
                              : "bg-muted-foreground/30"
                          )} />
                      );
                    })}
                  </div>
                </div>
              )}

              {sessionId && !isMobile && (
                <div className="space-y-3">
                  {productItems?.map((item: any, index: number) => (
                    <ItemVerificationCard key={item.id} item={item} sessionId={sessionId}
                      status={itemStatuses[item.id] || { status: 'pending', defectType: null, notes: '', photoUrls: [] }}
                      onStatusChange={(status) => handleItemStatusChange(item.id, status)}
                      disabled={isAlreadyVerified} index={index} />
                  ))}
                </div>
              )}

              {totalItems === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">{t('vr_no_products')}</p>
                  <p className="text-xs">{t('vr_add_first')}</p>
                </div>
              )}

              {isAlreadyVerified && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg shrink-0">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                    <div>
                      <p className="font-medium text-green-500">{t('vr_already_verified')}</p>
                      {boxData?.china_verified_at && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(boxData.china_verified_at).toLocaleString('uz-UZ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ResponsiveDialogBody>

        {sessionId && !isAlreadyVerified && (
          <ResponsiveDialogFooter>
            <div className="w-full">
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 text-blue-500 text-sm mb-3">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{t('vr_unmarked_auto_ok', { count: pendingCount })}</span>
                </div>
              )}
              <Button onClick={() => completeMutation.mutate()} disabled={!canComplete || completeMutation.isPending}
                className="w-full min-h-[52px] font-medium bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20">
                {completeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('vr_saving')}</>
                ) : (
                  <><ShieldCheck className="h-4 w-4 mr-2" />{t('vr_finish')}</>
                )}
              </Button>
            </div>
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>

    <Dialog open={showTrackCodeDialog} onOpenChange={(open) => {
      if (!open && !saveTrackCodeMutation.isPending) {
        setShowTrackCodeDialog(false);
        if (pendingVerificationResult) { handleSkipTrackCode(); }
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            {t('vr_track_title')}
          </DialogTitle>
          <DialogDescription>
            {t('vr_track_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {pendingVerificationResult && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-emerald-600">✓ {pendingVerificationResult.okCount} OK</span>
                {pendingVerificationResult.defectiveCount > 0 && (
                  <span className="text-amber-600">⚠ {pendingVerificationResult.defectiveCount} {t('vr_defective').toLowerCase()}</span>
                )}
                {pendingVerificationResult.missingCount > 0 && (
                  <span className="text-red-600">✗ {pendingVerificationResult.missingCount} {t('vr_missing').toLowerCase()}</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="trackCode">{t('vr_track_label')}</Label>
            <Input id="trackCode" placeholder={t('vr_track_placeholder')} value={trackCode}
              onChange={(e) => setTrackCode(e.target.value)} className="text-base" autoFocus />
            <p className="text-xs text-muted-foreground">{t('vr_track_hint')}</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleSkipTrackCode} disabled={saveTrackCodeMutation.isPending} className="w-full sm:w-auto">
            {t('vr_add_later')}
          </Button>
          <Button onClick={handleTrackCodeSubmit} disabled={saveTrackCodeMutation.isPending || !trackCode.trim()} className="w-full sm:w-auto">
            {saveTrackCodeMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('vr_saving')}</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-2" />{t('vr_save_close')}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
