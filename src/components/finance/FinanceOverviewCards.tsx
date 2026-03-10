import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Package, DollarSign } from 'lucide-react';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';

interface FinanceOverviewCardsProps {
  netRevenueUZS: number;
  totalCOGSUZS: number;
  netProfitUZS: number;
  inventoryValueUZS: number;
  inventoryCount: number;
  grossRevenueUZS?: number;
  marginPct?: number;
  onCardClick?: (type: string) => void;
  revenueSubItems?: { label: string; value: string; color?: string }[];
  cogsSubItems?: { label: string; value: string; color?: string }[];
}

export function FinanceOverviewCards({
  netRevenueUZS,
  totalCOGSUZS,
  netProfitUZS,
  inventoryValueUZS,
  inventoryCount,
  grossRevenueUZS,
  marginPct,
  onCardClick,
  revenueSubItems,
  cogsSubItems,
}: FinanceOverviewCardsProps) {
  const { t } = useTranslation();
  const { formatMoney } = useFinanceCurrency();

  const profitMargin = marginPct ?? (netRevenueUZS > 0 ? (netProfitUZS / netRevenueUZS) * 100 : 0);

  const cards = [
    {
      title: t('fin_pl_net_revenue'),
      value: formatMoney(netRevenueUZS),
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      type: 'revenue',
      badge: grossRevenueUZS ? `${t('fin_pl_gross_revenue')}: ${formatMoney(grossRevenueUZS)}` : undefined,
      subItems: revenueSubItems,
    },
    {
      title: t('fin_pl_cogs'),
      value: formatMoney(totalCOGSUZS),
      icon: TrendingDown,
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      type: 'cogs',
      subItems: cogsSubItems,
    },
    {
      title: t('fin_net_profit'),
      value: formatMoney(netProfitUZS),
      icon: netProfitUZS >= 0 ? TrendingUp : TrendingDown,
      color: netProfitUZS >= 0 ? 'text-emerald-500' : 'text-red-500',
      bgColor: netProfitUZS >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30',
      type: 'profit',
      badge: t('fin_margin', { percent: profitMargin.toFixed(1) }),
    },
    {
      title: t('fin_inventory_value'),
      value: formatMoney(inventoryValueUZS),
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      type: 'inventory',
      badge: t('fin_pcs', { count: inventoryCount }),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => (
        <Card
          key={card.type}
          className={`cursor-pointer hover:shadow-md transition-all ${card.bgColor}`}
          onClick={() => onCardClick?.(card.type)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-base sm:text-xl lg:text-2xl font-bold leading-tight break-all">{card.value}</div>
            {card.badge && (
              <Badge variant="secondary" className="mt-2 text-xs">
                {card.badge}
              </Badge>
            )}
            {card.subItems && (
              <div className="mt-3 space-y-1">
                {card.subItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.label}</span>
                    <span className={`font-medium ${item.color || ''}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
