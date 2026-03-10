import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { StoreProductCard } from '@/components/store/StoreProductCard';
import { useStoreProducts } from '@/hooks/useStoreProducts';
import { useStoreCategoriesWithCounts } from '@/hooks/useStoreCategoriesWithCounts';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type SortOption = 'newest' | 'price_asc' | 'price_desc';
const PAGE_SIZE = 24;

export default function StoreCatalog() {
  const { t, i18n } = useTranslation();
  const { category } = useParams();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';

  const [search, setSearch] = useState(initialSearch);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const { data: categories } = useStoreCategoriesWithCounts();
  const selectedCategory = categories?.find(c => c.slug === category);

  useDocumentMeta({
    title: selectedCategory?.name_uz || t('sf_catalog'),
    description: selectedCategory
      ? `${selectedCategory.name_uz} — AliBrand.uz ${selectedCategory.product_count} ta mahsulot`
      : t('sf_hero_subtitle'),
  });

  const { data: result, isLoading } = useStoreProducts({
    categoryId: selectedCategory?.id,
    search: search || undefined,
    sortBy,
    page,
    pageSize: PAGE_SIZE,
  });

  const products = result?.products;
  const totalCount = result?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: t('sf_sort_newest') },
    { value: 'price_asc', label: t('sf_sort_price_asc') },
    { value: 'price_desc', label: t('sf_sort_price_desc') },
  ];

  const getCatName = (cat: any) => i18n.language === 'ru' && cat.name_ru ? cat.name_ru : cat.name_uz;

  // Reset page when filters change
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleSort = (v: SortOption) => { setSortBy(v); setPage(1); };

  return (
    <div className="px-4 py-4">
      <nav className="text-sm text-muted-foreground mb-4">
        <Link to="/" className="hover:text-primary transition-colors">{t('sf_home')}</Link>
        <span className="mx-2 text-primary/50">›</span>
        {selectedCategory ? (
          <>
            <Link to="/catalog" className="hover:text-primary transition-colors">{t('sf_catalog')}</Link>
            <span className="mx-2 text-primary/50">›</span>
            <span className="text-foreground">{getCatName(selectedCategory)}</span>
          </>
        ) : (
          <span className="text-foreground">{t('sf_catalog')}</span>
        )}
      </nav>

      <h1 className="text-2xl font-extrabold text-foreground mb-4">
        {selectedCategory ? getCatName(selectedCategory) : t('sf_all_products')}
      </h1>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder={t('sf_search_placeholder')} className="pl-10 bg-muted/30 border-border/50" />
          {search && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7" onClick={() => handleSearch('')}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Button variant="outline" size="icon" className="md:hidden border-border/50" onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-6">
        <aside className={cn("shrink-0 w-56 space-y-1", showFilters ? "block" : "hidden md:block")}>
          <h3 className="text-sm font-semibold mb-2 text-foreground">{t('sf_categories')}</h3>
          <Link to="/catalog" className={cn("block py-2 px-3 text-sm rounded-lg transition-colors", !category ? "bg-primary/10 text-primary font-medium border border-primary/20" : "text-muted-foreground hover:bg-muted/30")}>
            {t('sf_all')}
          </Link>
          {categories?.map(cat => (
            <Link key={cat.id} to={`/catalog/${cat.slug}`} className={cn("block py-2 px-3 text-sm rounded-lg transition-colors", category === cat.slug ? "bg-primary/10 text-primary font-medium border border-primary/20" : "text-muted-foreground hover:bg-muted/30")}>
              {getCatName(cat)} <span className="text-xs opacity-60">({cat.product_count})</span>
            </Link>
          ))}
          <div className="pt-4">
            <h3 className="text-sm font-semibold mb-2 text-foreground">{t('sf_sort')}</h3>
            {sortOptions.map(opt => (
              <button key={opt.value} onClick={() => handleSort(opt.value)} className={cn("block w-full text-left py-2 px-3 text-sm rounded-lg transition-colors", sortBy === opt.value ? "bg-primary/10 text-primary font-medium border border-primary/20" : "text-muted-foreground hover:bg-muted/30")}>
                {opt.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1">
          <div className="flex gap-2 mb-4 md:hidden overflow-x-auto scrollbar-hide">
            {sortOptions.map(opt => (
              <Button key={opt.value} variant={sortBy === opt.value ? 'default' : 'outline'} size="sm" className={cn("shrink-0 text-xs", sortBy === opt.value && "gradient-gold-purple text-white border-0")} onClick={() => handleSort(opt.value)}>
                {opt.label}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="space-y-2"><Skeleton className="aspect-square rounded-xl" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {products.map(product => (
                  <StoreProductCard key={product.id} product={product} />
                ))}
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button variant="outline" size="icon" className="w-9 h-9 border-border/50" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) { pageNum = i + 1; }
                    else if (page <= 4) { pageNum = i + 1; }
                    else if (page >= totalPages - 3) { pageNum = totalPages - 6 + i; }
                    else { pageNum = page - 3 + i; }
                    return (
                      <Button key={pageNum} variant={page === pageNum ? 'default' : 'outline'} size="icon" className={cn("w-9 h-9", page === pageNum && "gradient-gold-purple text-white border-0")} onClick={() => setPage(pageNum)}>
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="icon" className="w-9 h-9 border-border/50" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-2">{t('sf_page')} {page} {t('sf_of')} {totalPages}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg mb-2">{t('sf_no_product_found')}</p>
              <p className="text-sm">{t('sf_try_other_search')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
