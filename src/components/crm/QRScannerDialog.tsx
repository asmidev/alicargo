import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Camera, 
  X, 
  Search, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Flashlight,
  FlashlightOff,
  ZoomIn,
  ZoomOut,
  History
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Html5Qrcode } from 'html5-qrcode';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QRScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBoxFound: (box: any) => void;
}

interface ScanHistoryItem {
  boxId: string;
  boxNumber: string;
  scannedAt: Date;
}

export function QRScannerDialog({ open, onOpenChange, onBoxFound }: QRScannerDialogProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { triggerHaptic } = useNativeFeatures();
  const [scanning, setScanning] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [cameraError, setCameraError] = useState<{ title: string; detail: string } | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Load scan history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('qr-scan-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setScanHistory(parsed.map((item: any) => ({
          ...item,
          scannedAt: new Date(item.scannedAt)
        })));
      } catch (e) {
        console.error('Failed to parse scan history', e);
      }
    }
  }, []);

  // Save scan to history
  const addToHistory = (boxId: string, boxNumber: string) => {
    const newItem: ScanHistoryItem = {
      boxId,
      boxNumber,
      scannedAt: new Date()
    };
    const newHistory = [newItem, ...scanHistory.filter(h => h.boxId !== boxId)].slice(0, 10);
    setScanHistory(newHistory);
    localStorage.setItem('qr-scan-history', JSON.stringify(newHistory));
  };

  // Start QR scanner
  const startScanner = async () => {
    try {
      setCameraError(null);
      setScanning(true);
      setScanSuccess(false);
      
      const config: any = {
        fps: 10,
        qrbox: isMobile ? { width: 280, height: 280 } : { width: 250, height: 250 },
      };

      const html5QrCode = new Html5Qrcode('qr-reader-dialog');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        async (decodedText) => {
          // QR code contains only the box ID (UUID format)
          let extractedBoxId = decodedText.trim();
          
          // Legacy support
          if (decodedText.includes('/verify/')) {
            extractedBoxId = decodedText.split('/verify/').pop() || '';
          } else if (decodedText.startsWith('{')) {
            try {
              const parsed = JSON.parse(decodedText);
              extractedBoxId = parsed.id || '';
            } catch {
              // Use as-is
            }
          }
          
          await stopScanner();
          await triggerHaptic('heavy');
          setScanSuccess(true);
          
          setTimeout(() => {
            findBoxById(extractedBoxId);
          }, 500);
        },
        () => {} // Ignore errors during scanning
      );
    } catch (err: any) {
      console.error('Scanner error:', err);
      setScanning(false);
      
      let errorTitle = 'Kamerani ishga tushirishda xatolik';
      let errorDetail = 'Iltimos, qayta urinib ko\'ring';
      
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        errorTitle = 'Kamera ruxsati berilmagan';
        errorDetail = 'Brauzer sozlamalaridan kamera ruxsatini yoqing';
      } else if (err.name === 'NotFoundError') {
        errorTitle = 'Kamera topilmadi';
        errorDetail = 'Qurilmangizda kamera mavjud ekanligini tekshiring';
      } else if (err.name === 'NotReadableError') {
        errorTitle = 'Kamera band';
        errorDetail = 'Boshqa ilovalarni yoping';
      }
      
      setCameraError({ title: errorTitle, detail: errorDetail });
      toast({
        title: errorTitle,
        description: errorDetail,
        variant: 'destructive',
      });
    }
  };

  // Toggle torch
  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const newState = !torchEnabled;
      // Note: torch control requires specific browser/device support
      setTorchEnabled(newState);
      await triggerHaptic('light');
    } catch (e) {
      console.error('Torch not supported', e);
    }
  };

  // Adjust zoom
  const adjustZoom = async (delta: number) => {
    const newZoom = Math.max(1, Math.min(4, zoomLevel + delta));
    setZoomLevel(newZoom);
    await triggerHaptic('light');
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
    setTorchEnabled(false);
  };

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      stopScanner();
      setSearchInput('');
      setCameraError(null);
      setScanSuccess(false);
      setShowHistory(false);
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Find box by ID and auto-arrive if in transit
  const findBoxById = async (boxId: string) => {
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('boxes')
        .select('*, product_items(id, item_uuid, status, notes, products(name, uuid, category))')
        .eq('id', boxId)
        .maybeSingle();

      if (error || !data) {
        setScanSuccess(false);
        await triggerHaptic('heavy');
        toast({
          title: 'Quti topilmadi',
          description: 'QR kod yaroqsiz yoki quti mavjud emas',
          variant: 'destructive',
        });
        return;
      }

      // AUTO-ARRIVAL: If box is in_transit, automatically mark as arrived
      if (data.status === 'in_transit') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: result } = await supabase.rpc('mark_box_arrived_on_scan', {
              p_box_id: boxId,
              p_user_id: user.id
            });
            
            const resultObj = result as { auto_arrived?: boolean; box_number?: string } | null;
            if (resultObj?.auto_arrived) {
              await triggerHaptic('heavy');
              toast({
                title: '✅ Quti avtomatik yetib keldi!',
                description: `${data.box_number} "Yetib keldi" deb belgilandi`,
              });
              // Refresh the box data with new status
              const { data: updatedBox } = await supabase
                .from('boxes')
                .select('*, product_items(id, item_uuid, status, notes, products(name, uuid, category))')
                .eq('id', boxId)
                .single();
              if (updatedBox) {
                addToHistory(updatedBox.id, updatedBox.box_number);
                onBoxFound(updatedBox);
                onOpenChange(false);
                return;
              }
            }
          }
        } catch (autoArriveError) {
          console.error('Auto-arrival error:', autoArriveError);
          // Continue with normal flow even if auto-arrive fails
        }
      }

      addToHistory(data.id, data.box_number);
      onBoxFound(data);
      onOpenChange(false);
    } catch (err) {
      setScanSuccess(false);
      toast({
        title: 'Xato',
        description: 'Qutini qidirishda xatolik',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  // Search for box by number
  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setSearching(true);

    try {
      const { data, error } = await supabase
        .from('boxes')
        .select('*, product_items(id, item_uuid, status, notes, products(name, uuid, category))')
        .or(`box_number.ilike.%${searchInput}%,id.eq.${searchInput}`)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        toast({
          title: 'Quti topilmadi',
          description: 'Iltimos, to\'g\'ri quti raqamini kiriting',
          variant: 'destructive',
        });
        return;
      }

      addToHistory(data.id, data.box_number);
      onBoxFound(data);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Xato',
        description: 'Qutini qidirishda xatolik',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  // Handle history item click
  const handleHistoryClick = async (item: ScanHistoryItem) => {
    setShowHistory(false);
    await findBoxById(item.boxId);
  };

  // Mobile full-screen layout
  if (isMobile && open) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] p-0">
          <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <SheetHeader className="px-4 py-3 border-b shrink-0">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  QR Skanerlash
                </SheetTitle>
                <div className="flex items-center gap-2">
                  {scanHistory.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setShowHistory(!showHistory)}
                    >
                      <History className="h-5 w-5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {showHistory ? (
                <ScrollArea className="flex-1 p-4">
                  <h3 className="font-medium mb-3">Oxirgi skanerlashlar</h3>
                  <div className="space-y-2">
                    {scanHistory.map((item, index) => (
                      <Button
                        key={`${item.boxId}-${index}`}
                        variant="outline"
                        className="w-full justify-start h-auto py-3 px-4"
                        onClick={() => handleHistoryClick(item)}
                      >
                        <div className="flex-1 text-left">
                          <p className="font-medium">{item.boxNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.scannedAt.toLocaleString('uz-UZ')}
                          </p>
                        </div>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              ) : scanning ? (
                <div className="flex-1 flex flex-col">
                  {/* Scanner viewport */}
                  <div className="flex-1 relative bg-black">
                    <div id="qr-reader-dialog" className="w-full h-full" />
                    
                    {/* Overlay controls */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm"
                        onClick={toggleTorch}
                      >
                        {torchEnabled ? (
                          <FlashlightOff className="h-5 w-5 text-white" />
                        ) : (
                          <Flashlight className="h-5 w-5 text-white" />
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm"
                        onClick={() => adjustZoom(-0.5)}
                      >
                        <ZoomOut className="h-5 w-5 text-white" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm"
                        onClick={() => adjustZoom(0.5)}
                      >
                        <ZoomIn className="h-5 w-5 text-white" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Stop button */}
                  <div className="p-4 shrink-0">
                    <Button
                      variant="destructive"
                      onClick={stopScanner}
                      className="w-full h-12"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Skanerlashni to'xtatish
                    </Button>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="text-center space-y-4 animate-scale-in">
                    <div className="w-24 h-24 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-12 w-12 text-green-500 animate-bounce" />
                    </div>
                    <p className="text-lg font-medium text-green-500">Quti topildi!</p>
                    {searching && (
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Yuklanmoqda...</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : cameraError ? (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="text-center space-y-4 max-w-sm">
                    <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-2xl">
                      <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                      <p className="font-medium text-destructive">{cameraError.title}</p>
                      <p className="text-sm text-muted-foreground mt-2">{cameraError.detail}</p>
                    </div>
                    <Button onClick={startScanner} className="w-full h-12 gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Qayta urinish
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <div className="w-24 h-24 mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <Camera className="h-12 w-12 text-primary" />
                  </div>
                  <p className="text-center text-muted-foreground mb-6">
                    Quti ustidagi QR kodni skanerlang
                  </p>
                  <Button onClick={startScanner} className="w-full max-w-xs h-14 gap-2 text-lg">
                    <Camera className="h-5 w-5" />
                    Skanerlash
                  </Button>
                </div>
              )}

              {/* Search section */}
              {!scanning && !scanSuccess && (
                <div className="p-4 border-t shrink-0 space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    yoki quti raqamini kiriting
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="BOX-12345..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="pl-10 h-12"
                      />
                    </div>
                    <Button
                      onClick={handleSearch}
                      disabled={searching || !searchInput.trim()}
                      className="h-12 px-6"
                    >
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Qidirish'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop dialog layout
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            QR Kod Skanerlash
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* QR Scanner */}
          {scanning ? (
            <div className="space-y-3">
              <div id="qr-reader-dialog" className="mx-auto rounded-lg overflow-hidden" />
              <Button variant="outline" onClick={stopScanner} className="w-full h-12">
                <X className="h-4 w-4 mr-2" />
                Skanerlashni to'xtatish
              </Button>
            </div>
          ) : scanSuccess ? (
            <div className="text-center space-y-4 py-6">
              <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-2xl flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-500 animate-bounce" />
              </div>
              <p className="font-medium text-green-500">Quti topildi!</p>
              {searching && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Yuklanmoqda...</span>
                </div>
              )}
            </div>
          ) : cameraError ? (
            <div className="text-center space-y-4 py-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
                <p className="font-medium text-destructive">{cameraError.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{cameraError.detail}</p>
              </div>
              <Button onClick={startScanner} variant="outline" className="w-full h-12 gap-2">
                <RefreshCw className="h-4 w-4" />
                Qayta urinish
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
                <Camera className="h-10 w-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Quti ustidagi QR kodni skanerlang
              </p>
              <Button onClick={startScanner} className="w-full h-12 gap-2">
                <Camera className="h-4 w-4" />
                Skanerlashni boshlash
              </Button>
            </div>
          )}

          {/* Divider */}
          {!scanSuccess && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">yoki</span>
              </div>
            </div>
          )}

          {/* Manual Search */}
          {!scanSuccess && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Quti raqamini qo'lda kiriting
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="BOX-12345..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 h-12"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={searching || !searchInput.trim()}
                  className="h-12"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Qidirish'}
                </Button>
              </div>
            </div>
          )}

          {/* Scan History */}
          {!scanning && !scanSuccess && scanHistory.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Oxirgi skanerlashlar</h4>
              <div className="space-y-1">
                {scanHistory.slice(0, 5).map((item, index) => (
                  <Button
                    key={`${item.boxId}-${index}`}
                    variant="ghost"
                    className="w-full justify-start h-10 px-3"
                    onClick={() => handleHistoryClick(item)}
                  >
                    <span className="truncate">{item.boxNumber}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {item.scannedAt.toLocaleDateString('uz-UZ')}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}