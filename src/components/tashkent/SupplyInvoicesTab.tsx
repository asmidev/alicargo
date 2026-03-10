import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Truck, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  Package,
  Store,
  Calendar,
  Loader2,
  Undo2,
  Upload,
  FileText,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { parsePdfText, parseInvoiceData, type ParsedInvoice } from '@/lib/pdfInvoiceParser';

interface FbsInvoice {
  id: string;
  invoice_id: string;
  store_id: string | null;
  store_name: string | null;
  platform: string | null;
  status: string | null;
  order_count: number;
  invoice_date: string | null;
  stock_deducted: boolean;
  stock_deducted_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
  created_at: string;
}

interface FbsInvoiceItem {
  id: string;
  invoice_id: string;
  external_order_id: string | null;
  product_title: string | null;
  sku_title: string | null;
  quantity: number;
  amount: number | null;
  variant_id?: string | null;
  product_id?: string | null;
  stock_quantity?: number | null;
  matched?: boolean;
}

function InvoiceCard({ invoice }: { invoice: FbsInvoice }) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch items + SKU matching when expanded
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['fbs-invoice-items', invoice.id],
    queryFn: async () => {
      const { data: rawItems, error } = await supabase
        .from('fbs_invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at');

      if (error) throw error;

      // sku_title null bo'lgan itemlar uchun marketplace_orders dan offerId olish
      const nullSkuItems = (rawItems || []).filter(i => !i.sku_title && i.external_order_id);
      const orderIdToOfferId = new Map<string, { offerId: string; title: string }>();

      if (nullSkuItems.length > 0 && invoice.store_id) {
        const orderIds = nullSkuItems.map(i => i.external_order_id!);
        const { data: orders } = await supabase
          .from('marketplace_orders')
          .select('external_order_id, items')
          .eq('store_id', invoice.store_id)
          .in('external_order_id', orderIds);

        for (const ord of orders || []) {
          const items = Array.isArray(ord.items) ? (ord.items as any[]) : [];
          const first = items[0];
          if (first?.offerId && ord.external_order_id) {
            orderIdToOfferId.set(ord.external_order_id, {
              offerId: first.offerId,
              title: first.title || first.offerName || '',
            });
          }
        }
      }

      const enrichedRaw = (rawItems || []).map(item => {
        if (!item.sku_title && item.external_order_id) {
          const orderData = orderIdToOfferId.get(item.external_order_id);
          if (orderData) {
            return { ...item, sku_title: orderData.offerId, product_title: orderData.title || item.product_title };
          }
        }
        return item;
      });

      // Aniq SKU match
      const skus = enrichedRaw.map(i => i.sku_title).filter(Boolean) as string[];
      const skuMappingMap = new Map<string, { variant_id: string; product_id: string | null; stock_quantity: number | null }>();

      if (skus.length > 0) {
        const { data: mappings } = await supabase
          .from('variant_sku_mappings')
          .select('external_sku, variant_id, product_variants(id, stock_quantity, product_id)')
          .in('external_sku', skus);

        for (const m of mappings || []) {
          if (m.variant_id && m.external_sku) {
            const variant = m.product_variants as any;
            skuMappingMap.set(m.external_sku, {
              variant_id: m.variant_id,
              product_id: variant?.product_id || null,
              stock_quantity: variant?.stock_quantity ?? null,
            });
          }
        }
      }

      // Fuzzy match
      const unmatchedSkus = skus.filter(s => !skuMappingMap.has(s));
      if (unmatchedSkus.length > 0 && invoice.store_id) {
        const { data: allStoreSkus } = await supabase
          .from('variant_sku_mappings')
          .select('external_sku, variant_id, product_variants(id, stock_quantity, product_id)')
          .eq('store_id', invoice.store_id);

        for (const sku of unmatchedSkus) {
          const skuUpper = sku.toUpperCase();
          const match = (allStoreSkus || []).find(
            m => m.external_sku && m.external_sku.toUpperCase().includes(skuUpper)
          );
          if (match && match.variant_id && match.external_sku) {
            const variant = match.product_variants as any;
            skuMappingMap.set(sku, {
              variant_id: match.variant_id,
              product_id: variant?.product_id || null,
              stock_quantity: variant?.stock_quantity ?? null,
            });
          }
        }
      }

      const enriched: FbsInvoiceItem[] = enrichedRaw.map((item) => {
        if (!item.sku_title) return { ...item, matched: false };
        const mapping = skuMappingMap.get(item.sku_title);
        if (mapping) {
          return {
            ...item,
            variant_id: mapping.variant_id,
            product_id: mapping.product_id,
            stock_quantity: mapping.stock_quantity,
            matched: true,
          };
        }
        return { ...item, matched: false };
      });

      return enriched;
    },
    enabled: expanded,
  });

  const matchedCount = items.filter(i => i.matched).length;
  const unmatchedCount = items.filter(i => !i.matched).length;

  const handleConfirm = async () => {
    if (invoice.stock_deducted) {
      toast.warning('Bu invoice allaqachon tasdiqlangan va zaxira kamaytirilgan!');
      return;
    }

    const matched = items.filter(i => i.matched && i.variant_id && i.product_id);
    if (matched.length === 0) {
      toast.error('Hech qanday mos SKU topilmadi.');
      return;
    }

    setConfirming(true);
    try {
      for (const item of matched) {
        await supabase.rpc('decrement_tashkent_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
          p_variant_id: item.variant_id,
        });
      }

      await supabase
        .from('fbs_invoices')
        .update({
          stock_deducted: true,
          stock_deducted_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      toast.success(`✅ Tasdiqlandi! ${matched.length} ta SKU zaxiradan kamaytirildi.`);
      queryClient.invalidateQueries({ queryKey: ['fbs-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fbs-invoices-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tashkent-dashboard-stats'] });
    } catch (err: any) {
      toast.error('Xatolik: ' + err.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleUndo = async () => {
    setUndoing(true);
    try {
      // Re-fetch items with matching to know what to restore
      const { data: rawItems } = await supabase
        .from('fbs_invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      const skus = (rawItems || []).map(i => i.sku_title).filter(Boolean) as string[];
      
      if (skus.length > 0) {
        const { data: mappings } = await supabase
          .from('variant_sku_mappings')
          .select('external_sku, variant_id, product_variants(id, product_id)')
          .in('external_sku', skus);

        const skuMap = new Map<string, { variant_id: string; product_id: string }>();
        for (const m of (mappings || []) as any[]) {
          if (m.variant_id && m.external_sku && m.product_variants?.product_id) {
            skuMap.set(m.external_sku, {
              variant_id: m.variant_id,
              product_id: m.product_variants.product_id,
            });
          }
        }

        let restoredCount = 0;
        for (const item of rawItems || []) {
          const mapping = item.sku_title ? skuMap.get(item.sku_title) : null;
          if (mapping) {
            const { error } = await supabase.rpc('increment_tashkent_stock', {
              p_product_id: mapping.product_id,
              p_quantity: item.quantity || 1,
              p_variant_id: mapping.variant_id,
            });
            if (!error) restoredCount++;
          }
        }

        await supabase
          .from('fbs_invoices')
          .update({
            stock_deducted: false,
            stock_deducted_at: null,
            confirmed_at: null,
          })
          .eq('id', invoice.id);

        toast.success(`Zaxira tiklandi! ${restoredCount} ta SKU qaytarildi ✅`);
      }

      queryClient.invalidateQueries({ queryKey: ['fbs-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fbs-invoices-stats'] });
      queryClient.invalidateQueries({ queryKey: ['fbs-invoice-items', invoice.id] });
      queryClient.invalidateQueries({ queryKey: ['tashkent-dashboard-stats'] });
    } catch (err: any) {
      toast.error('Xatolik: ' + err.message);
    } finally {
      setUndoing(false);
      setUndoConfirmOpen(false);
    }
  };

  const statusColor = {
    CONFIRMED: 'bg-green-500/10 text-green-600 border-green-200',
    DRAFT: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
    IN_PROGRESS: 'bg-blue-500/10 text-blue-600 border-blue-200',
    CANCELLED: 'bg-red-500/10 text-red-600 border-red-200',
  }[invoice.status || ''] || 'bg-muted text-muted-foreground border-border';

  return (
    <>
      <Card className={cn(
        'border transition-all',
        invoice.stock_deducted ? 'border-green-200 bg-green-50/30 dark:bg-green-950/10' : 'border-border bg-card'
      )}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <Truck className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-foreground text-sm">
                    Invoice #{invoice.invoice_id}
                  </span>
                  <Badge variant="outline" className={cn('text-xs border', statusColor)}>
                    {invoice.status || 'UNKNOWN'}
                  </Badge>
                  <Badge variant="outline" className={cn('text-xs border',
                    invoice.platform === 'yandex'
                      ? 'border-yellow-300 bg-yellow-500/10 text-yellow-700'
                      : invoice.notes === 'manual_pdf'
                      ? 'border-purple-300 bg-purple-500/10 text-purple-700'
                      : 'border-blue-300 bg-blue-500/10 text-blue-700'
                  )}>
                    {invoice.platform === 'yandex' ? 'Yandex' : invoice.notes === 'manual_pdf' ? '📄 PDF' : 'Uzum'}
                  </Badge>
                  {invoice.stock_deducted && (
                    <Badge variant="outline" className="text-xs border-green-300 bg-green-500/10 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Tasdiqlangan
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Store className="h-3 w-3" />
                    {invoice.store_name || 'Nomalum'}
                  </span>
                  {invoice.invoice_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(invoice.invoice_date), 'dd.MM.yyyy')}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {invoice.order_count} ta buyurtma
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="shrink-0"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {!expanded && !invoice.stock_deducted && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs border-amber-300 bg-amber-500/10 text-amber-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Zaxira hali kamaytirilmagan
              </Badge>
            </div>
          )}
        </div>

        {expanded && (
          <div className="border-t border-border">
            {itemsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">SKU lar yuklanmoqda...</span>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 bg-muted/30 flex flex-wrap items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {matchedCount} ta topildi
                  </span>
                  {unmatchedCount > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-4 w-4" />
                      {unmatchedCount} ta topilmadi
                    </span>
                  )}
                </div>

                <div className="divide-y divide-border max-h-72 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className={cn(
                      'px-4 py-2.5 flex items-center justify-between gap-3 text-sm',
                      item.matched ? 'bg-card' : 'bg-red-50/30 dark:bg-red-950/10'
                    )}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {item.matched ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-muted-foreground truncate">
                            {item.sku_title || '—'}
                          </p>
                          {item.product_title && (
                            <p className="text-xs text-foreground truncate">{item.product_title}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                        <span>{item.quantity} dona</span>
                        {item.matched && item.stock_quantity !== null && (
                          <span className={cn(
                            'font-medium',
                            (item.stock_quantity ?? 0) >= item.quantity ? 'text-green-600' : 'text-amber-600'
                          )}>
                            Zaxira: {item.stock_quantity ?? 0}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Bu invoice uchun tovarlar topilmadi
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 flex justify-between items-center gap-2 bg-muted/20">
                  {invoice.stock_deducted ? (
                    <>
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Zaxira kamaytirilgan
                        {invoice.stock_deducted_at && (
                          <span className="text-muted-foreground ml-1">
                            ({format(new Date(invoice.stock_deducted_at), 'dd.MM.yyyy HH:mm')})
                          </span>
                        )}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUndoConfirmOpen(true)}
                        disabled={undoing}
                        className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Bekor qilish
                      </Button>
                    </>
                  ) : (
                    <div className="ml-auto">
                      <Button
                        onClick={handleConfirm}
                        disabled={confirming || matchedCount === 0}
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {confirming ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Tasdiqlash — zaxira kamaysin ({matchedCount} ta)
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={undoConfirmOpen}
        onOpenChange={setUndoConfirmOpen}
        title="Zaxirani qaytarishni tasdiqlang"
        description={`Invoice #${invoice.invoice_id} uchun kamaytirilgan zaxira miqdorlari qaytariladi. Davom etasizmi?`}
        confirmText="Ha, qaytarish"
        cancelText="Bekor qilish"
        variant="destructive"
        isLoading={undoing}
        onConfirm={handleUndo}
      />
    </>
  );
}

export function SupplyInvoicesTab() {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedInvoice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['fbs-invoices-stats'],
    queryFn: async () => {
      const [totalRes, pendingRes, confirmedRes] = await Promise.all([
        supabase.from('fbs_invoices').select('*', { count: 'exact', head: true }),
        supabase.from('fbs_invoices').select('*', { count: 'exact', head: true }).eq('stock_deducted', false),
        supabase.from('fbs_invoices').select('*', { count: 'exact', head: true }).eq('stock_deducted', true),
      ]);
      return {
        total: totalRes.count || 0,
        pending: pendingRes.count || 0,
        confirmed: confirmedRes.count || 0,
      };
    },
  });

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['fbs-invoices', filterStatus, page],
    queryFn: async () => {
      let query = supabase
        .from('fbs_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterStatus === 'pending') {
        query = query.eq('stock_deducted', false);
      } else if (filterStatus === 'confirmed') {
        query = query.eq('stock_deducted', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FbsInvoice[];
    },
  });

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Faqat PDF fayl yuklang');
      return;
    }
    setSelectedFile(file);
    setParsing(true);
    try {
      const text = await parsePdfText(file);
      console.log('[Supply PDF text]:', text.substring(0, 2000));
      const parsed = parseInvoiceData(text);
      setParsedData(parsed);
      if (!parsed.invoiceNumber && parsed.acceptedOrders.length === 0 && parsed.productItems.length === 0) {
        toast.error('PDF dan ma\'lumot topilmadi. PDF formatini tekshiring.');
      }
    } catch (err) {
      console.error('PDF parsing error:', err);
      toast.error('PDF o\'qishda xatolik');
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearParsed = () => {
    setParsedData(null);
    setSelectedFile(null);
  };

  const handleSave = async () => {
    if (!parsedData) return;
    setSaving(true);
    try {
      let invoiceDate: string | null = null;
      if (parsedData.invoiceDate) {
        const [dd, mm, yyyy] = parsedData.invoiceDate.split('.');
        if (dd && mm && yyyy) {
          invoiceDate = `${yyyy}-${mm}-${dd}T00:00:00+05:00`;
        }
      }

      const orderCount = parsedData.isProductReceipt
        ? parsedData.productItems.reduce((s, i) => s + i.quantity, 0)
        : parsedData.acceptedOrders.length + parsedData.notAcceptedOrders.length;

      const { data: invoice, error: invError } = await supabase
        .from('fbs_invoices')
        .insert({
          invoice_id: parsedData.invoiceNumber || `PDF-${Date.now()}`,
          invoice_date: invoiceDate,
          order_count: orderCount,
          notes: 'manual_pdf',
          status: 'DRAFT',
          stock_deducted: false,
        })
        .select()
        .single();

      if (invError) throw invError;

      const itemsToInsert: any[] = [];

      if (parsedData.isProductReceipt && parsedData.productItems.length > 0) {
        for (const item of parsedData.productItems) {
          itemsToInsert.push({
            invoice_id: invoice.id,
            sku_title: item.artikul,
            product_title: item.name,
            quantity: item.quantity,
          });
        }
      } else {
        for (const orderNum of parsedData.acceptedOrders) {
          itemsToInsert.push({
            invoice_id: invoice.id,
            external_order_id: orderNum,
            quantity: 1,
          });
        }
      }

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('fbs_invoice_items')
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      toast.success(`Saqlandi! Invoice #${parsedData.invoiceNumber || 'PDF'} — ${orderCount} ta element`);
      clearParsed();
      queryClient.invalidateQueries({ queryKey: ['fbs-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fbs-invoices-stats'] });
    } catch (err: any) {
      toast.error('Saqlashda xatolik: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalParsedItems = parsedData
    ? (parsedData.isProductReceipt
        ? parsedData.productItems.reduce((s, i) => s + i.quantity, 0)
        : parsedData.acceptedOrders.length + parsedData.notAcceptedOrders.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Truck className="h-5 w-5 text-orange-500" />
          Yetkazib berish invoiclari
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Seller marketplace ga topshirgan FBS tovarlar — PDF nakladnoy yuklang
        </p>
      </div>

      {/* PDF Upload Zone */}
      <Card className={cn(
        'border-2 border-dashed transition-all cursor-pointer',
        isDragOver ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/20' : 'border-border hover:border-orange-300',
        parsedData && 'border-solid border-orange-200 bg-orange-50/30 dark:bg-orange-950/10'
      )}>
        <div className="p-4">
          {!parsedData && !parsing && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="flex flex-col items-center gap-3 py-6"
            >
              <Upload className="h-10 w-10 text-muted-foreground/50" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">PDF nakladnoy yuklang</p>
                <p className="text-xs text-muted-foreground mt-1">Faylni shu yerga tashlang yoki tanlang</p>
              </div>
              <label>
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />
                <Button variant="outline" size="sm" asChild>
                  <span className="gap-2 cursor-pointer">
                    <FileText className="h-4 w-4" />
                    PDF tanlash
                  </span>
                </Button>
              </label>
            </div>
          )}

          {parsing && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">PDF tahlil qilinmoqda...</span>
            </div>
          )}

          {parsedData && !parsing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-500" />
                  <span className="font-semibold text-sm text-foreground">{selectedFile?.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearParsed}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Invoice №</p>
                  <p className="font-mono font-medium">{parsedData.invoiceNumber || '—'}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Sana</p>
                  <p className="font-medium">{parsedData.invoiceDate || '—'}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Tur</p>
                  <p className="font-medium">{parsedData.isProductReceipt ? 'Tovar qabuli' : 'Buyurtmalar'}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Elementlar</p>
                  <p className="font-bold text-orange-600">{totalParsedItems}</p>
                </div>
              </div>

              {parsedData.isProductReceipt && parsedData.productItems.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground flex justify-between">
                    <span>Artikul</span>
                    <span>Miqdor</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-border">
                    {parsedData.productItems.map((item, i) => (
                      <div key={i} className="px-3 py-2 flex justify-between text-sm">
                        <span className="font-mono text-xs">{item.artikul}</span>
                        <span className="font-medium">{item.quantity} dona</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!parsedData.isProductReceipt && parsedData.acceptedOrders.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                    Qabul qilingan buyurtmalar ({parsedData.acceptedOrders.length})
                  </div>
                  <div className="max-h-36 overflow-y-auto px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {parsedData.acceptedOrders.map((o, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-xs">{o}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {parsedData.notAcceptedOrders.length > 0 && (
                <div className="border rounded-lg border-red-200 overflow-hidden">
                  <div className="bg-red-50/50 dark:bg-red-950/20 px-3 py-2 text-xs font-medium text-red-600">
                    Qabul qilinmagan ({parsedData.notAcceptedOrders.length})
                  </div>
                  <div className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {parsedData.notAcceptedOrders.map((o, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-xs border-red-200 text-red-600">{o}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={saving || totalParsedItems === 0}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Saqlash ({totalParsedItems} ta element)
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center bg-card border-border">
          <p className="text-2xl font-bold text-foreground">{stats?.total ?? '...'}</p>
          <p className="text-xs text-muted-foreground">Jami invoiclar</p>
        </Card>
        <Card className="p-3 text-center bg-amber-50/50 border-amber-200 dark:bg-amber-950/20">
          <p className="text-2xl font-bold text-amber-600">{stats?.pending ?? '...'}</p>
          <p className="text-xs text-muted-foreground">Kutilayotgan</p>
        </Card>
        <Card className="p-3 text-center bg-green-50/50 border-green-200 dark:bg-green-950/20">
          <p className="text-2xl font-bold text-green-600">{stats?.confirmed ?? '...'}</p>
          <p className="text-xs text-muted-foreground">Tasdiqlangan</p>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'confirmed'] as const).map((f) => (
          <Button
            key={f}
            variant={filterStatus === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilterStatus(f); setPage(0); }}
          >
            {f === 'all' ? 'Barchasi' : f === 'pending' ? 'Kutilayotgan' : 'Tasdiqlangan'}
          </Button>
        ))}
      </div>

      {/* Invoice list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Yuklanmoqda...</span>
        </div>
      ) : invoices.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Truck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium mb-1">
            {filterStatus === 'pending'
              ? 'Barcha invoiclar tasdiqlangan!'
              : filterStatus === 'confirmed'
              ? 'Tasdiqlangan invoice yo\'q'
              : 'Hech qanday invoice topilmadi'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">PDF nakladnoy yuklang</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))}

          <div className="flex justify-center items-center gap-3 pt-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Oldingi
            </Button>
            <span className="text-sm text-muted-foreground">
              {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, stats?.total || invoices.length)}
            </span>
            <Button variant="outline" size="sm" disabled={invoices.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
              Keyingi
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
