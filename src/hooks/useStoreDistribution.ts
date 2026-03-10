import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreDistribution {
  id: string;
  store_id: string;
  investor_share_pct: number;
  investor_user_id: string | null;
  store_name?: string;
  platform?: string;
}

export interface StoreFinanceWithDistribution {
  storeId: string;
  storeName: string;
  platform: string;
  grossRevenue: number;
  commission: number;
  deliveryFees: number;
  netRevenue: number;
  boshMenejerShare: number;
  investorShare: number;
  ownerShare: number;
  boshMenejerPct: number;
  investorPct: number;
}

export function useStoreDistribution() {
  const { data: distributions, isLoading: distributionsLoading } = useQuery({
    queryKey: ['store-profit-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_profit_distribution' as any)
        .select('*, marketplace_stores(name, platform)')
        .order('created_at');
      if (error) throw error;
      return (data as any[])?.map((d: any) => ({
        id: d.id,
        store_id: d.store_id,
        investor_share_pct: Number(d.investor_share_pct) || 0,
        investor_user_id: d.investor_user_id,
        store_name: d.marketplace_stores?.name,
        platform: d.marketplace_stores?.platform,
      })) || [];
    },
  });

  const getDistributionForStore = (storeId: string): StoreDistribution | undefined => {
    return distributions?.find(d => d.store_id === storeId);
  };

  const calculateDistribution = (
    storeId: string,
    netRevenue: number
  ): { boshMenejerShare: number; investorShare: number; ownerShare: number; taxAmount: number; ownerNet: number; boshMenejerPct: number; investorPct: number } => {
    const dist = getDistributionForStore(storeId);
    const storeInvestorPct = dist?.investor_share_pct ?? 0;
    const isBMStore = storeInvestorPct > 0;
    const TAX_PCT = 4;

    // Bosh Menejer: 5% from BM stores, 25% from non-BM stores
    const boshMenejerPct = isBMStore ? 5 : 25;
    const investorPct = isBMStore ? 50 : 0;
    const ownerPct = isBMStore ? 45 : 75;

    const boshMenejerShare = netRevenue * (boshMenejerPct / 100);
    const investorShare = netRevenue * (investorPct / 100);
    const ownerShare = netRevenue * (ownerPct / 100);
    const taxAmount = ownerShare > 0 ? ownerShare * (TAX_PCT / 100) : 0;
    const ownerNet = ownerShare - taxAmount;

    return { boshMenejerShare, investorShare, ownerShare, taxAmount, ownerNet, boshMenejerPct, investorPct };
  };

  const bmStoreIds = distributions?.filter(d => d.investor_share_pct > 0).map(d => d.store_id) || [];
  const investorStores = distributions?.filter(d => d.investor_user_id && d.investor_share_pct > 0) || [];

  return {
    distributions: distributions || [],
    distributionsLoading,
    getDistributionForStore,
    calculateDistribution,
    bmStoreIds,
    investorStores,
  };
}

/**
 * Hook for investor/admin view: fetches finance data for BM stores
 * Issue 3: Admin users see all BM stores, investors see only their assigned stores
 * Issue 5: Supports optional date filtering
 */
export function useInvestorFinance(
  investorUserId: string | undefined,
  isAdmin: boolean = false,
  dateRange?: { startDate: string; endDate: string }
) {
  // For admins: fetch ALL investor-linked distributions
  // For investors: fetch only their assigned stores
  const { data: investorDistributions, isLoading: distLoading } = useQuery({
    queryKey: ['investor-distributions', investorUserId, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('store_profit_distribution' as any)
        .select('*, marketplace_stores(name, platform)');
      
      if (isAdmin) {
        // Admin sees all BM stores (those with investor_share_pct > 0)
        query = query.gt('investor_share_pct', 0);
      } else {
        // Investor sees only their stores
        query = query.eq('investor_user_id', investorUserId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data as any[])?.map((d: any) => ({
        store_id: d.store_id,
        investor_share_pct: Number(d.investor_share_pct) || 0,
        store_name: d.marketplace_stores?.name || 'Unknown',
        platform: d.marketplace_stores?.platform || 'unknown',
      })) || [];
    },
    enabled: !!investorUserId || isAdmin,
  });

  const storeIds = investorDistributions?.map(d => d.store_id) || [];

  const { data: financeSummaries, isLoading: financeLoading } = useQuery({
    queryKey: ['investor-finance-summaries', storeIds, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      let query = supabase
        .from('marketplace_finance_summary')
        .select('*')
        .in('store_id', storeIds)
        .order('period_date', { ascending: false });
      
      // Issue 5: Apply date filtering
      if (dateRange?.startDate) {
        query = query.gte('period_date', dateRange.startDate);
      }
      if (dateRange?.endDate) {
        query = query.lte('period_date', dateRange.endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: storeIds.length > 0,
  });

  // Calculate per-store totals with distribution (aligned with calculateDistribution)
  const storeFinances: StoreFinanceWithDistribution[] = (investorDistributions || []).map(dist => {
    const storeSummaries = financeSummaries?.filter(s => s.store_id === dist.store_id) || [];
    const grossRevenue = storeSummaries.reduce((sum, s) => sum + (s.gross_revenue || 0), 0);
    const commission = storeSummaries.reduce((sum, s) => sum + (s.commission_total || 0), 0);
    const deliveryFees = storeSummaries.reduce((sum, s) => sum + (s.delivery_fees || 0), 0);
    const netRevenue = grossRevenue - commission - deliveryFees;

    // Use same logic as calculateDistribution: BM stores = 5% BM, non-BM = 25% BM
    const isBMStore = dist.investor_share_pct > 0;
    const boshMenejerPct = isBMStore ? 5 : 25;
    const investorPct = isBMStore ? 50 : 0;
    const boshMenejerShare = netRevenue * (boshMenejerPct / 100);
    const investorShare = netRevenue * (investorPct / 100);
    const ownerPct = 100 - boshMenejerPct - investorPct;
    const ownerShare = netRevenue * (ownerPct / 100);

    return {
      storeId: dist.store_id,
      storeName: dist.store_name,
      platform: dist.platform,
      grossRevenue,
      commission,
      deliveryFees,
      netRevenue,
      boshMenejerShare,
      investorShare,
      ownerShare,
      boshMenejerPct,
      investorPct,
    };
  });

  const totals = storeFinances.reduce(
    (acc, sf) => ({
      grossRevenue: acc.grossRevenue + sf.grossRevenue,
      commission: acc.commission + sf.commission,
      deliveryFees: acc.deliveryFees + sf.deliveryFees,
      netRevenue: acc.netRevenue + sf.netRevenue,
      boshMenejerShare: acc.boshMenejerShare + sf.boshMenejerShare,
      investorShare: acc.investorShare + sf.investorShare,
      ownerShare: acc.ownerShare + sf.ownerShare,
    }),
    { grossRevenue: 0, commission: 0, deliveryFees: 0, netRevenue: 0, boshMenejerShare: 0, investorShare: 0, ownerShare: 0 }
  );

  // Separate unfiltered query for trend chart (always shows last 12 months)
  const twelveMonthsAgo = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().substring(0, 10);
  })();

  const { data: trendSummaries } = useQuery({
    queryKey: ['investor-trend-summaries', storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data, error } = await supabase
        .from('marketplace_finance_summary')
        .select('*')
        .in('store_id', storeIds)
        .gte('period_date', twelveMonthsAgo)
        .order('period_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: storeIds.length > 0,
  });

  // Monthly trend for investor earnings (uses unfiltered data)
  const monthlyTrend = (() => {
    if (!trendSummaries || trendSummaries.length === 0) return [];
    const monthMap: Record<string, number> = {};
    const distMap = Object.fromEntries((investorDistributions || []).map(d => [d.store_id, d]));

    for (const s of trendSummaries) {
      const month = s.period_date?.substring(0, 7); // YYYY-MM
      if (!month) continue;
      const net = (s.gross_revenue || 0) - (s.commission_total || 0) - (s.delivery_fees || 0);
      const dist = distMap[s.store_id];
      const isBMStore = (dist?.investor_share_pct ?? 0) > 0;
      const investorPct = isBMStore ? 50 : 0;
      const investorEarning = net * (investorPct / 100);
      monthMap[month] = (monthMap[month] || 0) + investorEarning;
    }

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amount]) => ({ month, amount }));
  })();

  return {
    storeFinances,
    totals,
    monthlyTrend,
    isLoading: distLoading || financeLoading,
    investorDistributions: investorDistributions || [],
  };
}
