import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  RefreshCw,
  Download,
  Calculator,
  Loader2,
  Package,
  Truck,
  Users,
  Building
} from 'lucide-react';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface FinancialPeriod {
  id: string;
  period_start: string;
  period_end: string;
  revenue: number | null;
  cost_of_goods_sold: number | null;
  gross_profit: number | null;
  operating_expenses: number | null;
  net_profit: number | null;
  direct_sales_revenue: number | null;
  marketplace_revenue: number | null;
  shipping_expenses: number | null;
  payroll_expenses: number | null;
  rent_expenses: number | null;
  marketing_expenses: number | null;
  other_expenses: number | null;
  closing_inventory_value: number | null;
  accounts_receivable_total: number | null;
  accounts_payable_total: number | null;
  calculated_at: string | null;
  buying_cost: number | null;
  domestic_shipping_cost: number | null;
}

export function FinanceReportsTab() {
  const { t } = useTranslation();
  const { formatMoneyUSD } = useFinanceCurrency();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Fetch financial periods
  const { data: periods = [], isLoading, refetch } = useQuery({
    queryKey: ['financial-periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_periods')
        .select('*')
        .order('period_start', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as FinancialPeriod[];
    }
  });

  // Calculate period mutation
  const calculateMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke('calculate-financial-period', {
        body: { year: selectedYear, month: selectedMonth }
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('fin_rpt_calculated'));
      refetch();
    },
    onError: (error) => {
      toast.error(t('fin_rpt_calc_error') + ': ' + error.message);
    }
  });

  // Get current period data
  const currentPeriod = periods.find(p => {
    const start = new Date(p.period_start);
    return start.getFullYear() === selectedYear && start.getMonth() === selectedMonth;
  });

  const formatCurrency = (value: number | null) => {
    if (value === null) return formatMoneyUSD(0);
    return formatMoneyUSD(value);
  };

  const formatCurrencyPDF = (value: number | null) => {
    if (value === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const months = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const generatePDF = () => {
    if (!currentPeriod) {
      toast.error(t('fin_rpt_calc_before'));
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(t('fin_rpt_title'), 20, 25);
    doc.setFontSize(12);
    doc.text(`${months[selectedMonth]} ${selectedYear}`, 20, 35);

    yPos = 55;
    doc.setTextColor(0, 0, 0);

    // P&L Statement
    doc.setFontSize(16);
    doc.text(t('fin_rpt_pnl_title'), 20, yPos);
    yPos += 15;

    const addLine = (label: string, value: number | null, isTotal = false, isNegative = false) => {
      doc.setFontSize(isTotal ? 12 : 10);
      doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
      doc.text(label, 25, yPos);
      const color = isNegative ? [220, 38, 38] : (isTotal ? [22, 163, 74] : [0, 0, 0]);
      doc.setTextColor(...color as [number, number, number]);
      doc.text(formatCurrencyPDF(value), pageWidth - 60, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += isTotal ? 10 : 7;
    };

    addLine(t('fin_rpt_revenue'), currentPeriod.revenue);
    addLine('  - ' + t('fin_rpt_direct_sales'), currentPeriod.direct_sales_revenue);
    addLine('  - ' + t('fin_rpt_marketplace'), currentPeriod.marketplace_revenue);
    yPos += 3;
    addLine(t('fin_rpt_cogs'), currentPeriod.cost_of_goods_sold, false, true);
    addLine('  - ' + t('fin_rpt_buying_price'), currentPeriod.buying_cost, false, true);
    addLine('  - ' + t('fin_rpt_domestic_ship'), currentPeriod.domestic_shipping_cost, false, true);
    addLine('  - ' + t('fin_rpt_intl_ship'), (currentPeriod.cost_of_goods_sold || 0) - (currentPeriod.buying_cost || 0) - (currentPeriod.domestic_shipping_cost || 0), false, true);
    yPos += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos - 2, pageWidth - 20, yPos - 2);
    addLine(t('fin_rpt_gross_profit'), currentPeriod.gross_profit, true);
    yPos += 5;

    addLine(t('fin_rpt_op_expenses') + ':', null);
    addLine('  - ' + t('fin_rpt_payroll'), currentPeriod.payroll_expenses, false, true);
    addLine('  - ' + t('fin_rpt_rent'), currentPeriod.rent_expenses, false, true);
    addLine('  - ' + t('fin_rpt_marketing'), currentPeriod.marketing_expenses, false, true);
    addLine('  - ' + t('fin_rpt_other'), currentPeriod.other_expenses, false, true);
    yPos += 3;
    doc.line(20, yPos - 2, pageWidth - 20, yPos - 2);
    addLine(t('fin_rpt_total_expenses'), currentPeriod.operating_expenses, true, true);
    yPos += 5;

    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos - 5, pageWidth - 40, 12, 'F');
    addLine(t('fin_rpt_net_profit'), currentPeriod.net_profit, true, (currentPeriod.net_profit || 0) < 0);
    yPos += 15;

    // Balance Sheet Summary
    doc.setFontSize(16);
    doc.text(t('fin_rpt_balance'), 20, yPos);
    yPos += 15;

    addLine(t('fin_rpt_inventory'), currentPeriod.closing_inventory_value);
    addLine(t('fin_rpt_receivables'), currentPeriod.accounts_receivable_total);
    addLine(t('fin_rpt_payables'), currentPeriod.accounts_payable_total, false, true);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Yaratilgan: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 20, 280);
    doc.text('AliBrand CRM', pageWidth - 50, 280);

    doc.save(`Finance_Report_${selectedYear}_${selectedMonth + 1}.pdf`);
    toast.success(t('fin_rpt_downloaded'));
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('fin_rpt_title')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => calculateMutation.mutate()}
                disabled={calculateMutation.isPending}
              >
                {calculateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={generatePDF}
                disabled={!currentPeriod}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <LoadingSkeleton count={3} />
      ) : currentPeriod ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* P&L Statement */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('fin_rpt_pnl_title')}</CardTitle>
              {currentPeriod.calculated_at && (
                <p className="text-xs text-muted-foreground">
                  {t('fin_rpt_last_calc')}: {format(new Date(currentPeriod.calculated_at), 'dd MMM yyyy, HH:mm', { locale: uz })}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Revenue Section */}
              <div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium text-green-600">{t('fin_rpt_revenue')}</span>
                  <span className="font-bold text-green-600">{formatCurrency(currentPeriod.revenue)}</span>
                </div>
                <div className="pl-4 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('fin_rpt_direct_sales')}</span>
                    <span>{formatCurrency(currentPeriod.direct_sales_revenue)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('fin_rpt_marketplace')}</span>
                    <span>{formatCurrency(currentPeriod.marketplace_revenue)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* COGS - Tannarx breakdown */}
              <div>
                <div className="flex justify-between items-center py-2">
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    {t('fin_rpt_cogs')}
                  </span>
                  <span className="text-red-500">-{formatCurrency(currentPeriod.cost_of_goods_sold)}</span>
                </div>
                <div className="pl-4 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>↳ {t('fin_rpt_buying_price')}</span>
                    <span>{formatCurrency(currentPeriod.buying_cost)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>↳ {t('fin_rpt_domestic_ship')}</span>
                    <span>{formatCurrency(currentPeriod.domestic_shipping_cost)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>↳ {t('fin_rpt_intl_ship')}</span>
                    <span>{formatCurrency((currentPeriod.cost_of_goods_sold || 0) - (currentPeriod.buying_cost || 0) - (currentPeriod.domestic_shipping_cost || 0))}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Gross Profit */}
              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 rounded-lg">
                <span className="font-medium">{t('fin_rpt_gross_profit')}</span>
                <span className={`font-bold ${(currentPeriod.gross_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(currentPeriod.gross_profit)}
                </span>
              </div>

              <Separator />

              {/* Operating Expenses */}
              <div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium text-red-500">{t('fin_rpt_op_expenses')}</span>
                  <span className="font-bold text-red-500">-{formatCurrency(currentPeriod.operating_expenses)}</span>
                </div>
                <div className="pl-4 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t('fin_rpt_payroll')}</span>
                    <span>{formatCurrency(currentPeriod.payroll_expenses)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Building className="h-3 w-3" /> {t('fin_rpt_rent')}</span>
                    <span>{formatCurrency(currentPeriod.rent_expenses)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('fin_rpt_marketing')}</span>
                    <span>{formatCurrency(currentPeriod.marketing_expenses)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('fin_rpt_other')}</span>
                    <span>{formatCurrency(currentPeriod.other_expenses)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Net Profit */}
              <div className="flex justify-between items-center py-3 bg-primary/10 px-3 rounded-lg">
                <span className="font-bold text-sm sm:text-lg">{t('fin_rpt_net_profit')}</span>
                <span className={`font-bold text-base sm:text-xl ${(currentPeriod.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(currentPeriod.net_profit || 0) >= 0 ? <TrendingUp className="inline h-4 w-4 sm:h-5 sm:w-5 mr-1" /> : <TrendingDown className="inline h-4 w-4 sm:h-5 sm:w-5 mr-1" />}
                  {formatCurrency(currentPeriod.net_profit)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Balance Sheet Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('fin_rpt_balance')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Assets */}
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-3">{t('fin_rpt_assets')}</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-500" />
                      {t('fin_rpt_inventory')}
                    </span>
                    <span className="font-bold text-blue-600">{formatCurrency(currentPeriod.closing_inventory_value)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <span className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-amber-500" />
                      {t('fin_rpt_receivables')}
                    </span>
                    <span className="font-bold text-amber-600">{formatCurrency(currentPeriod.accounts_receivable_total)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Liabilities */}
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-3">{t('fin_rpt_liabilities')}</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <span className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-purple-500" />
                      {t('fin_rpt_payables')}
                    </span>
                    <span className="font-bold text-purple-600">{formatCurrency(currentPeriod.accounts_payable_total)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Working Capital */}
              <div className="p-3 sm:p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
                <h4 className="font-medium text-sm text-muted-foreground mb-2">{t('fin_rpt_working_capital')}</h4>
                <div className="text-xl sm:text-2xl font-bold">
                  {formatCurrency(
                    (currentPeriod.closing_inventory_value || 0) +
                    (currentPeriod.accounts_receivable_total || 0) -
                    (currentPeriod.accounts_payable_total || 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('fin_rpt_working_formula')}
                </p>
              </div>

              {/* Profit Margin */}
              {currentPeriod.revenue && currentPeriod.revenue > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">{t('fin_rpt_gross_margin')}</p>
                    <p className="text-lg font-bold">
                      {(((currentPeriod.gross_profit || 0) / currentPeriod.revenue) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">{t('fin_rpt_net_margin')}</p>
                    <p className="text-lg font-bold">
                      {(((currentPeriod.net_profit || 0) / currentPeriod.revenue) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium mb-2">{t('fin_rpt_no_report')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {months[selectedMonth]} {selectedYear} {t('fin_rpt_calculate_hint')}
            </p>
            <Button onClick={() => calculateMutation.mutate()} disabled={calculateMutation.isPending}>
              {calculateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              {t('fin_rpt_calculate')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Historical Periods */}
      {periods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('fin_rpt_historical')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {periods.slice(0, 6).map((period) => (
                <div
                  key={period.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    const start = new Date(period.period_start);
                    setSelectedYear(start.getFullYear());
                    setSelectedMonth(start.getMonth());
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {format(new Date(period.period_start), 'MMMM yyyy', { locale: uz })}
                    </span>
                    <Badge variant={(period.net_profit || 0) >= 0 ? 'default' : 'destructive'}>
                      {formatCurrency(period.net_profit)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('fin_rpt_revenue')}: {formatCurrency(period.revenue)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
