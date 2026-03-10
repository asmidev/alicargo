import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DisplayCurrency = 'UZS' | 'USD' | 'CNY';

// Fallback rates (used until live rates load)
const DEFAULT_USD_TO_UZS = 12800;
const DEFAULT_CNY_TO_UZS = 1750;

interface FinanceCurrencyContextValue {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  formatMoney: (amountInUZS: number) => string;
  convertFromUZS: (amountInUZS: number) => number;
  formatMoneyUSD: (amountInUSD: number) => string;
  usdToUzs: number;
  cnyToUzs: number;
  isManualRate: boolean;
  rateSource: string;
  refetchRates: () => void;
  saveManualRate: (usd: number, cny: number) => Promise<void>;
  resetToAutoRate: () => Promise<void>;
  /** @deprecated use isManualRate */
  isSessionOverride: boolean;
  /** @deprecated use saveManualRate */
  setSessionRate: (usd: number, cny: number) => void;
  /** @deprecated use resetToAutoRate */
  resetSessionRate: () => void;
}

const FinanceCurrencyContext = createContext<FinanceCurrencyContextValue | null>(null);

export function FinanceCurrencyProvider({ children }: { children: ReactNode }) {
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('UZS');
  const [dbUsdRate, setDbUsdRate] = useState(DEFAULT_USD_TO_UZS);
  const [dbCnyRate, setDbCnyRate] = useState(DEFAULT_CNY_TO_UZS);
  const [isManualRate, setIsManualRate] = useState(false);
  const [rateSource, setRateSource] = useState('loading');
  const queryClient = useQueryClient();

  const usdToUzs = dbUsdRate;
  const cnyToUzs = dbCnyRate;

  // Fetch live exchange rates from DB history
  const { data: rateData, refetch: refetchRates } = useQuery({
    queryKey: ['exchange-rates-history-latest'],
    queryFn: async () => {
      const { data } = await supabase
        .from('exchange_rates_history')
        .select('rates, source, is_manual')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (rateData?.rates) {
      const rates = rateData.rates as Record<string, number>;
      const uzs = rates.UZS || DEFAULT_USD_TO_UZS;
      const cnyDirectUzs = rates.CNY_TO_UZS;
      const cny = rates.CNY || 7.25;
      
      setDbUsdRate(uzs);
      setDbCnyRate(cnyDirectUzs || (uzs / cny));
      setIsManualRate(rateData.is_manual === true);
      setRateSource(rateData.source || 'unknown');
    }
  }, [rateData]);

  // Save manual rate to DB (persisted)
  const saveManualRate = useCallback(async (usd: number, cny: number) => {
    const { error } = await supabase
      .from('exchange_rates_history')
      .insert({
        base_currency: 'USD',
        rates: { UZS: usd, CNY_TO_UZS: cny } as any,
        source: 'manual',
        is_manual: true,
      });
    
    if (!error) {
      // Immediately update local state for instant UI feedback
      setDbUsdRate(usd);
      setDbCnyRate(cny);
      setIsManualRate(true);
      setRateSource('manual');
      // Invalidate query so other components also get the new rate
      queryClient.invalidateQueries({ queryKey: ['exchange-rates-history-latest'] });
    }
  }, [queryClient]);

  // Reset to auto bank rate by calling exchange-rates edge function
  const resetToAutoRate = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('exchange-rates');
      if (!error) {
        // The edge function inserts a new row with is_manual=false, just refetch
        queryClient.invalidateQueries({ queryKey: ['exchange-rates-history-latest'] });
      }
    } catch (e) {
      console.error('Failed to reset to auto rate:', e);
    }
  }, [queryClient]);

  // Legacy compat
  const setSessionRate = useCallback((usd: number, cny: number) => {
    saveManualRate(usd, cny);
  }, [saveManualRate]);
  const resetSessionRate = useCallback(() => {
    resetToAutoRate();
  }, [resetToAutoRate]);

  const convertFromUZS = useCallback((amountInUZS: number): number => {
    switch (displayCurrency) {
      case 'UZS': return amountInUZS;
      case 'USD': return amountInUZS / usdToUzs;
      case 'CNY': return amountInUZS / cnyToUzs;
    }
  }, [displayCurrency, usdToUzs, cnyToUzs]);

  const formatMoney = useCallback((amountInUZS: number): string => {
    const converted = convertFromUZS(amountInUZS);
    switch (displayCurrency) {
      case 'UZS':
        return `${converted.toLocaleString('uz-UZ')} so'm`;
      case 'USD':
        return `$${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'CNY':
        return `¥${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }, [displayCurrency, convertFromUZS]);

  const formatMoneyUSD = useCallback((amountInUSD: number): string => {
    return formatMoney(amountInUSD * usdToUzs);
  }, [formatMoney, usdToUzs]);

  return (
    <FinanceCurrencyContext.Provider value={{ 
      displayCurrency, setDisplayCurrency, formatMoney, convertFromUZS, formatMoneyUSD, 
      usdToUzs, cnyToUzs, isManualRate, rateSource, refetchRates,
      saveManualRate, resetToAutoRate,
      isSessionOverride: isManualRate,
      setSessionRate, resetSessionRate,
    }}>
      {children}
    </FinanceCurrencyContext.Provider>
  );
}


export function useFinanceCurrency() {
  const context = useContext(FinanceCurrencyContext);
  if (!context) {
    throw new Error('useFinanceCurrency must be used within a FinanceCurrencyProvider');
  }
  return context;
}
