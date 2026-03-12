import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScanLine, Package, Check, X, AlertTriangle, Camera, Search, Loader2 } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTelegramAlert } from '@/hooks/useTelegramAlert';
import { Html5Qrcode } from 'html5-qrcode';

interface ItemStatus {
  id: string;
  status: 'ok' | 'damaged' | 'missing';
  notes: string;
}

export default function Verification() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { notifyVerificationComplete } = useTelegramAlert();
  
  const [scanning, setScanning] = useState(false);
  const [boxId, setBoxId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>({});
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Fetch box data when boxId is set
  const { data: box, isLoading: boxLoading, error: boxError } = useQuery({
    queryKey: ['verification-box', boxId],
    queryFn: async () => {
      if (!boxId) return null;
      
      const { data, error } = await supabase
        .from('boxes')
        .select('*, product_items(id, product_id, item_uuid, status, notes, products(name, uuid, category))')
        .eq('id', boxId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!boxId,
  });

  // Initialize item statuses when box is loaded
  useEffect(() => {
    if (box?.product_items) {
      const initialStatuses: Record<string, ItemStatus> = {};
      box.product_items.forEach((item: any) => {
        initialStatuses[item.id] = {
          id: item.id,
          status: 'ok',
          notes: item.notes || '',
        };
      });
      setItemStatuses(initialStatuses);
    }
  }, [box]);

  // Start QR scanner
  const startScanner = async () => {
    try {
      setScanning(true);
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Extract box ID from URL or use directly
          let extractedBoxId = decodedText;
          
          // If it's a URL, extract the box ID
          if (decodedText.includes('/verify/')) {
            extractedBoxId = decodedText.split('/verify/').pop() || '';
          }
          
          setBoxId(extractedBoxId);
          stopScanner();
          toast({
            title: t('vf_qr_read'),
            description: t('vf_loading_box'),
          });
        },
        () => {} // Ignore errors during scanning
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setScanning(false);
      toast({
        title: t('vf_error'),
        description: t('vf_camera_error'),
        variant: 'destructive',
      });
    }
  };

  // Stop QR scanner
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Search for box by number
  const handleSearch = async () => {
    if (!searchInput.trim()) return;

    const { data, error } = await supabase
      .from('boxes')
      .select('id')
      .or(`box_number.ilike.%${searchInput}%,id.eq.${searchInput}`)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      toast({
        title: t('vf_box_not_found'),
        description: t('vf_try_again'),
        variant: 'destructive',
      });
      return;
    }

    setBoxId(data.id);
  };

  // Update item status
  const updateItemStatus = (itemId: string, status: 'ok' | 'damaged' | 'missing') => {
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
      if (!box || !user) throw new Error('Box or user not found');

      // Update each product item
      const updates = Object.entries(itemStatuses).map(([itemId, status]) => {
        const dbStatus = status.status === 'ok' ? 'arrived' : status.status;
        return supabase
          .from('product_items')
          .update({
            status: dbStatus,
            notes: status.notes || null,
            location: 'uzbekistan',
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId);
      });

      await Promise.all(updates);

      // Update box verification status AND status to 'arrived'
      const { error: boxError } = await supabase
        .from('boxes')
        .update({
          // TEMPORARY FIX: Bypassing schema cache error. Relying on status update directly.
          location: 'uzbekistan',
          status: 'arrived', // Avtomatik "Yetib keldi" ga o'tkazish
        })
        .eq('id', box.id);
        
      if (boxError) throw boxError;

      // Create claims for damaged/missing items
      const defectiveStatuses = Object.values(itemStatuses).filter(s => s.status === 'damaged' || s.status === 'missing');
      
      if (defectiveStatuses.length > 0) {
        // Fetch defect categories to map correctly
        const { data: categories } = await supabase.from('defect_categories').select('id, name');
        
        const brokenCategoryId = categories?.find(c => c.name === 'broken')?.id;
        const incompleteCategoryId = categories?.find(c => c.name === 'incomplete')?.id;
        const otherCategoryId = categories?.find(c => c.name === 'other')?.id;

        // Generate claim_number ourselves to bypass broken DB trigger
        const yearPrefix = new Date().getFullYear().toString();
        const { data: existingClaims } = await supabase
          .from('defect_claims')
          .select('claim_number')
          .like('claim_number', `CLM-${yearPrefix}-%`)
          .order('claim_number', { ascending: false })
          .limit(1);
          
        let nextSeqNum = 1;
        if (existingClaims && existingClaims.length > 0) {
          const lastNum = existingClaims[0].claim_number?.split('-').pop();
          nextSeqNum = (parseInt(lastNum || '0', 10) || 0) + 1;
        }

        const claimsToInsert = defectiveStatuses.map((statusObj, idx) => {
          const productItem = box.product_items.find((p: any) => p.id === statusObj.id);
          
          let categoryId = otherCategoryId;
          if (statusObj.status === 'damaged') categoryId = brokenCategoryId || otherCategoryId;
          if (statusObj.status === 'missing') categoryId = incompleteCategoryId || otherCategoryId;

          const seqNum = String(nextSeqNum + idx).padStart(4, '0');
          const claimNumber = `CLM-${yearPrefix}-${seqNum}`;

          return {
            claim_number: claimNumber,
            box_id: box.id,
            product_id: productItem?.product_id,
            product_item_id: statusObj.id,
            defect_category_id: categoryId,
            defect_description: statusObj.notes || (statusObj.status === 'damaged' ? "Keng qamrovli tekshiruvda brak chiqdi." : "Keng qamrovli tekshiruvda yetishmayapti."),
            status: 'pending',
            created_by: user.id
          };
        });

        if (claimsToInsert.length > 0) {
          const { error: claimsError } = await supabase.from('defect_claims').insert(claimsToInsert as any[]);
          if (claimsError) console.error('Error creating automated claims:', claimsError);
        }
      }

      // Create tracking event
      const okCount = Object.values(itemStatuses).filter(s => s.status === 'ok').length;
      const damagedCount = Object.values(itemStatuses).filter(s => s.status === 'damaged').length;
      const missingCount = Object.values(itemStatuses).filter(s => s.status === 'missing').length;

      await supabase
        .from('tracking_events')
        .insert({
          entity_type: 'box',
          entity_id: box.id,
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
      queryClient.invalidateQueries({ queryKey: ['verification-box', boxId] });
      queryClient.invalidateQueries({ queryKey: ['tracking'] });
      
      // Send Telegram notification
      if (box?.box_number) {
        notifyVerificationComplete(box.box_number, result.okCount, result.damagedCount, result.missingCount).catch(() => {});
      }
      
      toast({
        title: t('vf_verify_complete'),
        description: `${result.okCount} OK, ${result.damagedCount} ${t('vf_damaged')}, ${result.missingCount} ${t('vf_missing')}`,
      });
      
      // Reset state
      setBoxId('');
      setSearchInput('');
      setItemStatuses({});
    },
    onError: (error: any) => {
      toast({
        title: t('vf_error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Reset and search another
  const handleReset = () => {
    setBoxId('');
    setSearchInput('');
    setItemStatuses({});
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {t('verification')}
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t('vf_scan_subtitle')}
        </p>
      </div>

      {!boxId ? (
        <div className="space-y-6">
          {/* QR Scanner */}
          <Card className="p-6 bg-card border-border">
            <div className="text-center space-y-4">
              {scanning ? (
                <>
                  <div id="qr-reader" className="mx-auto max-w-sm rounded-lg overflow-hidden" />
                  <Button 
                    variant="outline" 
                    onClick={stopScanner}
                    className="min-h-[44px]"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('vf_stop_scan')}
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Camera className="h-12 w-12 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">{t('vf_qr_scan_title')}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('vf_qr_scan_desc')}
                    </p>
                  </div>
                  <Button 
                    onClick={startScanner}
                    className="bg-primary hover:bg-primary/90 min-h-[44px] gap-2"
                  >
                    <ScanLine className="h-4 w-4" />
                    {t('vf_start_scan')}
                  </Button>
                </>
              )}
            </div>
          </Card>

          {/* Manual Search */}
          <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-medium text-foreground mb-4">
              {t('vf_manual_search')}
            </h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('vf_enter_box_number')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 bg-input border-border min-h-[44px]"
                />
              </div>
              <Button 
                onClick={handleSearch}
                className="bg-primary hover:bg-primary/90 min-h-[44px]"
              >
                {t('search')}
              </Button>
            </div>
          </Card>
        </div>
      ) : boxLoading ? (
        <div className="p-6">
          <LoadingSkeleton count={1} />
        </div>
      ) : boxError || !box ? (
        <Card className="p-6 bg-card border-border">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <X className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">{t('vf_box_not_found')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('vf_try_again')}
              </p>
            </div>
            <Button onClick={handleReset} variant="outline" className="min-h-[44px]">
              {t('vf_search_again')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Box Info */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Package className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-foreground">{box.box_number}</h2>
                  {((box as any).verified_uz || box.status === 'arrived' || box.status === 'delivered' || box.location === 'uzbekistan') && (
                    <Badge variant="default" className="bg-green-500">
                      {t('vf_verified_badge')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('vf_location_status', { location: box.location, status: box.status })}
                </p>
                {box.sealed_at && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('vf_sealed_at', { date: new Date(box.sealed_at).toLocaleString('uz-UZ') })}
                  </p>
                )}
              </div>
              <Button onClick={handleReset} variant="ghost" size="sm">
                {t('vf_another_box')}
              </Button>
            </div>

            {/* AbuSaxiy details */}
            {((box as any).weight_kg || (box as any).volume_m3) && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {(box as any).weight_kg && (
                    <div>
                      <span className="text-muted-foreground">{t('vf_weight')}</span>
                      <span className="ml-1 text-foreground font-medium">{(box as any).weight_kg} kg</span>
                    </div>
                  )}
                  {(box as any).volume_m3 && (
                    <div>
                      <span className="text-muted-foreground">{t('vf_volume')}</span>
                      <span className="ml-1 text-foreground font-medium">{Number((box as any).volume_m3).toFixed(4)} m³</span>
                    </div>
                  )}
                  {(box as any).length_cm && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">{t('vf_dimensions')}</span>
                      <span className="ml-1 text-foreground font-medium">
                        {(box as any).length_cm}×{(box as any).width_cm}×{(box as any).height_cm} cm
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Products List */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-foreground">
                {t('vf_products', { count: box.product_items?.length || 0 })}
              </h3>
              <div className="flex gap-2 text-xs">
                <Badge variant="outline" className="border-green-500 text-green-500">
                  OK: {Object.values(itemStatuses).filter(s => s.status === 'ok').length}
                </Badge>
                <Badge variant="outline" className="border-red-500 text-red-500">
                  {t('vf_damaged')}: {Object.values(itemStatuses).filter(s => s.status === 'damaged').length}
                </Badge>
                <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                  {t('vf_missing')}: {Object.values(itemStatuses).filter(s => s.status === 'missing').length}
                </Badge>
              </div>
            </div>

            {box.product_items && box.product_items.length > 0 ? (
              <div className="space-y-3">
                {box.product_items.map((item: any) => {
                  const currentStatus = itemStatuses[item.id]?.status || 'ok';
                  return (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-lg border transition-colors ${
                        currentStatus === 'ok' ? 'bg-green-500/5 border-green-500/20' :
                        currentStatus === 'damaged' ? 'bg-red-500/5 border-red-500/20' :
                        'bg-yellow-500/5 border-yellow-500/20'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {item.products?.name || t('vf_unknown_product')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            UUID: {item.item_uuid}
                          </p>
                          {item.products?.category && (
                            <p className="text-xs text-muted-foreground">
                              {t('vf_category', { name: item.products.category })}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant={currentStatus === 'ok' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateItemStatus(item.id, 'ok')}
                            className={`min-h-[36px] ${currentStatus === 'ok' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            OK
                          </Button>
                          <Button
                            variant={currentStatus === 'damaged' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateItemStatus(item.id, 'damaged')}
                            className={`min-h-[36px] ${currentStatus === 'damaged' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            {t('vf_damaged')}
                          </Button>
                          <Button
                            variant={currentStatus === 'missing' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateItemStatus(item.id, 'missing')}
                            className={`min-h-[36px] ${currentStatus === 'missing' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}`}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            {t('vf_missing')}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Notes field for damaged/missing items */}
                      {(currentStatus === 'damaged' || currentStatus === 'missing') && (
                        <div className="mt-3">
                          <Textarea
                            placeholder={t('vf_add_notes')}
                            value={itemStatuses[item.id]?.notes || ''}
                            onChange={(e) => updateItemNotes(item.id, e.target.value)}
                            className="bg-input border-border min-h-[60px] text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">{t('vf_no_products')}</p>
              </div>
            )}
          </Card>

          {/* Verify Button */}
          {box.product_items && box.product_items.length > 0 && !((box as any).verified_uz || box.status === 'arrived' || box.status === 'delivered' || box.location === 'uzbekistan') && (
            <Button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
              className="w-full bg-gradient-to-r from-primary to-green-500 hover:from-primary/90 hover:to-green-600 min-h-[52px] text-lg font-medium"
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {t('vf_verifying')}
                </>
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  {t('vf_verify_box')}
                </>
              )}
            </Button>
          )}

          {((box as any).verified_uz || box.status === 'arrived' || box.status === 'delivered' || box.location === 'uzbekistan') && (
            <Card className="p-4 bg-green-500/10 border-green-500/20">
              <div className="flex items-center gap-3">
                <Check className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-medium text-green-500">{t('vf_already_verified')}</p>
                  {(box as any).verified_uz_at && (
                    <p className="text-sm text-muted-foreground">
                      {new Date((box as any).verified_uz_at).toLocaleString('uz-UZ')}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
