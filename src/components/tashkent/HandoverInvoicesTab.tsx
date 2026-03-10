import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Upload, ChevronDown, ChevronRight, CheckCircle2, XCircle, Search, Loader2, Trash2, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { parsePdfText, parseInvoiceData, type ParsedInvoice } from '@/lib/pdfInvoiceParser';

export function HandoverInvoicesTab() {
  const queryClient = useQueryClient();
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedInvoice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [undoConfirmId, setUndoConfirmId] = useState<string | null>(null);

  // Fetch existing invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['handover-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('handover_invoices' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch orders for expanded invoice
  const { data: expandedOrders = [] } = useQuery({
    queryKey: ['handover-invoice-orders', expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data, error } = await supabase
        .from('handover_invoice_orders' as any)
        .select('*')
        .eq('handover_invoice_id', expandedId)
        .order('accepted', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!expandedId,
  });

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({ title: 'Faqat PDF fayl yuklang', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setParsing(true);
    try {
      const text = await parsePdfText(file);
      console.log('[Nakladnoy PDF text FULL]:', text.substring(0, 3000));
      console.log('[Nakladnoy PDF text] ASL test:', /ASL/i.test(text), 'A S L test:', /A\s*S\s*L/i.test(text));
      const parsed = parseInvoiceData(text);
      setParsedData(parsed);
      if (!parsed.invoiceNumber) {
        toast({ title: 'Nakladnoy raqami topilmadi', description: 'PDF formatini tekshiring', variant: 'destructive' });
      }
    } catch (err) {
      console.error('PDF parsing error:', err);
      toast({ title: 'PDF o\'qishda xatolik', variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!parsedData || !selectedFile) throw new Error('No data');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload PDF to storage
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('handover-invoices')
        .upload(fileName, selectedFile);
      
      let pdfUrl: string | null = null;
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('handover-invoices')
          .getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
      }

      // Parse date
      let invoiceDate: string | null = null;
      if (parsedData.invoiceDate) {
        const [dd, mm, yyyy] = parsedData.invoiceDate.split('.');
        if (dd && mm && yyyy) {
          invoiceDate = `${yyyy}-${mm}-${dd}T00:00:00+05:00`;
        }
      }

      const totalOrders = parsedData.isProductReceipt 
        ? parsedData.productItems.reduce((s, i) => s + i.quantity, 0)
        : parsedData.acceptedOrders.length + parsedData.notAcceptedOrders.length;

      // Insert invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('handover_invoices' as any)
        .insert({
          invoice_number: parsedData.invoiceNumber || 'Noma\'lum',
          sender_name: parsedData.senderName || null,
          pickup_point: parsedData.pickupPoint || null,
          invoice_date: invoiceDate,
          total_orders: totalOrders,
          not_accepted_count: parsedData.notAcceptedOrders.length,
          pdf_url: pdfUrl,
          uploaded_by: user.id,
        } as any)
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;

      // Insert orders
      const allOrders = [
        ...parsedData.acceptedOrders.map(o => ({ 
          handover_invoice_id: (invoice as any).id, 
          order_number: o, 
          accepted: true 
        })),
        ...parsedData.notAcceptedOrders.map(o => ({ 
          handover_invoice_id: (invoice as any).id, 
          order_number: o, 
          accepted: false 
        })),
      ];

      if (allOrders.length > 0) {
        const { error: ordersError } = await supabase
          .from('handover_invoice_orders' as any)
          .insert(allOrders as any);
        if (ordersError) throw ordersError;
      }

      // === STOCK DEDUCTION LOGIC ===
      let matchedCount = 0;
      const unmatchedOrders: string[] = [];

      if (parsedData.isProductReceipt && parsedData.productItems.length > 0) {
        // "Приём товаров" — smart artikul-based stock deduction
        // Barcha ASL SKU'larni bazadan olish (normallashtirib solishtirish uchun)
        const { data: allSkuMappings } = await supabase
          .from('variant_sku_mappings')
          .select('external_sku, variant_id, product_variants!inner(id, product_id)')
          .ilike('external_sku', 'ASL%');

        console.log('[SKU Matching] DB SKUs count:', allSkuMappings?.length);

        // Normallashtirish: bo'shliqlarni olib tashlash, uppercase
        const normalize = (s: string) => s.replace(/\s+/g, '').toUpperCase();

        // SKU map: normalized -> mapping
        const skuMap = new Map<string, { variantId: string; productId: string }>();
        for (const mp of (allSkuMappings as any[] || [])) {
          const entry = { variantId: mp.variant_id, productId: mp.product_variants?.product_id };
          skuMap.set(normalize(mp.external_sku), entry);
        }

        // Smart matching: aniq mos kelish + prefix matching
        function findMapping(artikul: string) {
          const norm = normalize(artikul);
          // 1. Aniq mos kelish
          if (skuMap.has(norm)) return skuMap.get(norm)!;
          // 2. Prefix matching — eng uzun mos keluvchi SKU
          let bestMatch: { variantId: string; productId: string } | null = null;
          let bestLen = 0;
          for (const [dbNorm, entry] of skuMap) {
            if (norm.startsWith(dbNorm) && dbNorm.length > bestLen) {
              bestMatch = entry; bestLen = dbNorm.length;
            }
            if (dbNorm.startsWith(norm) && norm.length > bestLen) {
              bestMatch = entry; bestLen = norm.length;
            }
          }
          return bestMatch;
        }

        for (const item of parsedData.productItems) {
          const mapping = findMapping(item.artikul);
          console.log('[SKU Match]', item.artikul, '->', mapping ? 'FOUND' : 'NOT FOUND');
          if (mapping?.productId) {
            const { error: rpcError } = await supabase.rpc('decrement_tashkent_stock', {
              p_product_id: mapping.productId,
              p_quantity: item.quantity,
              p_variant_id: mapping.variantId || null,
            });
            if (!rpcError) {
              matchedCount += item.quantity;
            } else {
              console.warn('Stock decrement error for artikul:', item.artikul, rpcError);
            }
          } else {
            unmatchedOrders.push(item.artikul);
          }
        }
      } else if (parsedData.acceptedOrders.length > 0) {
        // Standard handover — order-based stock deduction
        const { data: marketplaceOrders } = await supabase
          .from('marketplace_orders')
          .select('id, external_order_id, items')
          .in('external_order_id', parsedData.acceptedOrders);

        if (marketplaceOrders && marketplaceOrders.length > 0) {
          const skuQuantityMap: Record<string, number> = {};
          const foundOrderIds = new Set(marketplaceOrders.map(o => o.external_order_id));

          for (const order of marketplaceOrders) {
            try {
              const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
              if (Array.isArray(items)) {
                for (const item of items) {
                  const sku = item.skuTitle || item.offerId || '';
                  const qty = item.quantity || 1;
                  if (sku) {
                    skuQuantityMap[sku] = (skuQuantityMap[sku] || 0) + qty;
                  }
                }
              }
            } catch (e) {
              console.warn('Failed to parse items for order:', order.external_order_id, e);
            }
          }

          for (const orderNum of parsedData.acceptedOrders) {
            if (!foundOrderIds.has(orderNum)) {
              unmatchedOrders.push(orderNum);
            }
          }

          const allSkus = Object.keys(skuQuantityMap);
          if (allSkus.length > 0) {
            const { data: skuMappings } = await supabase
              .from('variant_sku_mappings')
              .select('external_sku, variant_id, product_variants!inner(id, product_id)')
              .in('external_sku', allSkus);

            if (skuMappings && skuMappings.length > 0) {
              for (const mapping of skuMappings as any[]) {
                const qty = skuQuantityMap[mapping.external_sku] || 0;
                const productId = mapping.product_variants?.product_id;
                if (qty > 0 && productId) {
                  const { error: rpcError } = await supabase.rpc('decrement_tashkent_stock', {
                    p_product_id: productId,
                    p_quantity: qty,
                    p_variant_id: mapping.variant_id || null,
                  });
                  if (!rpcError) {
                    matchedCount += qty;
                  } else {
                    console.warn('Stock decrement error for SKU:', mapping.external_sku, rpcError);
                  }
                }
              }
            }
          }
        } else {
          unmatchedOrders.push(...parsedData.acceptedOrders);
        }
      }

      // Update invoice with stock deduction status
      await supabase
        .from('handover_invoices' as any)
        .update({
          stock_deducted: matchedCount > 0,
          stock_deducted_at: matchedCount > 0 ? new Date().toISOString() : null,
          matched_items_count: matchedCount,
        } as any)
        .eq('id', (invoice as any).id);

      return { invoice, matchedCount, unmatchedOrders };
    },
    onSuccess: (result) => {
      const { matchedCount, unmatchedOrders } = result || {};
      if (matchedCount && matchedCount > 0) {
        toast({ title: `Saqlandi! ${matchedCount} ta tovar zaxiradan kamaytirildi ✅` });
      } else {
        toast({ title: 'Nakladnoy saqlandi!' });
      }
      if (unmatchedOrders && unmatchedOrders.length > 0) {
        toast({
          title: `${unmatchedOrders.length} ta topilmadi`,
          description: `${unmatchedOrders.slice(0, 5).join(', ')}${unmatchedOrders.length > 5 ? '...' : ''}`,
          variant: 'destructive',
        });
      }
      setParsedData(null);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['handover-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      console.error('Save error:', err);
      toast({ title: 'Saqlashda xatolik', description: err.message, variant: 'destructive' });
    },
  });

  // === UNDO STOCK DEDUCTION ===
  const undoStockMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      // Get the invoice's PDF URL to re-parse
      const { data: inv } = await supabase
        .from('handover_invoices' as any)
        .select('*')
        .eq('id', invoiceId)
        .single();
      if (!inv) throw new Error('Invoice not found');
      const invoice = inv as any;
      if (!invoice.stock_deducted) throw new Error('Stock was not deducted');

      // Get orders associated with this invoice
      const { data: orders } = await supabase
        .from('handover_invoice_orders' as any)
        .select('*')
        .eq('handover_invoice_id', invoiceId);

      // Try PDF-based restore if it was a product receipt (matched_items_count > 0 and has pdf_url)
      let restoredCount = 0;

      if (invoice.pdf_url) {
        try {
          const response = await fetch(invoice.pdf_url);
          const blob = await response.blob();
          const file = new File([blob], 'invoice.pdf', { type: 'application/pdf' });
          const text = await parsePdfText(file);
          const parsed = parseInvoiceData(text);

          if (parsed.isProductReceipt && parsed.productItems.length > 0) {
            // Re-do SKU matching and INCREMENT instead of decrement
            const { data: allSkuMappings } = await supabase
              .from('variant_sku_mappings')
              .select('external_sku, variant_id, product_variants!inner(id, product_id)')
              .ilike('external_sku', 'ASL%');

            const normalize = (s: string) => s.replace(/\s+/g, '').toUpperCase();
            const skuMap = new Map<string, { variantId: string; productId: string }>();
            for (const mp of (allSkuMappings as any[] || [])) {
              skuMap.set(normalize(mp.external_sku), {
                variantId: mp.variant_id,
                productId: (mp as any).product_variants?.product_id,
              });
            }

            function findMapping(artikul: string) {
              const norm = normalize(artikul);
              if (skuMap.has(norm)) return skuMap.get(norm)!;
              let bestMatch: { variantId: string; productId: string } | null = null;
              let bestLen = 0;
              for (const [dbNorm, entry] of skuMap) {
                if (norm.startsWith(dbNorm) && dbNorm.length > bestLen) { bestMatch = entry; bestLen = dbNorm.length; }
                if (dbNorm.startsWith(norm) && norm.length > bestLen) { bestMatch = entry; bestLen = norm.length; }
              }
              return bestMatch;
            }

            for (const item of parsed.productItems) {
              const mapping = findMapping(item.artikul);
              if (mapping?.productId) {
                const { error } = await supabase.rpc('increment_tashkent_stock', {
                  p_product_id: mapping.productId,
                  p_quantity: item.quantity,
                  p_variant_id: mapping.variantId || null,
                });
                if (!error) restoredCount += item.quantity;
              }
            }
          } else if (parsed.acceptedOrders.length > 0) {
            // Order-based restore
            const { data: marketplaceOrders } = await supabase
              .from('marketplace_orders')
              .select('id, external_order_id, items')
              .in('external_order_id', parsed.acceptedOrders);

            if (marketplaceOrders && marketplaceOrders.length > 0) {
              const skuQuantityMap: Record<string, number> = {};
              for (const order of marketplaceOrders) {
                try {
                  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                  if (Array.isArray(items)) {
                    for (const item of items) {
                      const sku = item.skuTitle || item.offerId || '';
                      const qty = item.quantity || 1;
                      if (sku) skuQuantityMap[sku] = (skuQuantityMap[sku] || 0) + qty;
                    }
                  }
                } catch (e) { /* skip */ }
              }

              const allSkus = Object.keys(skuQuantityMap);
              if (allSkus.length > 0) {
                const { data: skuMappings } = await supabase
                  .from('variant_sku_mappings')
                  .select('external_sku, variant_id, product_variants!inner(id, product_id)')
                  .in('external_sku', allSkus);

                for (const mapping of (skuMappings as any[] || [])) {
                  const qty = skuQuantityMap[mapping.external_sku] || 0;
                  const productId = mapping.product_variants?.product_id;
                  if (qty > 0 && productId) {
                    const { error } = await supabase.rpc('increment_tashkent_stock', {
                      p_product_id: productId,
                      p_quantity: qty,
                      p_variant_id: mapping.variant_id || null,
                    });
                    if (!error) restoredCount += qty;
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('PDF re-parse error for undo:', err);
          throw new Error('PDF qayta tahlil qilishda xatolik');
        }
      }

      // Update invoice: mark stock as not deducted
      await supabase
        .from('handover_invoices' as any)
        .update({
          stock_deducted: false,
          stock_deducted_at: null,
          matched_items_count: 0,
        } as any)
        .eq('id', invoiceId);

      return restoredCount;
    },
    onSuccess: (restoredCount) => {
      toast({ title: `Zaxira tiklandi! ${restoredCount} ta birlik qaytarildi ✅` });
      setUndoConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['handover-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      console.error('Undo error:', err);
      toast({ title: 'Zaxirani tiklashda xatolik', description: err.message, variant: 'destructive' });
      setUndoConfirmId(null);
    },
  });

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const filteredInvoices = invoices.filter((inv: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.sender_name?.toLowerCase().includes(term) ||
      inv.pickup_point?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Nakladnoy yuklash
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!parsedData ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onClick={() => document.getElementById('pdf-input')?.click()}
            >
              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">PDF tahlil qilinmoqda...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground">PDF faylni shu yerga tashlang yoki bosing</p>
                  <p className="text-xs text-muted-foreground">Faqat Uzum nakladnoy PDF fayllari</p>
                </div>
              )}
              <input
                id="pdf-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Tahlil natijalari</h3>
                <Button variant="ghost" size="sm" onClick={() => { setParsedData(null); setSelectedFile(null); }}>
                  <Trash2 className="h-4 w-4 mr-1" /> Bekor qilish
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Nakladnoy raqami</p>
                  <p className="font-semibold text-foreground">{parsedData.invoiceNumber || '—'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Sana</p>
                  <p className="font-semibold text-foreground">{parsedData.invoiceDate || '—'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Jo'natuvchi</p>
                  <p className="font-semibold text-foreground">{parsedData.senderName || '—'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Qabul punkti</p>
                  <p className="font-semibold text-foreground">{parsedData.pickupPoint || '—'}</p>
                </div>
              </div>

              {parsedData.isProductReceipt ? (
                <>
                  <div className="flex items-center gap-4">
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Tovarlar: {parsedData.productItems.length}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Jami: {parsedData.productItems.reduce((s, i) => s + i.quantity, 0)} dona
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-3">
                    <div className="space-y-1">
                      {parsedData.productItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="font-mono text-foreground">{item.artikul}</span>
                          <Badge variant="outline" className="text-xs">{item.quantity} dona</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Qabul: {parsedData.acceptedOrders.length}
                    </Badge>
                    {parsedData.notAcceptedOrders.length > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Rad: {parsedData.notAcceptedOrders.length}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      Jami: {parsedData.acceptedOrders.length + parsedData.notAcceptedOrders.length} ta buyurtma
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-3">
                    <div className="flex flex-wrap gap-2">
                      {parsedData.acceptedOrders.map(o => (
                        <Badge key={o} variant="outline" className="text-xs">{o}</Badge>
                      ))}
                      {parsedData.notAcceptedOrders.map(o => (
                        <Badge key={o} variant="destructive" className="text-xs">{o}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saqlanmoqda va zaxira kamaytirilmoqda...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Saqlash va zaxirani kamaytirish</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Nakladnoy raqami yoki jo'natuvchi bo'yicha qidirish..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* History */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Yuklangan nakladnoylar ({filteredInvoices.length})
        </h3>

        {isLoading ? (
          <Card className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </Card>
        ) : filteredInvoices.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">Hali nakladnoy yuklanmagan</p>
          </Card>
        ) : (
          filteredInvoices.map((inv: any) => (
            <Collapsible 
              key={inv.id} 
              open={expandedId === inv.id}
              onOpenChange={(open) => setExpandedId(open ? inv.id : null)}
            >
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full">
                  <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 text-left">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="font-semibold text-foreground">№{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.sender_name && `${inv.sender_name} • `}
                          {inv.invoice_date ? format(new Date(inv.invoice_date), 'dd.MM.yyyy') : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {inv.stock_deducted && (
                        <Badge variant="outline" className="gap-1 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Zaxira: -{inv.matched_items_count || 0}
                        </Badge>
                      )}
                      <Badge variant="default" className="gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        {(inv.total_orders || 0) - (inv.not_accepted_count || 0)}
                      </Badge>
                      {(inv.not_accepted_count || 0) > 0 && (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <XCircle className="h-3 w-3" />
                          {inv.not_accepted_count}
                        </Badge>
                      )}
                      {expandedId === inv.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 border-t pt-3">
                    {inv.pickup_point && (
                      <p className="text-xs text-muted-foreground mb-2">📍 {inv.pickup_point}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {expandedOrders.map((order: any) => (
                        <Badge 
                          key={order.id} 
                          variant={order.accepted ? 'outline' : 'destructive'} 
                          className="text-xs"
                        >
                          {order.order_number}
                        </Badge>
                      ))}
                    </div>
                    {inv.stock_deducted && (
                      <div className="mt-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setUndoConfirmId(inv.id); }}
                          disabled={undoStockMutation.isPending}
                          className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Zaxirani qaytarish ({inv.matched_items_count || 0} birlik)
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!undoConfirmId}
        onOpenChange={(open) => !open && setUndoConfirmId(null)}
        title="Zaxirani qaytarishni tasdiqlang"
        description="Bu nakladnoydagi barcha kamaytirilgan zaxira miqdorlari qaytariladi. Davom etasizmi?"
        confirmText="Ha, qaytarish"
        cancelText="Bekor qilish"
        variant="destructive"
        isLoading={undoStockMutation.isPending}
        onConfirm={() => undoConfirmId && undoStockMutation.mutate(undoConfirmId)}
      />
    </div>
  );
}
