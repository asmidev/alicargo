import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreProduct {
  id: string;
  name: string;
  selling_price: number | null;
  cost_price: number | null;
  tashkent_manual_stock: number | null;
  main_image_url: string | null;
  store_description: string | null;
  store_category_id: string | null;
  has_variants: boolean | null;
  created_at: string | null;
  listing_image?: string;
  variants?: StoreVariant[];
}

export interface StoreVariant {
  id: string;
  sku: string;
  price: number | null;
  selling_price: number | null;
  cost_price: number | null;
  stock_quantity: number | null;
  variant_attributes: Record<string, string> | null;
}

export interface StoreCategory {
  id: string;
  name_uz: string;
  name_ru: string;
  slug: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export function useStoreCategories() {
  return useQuery({
    queryKey: ['store-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as StoreCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useStoreProducts(options?: {
  categoryId?: string;
  search?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  limit?: number;
  page?: number;
  pageSize?: number;
}) {
  const { categoryId, search, sortBy = 'newest', limit, page = 1, pageSize = 24 } = options || {};
  const usePagination = !limit; // If limit is explicitly set, use old behavior (Home page)

  return useQuery({
    queryKey: ['store-products', categoryId, search, sortBy, limit, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, selling_price, cost_price, tashkent_manual_stock, main_image_url, store_description, store_category_id, has_variants, created_at', { count: usePagination ? 'exact' : undefined })
        .gt('tashkent_manual_stock', 0)
        .eq('status', 'active')
        .neq('source', 'marketplace_auto');

      if (categoryId) query = query.eq('store_category_id', categoryId);
      if (search) query = query.ilike('name', `%${search}%`);

      switch (sortBy) {
        case 'price_asc': query = query.order('selling_price', { ascending: true, nullsFirst: false }); break;
        case 'price_desc': query = query.order('selling_price', { ascending: false, nullsFirst: false }); break;
        default: query = query.order('created_at', { ascending: false });
      }

      if (usePagination) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      } else {
        query = query.limit(limit!);
      }

      const { data: products, error, count } = await query;
      if (error) throw error;
      if (!products || products.length === 0) {
        return usePagination ? { products: [], count: 0 } : { products: [], count: 0 };
      }

      // Fetch listing images and variant images for products without main_image_url
      const productIds = products.map(p => p.id);
      const [{ data: listings }, { data: variantImages }] = await Promise.all([
        supabase
          .from('marketplace_listings')
          .select('product_id, image_url')
          .in('product_id', productIds)
          .not('image_url', 'is', null),
        supabase
          .from('product_variants')
          .select('product_id, image_url')
          .in('product_id', productIds)
          .not('image_url', 'is', null),
      ]);

      const imageMap = new Map<string, string>();
      listings?.forEach(l => {
        if (l.product_id && l.image_url && !imageMap.has(l.product_id)) {
          imageMap.set(l.product_id, l.image_url);
        }
      });

      const variantImageMap = new Map<string, string>();
      variantImages?.forEach(v => {
        if (v.product_id && v.image_url && !variantImageMap.has(v.product_id)) {
          variantImageMap.set(v.product_id, v.image_url);
        }
      });

      const mapped = products.map(p => ({
        ...p,
        listing_image: imageMap.get(p.id) || variantImageMap.get(p.id) || null,
      })) as StoreProduct[];

      return { products: mapped, count: count ?? mapped.length };
    },
    staleTime: 60 * 1000,
  });
}

export function useStoreProduct(productId: string | undefined) {
  return useQuery({
    queryKey: ['store-product', productId],
    queryFn: async () => {
      if (!productId) throw new Error('No product ID');
      const { data: product, error } = await supabase
        .from('products')
        .select('id, name, selling_price, cost_price, tashkent_manual_stock, main_image_url, store_description, store_category_id, has_variants, created_at')
        .eq('id', productId)
        .neq('source', 'marketplace_auto')
        .single();
      if (error) throw error;

      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('image_url')
        .eq('product_id', productId)
        .not('image_url', 'is', null)
        .limit(10);

      const { data: variants } = await supabase
        .from('product_variants')
        .select('id, sku, price, selling_price, cost_price, stock_quantity, variant_attributes')
        .eq('product_id', productId);

      return {
        ...product,
        listing_image: listings?.[0]?.image_url || null,
        gallery: listings?.map(l => l.image_url).filter(Boolean) || [],
        variants: (variants || []) as unknown as StoreVariant[],
      };
    },
    enabled: !!productId,
    staleTime: 30 * 1000,
  });
}

export function getProductImage(product: { main_image_url?: string | null; listing_image?: string | null }): string {
  return product.main_image_url || product.listing_image || '/placeholder.svg';
}

export function formatPrice(amount: number | null | undefined): string {
  if (!amount) return "—";
  return amount.toLocaleString('uz-UZ') + " so'm";
}
