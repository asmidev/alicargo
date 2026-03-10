import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Store } from 'lucide-react';
import { DashboardLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { StoreFinanceCard } from './StoreFinanceCard';
import { AllStoresCombinedView } from './AllStoresCombinedView';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { LayoutGrid } from 'lucide-react';

interface MarketplaceStore {
  id: string;
  name: string;
  platform: string;
  is_active: boolean;
}

interface AllStoresFinanceTabProps {
  platform?: 'uzum' | 'yandex';
  selectedMonth?: number;
  selectedYear?: number;
}

export function AllStoresFinanceTab({ platform, selectedMonth, selectedYear }: AllStoresFinanceTabProps) {
  const { t } = useTranslation();
  const [selectedStore, setSelectedStore] = useState<string>('all');

  const { data: stores, isLoading } = useQuery({
    queryKey: ['marketplace-stores', platform],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_stores')
        .select('id, name, platform, is_active')
        .eq('is_active', true)
        .order('name');
      if (platform) {
        query = query.eq('platform', platform);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as MarketplaceStore[];
    },
  });

  useEffect(() => {
    if (!stores?.length) {
      setSelectedStore('all');
      return;
    }

    if (selectedStore !== 'all' && !stores.some((s) => s.id === selectedStore)) {
      setSelectedStore('all');
    }
  }, [platform, stores, selectedStore]);

  const platformColor = platform === 'uzum' ? 'text-purple-500' : platform === 'yandex' ? 'text-yellow-500' : 'text-primary';
  const platformBg = platform === 'uzum' ? 'bg-purple-500/10' : platform === 'yandex' ? 'bg-yellow-500/10' : 'bg-primary/10';
  const platformLabel = platform === 'uzum' ? 'Uzum' : platform === 'yandex' ? 'Yandex' : 'Marketplace';

  if (isLoading) {
    return <DashboardLoadingSkeleton />;
  }

  if (!stores?.length) {
    return (
      <Card className="p-8 text-center">
        <Store className={`h-12 w-12 mx-auto mb-4 ${platformColor} opacity-50`} />
        <h3 className="text-lg font-semibold mb-2">{t('fin_no_stores', { platform: platformLabel })}</h3>
        <p className="text-sm text-muted-foreground">
          {t('fin_add_stores_hint', { platform: platformLabel })}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${platformBg}`}>
          <Store className={`h-5 w-5 ${platformColor}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{t('fin_stores_finance', { platform: platformLabel })}</h3>
          <p className="text-sm text-muted-foreground">{t('fin_active_stores', { count: stores.length })}</p>
        </div>
      </div>

      <Tabs value={selectedStore} onValueChange={setSelectedStore}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max min-w-full mb-4">
            <TabsTrigger value="all" className="gap-2 flex-shrink-0">
              <LayoutGrid className={`h-4 w-4 ${platformColor}`} />
              <span>{t('fin_stores_tab_all')}</span>
            </TabsTrigger>
            {stores.map((store) => {
              const storeColor = store.platform === 'uzum' ? 'text-purple-500' : 'text-yellow-500';
              return (
                <TabsTrigger 
                  key={store.id} 
                  value={store.id}
                  className="gap-2 flex-shrink-0"
                >
                  <Store className={`h-4 w-4 ${storeColor}`} />
                  <span className="truncate max-w-[120px]">{store.name}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="all">
          <AllStoresCombinedView platform={platform} stores={stores} />
        </TabsContent>

        {stores.map((store) => (
          <TabsContent key={store.id} value={store.id}>
            <StoreFinanceCard 
              storeId={store.id}
              storeName={store.name}
              platform={(store.platform === 'uzum' ? 'uzum' : 'yandex')}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
