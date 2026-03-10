import { useState, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { PullToRefresh } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, DollarSign, Loader2, Calculator, Warehouse, ShieldAlert, ClipboardList, Send, Store, Users, BarChart3, Package, Receipt, Pencil, RotateCcw, FileSpreadsheet } from 'lucide-react';
import { ExchangeRateBanner } from '@/components/crm/ExchangeRateBanner';
import { Badge } from '@/components/ui/badge';
import {
  FinanceDetailSheet,
  FinanceOverviewCards,
  FinanceDebtTab,
  FinanceReportsTab,
  TashkentFinanceTab,
  AllStoresFinanceTab,
  ProductProfitabilityTab,
  FinanceSaleBreakdownTab,
  FinancePeriodFilter,
  FinancePeriodTiles,
  FinancePLWaterfall,
  FinanceTransactionsTab,
  FinanceIncomeByStatus,
  AccountingReportTab,
} from '@/components/finance';
import type { StatusFilterType } from '@/components/finance/FinanceIncomeByStatus';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserRole } from '@/hooks/useUserRole';
import { useStoreDistribution } from '@/hooks/useStoreDistribution';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import type { DisplayCurrency } from '@/contexts/FinanceCurrencyContext';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

// Exchange rates are now provided by FinanceCurrencyContext

const FALLBACK_RATES: Record<string, number> = { USD: 1, CNY: 7.25, UZS: 12235 };

interface ExchangeRates {
  USD: number;
  CNY: number;
  UZS: number;
  lastUpdated: string | null;
  error?: string;
}

function FinanceInner() {
  const { t } = useTranslation();
  const { formatMoney, displayCurrency, setDisplayCurrency, usdToUzs, cnyToUzs, isManualRate, rateSource, refetchRates } = useFinanceCurrency();
  const USD_TO_UZS = usdToUzs;
  const CNY_TO_UZS = cnyToUzs;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { isOwner, isChiefManager, isFinanceStaff, isLoading: roleLoading } = useUserRole();
  const { distributions, calculateDistribution } = useStoreDistribution();

  const canAccessFinance = isOwner || isFinanceStaff || isChiefManager;
  const canAddManualTransactions = isOwner || isChiefManager;
  const canEditManualTransactions = isOwner || isChiefManager;
  const canDeleteTransactions = isOwner;
  const showAllTabs = isOwner || isFinanceStaff;
  const showDailySummary = isOwner;
  const showProfitDistribution = isOwner || isFinanceStaff;

  const [open, setOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [saleStatusFilter, setSaleStatusFilter] = useState<StatusFilterType | undefined>();
  const [formData, setFormData] = useState({ transaction_type: 'income', amount: '', category: '', currency: 'USD', description: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailType, setDetailType] = useState<string | null>(null);
  const [dailySummaryOpen, setDailySummaryOpen] = useState(false);
  const [dailySummaryData, setDailySummaryData] = useState<any>(null);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false);
  const [telegramSending, setTelegramSending] = useState(false);
  const [rateEditOpen, setRateEditOpen] = useState(false);
  const [manualUsd, setManualUsd] = useState('');
  const [manualCny, setManualCny] = useState('');
  const [savingManualRate, setSavingManualRate] = useState(false);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const openDetailSheet = (type: string) => { setDetailType(type); setDetailSheetOpen(true); };

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
    await queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
  }, [queryClient]);

  // ── Data Fetching ──
  const { data: exchangeRates, isLoading: ratesLoading, refetch: refetchEdgeRates } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async (): Promise<ExchangeRates> => {
      const { data, error } = await supabase.functions.invoke('exchange-rates');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const convertToUSD = (amount: number, currency: string): number => {
    const rates = exchangeRates || FALLBACK_RATES;
    const rate = Number(rates[currency as keyof typeof FALLBACK_RATES]) || 1;
    return amount / rate;
  };

  // ── Period Calculations ──
  const periodStart = new Date(selectedYear, selectedMonth, 1);
  const periodEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
  const periodStartISO = periodStart.toISOString();
  const periodEndISO = periodEnd.toISOString();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['finance-transactions', selectedMonth, selectedYear],
    queryFn: async () => fetchAllRows(
      supabase.from('finance_transactions')
        .select('*')
        .gte('created_at', periodStartISO)
        .lte('created_at', periodEndISO)
        .order('created_at', { ascending: false })
    ),
    staleTime: 60000,
    gcTime: 300000,
  });

  const { data: marketplaceSummary } = useQuery({
    queryKey: ['marketplace-finance-summary', selectedMonth, selectedYear],
    queryFn: async () => {
      const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const monthEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${new Date(selectedYear, selectedMonth + 1, 0).getDate()}`;
      return fetchAllRows(
        supabase.from('marketplace_finance_summary')
          .select('store_id, gross_revenue, commission_total, delivery_fees, net_revenue, period_date, currency')
          .gte('period_date', monthStart)
          .lte('period_date', monthEnd)
      );
    },
    staleTime: 60000,
    gcTime: 300000,
  });

  const { data: productVariants } = useQuery({
    queryKey: ['product-variants-finance'],
    queryFn: async () => fetchAllRows(supabase.from('product_variants').select('id, stock_quantity, cost_price, cost_price_currency').gt('stock_quantity', 0)),
    staleTime: 60000,
    gcTime: 300000,
  });

  const { data: productItems } = useQuery({
    queryKey: ['product-items-finance'],
    queryFn: async () => fetchAllRows(
      supabase.from('product_items')
        .select('id, item_uuid, status, location, unit_cost, unit_cost_currency, unit_cost_usd, sold_at, sold_price, sold_currency, sold_price_usd, product_id, products (name)')
        .neq('status', 'sold')
    ),
    staleTime: 60000,
    gcTime: 300000,
  });

  // Period data is already filtered server-side
  const periodTransactions = transactions;
  const periodMarketplaceSummary = marketplaceSummary;

  // Marketplace data from summary (UZS, source of truth)
  const marketplaceGrossUZS = periodMarketplaceSummary?.reduce((sum, d) => sum + (Number(d.gross_revenue) || 0), 0) || 0;
  const marketplaceCommissionUZS = periodMarketplaceSummary?.reduce((sum, d) => sum + (Number(d.commission_total) || 0), 0) || 0;
  const periodDeliveryFeesUZS = periodMarketplaceSummary?.reduce((sum, d) => sum + (Number(d.delivery_fees) || 0), 0) || 0;

  // Non-marketplace income from finance_transactions
  const directSalesUSD = periodTransactions?.filter(t => t.transaction_type === 'income' && t.category?.toLowerCase().includes("to'g'ridan-to'g'ri sotuv")).reduce((s, t) => s + (Number(t.amount_usd) || 0), 0) || 0;
  const otherIncomeUSD = periodTransactions?.filter(t => t.transaction_type === 'income' && !t.category?.startsWith('Marketplace sotuv') && t.reference_type !== 'marketplace_order' && !t.category?.toLowerCase().includes("to'g'ridan-to'g'ri sotuv")).reduce((s, t) => s + (Number(t.amount_usd) || 0), 0) || 0;

  // Expenses from finance_transactions
  const totalExpenseUSD = periodTransactions?.filter(t => t.transaction_type === 'expense').reduce((s, t) => s + (Number(t.amount_usd) || 0), 0) || 0;
  const buyingCostUSD = periodTransactions?.filter(t => t.transaction_type === 'expense' && t.category?.includes('Mahsulot sotib')).reduce((s, t) => s + (Number(t.amount_usd) || 0), 0) || 0;
  const domesticShippingUSD = periodTransactions?.filter(t => t.transaction_type === 'expense' && t.category?.includes('Xitoy ichki')).reduce((s, t) => s + (Number(t.amount_usd) || 0), 0) || 0;
  const internationalShippingUSD = periodTransactions?.filter(t => t.transaction_type === 'expense' && t.category?.includes('Yuk tashish')).reduce((s, t) => s + (Number(t.amount_usd) || 0), 0) || 0;
  const cogsUSD = buyingCostUSD + domesticShippingUSD + internationalShippingUSD;

  // Derived UZS values
  const directSalesUZS = directSalesUSD * USD_TO_UZS;
  const otherIncomeUZS = otherIncomeUSD * USD_TO_UZS;
  const buyingCostUZS = buyingCostUSD * USD_TO_UZS;
  const domesticShippingUZS = domesticShippingUSD * USD_TO_UZS;
  const internationalShippingUZS = internationalShippingUSD * USD_TO_UZS;
  const totalCOGSUZS = cogsUSD * USD_TO_UZS;
  const otherExpensesUZS = Math.max(0, (totalExpenseUSD - cogsUSD) * USD_TO_UZS);

  const grossRevenueUZS = marketplaceGrossUZS + directSalesUZS + otherIncomeUZS;
  const netRevenueUZS = (marketplaceGrossUZS - marketplaceCommissionUZS - periodDeliveryFeesUZS) + directSalesUZS + otherIncomeUZS;
  const netProfitUZS = netRevenueUZS - totalCOGSUZS - otherExpensesUZS;

  // Inventory
  const inventoryValueUZS = productVariants?.reduce((sum, variant) => {
    const costPrice = Number(variant.cost_price) || 0;
    const qty = Number(variant.stock_quantity) || 0;
    const currency = variant.cost_price_currency || 'UZS';
    let valueUZS = costPrice * qty;
    if (currency === 'USD') valueUZS = costPrice * USD_TO_UZS * qty;
    else if (currency === 'CNY') valueUZS = costPrice * CNY_TO_UZS * qty;
    return sum + valueUZS;
  }, 0) || 0;
  const totalInventoryItems = productVariants?.reduce((s, v) => s + (Number(v.stock_quantity) || 0), 0) || 0;

  // Profit distribution
  const storeNetMap: Record<string, number> = {};
  periodMarketplaceSummary?.forEach(s => {
    const net = (s.gross_revenue || 0) - (s.commission_total || 0) - (s.delivery_fees || 0);
    storeNetMap[s.store_id] = (storeNetMap[s.store_id] || 0) + net;
  });
  const totalMarketplaceNetUZS = Object.values(storeNetMap).reduce((s, v) => s + v, 0);

  let totalInvestorShareUZS = 0;
  let totalBoshMenejerShareUZS = 0;
  let totalTaxUZS = 0;
  const storeBreakdown = Object.entries(storeNetMap).map(([storeId, storeNet]) => {
    const { boshMenejerShare, investorShare, taxAmount, ownerNet, boshMenejerPct, investorPct } = calculateDistribution(storeId, storeNet);
    totalInvestorShareUZS += investorShare;
    totalBoshMenejerShareUZS += boshMenejerShare;
    totalTaxUZS += taxAmount;
    const dist = distributions.find(d => d.store_id === storeId);
    return {
      storeId,
      storeName: dist?.store_name || storeId.slice(0, 8),
      platform: dist?.platform || 'unknown',
      netRevenue: storeNet,
      investorShare, boshMenejerShare, taxAmount, ownerShare: ownerNet, boshMenejerPct, investorPct,
    };
  });

  // Transaction income totals for the Transactions tab
  const totalIncomeUSD = periodTransactions?.filter(t => t.transaction_type === 'income').reduce((s, t) => s + (Number(t.amount_usd) || 0), 0) || 0;
  const currencyBreakdown: Record<string, { income: number; expense: number }> = periodTransactions?.reduce((acc: Record<string, { income: number; expense: number }>, t) => {
    const currency = t.currency || 'USD';
    if (!acc[currency]) acc[currency] = { income: 0, expense: 0 };
    if (t.transaction_type === 'income') acc[currency].income += Number(t.amount);
    else acc[currency].expense += Number(t.amount);
    return acc;
  }, {} as Record<string, { income: number; expense: number }>) || {};

  const inventoryByLocation = (productItems?.filter(item => item.status !== 'sold') || []).reduce((acc, item) => {
    const location = item.location || 'unknown';
    if (!acc[location]) acc[location] = { count: 0, valueUSD: 0 };
    acc[location].count += 1;
    if (item.unit_cost_usd) acc[location].valueUSD += Number(item.unit_cost_usd);
    else if (item.unit_cost && item.unit_cost_currency) acc[location].valueUSD += convertToUSD(Number(item.unit_cost), item.unit_cost_currency);
    return acc;
  }, {} as Record<string, { count: number; valueUSD: number }>);

  // ── Mutations ──
  const suggestedCategories = [...new Set(transactions?.filter(t => t.reference_type === 'manual' || t.reference_type === null).map(t => t.category).filter(Boolean) || [])];

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.amount = t('fin_amount_required');
    if (!formData.category.trim()) errors.category = t('fin_category_required');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => { setFormData({ transaction_type: 'income', amount: '', category: '', currency: 'USD', description: '' }); setFormErrors({}); };

  const addTransactionMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) throw new Error(t('fin_form_errors'));
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('finance_transactions').insert({ ...formData, amount: parseFloat(formData.amount), created_by: user?.id, reference_type: 'manual' });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance-transactions'] }); toast({ title: t('fin_transaction_added'), description: t('fin_transaction_added_desc') }); setOpen(false); resetForm(); },
    onError: (error: any) => { if (error.message !== t('fin_form_errors')) toast({ title: t('fin_error_prefix'), description: error.message, variant: 'destructive' }); },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTransaction) return;
      const { error } = await supabase.from('finance_transactions').update({ transaction_type: formData.transaction_type, amount: parseFloat(formData.amount), category: formData.category, currency: formData.currency, description: formData.description }).eq('id', selectedTransaction.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance-transactions'] }); toast({ title: t('fin_transaction_updated'), description: t('fin_transaction_updated_desc') }); setEditDialogOpen(false); setSelectedTransaction(null); resetForm(); },
    onError: (error: any) => { toast({ title: t('fin_error_prefix'), description: error.message, variant: 'destructive' }); },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('finance_transactions').delete().eq('id', id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(t('fin_delete_no_permission'));
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance-transactions'] }); toast({ title: t('fin_transaction_deleted'), description: t('fin_transaction_deleted_desc') }); setDeleteDialogOpen(false); setSelectedTransaction(null); },
    onError: (error: any) => { toast({ title: t('fin_error_prefix'), description: error.message, variant: 'destructive' }); },
  });

  const handleEdit = (transaction: any) => {
    setSelectedTransaction(transaction);
    setFormData({ transaction_type: transaction.transaction_type, amount: transaction.amount.toString(), category: transaction.category || '', currency: transaction.currency || 'USD', description: transaction.description || '' });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (transaction: any) => { setSelectedTransaction(transaction); setDeleteDialogOpen(true); };

  // ── Daily Summary ──
  const fetchDailySummary = useCallback(async (dateOverride?: string) => {
    setDailySummaryLoading(true);
    try {
      let dateStr = dateOverride;
      if (!dateStr) {
        const today = new Date();
        const tashkentMs = today.getTime() + 5 * 60 * 60 * 1000;
        const tashkent = new Date(tashkentMs);
        tashkent.setDate(tashkent.getDate() - 1);
        dateStr = tashkent.toISOString().split('T')[0];
      }
      const { data, error } = await supabase.functions.invoke('daily-finance-summary', { body: { date: dateStr, send_telegram: false } });
      if (error) throw error;
      setDailySummaryData(data);
      setDailySummaryOpen(true);
    } catch (err: any) {
      toast({ title: t('fin_error_prefix'), description: err.message, variant: 'destructive' });
    } finally { setDailySummaryLoading(false); }
  }, [toast, t]);

  const sendSummaryToTelegram = useCallback(async () => {
    if (!dailySummaryData?.summary) { toast({ title: t('fin_error_prefix'), description: t('fin_load_summary_first'), variant: 'destructive' }); return; }
    setTelegramSending(true);
    try {
      const today = new Date(); today.setHours(today.getHours() + 5); today.setDate(today.getDate() - 1);
      const { error } = await supabase.functions.invoke('daily-finance-summary', { body: { date: today.toISOString().split('T')[0], send_telegram: true } });
      if (error) throw error;
      toast({ title: t('tg_daily_summary'), description: t('tg_daily_summary_desc') });
    } catch (err: any) { toast({ title: t('fin_error_prefix'), description: err.message, variant: 'destructive' }); }
    finally { setTelegramSending(false); }
  }, [toast, dailySummaryData, t]);

  // ── Access Guard ──
  if (!roleLoading && !canAccessFinance) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('fin_access_denied')}</h2>
        <p className="text-muted-foreground">{t('fin_access_denied_msg')}</p>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{t('fin_title')}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">{t('fin_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as DisplayCurrency)}>
            <SelectTrigger className="w-[120px] bg-input border-border">
              <DollarSign className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UZS">UZS (so'm)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="CNY">CNY (¥)</SelectItem>
            </SelectContent>
          </Select>
          {showDailySummary && (
            <Button variant="outline" size="sm" onClick={() => fetchDailySummary()} disabled={dailySummaryLoading} className="gap-2">
              {dailySummaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              {isMobile ? '' : t('fin_daily_btn')}
            </Button>
          )}
          {canAddManualTransactions && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20 min-h-[44px]">
                  <Plus className="h-4 w-4" /> {t('fin_transaction')}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="text-foreground">{t('fin_new_transaction')}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Select value={formData.transaction_type} onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}>
                    <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="income">{t('fin_income')}</SelectItem>
                      <SelectItem value="expense">{t('fin_expense')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <div>
                    <Input type="number" placeholder={t('fin_amount_placeholder')} value={formData.amount}
                      onChange={(e) => { setFormData({ ...formData, amount: e.target.value }); if (formErrors.amount) setFormErrors({ ...formErrors, amount: '' }); }}
                      className={`bg-input border-border ${formErrors.amount ? 'border-destructive' : ''}`} />
                    {formErrors.amount && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {formErrors.amount}</p>}
                  </div>
                  <div>
                    <Input placeholder={t('fin_category_placeholder')} value={formData.category} list="suggested-categories"
                      onChange={(e) => { setFormData({ ...formData, category: e.target.value }); if (formErrors.category) setFormErrors({ ...formErrors, category: '' }); }}
                      className={`bg-input border-border ${formErrors.category ? 'border-destructive' : ''}`} />
                    <datalist id="suggested-categories">{suggestedCategories.map((cat) => <option key={cat} value={cat!} />)}</datalist>
                    {formErrors.category && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {formErrors.category}</p>}
                  </div>
                  <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                    <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="CNY">CNY (¥)</SelectItem>
                      <SelectItem value="UZS">UZS (so'm)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea placeholder={t('fin_description_placeholder')} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-input border-border" />
                  <Button onClick={() => addTransactionMutation.mutate()} disabled={addTransactionMutation.isPending} className="w-full bg-gradient-to-r from-primary to-secondary">
                    {addTransactionMutation.isPending ? t('fin_saving') : t('save')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Exchange rates bar */}
      <ExchangeRateBanner
        showEdit={canAddManualTransactions}
        className="w-full"
      />
      {/* DB-save manual rate edit dialog (owner/manager can permanently save) */}
      <Dialog open={rateEditOpen} onOpenChange={setRateEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Valyuta kursini tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">1 USD = ? UZS</label>
              <Input type="number" value={manualUsd} onChange={(e) => setManualUsd(e.target.value)} placeholder="12200" />
            </div>
            <div>
              <label className="text-sm font-medium">1 CNY = ? UZS</label>
              <Input type="number" value={manualCny} onChange={(e) => setManualCny(e.target.value)} placeholder="1750" />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={savingManualRate || !manualUsd || !manualCny}
                onClick={async () => {
                  setSavingManualRate(true);
                  try {
                    const uzsVal = parseFloat(manualUsd);
                    const cnyVal = parseFloat(manualCny);
                    if (!uzsVal || !cnyVal) throw new Error('Noto\'g\'ri qiymat');

                    const cnyPerUsd = uzsVal / cnyVal;
                    await supabase.from('exchange_rates_history').insert({
                      base_currency: 'USD',
                      rates: { UZS: uzsVal, CNY: parseFloat(cnyPerUsd.toFixed(4)), CNY_TO_UZS: cnyVal, UZS_BUY: uzsVal, UZS_SELL: uzsVal },
                      source: 'manual',
                      is_manual: true,
                      fetched_at: new Date().toISOString(),
                    });

                    queryClient.invalidateQueries({ queryKey: ['exchange-rates-history-latest'] });
                    queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
                    refetchRates();
                    toast({ title: 'Saqlandi', description: `1 USD = ${uzsVal} UZS, 1 CNY = ${cnyVal} UZS` });
                    setRateEditOpen(false);
                  } catch (err: any) {
                    toast({ title: 'Xato', description: err.message, variant: 'destructive' });
                  } finally {
                    setSavingManualRate(false);
                  }
                }}
              >
                {savingManualRate ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saqlash'}
              </Button>
              {isManualRate && (
                <Button
                  variant="outline"
                  className="gap-1"
                  disabled={savingManualRate}
                  onClick={async () => {
                    setSavingManualRate(true);
                    try {
                      await supabase.from('exchange_rates_history').delete().eq('is_manual', true).eq('source', 'manual');
                      // Trigger fresh fetch with force=true to bypass cache
                      await supabase.functions.invoke('exchange-rates', { body: null, headers: {} });
                      // Call with force param via direct fetch
                      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                      await fetch(`${supabaseUrl}/functions/v1/exchange-rates?force=true`, {
                        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
                      });
                      queryClient.invalidateQueries({ queryKey: ['exchange-rates-history-latest'] });
                      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
                      refetchRates();
                      toast({ title: 'Avtomatik rejimga qaytarildi', description: 'Bank kursiga qaytildi' });
                      setRateEditOpen(false);
                    } catch (err: any) {
                      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
                    } finally {
                      setSavingManualRate(false);
                    }
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Avtomatik
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isManualRate
                ? 'Hozir qo\'lda kiritilgan kurs ishlatilmoqda. "Avtomatik" tugmasi orqali Ipak Yo\'li Bank kursiga qaytishingiz mumkin.'
                : 'Qo\'lda kurs kiritganingizda, siz o\'zgartirmaguncha shu kurs barcha hisob-kitoblarda ishlatiladi.'}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Period Filter */}
      <FinancePeriodFilter selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={setSelectedMonth} onYearChange={setSelectedYear} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max min-w-full">
            <TabsTrigger value="overview" className="gap-2 flex-shrink-0"><Calculator className="h-4 w-4" /><span className="hidden sm:inline">{t('fin_tab_overview')}</span></TabsTrigger>
            {showAllTabs && <TabsTrigger value="marketplace" className="gap-2 flex-shrink-0"><Store className="h-4 w-4" /><span className="hidden sm:inline">Marketplace</span></TabsTrigger>}
            {showAllTabs && <TabsTrigger value="tashkent" className="gap-2 flex-shrink-0"><Warehouse className="h-4 w-4" /><span className="hidden sm:inline">{t('fin_tab_tashkent')}</span></TabsTrigger>}
            {showAllTabs && <TabsTrigger value="debt" className="gap-2 flex-shrink-0"><Users className="h-4 w-4" /><span className="hidden sm:inline">{t('fin_tab_debt')}</span></TabsTrigger>}
            <TabsTrigger value="transactions" className="gap-2 flex-shrink-0"><DollarSign className="h-4 w-4" /><span className="hidden sm:inline">{t('fin_tab_transactions')}</span></TabsTrigger>
            {showAllTabs && <TabsTrigger value="reports" className="gap-2 flex-shrink-0"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">{t('fin_tab_reports')}</span></TabsTrigger>}
            {showAllTabs && <TabsTrigger value="product-profit" className="gap-2 flex-shrink-0"><Package className="h-4 w-4" /><span className="hidden sm:inline">{t('pp_tab_title')}</span></TabsTrigger>}
            {showAllTabs && <TabsTrigger value="sale-breakdown" className="gap-2 flex-shrink-0"><Receipt className="h-4 w-4" /><span className="hidden sm:inline">{t('fin_tab_sale_breakdown')}</span></TabsTrigger>}
            {(showAllTabs || isChiefManager) && <TabsTrigger value="accounting" className="gap-2 flex-shrink-0"><FileSpreadsheet className="h-4 w-4" /><span className="hidden sm:inline">Buxgalteriya</span></TabsTrigger>}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="overview" className="space-y-6">
          <FinancePeriodTiles />
          <FinanceIncomeByStatus
            periodStart={periodStart.toISOString()}
            periodEnd={periodEnd.toISOString()}
            onStatusClick={(status) => {
              setSaleStatusFilter(status);
              setActiveTab('sale-breakdown');
            }}
          />
          <FinancePLWaterfall
            data={{
              marketplaceGrossUZS, marketplaceCommissionUZS, marketplaceDeliveryFeesUZS: periodDeliveryFeesUZS,
              directSalesUZS, otherIncomeUZS, buyingCostUZS, domesticShippingUZS, internationalShippingUZS, otherExpensesUZS,
            }}
            storeBreakdown={storeBreakdown}
            showDistribution={showProfitDistribution}
            totalInvestorShareUZS={totalInvestorShareUZS}
            totalBoshMenejerShareUZS={totalBoshMenejerShareUZS}
            totalTaxUZS={totalTaxUZS}
            onDetailClick={openDetailSheet}
          />
        </TabsContent>

        <TabsContent value="marketplace" className="space-y-6">
          {activeTab === 'marketplace' && <AllStoresFinanceTab selectedMonth={selectedMonth} selectedYear={selectedYear} />}
        </TabsContent>

        <TabsContent value="tashkent" className="space-y-6">{activeTab === 'tashkent' && <TashkentFinanceTab />}</TabsContent>
        <TabsContent value="debt" className="space-y-6">{activeTab === 'debt' && <FinanceDebtTab />}</TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <FinanceTransactionsTab
            transactions={periodTransactions || []}
            isLoading={isLoading}
            currencyBreakdown={currencyBreakdown}
            totalIncomeUSD={totalIncomeUSD}
            totalExpenseUSD={totalExpenseUSD}
            canAddManual={canAddManualTransactions}
            canEditManual={canEditManualTransactions}
            canDelete={canDeleteTransactions}
            onAdd={() => setOpen(true)}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
          />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">{activeTab === 'reports' && <FinanceReportsTab />}</TabsContent>
        <TabsContent value="product-profit" className="space-y-6">{activeTab === 'product-profit' && <ProductProfitabilityTab usdToUzs={USD_TO_UZS} cnyToUzs={CNY_TO_UZS} />}</TabsContent>
        <TabsContent value="sale-breakdown" className="space-y-6">{activeTab === 'sale-breakdown' && <FinanceSaleBreakdownTab selectedMonth={selectedMonth} selectedYear={selectedYear} usdToUzs={USD_TO_UZS} cnyToUzs={CNY_TO_UZS} statusFilter={saleStatusFilter} onClearFilter={() => setSaleStatusFilter(undefined)} />}</TabsContent>
        <TabsContent value="accounting" className="space-y-6">{activeTab === 'accounting' && <AccountingReportTab />}</TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">{t('fin_edit_transaction')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={formData.transaction_type} onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border"><SelectItem value="income">{t('fin_income')}</SelectItem><SelectItem value="expense">{t('fin_expense')}</SelectItem></SelectContent>
            </Select>
            <Input type="number" placeholder={t('fin_amount_placeholder')} value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="bg-input border-border" />
            <Input placeholder={t('fin_category_placeholder')} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="bg-input border-border" />
            <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border"><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="CNY">CNY (¥)</SelectItem><SelectItem value="UZS">UZS (so'm)</SelectItem></SelectContent>
            </Select>
            <Textarea placeholder={t('fin_description_placeholder')} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-input border-border" />
            <Button onClick={() => updateTransactionMutation.mutate()} disabled={updateTransactionMutation.isPending} className="w-full bg-gradient-to-r from-primary to-secondary">
              {updateTransactionMutation.isPending ? t('fin_saving') : t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title={t('fin_delete_transaction')} description={t('fin_delete_confirm', { category: selectedTransaction?.category })} confirmText={t('delete')} cancelText={t('cancel')} onConfirm={() => selectedTransaction && deleteTransactionMutation.mutate(selectedTransaction.id)} variant="destructive" isLoading={deleteTransactionMutation.isPending} />

      <FinanceDetailSheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen} detailType={detailType} productItems={productItems || []} transactions={transactions || []} inventoryByLocation={inventoryByLocation} convertToUSD={convertToUSD} />

      {/* Daily Summary Dialog */}
      <Dialog open={dailySummaryOpen} onOpenChange={setDailySummaryOpen}>
        <DialogContent className="bg-card border-border sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2"><ClipboardList className="h-5 w-5" />{t('fin_daily_title')}</DialogTitle>
          </DialogHeader>
          {dailySummaryData?.metrics ? (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">📅 {dailySummaryData.metrics.date}</div>
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('fin_daily_income')}</p>
                  <p className="text-lg font-bold text-green-600">${dailySummaryData.metrics.income_usd?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(dailySummaryData.metrics.income_uzs).toLocaleString()} so'm</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('fin_daily_expense')}</p>
                  <p className="text-lg font-bold text-red-600">${dailySummaryData.metrics.expense_usd?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(dailySummaryData.metrics.expense_uzs).toLocaleString()} so'm</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('fin_daily_net')}</p>
                  <p className={`text-lg font-bold ${dailySummaryData.metrics.net_profit_usd >= 0 ? 'text-green-600' : 'text-red-600'}`}>${dailySummaryData.metrics.net_profit_usd?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(dailySummaryData.metrics.net_profit_uzs).toLocaleString()} so'm</p>
                </Card>
              </div>
              {(dailySummaryData.metrics.marketplace_income_usd > 0 || dailySummaryData.metrics.direct_sale_income_usd > 0) && (
                <Card className="p-3">
                  <p className="text-sm font-medium mb-2">🛒 {t('fin_daily_breakdown')}</p>
                  <div className="space-y-1 text-sm">
                    {dailySummaryData.metrics.marketplace_income_usd > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('fin_marketplace')}</span><span className="font-medium">${dailySummaryData.metrics.marketplace_income_usd?.toLocaleString()}</span></div>}
                    {dailySummaryData.metrics.direct_sale_income_usd > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('fin_daily_direct')}</span><span className="font-medium">${dailySummaryData.metrics.direct_sale_income_usd?.toLocaleString()}</span></div>}
                  </div>
                </Card>
              )}
              {dailySummaryData.metrics.marketplace_stores?.length > 0 && (
                <Card className="p-3">
                  <p className="text-sm font-medium mb-2">🏪 {t('fin_daily_stores')}</p>
                  <div className="space-y-1 text-sm">
                    {dailySummaryData.metrics.marketplace_stores.map((s: any, i: number) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{s.platform === 'uzum' ? '🟣' : '🔴'} {s.name}</span>
                        <span className="font-medium">{s.delivered} {t('pcs')} | {s.currency === 'UZS' ? `${Math.round(s.net_revenue).toLocaleString()} so'm` : `$${s.net_revenue}`}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              <Card className="p-3">
                <p className="text-sm font-medium mb-2">🏭 {t('fin_daily_warehouse')}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('fin_daily_tashkent_wh')}</span><span className="font-medium">{Math.round(dailySummaryData.metrics.warehouse_value_uzs).toLocaleString()} so'm</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('fin_daily_in_transit')}</span><span className="font-medium">{dailySummaryData.metrics.boxes_in_transit} {t('pcs')}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('fin_daily_arrived_yesterday')}</span><span className="font-medium">{dailySummaryData.metrics.boxes_arrived_yesterday} {t('pcs')}</span></div>
                </div>
              </Card>
              {(dailySummaryData.metrics.receivable_usd > 0 || dailySummaryData.metrics.payable_usd > 0) && (
                <Card className="p-3">
                  <p className="text-sm font-medium mb-2">💳 {t('fin_daily_debts')}</p>
                  <div className="space-y-1 text-sm">
                    {dailySummaryData.metrics.receivable_usd > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('fin_daily_receivable')}</span><span className="font-medium">${dailySummaryData.metrics.receivable_usd?.toLocaleString()}</span></div>}
                    {dailySummaryData.metrics.payable_usd > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('fin_daily_payable')}</span><span className="font-medium">${dailySummaryData.metrics.payable_usd?.toLocaleString()}</span></div>}
                  </div>
                </Card>
              )}
              {(dailySummaryData.metrics.low_stock_alerts > 0 || dailySummaryData.metrics.overdue_tasks > 0 || dailySummaryData.metrics.open_claims > 0) && (
                <Card className="p-3 border-destructive/30">
                  <p className="text-sm font-medium mb-2">🚨 {t('fin_daily_alerts')}</p>
                  <div className="space-y-1 text-sm">
                    {dailySummaryData.metrics.low_stock_alerts > 0 && <div className="flex justify-between"><span className="text-muted-foreground">⚠️ {t('fin_daily_low_stock')}</span><span className="font-medium text-amber-600">{dailySummaryData.metrics.low_stock_alerts}</span></div>}
                    {dailySummaryData.metrics.overdue_tasks > 0 && <div className="flex justify-between"><span className="text-muted-foreground">⏰ {t('fin_daily_overdue')}</span><span className="font-medium text-destructive">{dailySummaryData.metrics.overdue_tasks}</span></div>}
                    {dailySummaryData.metrics.open_claims > 0 && <div className="flex justify-between"><span className="text-muted-foreground">📋 {t('fin_daily_open_claims')}</span><span className="font-medium text-amber-600">{dailySummaryData.metrics.open_claims}</span></div>}
                  </div>
                </Card>
              )}
              <Button onClick={sendSummaryToTelegram} disabled={telegramSending} variant="outline" className="w-full gap-2">
                {telegramSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t('fin_daily_send_tg')}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">{t('fin_daily_no_data')}</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Finance() {
  return <FinanceInner />;
}
