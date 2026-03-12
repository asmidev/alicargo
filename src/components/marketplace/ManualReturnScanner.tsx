import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Trash2, Package, Tag, Save, AlertTriangle, AlertCircle, FileUp, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseDocumentForReturns } from '@/lib/documentScanner';

interface ScannedReturnItem {
  id: string; // unique temp id for UI
  product_id: string;
  variant_id: string | null;
  product_title: string;
  sku: string | null;
  image_url: string | null;
  quantity: number;
  condition: 'healthy' | 'defect';
  platform: string;
  store_id: string | null;
  store_name: string | null;
  return_type: string; // fbo_return, fbo_defect, fbs_seller, fbs_defect
  search_query: string;
  barcode?: string;
  buy_price: number | null; // For finance deduction
}

interface ManualReturnScannerProps {
  onSaved?: () => void;
}

export function ManualReturnScanner({ onSaved }: ManualReturnScannerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ScannedReturnItem[]>([]);
  const [unfoundItems, setUnfoundItems] = useState<{barcode: string, quantity: number}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [platform, setPlatform] = useState<string>('uzum');
  const [storeId, setStoreId] = useState<string>('all');
  const [orderType, setOrderType] = useState<'fbo' | 'fbs'>('fbo');
  
  const [isScanningFile, setIsScanningFile] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount and after scans
  useEffect(() => {
    searchInputRef.current?.focus();
  }, [items.length]);

  // Fetch active stores
  const { data: stores } = useQuery({
    queryKey: ['marketplace_stores', platform],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, name')
        .eq('platform', platform)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch product matches
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    try {
      const term = searchTerm.trim().toLowerCase();
      let foundProduct: any = null;
      let isVariant = false;

      // 1. Ochiq izlash: avval barcode, keyin sku yoki nom bo'yicha
      // Product variants dan qidiramiz
      const { data: qVariants } = await supabase
        .from('product_variants')
        .select(`
          id, stock_quantity, sku, image_url, cost_price, product_id,
          products (id, name, main_image_url, cost_price)
        `)
        .or(`sku.ilike.%${term}%,product_id.in.(select id from products where barcode ilike '%${term}%' or name ilike '%${term}%')`)
        .limit(5);

      if (qVariants && qVariants.length > 0) {
        // Eng aniq mos kelganini tanlaymiz (aniq SKU match >= 1)
        const exactSku = qVariants.find(v => v.sku?.toLowerCase() === term);
        foundProduct = exactSku || qVariants[0];
        isVariant = true;
      } else {
        // Products default qidiruv
        const { data: qProducts } = await supabase
          .from('products')
          .select('id, name, main_image_url, cost_price, barcode')
          .or(`barcode.ilike.%${term}%,name.ilike.%${term}%`)
          .limit(5);

        if (qProducts && qProducts.length > 0) {
          const exactBarcode = qProducts.find(p => p.barcode?.toLowerCase() === term);
          foundProduct = exactBarcode || qProducts[0];
        }
      }

      if (!foundProduct) {
        toast.error(`Mahsulot topilmadi: ${term}`);
        setSearchTerm('');
        return;
      }

      const storeName = storeId !== 'all' ? stores?.find(s => s.id === storeId)?.name : null;
      const condition = 'healthy';
      const rType = orderType === 'fbo' ? 'fbo_return' : 'fbs_seller';

      const newItem: ScannedReturnItem = {
        id: crypto.randomUUID(),
        product_id: isVariant ? foundProduct.products?.id : foundProduct.id,
        variant_id: isVariant ? foundProduct.id : null,
        product_title: (isVariant ? foundProduct.products?.name : foundProduct.name) || 'Noma\'lum',
        sku: isVariant ? foundProduct.sku : foundProduct.barcode,
        image_url: foundProduct.image_url || foundProduct.main_image_url || null,
        quantity: 1,
        condition,
        platform,
        store_id: storeId === 'all' ? null : storeId,
        store_name: storeName || null,
        return_type: rType,
        search_query: term,
        buy_price: isVariant ? (foundProduct.cost_price || foundProduct.products?.cost_price || 0) : (foundProduct.cost_price || 0)
      };

      // Qidiramiz, xuddi shu sku/product va holat bo'lsa sonini oshiramiz
      setItems(prev => {
        const existing = prev.find(p => p.variant_id === newItem.variant_id && p.product_id === newItem.product_id && p.condition === newItem.condition && p.store_id === newItem.store_id && p.return_type === newItem.return_type);
        if (existing) {
          return prev.map(p => p.id === existing.id ? { ...p, quantity: p.quantity + 1 } : p);
        }
        return [newItem, ...prev];
      });

      toast.success("Muvaffaqiyatli qo'shildi!");
      setSearchTerm('');
    } catch (err: any) {
      toast.error("Qidiruvda xatolik: " + err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    setScanProgress("Hujjat o'qilmoqda (vaqt olishi mumkin)...");
    
    try {
      setUnfoundItems([]); // clear previous unfound
      const parsedData = await parseDocumentForReturns(file, stores);
      
      // Auto-update states from OCR metadata
      let currentPlatform = platform;
      let currentOrderType = orderType;
      let currentStoreId = storeId;
      
      if (parsedData.platform && parsedData.platform !== platform) {
         setPlatform(parsedData.platform);
         currentPlatform = parsedData.platform;
         toast.success(`Platforma auto-aniqlandi: ${parsedData.platform.toUpperCase()}`);
      }
      
      if (parsedData.orderType && parsedData.orderType !== orderType) {
         setOrderType(parsedData.orderType);
         currentOrderType = parsedData.orderType;
         toast.success(`Qaytarish turi auto-aniqlandi: ${parsedData.orderType.toUpperCase()}`);
      }
      
      if (parsedData.storeId && parsedData.storeId !== storeId) {
         setStoreId(parsedData.storeId);
         currentStoreId = parsedData.storeId;
         const storeNameDetected = stores?.find(s => s.id === parsedData.storeId)?.name;
         toast.success(`Do'kon auto-aniqlandi: ${storeNameDetected}`);
      }

      if (parsedData.items.length === 0) {
        toast.error("Fayldan hech qanday mahsulot shtrix-kodi topilmadi. Fayl sifatini tekshiring.");
        // Konsolda rawText ni ko'rish mumkin
        console.log("Raw Document Text:", parsedData.rawText);
        return;
      }

      if (currentStoreId === 'all') {
        toast.warning("Fayldan do'konni aniqlab bo'lmadi! Qatorlarda do'kon saqlanmadi, iltimos do'konni tanlang.");
      }

      toast.info(`Fayldan ${parsedData.items.length} xil mahsulot shtrix-kodi topildi. Bazadan tekshirilmoqda...`);
      setScanProgress('Bazadan tekshirilmoqda...');

      let successCount = 0;
      let errorCount = 0;

      // Ensure active stores data is available
      const storeName = stores?.find(s => s.id === currentStoreId)?.name || null;
      const condition = 'healthy';
      const rType = currentOrderType === 'fbo' ? 'fbo_return' : 'fbs_seller';

      // Vaqtincha saqlab turadigan ro'yxatlar (xato bo'lmasa keyin asosiyga qo'shiladi)
      const tempFoundItems: ScannedReturnItem[] = [];
      const tempUnfoundItems: {barcode: string, quantity: number}[] = [];

      // Har bir topilgan itemni bazadan izlash
      for (const item of parsedData.items) {
        // 1. Dastlab To'g'ridan to'g'ri Variantlardan Sku orqali qidiramiz
        let { data: qVariants } = await supabase
          .from('product_variants')
          .select(`
            id, stock_quantity, sku, image_url, cost_price, product_id,
            products (id, name, main_image_url, cost_price, barcode)
          `)
          .eq('sku', item.barcode)
          .limit(1);

        // OCR Xatoliklarni e'tiborga olish (masalan 4, 6, 8 o'xshashligi)
        if (!qVariants || qVariants.length === 0) {
            // "10000485" kabi shtrix-kodni o'qilganda ichidan 4, 6 va 8 ni ajratib MySQL yovvoyi belgisi "_" ga almashtiramiz
            const fuzzySkuPattern = item.barcode.replace(/[468]/g, '_');
            const fuzzyQ = await supabase.from('product_variants').select(`id, stock_quantity, sku, image_url, cost_price, product_id, products (id, name, main_image_url, cost_price, barcode)`).like('sku', fuzzySkuPattern).limit(1);
            if (fuzzyQ.data && fuzzyQ.data.length > 0) qVariants = fuzzyQ.data;
        }

        let foundProduct: any = null;
        let isVariant = false;

        if (qVariants && qVariants.length > 0) {
          foundProduct = qVariants[0];
          isVariant = true;
        } else {
          // 2. Agar variant topilmasa, Products ni o'zidan Barcode orqali izlaymiz
          let { data: qProducts } = await supabase
            .from('products')
            .select('id, name, main_image_url, cost_price, barcode')
            .eq('barcode', item.barcode)
            .limit(1);

          if (!qProducts || qProducts.length === 0) {
             const fuzzyBPattern = item.barcode.replace(/[468]/g, '_');
             const fuzzyP = await supabase.from('products').select('id, name, main_image_url, cost_price, barcode').like('barcode', fuzzyBPattern).limit(1);
             if (fuzzyP.data && fuzzyP.data.length > 0) qProducts = fuzzyP.data;
          }

          if (qProducts && qProducts.length > 0) {
            foundProduct = qProducts[0];
          }
        }

        if (foundProduct) {
          const newItem: ScannedReturnItem = {
            barcode: item.barcode,
            id: crypto.randomUUID(), // This should be a unique ID for the scanned item, not product_id
            product_id: isVariant ? foundProduct.products?.id : foundProduct.id,
            variant_id: isVariant ? foundProduct.id : null,
            product_title: (isVariant ? foundProduct.products?.name : foundProduct.name) || "Noma'lum",
            sku: isVariant ? foundProduct.sku : foundProduct.barcode,
            image_url: isVariant ? foundProduct.image_url || foundProduct.products?.main_image_url : foundProduct.main_image_url,
            quantity: item.quantity,
            condition,
            platform: currentPlatform,
            store_id: currentStoreId === 'all' ? null : currentStoreId,
            store_name: currentStoreId === 'all' ? null : storeName,
            return_type: rType,
            search_query: item.barcode,
            buy_price: isVariant ? (foundProduct.cost_price || foundProduct.products?.cost_price || 0) : (foundProduct.cost_price || 0)
          };

          const existing = tempFoundItems.find(p => p.variant_id === newItem.variant_id && p.product_id === newItem.product_id && p.condition === newItem.condition && p.store_id === newItem.store_id && p.return_type === newItem.return_type);
          if (existing) {
            existing.quantity += newItem.quantity;
          } else {
            tempFoundItems.push(newItem);
          }
          successCount++;
        } else {
          errorCount++;
          const existing = tempUnfoundItems.find(p => p.barcode === item.barcode);
          if (existing) {
             existing.quantity += item.quantity;
          } else {
             tempUnfoundItems.push({ barcode: item.barcode, quantity: item.quantity });
          }
        }
      } // end of for loop over parsedData.items

      // QATIY QOIDA: Agar kamida 1 ta xato bo'lsa ham hech qaysini yuklamaslik
      if (errorCount > 0) {
        setUnfoundItems(tempUnfoundItems);
        toast.error(`Diqqat! Hujjatdan ${errorCount} turdagi shtrix kod bazadan topilmadi. Barcha yuklash to'xtatildi! Zaxirada ushbu tovarlar borligini tasdiqlang.`, { duration: 8000 });
      } else if (successCount > 0) {
        // Hammasi muvaffaqiyatli topshilganida qo'shamiz
        setItems(prev => {
          let newItems = [...prev];
          tempFoundItems.forEach(newItem => {
             const existing = newItems.find(p => p.variant_id === newItem.variant_id && p.product_id === newItem.product_id && p.condition === newItem.condition && p.store_id === newItem.store_id && p.return_type === newItem.return_type);
             if (existing) {
                existing.quantity += newItem.quantity;
             } else {
                newItems = [newItem, ...newItems];
             }
          });
          return newItems;
        });
        toast.success(`Hujjatdagi barcha ${successCount} turdagi mahsulot muvaffaqiyatli topildi!`);
      }
      
    } catch (err: any) {
      toast.error(`Faylni o'qishda xatolik: ${err.message}`);
    } finally {
      setIsScanningFile(false);
      setScanProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  
  const updateItemQty = (id: string, qty: number) => {
    if (qty < 1) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const updateItemCondition = (id: string, condition: 'healthy' | 'defect') => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const baseType = i.return_type.startsWith('fbo') ? 'fbo' : 'fbs';
      const newType = baseType === 'fbo' 
        ? (condition === 'healthy' ? 'fbo_return' : 'fbo_defect')
        : (condition === 'healthy' ? 'fbs_seller' : 'fbs_defect');
      return { ...i, condition, return_type: newType };
    }));
  };

  // Saqlash Mantiqi
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (items.length === 0) return;

      const dateStr = new Date().toISOString();
      const nakladnoyId = `MN-${Date.now().toString().slice(-6)}`;
      
      let healthyCount = 0;
      let defectCount = 0;
      let totalFinanceDeduction = 0;

      for (const item of items) {
        // 1. marketplace_returns ga qo'shish
        const { error: mrErr } = await supabase.from('marketplace_returns').insert({
          store_id: item.store_id,
          store_name: item.store_name,
          platform: item.platform,
          product_title: item.product_title,
          sku_title: item.sku,
          image_url: item.image_url,
          quantity: item.quantity,
          return_type: item.return_type,
          return_date: dateStr,
          resolution: item.condition === 'healthy' ? 'resolved' : 'pending', // yaroqli bo'lsa avtom. hal etildi
          resolution_note: 'Manual Scanner orqali qabul qilindi',
          resolved_by: item.condition === 'healthy' ? user?.id : null,
          resolved_at: item.condition === 'healthy' ? dateStr : null,
          nakladnoy_id: nakladnoyId,
          external_order_id: `manual-${item.id}`
        });
        if (mrErr) throw mrErr;

        // 2. Ombor zaxirasiga qo'shish (Faqat yaroqli bo'lsa!)
        if (item.condition === 'healthy') {
           healthyCount += item.quantity;
           if (item.variant_id) {
             const { data: vParams } = await supabase.from('product_variants').select('stock_quantity, product_id').eq('id', item.variant_id).single();
             if (vParams) {
               await supabase.from('product_variants').update({ stock_quantity: (vParams.stock_quantity || 0) + item.quantity }).eq('id', item.variant_id);
               // Asosiy tovarni ham sinxronizatsiya qilamiz
               const { data: allVars } = await supabase.from('product_variants').select('stock_quantity').eq('product_id', vParams.product_id);
               const toTst = allVars?.reduce((a,b) => a + (b.stock_quantity||0), 0);
               
               // RPC orqali yoki faqat service role ruxsat bergan bo'lishi mumkin tashkent_manual_stock ni o'zgartirish, error bersa ignore qilamiz sababi muhimmas vizual
               const { error: pErr } = await supabase.from('products').update({ tashkent_manual_stock: toTst }).eq('id', vParams.product_id);
               if (pErr) console.warn("403 RLS qismi (Product ombor yangilash) chetlab o'tildi: " + pErr.message);
             }
           } else if (item.product_id) {
             const { data: pParams } = await supabase.from('products').select('tashkent_manual_stock').eq('id', item.product_id).single();
             if (pParams) {
               const { error: pErr } = await supabase.from('products').update({ tashkent_manual_stock: (pParams.tashkent_manual_stock || 0) + item.quantity }).eq('id', item.product_id);
               if (pErr) console.warn("403 RLS qismi (Product ombor yangilash) chetlab o'tildi: " + pErr.message);
             }
           }
        } else {
           defectCount += item.quantity;
        }

        // 3. Moliyadan foydani qisqartirish (Tovarning tannarxi hajmida foydadan voz kechiladi yoxud expense yoziladi)
        // Yoki jami chegirmani umumlashtirib bitta expense qilib yozamiz
        const itemFinance = (item.buy_price || 0) * item.quantity;
        totalFinanceDeduction += itemFinance;
      }

      // 4. Moliya tranzaksiyasi
      if (totalFinanceDeduction > 0) {
        // Vozvrat - zarar/chiqim sifatida xarajatlarga yoziladi
        const { error: txErr } = await supabase.from('finance_transactions').insert({
          transaction_type: 'expense',
          category: 'Marketplace Vozvrat',
          amount: totalFinanceDeduction,
          currency: 'UZS', // Defaulting to UZS as typical for deductions here
          description: `Qo'lda kiritilgan vozvrat (#${nakladnoyId}): ${healthyCount} ta sog'lom, ${defectCount} ta brak. P/e: foydadan chegirildi.`,
          created_at: dateStr,
          created_by: user?.id,
          marketplace_store_id: items[0].store_id, // assumes batch is generally for same store
          reference_type: 'manual_return_scanner',
          // reference_id ni null qilib ketamiz uuid talab qilsa, chunki MN format string
        });
        if (txErr) console.error("Moliyani yozishda xato: ", txErr);
      }

      return { healthyCount, defectCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_returns'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory-overview'] });
      queryClient.invalidateQueries({ queryKey: ['marketplaces'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
      toast.success(`Muvaffaqiyatli saqlandi! \nSog'lom (Omborga qaytdi): ${data?.healthyCount}\nBrak: ${data?.defectCount}`, { duration: 5000 });
      setItems([]);
      if (onSaved) onSaved();
    },
    onError: (err: any) => {
      toast.error(`Saqlashda xatolik: ${err.message}`);
    }
  });

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg">Skaner orqali Vozvrat Qabul Qilish</CardTitle>
        <CardDescription>
          Mahsulotlarni skanerlang (shtrix kod) yoki yarating. Yaroqli mahsulotlar omborga qaytadi, moliya avtomatik hisoblanadi.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="px-0 space-y-4">
        {/* Scanner Form */}
        <form onSubmit={handleScan} className="flex gap-2 relative">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Shtrix kod yoki mahsulot nomi (Scanner ishlatish mumkin)..."
              className="pl-9 h-12 text-base"
            />
          </div>
          <Button type="button" variant="outline" size="lg" className="h-12 px-4 shrink-0 border-dashed border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors gap-2" onClick={() => fileInputRef.current?.click()} disabled={isScanningFile} title="Hujjatdan avtomatik skanerlash">
            {isScanningFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
            <span className="hidden sm:inline-block">Faylni o'qish</span>
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*,application/pdf"
            onChange={handleFileUpload}
          />
          <Button type="submit" size="lg" className="h-12 w-12 p-0 shrink-0" disabled={!searchTerm.trim() || isScanningFile}>
            <Plus className="h-5 w-5" />
          </Button>
        </form>

        {isScanningFile && scanProgress && (
          <div className="text-sm font-medium text-primary animate-pulse flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {scanProgress}
          </div>
        )}

        {unfoundItems.length > 0 && (
          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 relative">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500" />
            <AlertDescription className="pr-8">
              <span className="font-semibold block mb-1">Quyidagi {unfoundItems.length} xil bazadan topilmadi (Yaratilmagan bo'lishi mumkin):</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {unfoundItems.map((ui, idx) => (
                  <Badge key={idx} variant="outline" className="border-red-300 bg-white dark:bg-red-950 text-red-700 font-mono text-xs">
                    {ui.barcode} {"\u00D7"} {ui.quantity}
                  </Badge>
                ))}
              </div>
            </AlertDescription>
            <Button 
              size="sm" 
              variant="ghost" 
              className="absolute right-2 top-2 h-6 w-6 p-0 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-full" 
              onClick={() => setUnfoundItems([])}
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        )}

        {/* Scan List */}
        {items.length > 0 && (
          <div className="border rounded-md mt-4 overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead className="w-[140px]">Holati (Sifat)</TableHead>
                  <TableHead className="w-[120px] text-center">Soni</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id} className={cn(item.condition === 'defect' && "bg-red-50/50 dark:bg-red-950/20")}>
                    <TableCell>
                      {item.image_url ? (
                        <img src={item.image_url.startsWith('http') ? item.image_url : `https://images.uzum.uz/${item.image_url}`} alt="" className="w-10 h-10 rounded-md object-cover border" />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border">
                          <Package className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm line-clamp-2">{item.product_title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {item.sku && <Badge variant="outline" className="text-[10px]"><Tag className="w-3 h-3 mr-1"/>{item.sku}</Badge>}
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold text-muted-foreground">{item.platform}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={item.condition} onValueChange={(v: 'healthy'|'defect') => updateItemCondition(item.id, v)}>
                        <SelectTrigger className={cn("h-8 text-xs font-semibold border-0", item.condition==='healthy' ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 focus:ring-green-500" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 focus:ring-red-500")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="healthy" className="font-semibold text-green-600">Yaroqli</SelectItem>
                          <SelectItem value="defect" className="font-semibold text-red-600">Brak (Yaroqsiz)</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0 rounded-full" onClick={(e) => { e.preventDefault(); updateItemQty(item.id, item.quantity - 1);}}>-</Button>
                        <Input 
                          type="number" 
                          min={1} 
                          value={item.quantity} 
                          onChange={(e) => updateItemQty(item.id, parseInt(e.target.value)||1)} 
                          className="w-14 h-8 text-center text-sm px-1 font-semibold"
                        />
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0 rounded-full" onClick={(e) => { e.preventDefault(); updateItemQty(item.id, item.quantity + 1);}}>+</Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0 shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Footer Actions */}
        {items.length > 0 && (
          <div className="pt-4 flex items-center justify-between border-t mt-4">
            <div className="text-sm">
              <span className="text-muted-foreground mr-2">Jami turlar:</span>
              <span className="font-bold text-lg">{items.length}</span>
              <span className="text-muted-foreground mx-3">|</span>
              <span className="text-muted-foreground mr-2">Jami tovarlar:</span>
              <span className="font-bold text-lg">{items.reduce((acc, curr) => acc + curr.quantity, 0)}</span>
            </div>
            <Button 
              size="lg" 
              className="gap-2 font-semibold bg-primary hover:bg-primary/90"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Search className="animate-spin h-4 w-4" /> : <Save className="h-5 w-5" />}
              {saveMutation.isPending ? 'Saqlanmoqda...' : 'Bazaga Saqlash'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
