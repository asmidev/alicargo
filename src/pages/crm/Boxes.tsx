import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { useTelegramAlert } from '@/hooks/useTelegramAlert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, QrCode, Printer, Package, PackagePlus, ScanLine, CheckCircle, ShieldCheck, Trash2, Filter, Calendar as CalendarIcon, MoreVertical, Eye, ChevronDown, Info, Calculator, Star } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import { BoxPackingDialog } from '@/components/crm/BoxPackingDialog';
import { BoxVerificationDialog } from '@/components/crm/BoxVerificationDialog';
import { QRScannerDialog } from '@/components/crm/QRScannerDialog';
import { ChinaVerificationDialog } from '@/components/crm/verification';
import { TrackCodesManager } from '@/components/crm/TrackCodesManager';
import { useUserRole } from '@/hooks/useUserRole';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { PullToRefresh, MobileHeader } from '@/components/mobile';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BoxCostBreakdownSheet } from '@/components/crm/BoxCostBreakdownSheet';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';

export default function Boxes() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { notifyBoxSealed, notifyBoxArrived } = useTelegramAlert();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [packingDialogOpen, setPackingDialogOpen] = useState(false);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [chinaVerificationDialogOpen, setChinaVerificationDialogOpen] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<any>(null);
  const { isUzManager, isUzStaff, isChiefManager, isChinaManager, isChinaStaff } = useUserRole();
  const { triggerHaptic } = useNativeFeatures();
  const canVerifyUz = isUzManager || isUzStaff || isChiefManager;
  const canVerifyChina = isChinaManager || isChinaStaff || isChiefManager;
  const canDelete = isChiefManager || isChinaManager;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [boxToDelete, setBoxToDelete] = useState<any>(null);
  const canCreate = isChinaManager || isChinaStaff || isChiefManager;
  const [quickActionsBox, setQuickActionsBox] = useState<any>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  // Custom exchange rates (per box) - overrides API rates when set
  const [customRates, setCustomRates] = useState<Record<string, { uzsRate: number; cnyToUzs: number }>>({});
  // Track which box's cost sheet is open
  const [costSheetBoxId, setCostSheetBoxId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    trackCodes: [] as string[],
    pendingTrackCode: '', // Current input value (not yet added to list)
    location: 'china',
    notes: '',
  });

  const handleRefresh = useCallback(async () => {
    await triggerHaptic('light');
    await queryClient.invalidateQueries({ queryKey: ['boxes'] });
  }, [queryClient, triggerHaptic]);

  // Quick actions sheet handlers
  const openQuickActions = async (box: any) => {
    await triggerHaptic('light');
    setQuickActionsBox(box);
    setQuickActionsOpen(true);
  };

  const activeFiltersCount = [
    statusFilter !== 'all',
    locationFilter !== 'all',
    verificationFilter !== 'all',
    dateFrom !== null,
    dateTo !== null,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setStatusFilter('all');
    setLocationFilter('all');
    setVerificationFilter('all');
    setDateFrom(null);
    setDateTo(null);
  };

  const { usdToUzs, cnyToUzs } = useFinanceCurrency();
  // We'll keep the exchangeRates object for the BoxCostBreakdownSheet if needed, 
  // but we'll populate it from the context instead of a separate query.
  const exchangeRates = useMemo(() => ({
    USD: 1,
    CNY: usdToUzs / cnyToUzs,
    UZS: usdToUzs,
    lastUpdated: new Date().toISOString()
  }), [usdToUzs, cnyToUzs]);

  const { data: boxes, isLoading } = useQuery({
    queryKey: ['boxes', { archived: false }],
    queryFn: async () => {
      return await fetchAllRows(
        supabase
          .from('boxes')
          .select(`
            *,
            box_track_codes(id, track_code, is_primary, source, created_at),
            product_items(
              id, 
              item_uuid,
              variant_id,
              unit_cost,
              unit_cost_currency,
              unit_cost_usd,
              domestic_shipping_cost,
              international_shipping_cost,
              final_cost_usd,
              exchange_rate_at_purchase,
              products(name, uuid, main_image_url),
              product_variants(id, variant_attributes, cost_price, cost_price_currency),
              verification_items(status, defect_type, notes)
            ),
            shipment_boxes(shipment:shipments(id, shipment_number, status))
          `)
          .neq('status', 'arrived')
          .order('created_at', { ascending: false })
      );
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Real-time subscription for boxes
  useEffect(() => {
    const channel = supabase
      .channel('boxes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'boxes'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['boxes'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handlePackBox = (box: any) => {
    setSelectedBox(box);
    setPackingDialogOpen(true);
  };

  const handleVerifyBox = (box: any) => {
    setSelectedBox(box);
    setVerificationDialogOpen(true);
  };

  const handleChinaVerifyBox = (box: any) => {
    setSelectedBox(box);
    setChinaVerificationDialogOpen(true);
  };

  const handleBoxFoundFromScanner = (box: any) => {
    setSelectedBox(box);
    setVerificationDialogOpen(true);
  };

  const generateBoxNumber = () => {
    return 'BOX-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  const createBoxMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const boxNumber = generateBoxNumber();
      
      // Collect all track codes: list + pending input (if any)
      const allTrackCodes = [...formData.trackCodes];
      const pendingTrimmed = formData.pendingTrackCode.trim();
      if (pendingTrimmed && !allTrackCodes.includes(pendingTrimmed)) {
        allTrackCodes.push(pendingTrimmed);
      }
      
      // Primary track code (first one in the list)
      const primaryTrackCode = allTrackCodes[0] || null;
      
      const { data, error } = await supabase
        .from('boxes')
        .insert({
          box_number: boxNumber,
          store_number: primaryTrackCode, // For backward compatibility
          location: formData.location,
          notes: formData.notes,
          status: 'packing',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add all track codes to junction table
      if (allTrackCodes.length > 0) {
        const trackCodeInserts = allTrackCodes.map((code, index) => ({
          box_id: data.id,
          track_code: code,
          source: 'manual',
          is_primary: index === 0,
        }));
        
        await supabase
          .from('box_track_codes')
          .insert(trackCodeInserts);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      toast({ title: t('box_created'), description: t('box_created_desc') });
      setOpen(false);
      setFormData({ trackCodes: [], pendingTrackCode: '', location: 'china', notes: '' });
    },
    onError: (error: any) => {
      toast({ title: t('vf_error'), description: error.message, variant: 'destructive' });
    },
  });

  const printQRCode = useMemo(() => (box: any) => {
    const canvas = document.getElementById(`qr-${box.id}`) as HTMLCanvasElement;
    
    if (canvas) {
      const qrImage = canvas.toDataURL('image/png');
      
      // Open print window with QR code
      const printWindow = window.open('', '_blank', 'width=400,height=400');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>QR: ${box.box_number}</title>
            <style>
              @page { 
                size: 58mm 60mm; 
                margin: 0; 
              }
              * { 
                box-sizing: border-box; 
              }
              html, body { 
                width: 58mm;
                height: 60mm;
                margin: 0; 
                padding: 0;
                overflow: hidden;
              }
              body { 
                padding: 3mm;
                display: flex; 
                flex-direction: column;
                align-items: center; 
                justify-content: center;
                font-family: Arial, sans-serif;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .container {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              img { 
                width: 48mm; 
                height: 48mm; 
                max-width: 48mm;
                max-height: 48mm;
              }
              .box-number { 
                font-size: 9pt; 
                font-weight: bold; 
                margin-top: 1mm;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <img src="${qrImage}" alt="QR Code" />
              <div class="box-number">${box.box_number}</div>
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
        
        // Use a flag to prevent double printing
        let hasPrinted = false;
        const triggerPrint = () => {
          if (hasPrinted) return;
          hasPrinted = true;
          printWindow.focus();
          printWindow.print();
          printWindow.onafterprint = () => printWindow.close();
        };
        
        // Wait for content to load then print
        printWindow.onload = triggerPrint;
        
        // Fallback for browsers that don't support onload well
        setTimeout(triggerPrint, 300);
      }
      
      toast({ title: t('box_print_sent'), description: t('box_print_desc') });
    }
  }, [toast]);

  const handleViewQR = (box: any) => {
    setSelectedBox(box);
    setQrDialogOpen(true);
  };

  // Status flow order - one-way transitions only (except for Chief Manager)
  const STATUS_ORDER = ['packing', 'sealed', 'in_transit', 'arrived'];
  
  const getStatusIndex = (status: string) => STATUS_ORDER.indexOf(status);
  
  const canTransitionTo = (currentStatus: string, newStatus: string, hasOverride: boolean = false) => {
    // Chief Manager can override and change status in any direction
    if (hasOverride) return true;
    
    const currentIndex = getStatusIndex(currentStatus);
    const newIndex = getStatusIndex(newStatus);
    // Can only move forward, not backward
    return newIndex >= currentIndex;
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ boxId, status, currentStatus, verificationComplete, canOverride }: { boxId: string; status: string; currentStatus: string; verificationComplete?: boolean; canOverride?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // ONE-WAY STATUS FLOW: Block going back to previous statuses (except for Chief Manager)
      if (!canTransitionTo(currentStatus, status, canOverride)) {
        throw new Error(`Holatni orqaga qaytarish mumkin emas. "${getStatusLabel(currentStatus)}" holatidan "${getStatusLabel(status)}" holatiga o'tib bo'lmaydi.`);
      }
      
      // MANDATORY VERIFICATION GATE: Block sealed, in_transit, and arrived statuses if verification is not complete
      // Chief Manager can also override this
      const requiresVerification = ['sealed', 'in_transit', 'arrived'].includes(status);
      if (requiresVerification && !verificationComplete && !canOverride) {
        throw new Error('Bu holatga o\'tkazish uchun avval 100% tekshirish talab qilinadi. Iltimos, barcha mahsulotlarni tekshiring.');
      }
      
      // Get box info for tracking event
      const { data: boxInfo } = await supabase
        .from('boxes')
        .select('box_number, location')
        .eq('id', boxId)
        .single();
      
      // If changing to sealed, generate/regenerate QR code with current contents
      if (status === 'sealed') {
        // Fetch box with its current items
        const { data: box } = await supabase
          .from('boxes')
          .select('*, product_items(id, item_uuid, products(name, uuid))')
          .eq('id', boxId)
          .single();
        
        if (box) {
          // Store only the box ID - not a URL (so external scanners can't redirect)
          const qrCodeValue = box.id;
          
          // Also store compact data for reference
          const qrData = {
            id: box.id,
            num: box.box_number,
            cnt: box.product_items?.length || 0,
            t: new Date().toISOString().slice(0, 10),
          };
          
          const { error } = await supabase
            .from('boxes')
            .update({ 
              status,
              qr_code: qrCodeValue,
              qr_data: qrData,
              sealed_at: new Date().toISOString(),
              sealed_by: user?.id,
            })
            .eq('id', boxId);
          
          if (error) throw error;
        }
      } else {
        const updateData: any = { status };
        
        const { error } = await supabase
          .from('boxes')
          .update(updateData)
          .eq('id', boxId);
        
        if (error) throw error;
      }
      
      // Create tracking event for box status change
      const statusDescriptions: Record<string, string> = {
        'packing': 'Qadoqlashga qaytarildi',
        'sealed': 'Quti yopildi va QR kod yaratildi',
        'in_transit': "Jo'natildi - yo'lda",
        'arrived': "O'zbekistonga yetib keldi",
      };
      
      const locationByStatus: Record<string, string> = {
        'packing': 'china',
        'sealed': 'china',
        'in_transit': 'transit',
        'arrived': 'uzbekistan',
      };
      
      await supabase
        .from('tracking_events')
        .insert({
          entity_type: 'box',
          entity_id: boxId,
          event_type: status,
          description: `${boxInfo?.box_number || 'Quti'}: ${statusDescriptions[status] || status}`,
          location: locationByStatus[status] || boxInfo?.location || 'china',
          created_by: user?.id,
        });
      // Send Telegram alerts for key status changes
      if (status === 'sealed' && boxInfo?.box_number) {
        const itemCount = await supabase
          .from('product_items')
          .select('id', { count: 'exact', head: true })
          .eq('box_id', boxId);
        // Fire and forget - don't block UI
        notifyBoxSealed(boxInfo.box_number, itemCount.count || 0, user?.email).catch(() => {});
      }
      if (status === 'arrived' && boxInfo?.box_number) {
        notifyBoxArrived(boxInfo.box_number).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      toast({ title: t('box_status_updated'), description: t('box_status_updated_desc') });
    },
    onError: (error: any) => {
      toast({ title: t('vf_error'), description: error.message, variant: 'destructive' });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'packing': return 'secondary';
      case 'sealed': return 'default';
      case 'in_transit': return 'outline';
      case 'arrived': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'packing': return t('box_status_packing');
      case 'sealed': return t('box_status_sealed');
      case 'in_transit': return t('box_status_in_transit');
      case 'arrived': return t('box_status_arrived');
      default: return status;
    }
  };

  const deleteBoxMutation = useMutation({
    mutationFn: async (boxId: string) => {
      // CASCADE O'CHIRISH - barcha bog'liq yozuvlarni o'chirish
      
      // 1. Trek raqamlarni o'chirish
      await supabase.from('box_track_codes').delete().eq('box_id', boxId);
      
      // 2. Qutiga tegishli da'volarni o'chirish
      await supabase.from('defect_claims').delete().eq('box_id', boxId);
      
      // 3. Verification items va sessions o'chirish
      const { data: sessions } = await supabase
        .from('verification_sessions')
        .select('id')
        .eq('box_id', boxId);
      
      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        await supabase.from('verification_items').delete().in('session_id', sessionIds);
        await supabase.from('verification_sessions').delete().eq('box_id', boxId);
      }
      
      // 4. Tracking events o'chirish
      await supabase.from('tracking_events').delete().eq('entity_id', boxId);
      
      // 5. Shipment bog'lanishini o'chirish
      await supabase.from('shipment_boxes').delete().eq('box_id', boxId);
      
      // 6. Product items ni TO'LIQ O'CHIRISH (null emas!)
      await supabase.from('product_items').delete().eq('box_id', boxId);
      
      // 7. Qutini o'chirish
      const { data, error } = await supabase
        .from('boxes')
        .delete()
        .eq('id', boxId)
        .select();
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Qutini o\'chirishga ruxsat yo\'q');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      queryClient.invalidateQueries({ queryKey: ['in-transit-products-detailed'] });
      queryClient.invalidateQueries({ queryKey: ['tashkent-dashboard-stats'] });
      toast({ title: t('box_deleted'), description: t('box_deleted_desc') });
      setDeleteDialogOpen(false);
      setBoxToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: t('vf_error'), description: error.message, variant: 'destructive' });
    },
  });

  const handleDeleteBox = (box: any) => {
    setBoxToDelete(box);
    setDeleteDialogOpen(true);
  };

  const content = (
    <div className="space-y-4 sm:space-y-6 relative">
      {/* Mobile Header with native styling */}
      {isMobile && (
        <MobileHeader
          title={t('boxes')}
          subtitle="Qutilar va QR kodlarni boshqarish"
          showSearch
          searchPlaceholder="Quti qidirish..."
          searchValue={searchQuery}
          onSearch={setSearchQuery}
          largeTitle={true}
          rightAction={
            canCreate && (
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full"
                onClick={() => setOpen(true)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            )
          }
        />
      )}

      {/* Desktop header */}
      {!isMobile && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">
              {t('boxes')}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              {t('box_subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canVerifyUz && (
              <Button 
                variant="outline" 
                className="gap-2 min-h-[44px] border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={() => setScannerDialogOpen(true)}
              >
                <ScanLine className="h-4 w-4" />
                {t('box_qr_scan')}
              </Button>
            )}
            {canCreate && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-primary hover:bg-primary/90 min-h-[44px]">
                    <Plus className="h-4 w-4" />
                    {t('box_new')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                     <DialogTitle className="text-foreground">{t('box_create_title')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <TrackCodesManager
                      localMode
                      localTrackCodes={formData.trackCodes}
                      pendingValue={formData.pendingTrackCode}
                      onPendingChange={(value) => setFormData(prev => ({ ...prev, pendingTrackCode: value }))}
                      onLocalAdd={(code) => setFormData(prev => ({ 
                        ...prev, 
                        trackCodes: [...prev.trackCodes, code],
                        pendingTrackCode: '' // Clear input after adding
                      }))}
                      onLocalRemove={(code) => setFormData(prev => ({ 
                        ...prev, 
                        trackCodes: prev.trackCodes.filter(c => c !== code) 
                      }))}
                    />
                    <Select value={formData.location} onValueChange={(value) => setFormData({ ...formData, location: value })}>
                      <SelectTrigger className="bg-input border-border min-h-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                         <SelectItem value="china">{t('box_location_china')}</SelectItem>
                         <SelectItem value="uzbekistan">{t('box_location_uz')}</SelectItem>
                         <SelectItem value="transit">{t('box_location_transit')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder={t('box_note_placeholder')}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="bg-input border-border min-h-[80px]"
                    />
                    <Button
                      onClick={() => createBoxMutation.mutate()}
                      disabled={createBoxMutation.isPending}
                      className="w-full bg-primary hover:bg-primary/90 min-h-[44px]"
                    >
                       {createBoxMutation.isPending ? t('box_creating') : t('box_create_btn')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      )}

      {/* Mobile Create Box Dialog */}
      {isMobile && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">{t('box_create_title')}</DialogTitle>
            </DialogHeader>
              <div className="space-y-4">
                <TrackCodesManager
                  localMode
                  localTrackCodes={formData.trackCodes}
                  pendingValue={formData.pendingTrackCode}
                  onPendingChange={(value) => setFormData(prev => ({ ...prev, pendingTrackCode: value }))}
                  onLocalAdd={(code) => setFormData(prev => ({ 
                    ...prev, 
                    trackCodes: [...prev.trackCodes, code],
                    pendingTrackCode: '' // Clear input after adding
                  }))}
                  onLocalRemove={(code) => setFormData(prev => ({ 
                    ...prev, 
                    trackCodes: prev.trackCodes.filter(c => c !== code) 
                  }))}
                />
              <Select value={formData.location} onValueChange={(value) => setFormData({ ...formData, location: value })}>
                <SelectTrigger className="bg-input border-border min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                   <SelectItem value="china">{t('box_location_china')}</SelectItem>
                   <SelectItem value="uzbekistan">{t('box_location_uz')}</SelectItem>
                   <SelectItem value="transit">{t('box_location_transit')}</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder={t('box_note_placeholder')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-input border-border min-h-[80px]"
              />
              <Button
                onClick={() => createBoxMutation.mutate()}
                disabled={createBoxMutation.isPending}
                className="w-full bg-primary hover:bg-primary/90 min-h-[44px]"
              >
                {createBoxMutation.isPending ? t('box_creating') : t('box_create_btn')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Card className="p-3 sm:p-6 bg-card border-border">
        {/* Mobile Filter Chips - Horizontally scrollable */}
        {isMobile && (
          <div className="flex overflow-x-auto pb-3 -mx-3 px-3 mb-4 gap-2 scrollbar-hide">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                statusFilter === 'all'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
               {t('all')}
            </button>
            <button
              onClick={() => setStatusFilter('packing')}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                statusFilter === 'packing'
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
               {t('box_status_packing')}
            </button>
            <button
              onClick={() => setStatusFilter('sealed')}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                statusFilter === 'sealed'
                  ? "bg-blue-500 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
               {t('box_status_sealed')}
            </button>
            <button
              onClick={() => setStatusFilter('in_transit')}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                statusFilter === 'in_transit'
                  ? "bg-purple-500 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
               {t('box_status_in_transit')}
            </button>
            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive"
              >
                 {t('box_filter_clear')}
              </button>
            )}
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search') + '...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-input border-border min-h-[44px]"
              />
            </div>
            {/* Desktop selects */}
            <div className="hidden sm:flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] min-h-[44px]">
                  <SelectValue placeholder={t('prod_status_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">{t('box_filter_all_statuses')}</SelectItem>
                   <SelectItem value="packing">{t('box_status_packing')}</SelectItem>
                   <SelectItem value="sealed">{t('box_status_sealed')}</SelectItem>
                   <SelectItem value="in_transit">{t('box_status_in_transit')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[160px] min-h-[44px]">
                  <SelectValue placeholder={t('box_filter_location')} />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">{t('box_filter_all_locations')}</SelectItem>
                   <SelectItem value="china">{t('box_location_china')}</SelectItem>
                   <SelectItem value="transit">{t('box_location_transit')}</SelectItem>
                   <SelectItem value="uzbekistan">{t('box_location_uz')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Advanced Filters Row - Desktop only */}
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            <Select value={verificationFilter} onValueChange={setVerificationFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('box_filter_verification')} />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="all">{t('all')}</SelectItem>
                 <SelectItem value="verified">{t('box_filter_verified')}</SelectItem>
                 <SelectItem value="not_verified">{t('box_filter_not_verified')}</SelectItem>
                 <SelectItem value="required">{t('box_filter_required')}</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[130px] justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd.MM.yy") : t('box_filter_date_from')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom || undefined}
                  onSelect={(date) => setDateFrom(date || null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[130px] justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "dd.MM.yy") : t('box_filter_date_to')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo || undefined}
                  onSelect={(date) => setDateTo(date || null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
                {t('box_filter_clear')} ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton count={6} />
        ) : boxes && boxes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boxes
              .filter(box => {
                // Search filter - includes trek raqam from junction table
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  const boxTrackCodes = (box as any).box_track_codes || [];
                  const matchesTrackCode = boxTrackCodes.some((tc: any) => 
                    tc.track_code?.toLowerCase().includes(query)
                  );
                  const matchesSearch = (
                    box.box_number.toLowerCase().includes(query) ||
                    box.location?.toLowerCase().includes(query) ||
                    box.notes?.toLowerCase().includes(query) ||
                    box.status?.toLowerCase().includes(query) ||
                    box.store_number?.toLowerCase().includes(query) ||
                    (box as any).abusaxiy_receipt_number?.toLowerCase().includes(query) ||
                    matchesTrackCode
                  );
                  if (!matchesSearch) return false;
                }
                
                // Status filter
                if (statusFilter !== 'all' && box.status !== statusFilter) return false;
                
                // Location filter
                if (locationFilter !== 'all' && box.location !== locationFilter) return false;
                
                // Verification filter
                if (verificationFilter === 'verified' && !box.verification_complete) return false;
                if (verificationFilter === 'not_verified' && box.verification_complete) return false;
                if (verificationFilter === 'required' && !box.verification_required) return false;
                
                // Date range filter
                if (dateFrom) {
                  const boxDate = new Date(box.created_at);
                  if (boxDate < startOfDay(dateFrom)) return false;
                }
                if (dateTo) {
                  const boxDate = new Date(box.created_at);
                  if (boxDate > endOfDay(dateTo)) return false;
                }
                
                return true;
              })
              .map((box) => {
              const boxTrackCodes = (box as any).box_track_codes || [];
              const isVerifiedUz = (box as any).verified_uz || box.status === 'arrived' || box.status === 'delivered' || box.location === 'uzbekistan';
              return (
              <Card key={`${box.id}-${customRates[box.id]?.uzsRate || 0}-${customRates[box.id]?.cnyToUzs || 0}`} className={cn(
                "p-3 sm:p-4 bg-muted border-border transition-all",
                isMobile && "active:scale-[0.99]"
              )}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 sm:h-6 w-5 sm:w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground text-sm sm:text-base truncate">{box.box_number}</h3>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <Badge 
                        variant={getStatusBadgeVariant(box.status)} 
                        className="text-[10px] sm:text-xs"
                      >
                        {getStatusLabel(box.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{box.location}</span>
                      {box.verification_complete && (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                    {/* Track codes from junction table */}
                    {boxTrackCodes.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {boxTrackCodes.slice(0, 2).map((tc: any) => (
                          <Badge 
                            key={tc.id} 
                            variant={tc.is_primary ? "default" : "secondary"} 
                            className="text-[10px] gap-0.5"
                          >
                            {tc.is_primary && <Star className="h-2.5 w-2.5 fill-current" />}
                            🏷️ {tc.track_code}
                          </Badge>
                        ))}
                        {boxTrackCodes.length > 2 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{boxTrackCodes.length - 2} trek
                          </Badge>
                        )}
                      </div>
                    ) : box.store_number ? (
                      // Fallback to old store_number field
                      <Badge variant="secondary" className="text-[10px] mt-0.5">
                        🏷️ Trek: {box.store_number}
                      </Badge>
                    ) : null}
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {(box as any).shipment_boxes?.[0]?.shipment && (
                        <Badge variant="outline" className="text-[10px] bg-primary/5">
                          📦 {(box as any).shipment_boxes[0].shipment.shipment_number}
                        </Badge>
                      )}
                      {(box.product_items?.length || 0) > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {box.product_items?.length} ta tovar
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Mobile quick actions button */}
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openQuickActions(box);
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {/* AbuSaxiy details */}
                {((box as any).weight_kg || (box as any).volume_m3) && (
                  <div className="mb-3 p-2 bg-background/50 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(box as any).weight_kg && (
                        <div>
                          <span className="text-muted-foreground">{t('box_weight')}</span>
                          <span className="ml-1 text-foreground">{(box as any).weight_kg} kg</span>
                        </div>
                      )}
                      {(box as any).volume_m3 && (
                        <div>
                          <span className="text-muted-foreground">{t('box_volume')}</span>
                          <span className="ml-1 text-foreground">{Number((box as any).volume_m3).toFixed(4)} m³</span>
                        </div>
                      )}
                      {(box as any).length_cm && (box as any).width_cm && (box as any).height_cm && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">{t('box_dimensions')}</span>
                          <span className="ml-1 text-foreground">
                            {(box as any).length_cm}×{(box as any).width_cm}×{(box as any).height_cm} cm
                          </span>
                        </div>
                      )}
                      {(box as any).shipping_cost && (
                        <div>
                          <span className="text-muted-foreground">{t('box_cost')}</span>
                          <span className="ml-1 text-foreground">${(box as any).shipping_cost}</span>
                        </div>
                      )}
                      {(box as any).estimated_arrival && (
                        <div>
                          <span className="text-muted-foreground">{t('box_arrival')}</span>
                          <span className="ml-1 text-foreground">
                            {new Date((box as any).estimated_arrival).toLocaleDateString('uz-UZ')}
                          </span>
                        </div>
                      )}
                    </div>
                    {(box as any).product_description && (
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        {(box as any).product_description}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">{t('box_products_label')}</p>
                  <div className="flex flex-wrap gap-2 text-sm">
                     <span className="text-emerald-600 dark:text-emerald-400">
                       {t('box_ok')} {(box.product_items?.length || 0) - (box.defect_count || 0) - (box.missing_count || 0)}
                     </span>
                     <span className="text-amber-600 dark:text-amber-400">
                       {t('box_defective')} {box.defect_count || 0}
                     </span>
                     <span className="text-red-600 dark:text-red-400">
                       {t('box_missing')} {box.missing_count || 0}
                     </span>
                  </div>
                  
                  {/* Product items with costs */}
                  {/* Product items preview - Grouped by product name */}
                  {box.product_items && box.product_items.length > 0 && (() => {
                    // Use custom rates for this box if set, otherwise global context rates
                    const boxCustomRates = customRates[box.id];
                    const globalUzsRate = usdToUzs;
                    const globalCnyToUzs = cnyToUzs;
                    
                    const currentUzsRate = boxCustomRates?.uzsRate ?? globalUzsRate;
                    const currentCnyToUzs = boxCustomRates?.cnyToUzs ?? globalCnyToUzs;
                    
                    // Helper function for color emojis
                    const getColorEmoji = (color: string | undefined): string => {
                      if (!color) return "";
                      const c = color.toLowerCase();
                      const colorMap: Record<string, string> = {
                        'qizil': '🔴', 'red': '🔴',
                        'ko\'k': '🔵', 'kok': '🔵', 'blue': '🔵',
                        'yashil': '🟢', 'green': '🟢',
                        'sariq': '🟡', 'yellow': '🟡',
                        'qora': '⚫', 'black': '⚫',
                        'oq': '⚪', 'white': '⚪',
                        'jigarrang': '🟤', 'brown': '🟤',
                        'pushti': '💗', 'pink': '💗',
                        'binafsha': '🟣', 'purple': '🟣',
                      };
                      return colorMap[c] || "";
                    };
                    
                    // Filter out defective/missing items
                    const validItems = box.product_items.filter((item: any) => {
                      const chinaVerification = item.verification_items?.[0];
                      return !(chinaVerification && (chinaVerification.status === 'defective' || chinaVerification.status === 'missing'));
                    });
                    
                    // Group items by product name + variant
                    const grouped: Record<string, { 
                      name: string; 
                      variantId: string | null;
                      variantInfo: string | null;
                      variantColor: string | null;
                      count: number; 
                      totalCostUZS: number; 
                      unitCostUZS: number; 
                      items: any[] 
                    }> = {};
                    
                    validItems.forEach((item: any) => {
                      const name = item.products?.name || item.item_uuid?.slice(0, 8) || 'Noma\'lum';
                      const variantId = item.variant_id || null;
                      const variantAttrs = item.product_variants?.variant_attributes as Record<string, unknown> | undefined;
                      const rang = (variantAttrs?.rang as string) || null;
                      const material = (variantAttrs?.material as string) || null;
                      const variantInfo = rang && material ? `${rang} / ${material}` : (rang || material || null);
                      
                      // CNY qismi: Sotib olish + Xitoygacha yetkazish
                      // unit_cost bo'sh bo'lsa → product_variants.cost_price dan fallback
                      const rawUnitCost = item.unit_cost ?? item.product_variants?.cost_price ?? 0;
                      const unitCostCurrency = item.unit_cost_currency || item.product_variants?.cost_price_currency || 'CNY';
                      const unitCostCNY = unitCostCurrency === 'USD'
                        ? Number(rawUnitCost) * (currentUzsRate / currentCnyToUzs)
                        : Number(rawUnitCost) || 0;
                      const domesticShippingCNY = Number(item.domestic_shipping_cost) || 0;
                      // USD qismi: Xalqaro logistika
                      const internationalUSD = Number(item.international_shipping_cost) || 0;
                      
                      // Jami tannarx = (CNY qismi × CNY kursi) + (USD qismi × USD kursi)
                      const landedCostUZS = (unitCostCNY + domesticShippingCNY) * currentCnyToUzs + internationalUSD * currentUzsRate;
                      
                      // Group key: name + variant ID
                      const groupKey = variantId 
                        ? `${name}::${variantId}` 
                        : `${name}::no-variant`;
                      
                      if (!grouped[groupKey]) {
                        grouped[groupKey] = { 
                          name, 
                          variantId,
                          variantInfo,
                          variantColor: rang,
                          count: 0, 
                          totalCostUZS: 0, 
                          unitCostUZS: landedCostUZS, 
                          items: [] 
                        };
                      }
                      grouped[groupKey].count += 1;
                      grouped[groupKey].totalCostUZS += landedCostUZS;
                      grouped[groupKey].items.push(item);
                    });
                    
                    const groupedArray = Object.values(grouped);
                    const displayGroups = groupedArray.slice(0, 5);
                    const remainingGroupCount = groupedArray.length - 5;
                    const totalLandedCostUZS = groupedArray.reduce((sum, g) => sum + g.totalCostUZS, 0);
                    const cnyToUzsRate = currentCnyToUzs; // Already UZS
                    
                    // Calculate averages for breakdown
                    const avgUnitCostCNY = validItems.reduce((s: number, i: any) => s + (Number(i.unit_cost) || 0), 0) / (validItems.length || 1);
                    const avgDomesticCNY = validItems.reduce((s: number, i: any) => s + (Number(i.domestic_shipping_cost) || 0), 0) / (validItems.length || 1);
                    const avgIntlUSD = validItems.reduce((s: number, i: any) => s + (Number(i.international_shipping_cost) || 0), 0) / (validItems.length || 1);
                    const perItemUZS = totalLandedCostUZS / (validItems.length || 1);
                    const lastUpdated = exchangeRates?.lastUpdated ? formatDistanceToNow(new Date(exchangeRates.lastUpdated), { addSuffix: true, locale: uz }) : 'hozir';
                    
                    return (
                      <div className="mt-2 space-y-2">
                        {/* Grouped product list with variants */}
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          {displayGroups.map((group, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-background/50 rounded px-2 py-1.5">
                              <div className="flex items-center gap-1 truncate flex-1 mr-2">
                                {group.variantColor && (
                                  <span className="shrink-0">{getColorEmoji(group.variantColor)}</span>
                                )}
                                <span className="truncate">
                                  {group.variantInfo 
                                    ? `${group.name} (${group.variantInfo})`
                                    : group.name
                                  }
                                </span>
                              </div>
                              <span className="font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                                {(() => {
                                  const perUnitCost = group.totalCostUZS / group.count;
                                  if (group.count > 1) {
                                    return `${group.count} ta × ${perUnitCost.toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} = ${group.totalCostUZS.toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} so'm`;
                                  } else {
                                    return `${perUnitCost.toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} so'm`;
                                  }
                                })()}
                              </span>
                            </div>
                          ))}
                          {remainingGroupCount > 0 && (
                            <p className="text-[10px] text-muted-foreground text-center">
                              +{remainingGroupCount} xil tovar
                            </p>
                          )}
                        </div>
                        
                        {/* Total cost with Sheet breakdown */}
                        {totalLandedCostUZS > 0 && (
                          <Sheet 
                            open={costSheetBoxId === box.id} 
                            onOpenChange={(open) => setCostSheetBoxId(open ? box.id : null)}
                          >
                            <SheetTrigger asChild>
                              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calculator className="h-3 w-3" />
                                    Jami tannarx:
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                      {totalLandedCostUZS.toLocaleString('uz-UZ', { maximumFractionDigits: 0 })} so'm
                                    </span>
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                </div>
                              </div>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="max-h-[85vh]">
                              <BoxCostBreakdownSheet 
                                productItems={box.product_items || []}
                                exchangeRates={exchangeRates}
                                customRates={customRates[box.id] || null}
                                onApplyRates={(rates) => {
                                  setCustomRates(prev => ({
                                    ...prev,
                                    [box.id]: rates
                                  }));
                                  // Close the sheet after applying
                                  setCostSheetBoxId(null);
                                }}
                              />
                            </SheetContent>
                          </Sheet>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">Holat:</p>
                  <Select 
                    value={box.status || 'packing'} 
                    onValueChange={(value) => {
                      const currentStatus = box.status || 'packing';
                      
                      // Block going back to previous statuses (except for Chief Manager)
                      if (!canTransitionTo(currentStatus, value, isChiefManager)) {
                        toast({
                          title: "O'tish mumkin emas",
                          description: `"${getStatusLabel(currentStatus)}" holatidan "${getStatusLabel(value)}" holatiga qaytish mumkin emas.`,
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      // Block sealing without verification (except for Chief Manager)
                      if (!isChiefManager && ['sealed', 'in_transit', 'arrived'].includes(value) && !box.verification_complete) {
                        toast({
                          title: "Tekshirish talab qilinadi",
                          description: "Bu holatga o'tkazish uchun avval 100% tekshirish talab qilinadi. Iltimos, barcha mahsulotlarni tekshiring.",
                          variant: "destructive"
                        });
                        return;
                      }
                      updateStatusMutation.mutate({ 
                        boxId: box.id, 
                        status: value, 
                        currentStatus,
                        verificationComplete: box.verification_complete,
                        canOverride: isChiefManager
                      });
                    }}
                  >
                    <SelectTrigger className="w-full min-h-[40px] bg-input border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {(() => {
                        const currentStatus = box.status || 'packing';
                        const currentIndex = getStatusIndex(currentStatus);
                        
                        return STATUS_ORDER.map((status, index) => {
                          const isPreviousStatus = index < currentIndex;
                          const needsVerification = ['sealed', 'in_transit', 'arrived'].includes(status) && !box.verification_complete;
                          
                          // Chief Manager can access all statuses
                          const isDisabled = isChiefManager ? false : (isPreviousStatus || needsVerification);
                          
                          let label = getStatusLabel(status);
                          if (isPreviousStatus && !isChiefManager) {
                            label = `${label} ✓`;
                          } else if (needsVerification && !isChiefManager) {
                            label = `${label} (tekshirish kerak)`;
                          }
                          
                          return (
                            <SelectItem 
                              key={status}
                              value={status} 
                              disabled={isDisabled}
                              className={cn(
                                isDisabled && 'opacity-50',
                                isPreviousStatus && !isChiefManager && 'text-muted-foreground line-through'
                              )}
                            >
                              {label}
                            </SelectItem>
                          );
                        });
                      })()}
                    </SelectContent>
                  </Select>
                  {!box.verification_complete && box.status === 'packing' && box.location === 'china' && !isChiefManager && (
                    <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {t('box_verification_required')}
                    </p>
                  )}
                </div>

                {/* Desktop action buttons - hidden on mobile */}
                <div className="hidden sm:grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5 min-h-[40px]"
                    onClick={() => handlePackBox(box)}
                  >
                    <PackagePlus className="h-4 w-4" />
                    <span className="text-xs sm:text-sm">{t('box_pack')}</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5 min-h-[40px]"
                    onClick={() => handleViewQR(box)}
                  >
                    <QrCode className="h-4 w-4" />
                    <span className="text-xs sm:text-sm">QR</span>
                  </Button>
                  {canVerifyChina && box.location === 'china' && !box.verification_complete && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1.5 min-h-[40px] border-yellow-500 text-yellow-500"
                      onClick={() => handleChinaVerifyBox(box)}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">{t('box_verify')}</span>
                    </Button>
                  )}
                  {canVerifyUz && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={`gap-1.5 min-h-[40px] ${isVerifiedUz ? 'border-green-500 text-green-500' : 'border-primary text-primary'}`}
                      onClick={() => !isVerifiedUz && handleVerifyBox(box)}
                      disabled={isVerifiedUz}
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">{isVerifiedUz ? t('box_uz_verified') : t('box_uz_verify')}</span>
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5 min-h-[40px]"
                    onClick={() => printQRCode(box)}
                  >
                    <Printer className="h-4 w-4" />
                    <span className="text-xs sm:text-sm">{t('box_print')}</span>
                  </Button>
                  {canDelete && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1.5 min-h-[40px] border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleDeleteBox(box)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">{t('delete')}</span>
                    </Button>
                  )}
                </div>
                
                <div style={{ display: 'none' }}>
                  <QRCodeCanvas 
                    id={`qr-${box.id}`}
                    value={box.id}
                    size={256}
                    level="M"
                  />
                </div>
              </Card>
            )})}
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
             <p className="text-muted-foreground mb-4">{t('box_no_boxes')}</p>
             <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setOpen(true)}>
               <Plus className="h-4 w-4" />
               {t('box_create_first')}
             </Button>
          </div>
        )}
      </Card>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              QR Kod - {selectedBox?.box_number}
            </DialogTitle>
          </DialogHeader>
          {selectedBox && (
            <div className="flex flex-col items-center gap-4">
              <QRCodeSVG 
                value={selectedBox.id}
                size={200}
                level="M"
              />
              <div className="text-center">
               <p className="text-sm text-muted-foreground mb-2">
                   {t('box_qr_location')} {selectedBox.location}
                 </p>
                 <p className="text-xs text-muted-foreground">
                   {t('box_qr_created')} {new Date(selectedBox.created_at).toLocaleDateString('uz-UZ')}
                </p>
              </div>
              <Button 
                className="w-full gap-2 bg-primary hover:bg-primary/90"
                onClick={() => {
                  printQRCode(selectedBox);
                  setQrDialogOpen(false);
                }}
              >
                <Printer className="h-4 w-4" />
                 {t('box_print_qr')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BoxPackingDialog
        box={selectedBox}
        open={packingDialogOpen}
        onOpenChange={setPackingDialogOpen}
      />

      <BoxVerificationDialog
        box={selectedBox}
        open={verificationDialogOpen}
        onOpenChange={setVerificationDialogOpen}
      />

      <QRScannerDialog
        open={scannerDialogOpen}
        onOpenChange={setScannerDialogOpen}
        onBoxFound={handleBoxFoundFromScanner}
      />

      <ChinaVerificationDialog
        box={selectedBox}
        open={chinaVerificationDialogOpen}
        onOpenChange={setChinaVerificationDialogOpen}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
         title={t('box_delete_title')}
         description={t('box_delete_desc', { name: boxToDelete?.box_number })}
         confirmText={t('delete')}
         cancelText={t('cancel')}
        onConfirm={() => boxToDelete && deleteBoxMutation.mutate(boxToDelete.id)}
        isLoading={deleteBoxMutation.isPending}
        variant="destructive"
      />

      {/* Mobile Quick Actions Sheet */}
      <Sheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[70vh]">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              {quickActionsBox?.box_number}
            </SheetTitle>
          </SheetHeader>
          {quickActionsBox && (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 justify-start gap-3"
                onClick={() => {
                  setQuickActionsOpen(false);
                  handlePackBox(quickActionsBox);
                }}
              >
                <PackagePlus className="h-5 w-5" />
                {t('box_add_product')}
              </Button>
              {canVerifyChina && quickActionsBox.location === 'china' && !quickActionsBox.verification_complete && (
                <Button
                  variant="outline"
                  className="w-full h-12 justify-start gap-3 border-yellow-500 text-yellow-500"
                  onClick={() => {
                    setQuickActionsOpen(false);
                    handleChinaVerifyBox(quickActionsBox);
                  }}
                >
                  <ShieldCheck className="h-5 w-5" />
                   {t('box_verify')}
                </Button>
              )}
              {canVerifyUz && (
                <Button
                  variant="outline"
                  className="w-full h-12 justify-start gap-3"
                  onClick={() => {
                    setQuickActionsOpen(false);
                    handleVerifyBox(quickActionsBox);
                  }}
                >
                  <CheckCircle className="h-5 w-5" />
                  {t('box_uz_verify')}
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full h-12 justify-start gap-3"
                onClick={() => {
                  setQuickActionsOpen(false);
                  handleViewQR(quickActionsBox);
                }}
              >
                <QrCode className="h-5 w-5" />
                {t('box_view_qr')}
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 justify-start gap-3"
                onClick={() => {
                  setQuickActionsOpen(false);
                  printQRCode(quickActionsBox);
                }}
              >
                <Printer className="h-5 w-5" />
                {t('box_print_qr')}
              </Button>
              {canDelete && (
                <Button
                  variant="outline"
                  className="w-full h-12 justify-start gap-3 border-destructive text-destructive"
                  onClick={() => {
                    setQuickActionsOpen(false);
                    handleDeleteBox(quickActionsBox);
                  }}
                >
                  <Trash2 className="h-5 w-5" />
                  {t('delete')}
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Mobile Floating QR Scan Button */}
      {isMobile && canVerifyUz && (
        <Button
          className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg shadow-primary/30 z-50"
          onClick={() => setScannerDialogOpen(true)}
        >
          <ScanLine className="h-6 w-6" />
        </Button>
      )}
    </div>
  );

  // Wrap with PullToRefresh on mobile
  if (isMobile) {
    return (
      <PullToRefresh onRefresh={handleRefresh} className="min-h-full">
        {content}
      </PullToRefresh>
    );
  }

  return content;
}
