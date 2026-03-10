import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Warehouse, 
  ShoppingCart, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Package,
  Calendar,
  MapPin,
  Calculator
} from 'lucide-react';

interface ProductItem {
  id: string;
  item_uuid: string;
  status: string;
  location: string;
  unit_cost: number | null;
  unit_cost_currency: string | null;
  unit_cost_usd: number | null;
  sold_at: string | null;
  sold_price: number | null;
  sold_currency: string | null;
  sold_price_usd: number | null;
  product_id: string;
  products: { name: string } | null;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  category: string | null;
  currency: string | null;
  description: string | null;
  created_at: string;
}

interface FinanceDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detailType: string | null;
  productItems: ProductItem[];
  transactions: Transaction[];
  inventoryByLocation: Record<string, { count: number; valueUSD: number }>;
  convertToUSD: (amount: number, currency: string) => number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CNY: '¥',
  UZS: "so'm"
};

const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  if (currency === 'UZS') {
    return `${amount.toLocaleString('uz-UZ')} so'm`;
  }
  return `${CURRENCY_SYMBOLS[currency] || '$'}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function FinanceDetailSheet({
  open,
  onOpenChange,
  detailType,
  productItems,
  transactions,
  inventoryByLocation,
  convertToUSD,
}: FinanceDetailSheetProps) {
  const { t } = useTranslation();

  const locationLabels: Record<string, string> = {
    china: t('fin_loc_china'),
    transit: t('fin_loc_transit'),
    uzbekistan: t('fin_loc_uzbekistan'),
    unknown: t('fin_loc_unknown'),
  };

  const inventoryItems = productItems?.filter(item => item.status !== 'sold') || [];
  const soldItems = productItems?.filter(item => item.status === 'sold') || [];
  const incomeTransactions = transactions?.filter(t => t.transaction_type === 'income') || [];
  const expenseTransactions = transactions?.filter(t => t.transaction_type === 'expense') || [];

  const totalInventoryUSD = inventoryItems.reduce((sum, item) => {
    if (item.unit_cost_usd) return sum + Number(item.unit_cost_usd);
    if (item.unit_cost && item.unit_cost_currency) {
      return sum + convertToUSD(Number(item.unit_cost), item.unit_cost_currency);
    }
    return sum;
  }, 0);

  const totalRevenueUSD = soldItems.reduce((sum, item) => {
    if (item.sold_price_usd) return sum + Number(item.sold_price_usd);
    if (item.sold_price && item.sold_currency) {
      return sum + convertToUSD(Number(item.sold_price), item.sold_currency);
    }
    return sum;
  }, 0);

  const cogsUSD = soldItems.reduce((sum, item) => {
    if (item.unit_cost_usd) return sum + Number(item.unit_cost_usd);
    if (item.unit_cost && item.unit_cost_currency) {
      return sum + convertToUSD(Number(item.unit_cost), item.unit_cost_currency);
    }
    return sum;
  }, 0);

  const totalIncomeUSD = incomeTransactions.reduce((sum, t) => 
    sum + convertToUSD(Number(t.amount), t.currency || 'USD'), 0);
  
  const totalExpenseUSD = expenseTransactions.reduce((sum, t) => 
    sum + convertToUSD(Number(t.amount), t.currency || 'USD'), 0);

  const grossProfitUSD = totalRevenueUSD - cogsUSD;
  const netBalanceUSD = (totalIncomeUSD + totalRevenueUSD) - (totalExpenseUSD + cogsUSD);

  const getTitle = () => {
    switch (detailType) {
      case 'inventory': return t('fin_det_inventory');
      case 'revenue': return t('fin_det_revenue');
      case 'gross_profit': return t('fin_detail_gross');
      case 'net_balance': return t('fin_detail_net');
      case 'income': return t('fin_det_income');
      case 'cogs': return t('fin_det_cogs');
      case 'expenses': return t('fin_det_expenses');
      default: return t('details');
    }
  };

  const getIcon = () => {
    switch (detailType) {
      case 'inventory': return <Warehouse className="h-5 w-5 text-blue-500" />;
      case 'revenue': return <ShoppingCart className="h-5 w-5 text-green-500" />;
      case 'gross_profit': return <TrendingUp className="h-5 w-5 text-purple-500" />;
      case 'net_balance': return <DollarSign className="h-5 w-5 text-primary" />;
      case 'income': return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'cogs': return <Package className="h-5 w-5 text-orange-500" />;
      case 'expenses': return <TrendingDown className="h-5 w-5 text-red-500" />;
      default: return <Calculator className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const renderContent = () => {
    switch (detailType) {
      case 'inventory':
        return (
          <div className="space-y-4">
            {Object.entries(inventoryByLocation).map(([location, data]) => (
              <div key={location} className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{locationLabels[location] || location}</span>
                    <Badge variant="secondary" className="text-xs">{data.count} {t('pcs')}</Badge>
                  </div>
                  <span className="font-semibold text-blue-600">${data.valueUSD.toFixed(2)}</span>
                </div>
                <div className="pl-4 space-y-1 max-h-[200px] overflow-y-auto">
                  {inventoryItems
                    .filter(item => (item.location || 'unknown') === location)
                    .slice(0, 20)
                    .map(item => (
                      <div key={item.id} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[180px]">{item.products?.name || t('unknown')}</span>
                          <span className="text-xs text-muted-foreground font-mono">{item.item_uuid?.slice(0, 8)}</span>
                        </div>
                        <span className="text-primary font-medium">
                          ${item.unit_cost_usd?.toFixed(2) || '—'}
                        </span>
                      </div>
                    ))}
                  {inventoryItems.filter(item => (item.location || 'unknown') === location).length > 20 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{inventoryItems.filter(item => (item.location || 'unknown') === location).length - 20} {t('fin_det_more')}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <span className="font-semibold">{t('fin_total_inv_value')}:</span>
                <span className="text-xl font-bold text-primary">${totalInventoryUSD.toFixed(2)}</span>
              </div>
            </div>
          </div>
        );

      case 'revenue':
        return (
          <div className="space-y-3">
            {soldItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('fin_det_no_sold')}</p>
              </div>
            ) : (
              <>
                {soldItems.map(item => {
                  const itemCost = item.unit_cost_usd || (item.unit_cost && item.unit_cost_currency 
                    ? convertToUSD(Number(item.unit_cost), item.unit_cost_currency) 
                    : 0);
                  const itemRevenue = item.sold_price_usd || (item.sold_price && item.sold_currency 
                    ? convertToUSD(Number(item.sold_price), item.sold_currency) 
                    : 0);
                  const itemProfit = itemRevenue - itemCost;
                  const profitMargin = itemRevenue > 0 ? (itemProfit / itemRevenue) * 100 : 0;
                  
                  return (
                    <div key={item.id} className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-green-500" />
                          <span className="font-medium truncate max-w-[200px]">{item.products?.name || t('unknown')}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{item.item_uuid?.slice(0, 8)}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{t('fin_det_sold_at')}: {item.sold_at ? new Date(item.sold_at).toLocaleDateString() : '—'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">{t('fin_det_selling_price')}</p>
                          <p className="font-medium text-green-600">${itemRevenue.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('fin_det_cost_price')}</p>
                          <p className="font-medium text-red-500">${itemCost.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('fin_det_profit')}</p>
                          <p className={`font-medium ${itemProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            ${itemProfit.toFixed(2)} ({profitMargin.toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                <div className="border-t pt-4 mt-4 space-y-2">
                  <div className="flex justify-between items-center p-2 bg-green-500/10 rounded">
                    <span className="text-sm">{t('fin_det_total_revenue')}:</span>
                    <span className="font-semibold text-green-600">+${totalRevenueUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-red-500/10 rounded">
                    <span className="text-sm">{t('fin_det_total_cogs')}:</span>
                    <span className="font-semibold text-red-500">-${cogsUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                    <span className="font-semibold">{t('fin_gross_profit_label')}:</span>
                    <span className={`text-xl font-bold ${grossProfitUSD >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      ${grossProfitUSD.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 'income':
        return (
          <div className="space-y-3">
            {incomeTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('fin_no_additional_income')}</p>
              </div>
            ) : (
              <>
                {incomeTransactions.map(t_item => (
                  <div key={t_item.id} className="p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(t_item.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{t_item.category || t('fin_uncategorized')}</p>
                        {t_item.description && <p className="text-sm text-muted-foreground">{t_item.description}</p>}
                      </div>
                      <span className="font-semibold text-green-600">
                        +{formatCurrency(Number(t_item.amount), t_item.currency || 'USD')}
                      </span>
                    </div>
                  </div>
                ))}
                
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg">
                    <span className="font-semibold">{t('fin_det_additional_income')}:</span>
                    <span className="text-xl font-bold text-green-600">+${totalIncomeUSD.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 'cogs':
        return (
          <div className="space-y-3">
            {soldItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('fin_no_sold_items')}</p>
              </div>
            ) : (
              <>
                {soldItems.map(item => {
                  const itemCost = item.unit_cost_usd || (item.unit_cost && item.unit_cost_currency 
                    ? convertToUSD(Number(item.unit_cost), item.unit_cost_currency) 
                    : 0);
                  
                  return (
                    <div key={item.id} className="p-3 bg-orange-500/5 rounded-lg border border-orange-500/20">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-orange-500" />
                          <span className="font-medium truncate max-w-[200px]">{item.products?.name || t('unknown')}</span>
                        </div>
                        <span className="font-semibold text-orange-600">
                          ${itemCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="font-mono">{item.item_uuid?.slice(0, 8)}</span>
                        <span>•</span>
                        <span>{t('fin_det_sold_at')}: {item.sold_at ? new Date(item.sold_at).toLocaleDateString() : '—'}</span>
                      </div>
                    </div>
                  );
                })}
                
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center p-3 bg-orange-500/10 rounded-lg">
                    <span className="font-semibold">{t('fin_det_total_cogs')}:</span>
                    <span className="text-xl font-bold text-orange-600">${cogsUSD.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 'expenses':
        return (
          <div className="space-y-3">
            {expenseTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingDown className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('fin_det_no_expenses')}</p>
              </div>
            ) : (
              <>
                {expenseTransactions.map(t_item => (
                  <div key={t_item.id} className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(t_item.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{t_item.category || t('fin_uncategorized')}</p>
                        {t_item.description && <p className="text-sm text-muted-foreground">{t_item.description}</p>}
                      </div>
                      <span className="font-semibold text-red-500">
                        -{formatCurrency(Number(t_item.amount), t_item.currency || 'USD')}
                      </span>
                    </div>
                  </div>
                ))}
                
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg">
                    <span className="font-semibold">{t('fin_det_total_expenses')}:</span>
                    <span className="text-xl font-bold text-red-500">-${totalExpenseUSD.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 'gross_profit':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('fin_det_gross_formula')}
            </p>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-green-500" />
                  <span>{t('fin_det_total_revenue')}</span>
                  <Badge variant="secondary" className="text-xs">{soldItems.length} {t('pcs')}</Badge>
                </div>
                <span className="font-semibold text-green-600">+${totalRevenueUSD.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-red-500" />
                  <span>COGS</span>
                </div>
                <span className="font-semibold text-red-500">-${cogsUSD.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center p-4 bg-purple-500/10 rounded-lg">
                <span className="font-semibold text-lg">{t('fin_gross_profit_label')}:</span>
                <span className={`text-2xl font-bold ${grossProfitUSD >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  ${grossProfitUSD.toFixed(2)}
                </span>
              </div>
              {totalRevenueUSD > 0 && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  {t('fin_det_profit_margin')}: {((grossProfitUSD / totalRevenueUSD) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        );

      case 'net_balance':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('fin_det_net_formula')}
            </p>
            
            <div className="space-y-3">
              <h4 className="font-medium text-green-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t('fin_det_income_label')}
              </h4>
              <div className="pl-4 space-y-2">
                <div className="flex justify-between items-center p-2 bg-green-500/5 rounded">
                  <span className="text-sm">{t('fin_det_total_revenue')} ({soldItems.length} {t('pcs')})</span>
                  <span className="font-medium text-green-600">+${totalRevenueUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-500/5 rounded">
                  <span className="text-sm">{t('fin_det_additional_income')} ({incomeTransactions.length} {t('pcs')})</span>
                  <span className="font-medium text-green-600">+${totalIncomeUSD.toFixed(2)}</span>
                </div>
              </div>
              
              <h4 className="font-medium text-red-500 flex items-center gap-2 mt-4">
                <TrendingDown className="h-4 w-4" />
                {t('fin_det_expense_label')}
              </h4>
              <div className="pl-4 space-y-2">
                <div className="flex justify-between items-center p-2 bg-red-500/5 rounded">
                  <span className="text-sm">{t('fin_det_sold_cogs')}</span>
                  <span className="font-medium text-red-500">-${cogsUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-500/5 rounded">
                  <span className="text-sm">{t('fin_det_other_expenses')} ({expenseTransactions.length} {t('pcs')})</span>
                  <span className="font-medium text-red-500">-${totalExpenseUSD.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
                <span className="font-semibold text-lg">{t('fin_det_net_balance')}:</span>
                <span className={`text-2xl font-bold ${netBalanceUSD >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  ${netBalanceUSD.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        );

      default:
        return <p className="text-muted-foreground">{t('fin_no_data_available')}</p>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          {renderContent()}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
