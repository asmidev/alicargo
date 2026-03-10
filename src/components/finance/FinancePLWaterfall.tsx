import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface PLData {
  marketplaceGrossUZS: number;
  marketplaceCommissionUZS: number;
  marketplaceDeliveryFeesUZS: number;
  directSalesUZS: number;
  otherIncomeUZS: number;
  buyingCostUZS: number;
  domesticShippingUZS: number;
  internationalShippingUZS: number;
  otherExpensesUZS: number;
}

interface StoreBreakdown {
  storeId: string;
  storeName: string;
  platform: string;
  netRevenue: number;
  investorShare: number;
  boshMenejerShare: number;
  taxAmount: number;
  ownerShare: number;
  investorPct: number;
  boshMenejerPct: number;
}

interface FinancePLWaterfallProps {
  data: PLData;
  storeBreakdown: StoreBreakdown[];
  showDistribution: boolean;
  totalInvestorShareUZS: number;
  totalBoshMenejerShareUZS: number;
  totalTaxUZS: number;
  onDetailClick?: (type: string) => void;
}

function PLRow({ label, amount, pct, indent = false, isTotal = false, isSub = false, color }: {
  label: string;
  amount: number;
  pct?: number;
  indent?: boolean;
  isTotal?: boolean;
  isSub?: boolean;
  color?: 'green' | 'red' | 'blue' | 'emerald' | 'amber';
}) {
  const { formatMoney } = useFinanceCurrency();
  const colorClasses = {
    green: 'text-green-600',
    red: 'text-red-500',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
  };
  const textColor = color ? colorClasses[color] : 'text-foreground';

  return (
    <TableRow className={isTotal ? 'bg-muted/50 font-semibold' : ''}>
      <TableCell className={`${indent ? 'pl-8' : 'pl-4'} ${isTotal ? 'font-semibold' : ''} ${isSub ? 'text-muted-foreground text-xs' : 'text-sm'}`}>
        {isSub ? `↳ ${label}` : label}
      </TableCell>
      <TableCell className={`text-right ${textColor} ${isTotal ? 'text-base font-bold' : 'text-sm'}`}>
        {amount < 0 ? `-${formatMoney(Math.abs(amount))}` : (amount > 0 && color === 'red' ? `-${formatMoney(amount)}` : formatMoney(amount))}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground w-[70px]">
        {pct !== undefined ? `${pct.toFixed(1)}%` : ''}
      </TableCell>
    </TableRow>
  );
}

export function FinancePLWaterfall({ data, storeBreakdown, showDistribution, totalInvestorShareUZS, totalBoshMenejerShareUZS, totalTaxUZS, onDetailClick }: FinancePLWaterfallProps) {
  const { t } = useTranslation();
  const { formatMoney } = useFinanceCurrency();
  const [storeOpen, setStoreOpen] = useState(false);

  const grossRevenue = data.marketplaceGrossUZS + data.directSalesUZS + data.otherIncomeUZS;
  const marketplaceDeductions = data.marketplaceCommissionUZS + data.marketplaceDeliveryFeesUZS;
  const netRevenue = grossRevenue - marketplaceDeductions;
  const totalCOGS = data.buyingCostUZS + data.domesticShippingUZS + data.internationalShippingUZS;
  const grossProfit = netRevenue - totalCOGS;
  const operatingProfit = grossProfit - data.otherExpensesUZS;
  // Distributions from net revenue; COGS and expenses separate
  const totalDistributions = totalBoshMenejerShareUZS + totalInvestorShareUZS + totalTaxUZS;
  const ownerNet = netRevenue - totalDistributions - totalCOGS - data.otherExpensesUZS;

  const pct = (val: number) => grossRevenue > 0 ? (val / grossRevenue) * 100 : 0;

  return (
    <Card className="p-4 sm:p-6 bg-card border-border">
      <h3 className="text-lg font-semibold mb-4">{t('fin_profit_loss')}</h3>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[55%]">{t('fin_pl_line_item')}</TableHead>
              <TableHead className="text-right">{t('fin_pl_amount')}</TableHead>
              <TableHead className="text-right w-[70px]">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Gross Revenue */}
            <PLRow label={t('fin_pl_gross_revenue')} amount={grossRevenue} pct={100} isTotal color="green" />
            <PLRow label={t('fin_pl_mp_gross')} amount={data.marketplaceGrossUZS} pct={pct(data.marketplaceGrossUZS)} isSub indent />
            <PLRow label={t('fin_direct_sales')} amount={data.directSalesUZS} pct={pct(data.directSalesUZS)} isSub indent />
            <PLRow label={t('fin_other_income')} amount={data.otherIncomeUZS} pct={pct(data.otherIncomeUZS)} isSub indent />

            {/* Marketplace Deductions */}
            {marketplaceDeductions > 0 && (
              <>
                <PLRow label={`(−) ${t('fin_pl_mp_deductions')}`} amount={marketplaceDeductions} pct={pct(marketplaceDeductions)} color="red" />
                <PLRow
                  label={`${t('fin_commission')} (${grossRevenue > 0 ? ((data.marketplaceCommissionUZS / grossRevenue) * 100).toFixed(1) : '0'}%)`}
                  amount={data.marketplaceCommissionUZS} pct={pct(data.marketplaceCommissionUZS)} isSub indent color="red"
                />
                <PLRow label={t('fin_fee_delivery')} amount={data.marketplaceDeliveryFeesUZS} pct={pct(data.marketplaceDeliveryFeesUZS)} isSub indent color="red" />
              </>
            )}

            {/* Net Revenue */}
            <PLRow label={`= ${t('fin_pl_net_revenue')}`} amount={netRevenue} pct={pct(netRevenue)} isTotal color="emerald" />

            {/* COGS */}
            <PLRow label={`(−) ${t('fin_pl_cogs')}`} amount={totalCOGS} pct={pct(totalCOGS)} color="red" />
            <PLRow label={t('fin_buying_cost')} amount={data.buyingCostUZS} pct={pct(data.buyingCostUZS)} isSub indent color="red" />
            <PLRow label={t('fin_domestic_shipping')} amount={data.domesticShippingUZS} pct={pct(data.domesticShippingUZS)} isSub indent color="red" />
            <PLRow label={t('fin_intl_shipping')} amount={data.internationalShippingUZS} pct={pct(data.internationalShippingUZS)} isSub indent color="red" />

            {/* Gross Profit */}
            <PLRow label={`= ${t('fin_pl_gross_profit')}`} amount={grossProfit} pct={pct(grossProfit)} isTotal color={grossProfit >= 0 ? 'emerald' : 'red'} />

            {/* Other Expenses */}
            {data.otherExpensesUZS > 0 && (
              <PLRow label={`(−) ${t('fin_other_expenses')}`} amount={data.otherExpensesUZS} pct={pct(data.otherExpensesUZS)} color="red" />
            )}

            {/* Profit Distribution */}
            {showDistribution && (
              <>
                <PLRow label={`(−) Bosh menejer ulushi`} amount={totalBoshMenejerShareUZS} pct={pct(totalBoshMenejerShareUZS)} color="amber" />
                {totalInvestorShareUZS > 0 && (
                  <PLRow label={`(−) ${t('fin_pl_investor_bm')}`} amount={totalInvestorShareUZS} pct={pct(totalInvestorShareUZS)} color="amber" />
                )}
                <PLRow label={`(−) ${t('fin_pl_tax', { pct: '4' })}`} amount={totalTaxUZS} pct={pct(totalTaxUZS)} color="red" />
                <PLRow label={`= ${t('fin_pl_owner_net')}`} amount={ownerNet} pct={pct(ownerNet)} isTotal color={ownerNet >= 0 ? 'blue' : 'red'} />
                <TableRow>
                  <TableCell colSpan={3} className="text-xs text-muted-foreground italic pt-1 pb-0">
                    ⓘ Taqsimotlar sof daromaddan hisoblanadi. Tannarx va boshqa xarajatlar alohida hisobga olinadi.
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Per-store breakdown */}
      {showDistribution && storeBreakdown.length > 0 && (
        <Collapsible open={storeOpen} onOpenChange={setStoreOpen} className="mt-4">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2">
            {storeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {t('fin_pl_store_breakdown')}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-x-auto mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fin_pl_store')}</TableHead>
                    <TableHead className="text-right">{t('fin_pl_net_revenue')}</TableHead>
                    <TableHead className="text-right">BM ulushi</TableHead>
                    <TableHead className="text-right">{t('fin_pl_investor_bm')}</TableHead>
                    <TableHead className="text-right">{t('fin_pl_tax', { pct: '4' })}</TableHead>
                    <TableHead className="text-right">{t('fin_pl_owner_net')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storeBreakdown.map((sb) => (
                    <TableRow key={sb.storeId}>
                      <TableCell className="text-sm">
                        <span className={sb.platform === 'uzum' ? 'text-purple-600' : 'text-yellow-600'}>
                          {sb.platform === 'uzum' ? '🟣' : '🔴'}
                        </span>{' '}
                        {sb.storeName}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatMoney(sb.netRevenue)}</TableCell>
                      <TableCell className="text-right text-sm text-amber-600">
                        -{formatMoney(sb.boshMenejerShare)} ({sb.boshMenejerPct}%)
                      </TableCell>
                      <TableCell className="text-right text-sm text-amber-600">
                        {sb.investorShare > 0 ? `-${formatMoney(sb.investorShare)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-500">
                        -{formatMoney(sb.taxAmount)}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-bold ${sb.ownerShare >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatMoney(sb.ownerShare)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
