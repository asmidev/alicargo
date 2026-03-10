import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useInvestorFinance } from '@/hooks/useStoreDistribution';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Store,
  TrendingUp,
  Percent,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function InvestorDashboardContent() {
  const { hasAnyRole, isInvestor, isAdmin } = useUserRole();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { formatMoney, convertFromUZS } = useFinanceCurrency();

  // Issue 6: Remove moliya_xodimi from access
  const canAccess = hasAnyRole(['rahbar', 'bosh_admin', 'investor']);

  // Issue 5: Period filter
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
  const endDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  // Issue 3: Admin sees all BM stores, investor sees only their stores
  const { storeFinances, totals, monthlyTrend, isLoading } = useInvestorFinance(
    user?.id,
    isAdmin,
    { startDate, endDate }
  );

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t('invd_no_access')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('invd_title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            BM do'konlar moliyaviy ko'rsatkichlari
          </p>
        </div>
        {/* Issue 5: Period selector */}
        <div className="flex items-center gap-2">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'].map((m, i) => (
                <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton count={4} compact />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Jami daromad
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-green-600">{formatMoney(totals.grossRevenue)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  Komissiya
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-red-500">-{formatMoney(totals.commission + totals.deliveryFees)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Sof daromad
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className={cn("text-lg sm:text-2xl font-bold", totals.netRevenue >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {formatMoney(totals.netRevenue)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-primary flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  {isInvestor ? 'Sizning ulushingiz' : 'Investor ulushi'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className={cn(
                  "text-lg sm:text-2xl font-bold flex items-center gap-1",
                  totals.investorShare >= 0 ? 'text-primary' : 'text-red-600'
                )}>
                  {totals.investorShare >= 0 ? <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" /> : <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5" />}
                  {formatMoney(totals.investorShare)}
                </div>
                <Badge variant="outline" className="text-[10px] mt-1 text-muted-foreground">
                  Tannarx hisobga olinmagan
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Per-Store Breakdown */}
          <div className="grid gap-4 md:grid-cols-3">
            {storeFinances.map((sf) => (
              <Card key={sf.storeId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Store className={cn("h-4 w-4", sf.platform === 'uzum' ? 'text-purple-500' : 'text-yellow-500')} />
                    {sf.storeName}
                    <Badge variant="outline" className="text-xs capitalize">{sf.platform}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jami daromad</span>
                    <span className="font-medium text-green-600">{formatMoney(sf.grossRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Komissiya + yetkazish</span>
                    <span className="text-red-500">-{formatMoney(sf.commission + sf.deliveryFees)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sof daromad</span>
                    <span className="font-medium">{formatMoney(sf.netRevenue)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">BM ulushi ({sf.boshMenejerPct}%)</span>
                      <span className="text-red-500">-{formatMoney(sf.boshMenejerShare)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-primary">
                      <span>{isInvestor ? 'Sizning ulush' : 'Investor ulushi'} ({sf.investorPct}%)</span>
                      <span>{formatMoney(sf.investorShare)}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] mt-1 text-muted-foreground">
                      Tannarx hisobga olinmagan
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Monthly Trend */}
          {monthlyTrend.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5" />
                  Oylik investor daromadi
                </CardTitle>
                <CardDescription>Oxirgi oylar bo'yicha investor ulushi</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyTrend}>
                      <defs>
                        <linearGradient id="investorGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={(v) => {
                        const converted = convertFromUZS(v);
                        return `${(converted / 1_000_000).toFixed(0)}M`;
                      }} />
                      <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#investorGrad)" name="Investor ulushi" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info card */}
          {isInvestor && storeFinances.length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Siz {storeFinances.length} ta BM do'kondan sof daromadning to'g'ridan-to'g'ri {storeFinances[0]?.investorPct || 50}% ulushiga egasiz. 
                  Taqsimot: BM 5%, Investor {storeFinances[0]?.investorPct || 50}%, Egasi {100 - 5 - (storeFinances[0]?.investorPct || 50)}% (tannarx hisobga olinmagan).
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function InvestorDashboard() {
  return <InvestorDashboardContent />;
}
