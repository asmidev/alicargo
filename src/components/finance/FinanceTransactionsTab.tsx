import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { TrendingUp, TrendingDown, DollarSign, Search, Filter, Edit, Trash2, Plus } from 'lucide-react';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CNY: '¥',
  UZS: "so'm"
};

const formatCurrency = (amount: number, currency: string): string => {
  if (currency === 'UZS') return `${amount.toLocaleString('uz-UZ')} so'm`;
  return `${CURRENCY_SYMBOLS[currency] || ''}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface FinanceTransactionsTabProps {
  transactions: any[];
  isLoading: boolean;
  currencyBreakdown: Record<string, { income: number; expense: number }>;
  totalIncomeUSD: number;
  totalExpenseUSD: number;
  canAddManual: boolean;
  canEditManual: boolean;
  canDelete: boolean;
  onAdd: () => void;
  onEdit: (transaction: any) => void;
  onDelete: (transaction: any) => void;
}

export function FinanceTransactionsTab({
  transactions,
  isLoading,
  currencyBreakdown,
  totalIncomeUSD,
  totalExpenseUSD,
  canAddManual,
  canEditManual,
  canDelete,
  onAdd,
  onEdit,
  onDelete,
}: FinanceTransactionsTabProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');

  const filtered = transactions.filter(transaction => {
    if (typeFilter !== 'all' && transaction.transaction_type !== typeFilter) return false;
    if (currencyFilter !== 'all' && transaction.currency !== currencyFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return transaction.category?.toLowerCase().includes(q) || transaction.description?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{t('fin_additional_income_card')}</p>
              <p className="text-2xl font-bold text-foreground">${totalIncomeUSD.toFixed(2)}</p>
              {Object.keys(currencyBreakdown).length > 1 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(currencyBreakdown).map(([currency, data]) =>
                    data.income > 0 ? (
                      <span key={currency} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {formatCurrency(data.income, currency)}
                      </span>
                    ) : null
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{t('fin_additional_expense_card')}</p>
              <p className="text-2xl font-bold text-foreground">${totalExpenseUSD.toFixed(2)}</p>
              {Object.keys(currencyBreakdown).length > 1 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(currencyBreakdown).map(([currency, data]) =>
                    data.expense > 0 ? (
                      <span key={currency} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {formatCurrency(data.expense, currency)}
                      </span>
                    ) : null
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{t('fin_transaction_balance')}</p>
              <p className={`text-2xl font-bold ${(totalIncomeUSD - totalExpenseUSD) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${(totalIncomeUSD - totalExpenseUSD).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-card border-border">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t('fin_transaction_list')}</h2>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('fin_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border min-h-[44px]"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-input border-border min-h-[44px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('fin_type')} />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">{t('all')}</SelectItem>
              <SelectItem value="income">{t('fin_income')}</SelectItem>
              <SelectItem value="expense">{t('fin_expense')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="w-full sm:w-[130px] bg-input border-border min-h-[44px]">
              <DollarSign className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('fin_currency')} />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">{t('all')}</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="CNY">CNY (¥)</SelectItem>
              <SelectItem value="UZS">UZS (so'm)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <LoadingSkeleton count={5} />
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-xl hover:bg-muted/70 transition-all duration-200"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    transaction.transaction_type === 'income' ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                    {transaction.transaction_type === 'income' ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{transaction.category}</p>
                    <p className="text-sm text-muted-foreground">{transaction.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                  <div className="text-left sm:text-right">
                    <p className={`text-base sm:text-lg font-semibold ${
                      transaction.transaction_type === 'income' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {transaction.transaction_type === 'income' ? '+' : '-'}
                      {transaction.amount} {transaction.currency}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {canEditManual && (transaction.reference_type === 'manual' || transaction.reference_type === null) && (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(transaction)} className="h-10 w-10 p-0" aria-label={t('edit')}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => onDelete(transaction)} className="h-10 w-10 p-0 text-destructive hover:text-destructive" aria-label={t('delete')}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <div className="text-center py-12">
            <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-2">{t('fin_no_search_results')}</p>
            <p className="text-sm text-muted-foreground">{t('fin_no_search_hint')}</p>
          </div>
        ) : (
          <div className="text-center py-12">
            <DollarSign className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">{t('fin_no_transactions')}</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">{t('fin_no_transactions_hint')}</p>
            {canAddManual && (
              <Button onClick={onAdd} className="gap-2 bg-gradient-to-r from-primary to-secondary">
                <Plus className="h-4 w-4" /> {t('fin_add_first')}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
