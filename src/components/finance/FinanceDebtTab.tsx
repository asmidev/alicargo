import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  User, 
  Phone, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Truck
} from 'lucide-react';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';

interface AccountsReceivable {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  amount: number;
  currency: string;
  amount_usd: number | null;
  due_date: string | null;
  status: string;
  paid_amount: number;
  notes: string | null;
  created_at: string;
}

interface AccountsPayable {
  id: string;
  supplier_name: string;
  supplier_contact: string | null;
  amount: number;
  currency: string;
  amount_usd: number | null;
  due_date: string | null;
  status: string;
  paid_amount: number;
  notes: string | null;
  created_at: string;
}

export function FinanceDebtTab() {
  const { t } = useTranslation();
  const { formatMoneyUSD, usdToUzs, cnyToUzs } = useFinanceCurrency();
  const queryClient = useQueryClient();
  const [isReceivableDialogOpen, setIsReceivableDialogOpen] = useState(false);
  const [isPayableDialogOpen, setIsPayableDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    amount: '',
    currency: 'USD',
    due_date: '',
    notes: ''
  });

  // Fetch accounts receivable
  const { data: receivables = [], isLoading: loadingReceivables } = useQuery({
    queryKey: ['accounts-receivable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AccountsReceivable[];
    }
  });

  // Fetch accounts payable
  const { data: payables = [], isLoading: loadingPayables } = useQuery({
    queryKey: ['accounts-payable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_payable')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AccountsPayable[];
    }
  });

  // Add receivable mutation
  const addReceivableMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('accounts_receivable').insert({
        customer_name: formData.name,
        customer_phone: formData.contact || null,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
        created_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('fin_receivable_added'));
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      setIsReceivableDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(t('fin_error_prefix') + error.message);
    }
  });

  // Add payable mutation
  const addPayableMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('accounts_payable').insert({
        supplier_name: formData.name,
        supplier_contact: formData.contact || null,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
        created_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('fin_payable_added'));
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      setIsPayableDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(t('fin_error_prefix') + error.message);
    }
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ table, id, status }: { table: 'accounts_receivable' | 'accounts_payable', id: string, status: string }) => {
      const { error } = await supabase
        .from(table)
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { table }) => {
      toast.success(t('fin_status_updated'));
      queryClient.invalidateQueries({ queryKey: [table === 'accounts_receivable' ? 'accounts-receivable' : 'accounts-payable'] });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      contact: '',
      amount: '',
      currency: 'USD',
      due_date: '',
      notes: ''
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', icon: React.ReactNode }> = {
      pending: { variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
      partial: { variant: 'outline', icon: <AlertCircle className="h-3 w-3" /> },
      paid: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
      overdue: { variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
      written_off: { variant: 'outline', icon: null }
    };
    const style = styles[status] || styles.pending;
    const statusLabels: Record<string, string> = {
      pending: t('fin_status_pending'),
      partial: t('fin_status_partial'),
      paid: t('fin_status_paid'),
      overdue: t('fin_status_overdue'),
    };
    return (
      <Badge variant={style.variant} className="gap-1">
        {style.icon}
        {statusLabels[status] || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Calculate totals (always use amount_usd; fallback: convert UZS/CNY to USD)
  const toUSD = (item: { amount: number; currency: string; amount_usd: number | null }) => {
    if (item.amount_usd) return item.amount_usd;
    if (item.currency === 'USD') return item.amount;
    if (item.currency === 'UZS') return item.amount / usdToUzs;
    if (item.currency === 'CNY') return item.amount / (usdToUzs / cnyToUzs); // CNY->USD
    return item.amount;
  };

  const totalReceivable = receivables
    .filter(r => r.status !== 'paid')
    .reduce((sum, r) => sum + toUSD(r), 0);
  
  const totalPayable = payables
    .filter(p => p.status !== 'paid')
    .reduce((sum, p) => sum + toUSD(p), 0);

  const renderDebtForm = (type: 'receivable' | 'payable') => (
    <div className="space-y-4">
      <div>
      <Label>{type === 'receivable' ? t('fin_customer_name') : t('fin_supplier_name')}</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder={type === 'receivable' ? t('fin_customer_name') : t('fin_supplier_name')}
        />
      </div>
      <div>
        <Label>{t('fin_phone_contact')}</Label>
        <Input
          value={formData.contact}
          onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
          placeholder="+998 90 123 45 67"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>{t('fin_amount')}</Label>
          <Input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div>
          <Label>{t('fin_currency')}</Label>
          <Select value={formData.currency} onValueChange={(v) => setFormData(prev => ({ ...prev, currency: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="UZS">UZS</SelectItem>
              <SelectItem value="CNY">CNY</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>{t('fin_due_date')}</Label>
        <Input
          type="date"
          value={formData.due_date}
          onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
        />
      </div>
      <div>
        <Label>{t('fin_comment')}</Label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder={t('fin_comment_placeholder')}
        />
      </div>
      <Button
        className="w-full min-h-[44px]"
        onClick={() => type === 'receivable' ? addReceivableMutation.mutate() : addPayableMutation.mutate()}
        disabled={!formData.name || !formData.amount}
      >
        {t('save')}
      </Button>
    </div>
  );

  const renderDebtList = (items: (AccountsReceivable | AccountsPayable)[], type: 'receivable' | 'payable') => (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 p-1">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>{t('noData')}</p>
          </div>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {type === 'receivable' ? (
                        <User className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Truck className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">
                        {'customer_name' in item ? item.customer_name : item.supplier_name}
                      </span>
                    </div>
                    {('customer_phone' in item ? item.customer_phone : item.supplier_contact) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {'customer_phone' in item ? item.customer_phone : item.supplier_contact}
                      </div>
                    )}
                    {item.due_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(item.due_date), 'dd MMM yyyy', { locale: uz })}
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-2">
                    <div className="text-base sm:text-lg font-bold">
                      {formatCurrency(item.amount, item.currency)}
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                </div>
                {item.notes && (
                  <p className="text-sm text-muted-foreground mt-2 border-t pt-2">
                    {item.notes}
                  </p>
                )}
                {item.status !== 'paid' && (
                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] sm:min-h-0"
                      onClick={() => updateStatusMutation.mutate({
                        table: type === 'receivable' ? 'accounts_receivable' : 'accounts_payable',
                        id: item.id,
                        status: 'paid'
                      })}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('fin_paid_btn')}
                    </Button>
                    {item.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-[44px] sm:min-h-0"
                        onClick={() => updateStatusMutation.mutate({
                          table: type === 'receivable' ? 'accounts_receivable' : 'accounts_payable',
                          id: item.id,
                          status: 'partial'
                        })}
                      >
                        {t('fin_partial_btn')}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ScrollArea>
  );

  return (
    <Tabs defaultValue="receivable" className="w-full">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="receivable" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Debitorlik</span>
            <Badge variant="secondary">{formatMoneyUSD(totalReceivable)}</Badge>
          </TabsTrigger>
          <TabsTrigger value="payable" className="gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Kreditorlik</span>
            <Badge variant="secondary">{formatMoneyUSD(totalPayable)}</Badge>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="receivable">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t('fin_receivable')}</CardTitle>
            <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => setIsReceivableDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('add')}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingReceivables ? (
              <LoadingSkeleton count={3} compact />
            ) : (
              renderDebtList(receivables, 'receivable')
            )}
          </CardContent>
        </Card>
        <ResponsiveDialog open={isReceivableDialogOpen} onOpenChange={setIsReceivableDialogOpen}>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>{t('fin_receivable')}</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody>
              {renderDebtForm('receivable')}
            </ResponsiveDialogBody>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </TabsContent>

      <TabsContent value="payable">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t('fin_payable')}</CardTitle>
            <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => setIsPayableDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('add')}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingPayables ? (
              <LoadingSkeleton count={3} compact />
            ) : (
              renderDebtList(payables, 'payable')
            )}
          </CardContent>
        </Card>
        <ResponsiveDialog open={isPayableDialogOpen} onOpenChange={setIsPayableDialogOpen}>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>{t('fin_payable')}</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody>
              {renderDebtForm('payable')}
            </ResponsiveDialogBody>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </TabsContent>
    </Tabs>
  );
}
