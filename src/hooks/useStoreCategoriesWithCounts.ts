import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StoreCategory } from './useStoreProducts';

export interface StoreCategoryWithCount extends StoreCategory {
  product_count: number;
}

export function useStoreCategoriesWithCounts() {
  return useQuery({
    queryKey: ['store-categories-with-counts'],
    queryFn: async () => {
      // Fetch categories
      const { data: categories, error } = await supabase
        .from('store_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;

      // Fetch product counts per category
      const { data: products } = await supabase
        .from('products')
        .select('store_category_id')
        .gt('tashkent_manual_stock', 0)
        .eq('status', 'active');

      const countMap = new Map<string, number>();
      products?.forEach(p => {
        if (p.store_category_id) {
          countMap.set(p.store_category_id, (countMap.get(p.store_category_id) || 0) + 1);
        }
      });

      return (categories as StoreCategory[])
        .map(c => ({ ...c, product_count: countMap.get(c.id) || 0 }))
        .filter(c => c.product_count > 0) as StoreCategoryWithCount[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
