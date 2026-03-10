// Product Grouping Algorithm for Tashkent Warehouse
// Groups similar products (e.g., same item with different colors) into baskets

// Color keywords in Uzbek, Russian, and English
export const COLOR_KEYWORDS = [
  // O'zbekcha
  'qora', 'oq', 'qizil', 'kok', 'yashil', 'sariq', 'pushti',
  'jigarang', 'kulrang', 'binafsha', 'toq', 'och', 'siyohrang',
  'moviy', 'oltin', 'kumush', 'bronza', 'shaffof', 'rangli',
  // Ruscha kirill
  'черный', 'белый', 'красный', 'синий', 'зеленый', 'желтый',
  'розовый', 'коричневый', 'серый', 'фиолетовый', 'оранжевый',
  'голубой', 'золотой', 'серебряный', 'бронзовый', 'прозрачный',
  // Inglizcha
  'black', 'white', 'red', 'blue', 'green', 'yellow',
  'pink', 'brown', 'gray', 'grey', 'purple', 'orange',
  'gold', 'silver', 'bronze', 'transparent', 'clear',
  // Ruscha lotin transliteratsiya (ruscha so'zlar lotin harflarda)
  'cherniy', 'chernyy', 'chorny',
  'beliy', 'belyy', 'bely',
  'krasnyy', 'krasniy', 'krasni',
  'siniy', 'sinii', 'sini',
  'zelonyy', 'zelyoniy', 'zeleni', 'zeleniy',
  'jeltyy', 'jeltyj', 'jelti', 'zhyoltyy',
  'rozoviy', 'rozovi',
  'korichneviy', 'korichnevi', 'korichnevoye',
  'seryy', 'seriy', 'seri',
  'fioletoviy', 'fioletovi',
  'oranjeviy', 'oranzheviy', 'oranji', 'oranzhevi',
  'goluboy', 'golubiy', 'goluboye',
  'zolotoy', 'zoloti', 'zolotiye',
  'serebryanyy', 'serebryani', 'serebri',
  'bronzoviy', 'bronzovi',
  'prozrachnyy', 'prozrachni',
];

// Color emoji and hex mappings
export const COLOR_STYLES: Record<string, { emoji: string; color: string; label: string }> = {
  // O'zbekcha
  'qora': { emoji: '⚫', color: '#1f2937', label: "Qora" },
  'oq': { emoji: '⚪', color: '#f3f4f6', label: "Oq" },
  'qizil': { emoji: '🔴', color: '#ef4444', label: "Qizil" },
  'kok': { emoji: '🔵', color: '#3b82f6', label: "Ko'k" },
  'yashil': { emoji: '🟢', color: '#22c55e', label: "Yashil" },
  'sariq': { emoji: '🟡', color: '#eab308', label: "Sariq" },
  'pushti': { emoji: '🩷', color: '#ec4899', label: "Pushti" },
  'jigarang': { emoji: '🟤', color: '#92400e', label: "Jigarang" },
  'kulrang': { emoji: '⚪', color: '#6b7280', label: "Kulrang" },
  'binafsha': { emoji: '🟣', color: '#8b5cf6', label: "Binafsha" },
  'siyohrang': { emoji: '🟣', color: '#7c3aed', label: "Siyohrang" },
  'moviy': { emoji: '🔵', color: '#06b6d4', label: "Moviy" },
  'oltin': { emoji: '🟡', color: '#f59e0b', label: "Oltin" },
  'kumush': { emoji: '⚪', color: '#9ca3af', label: "Kumush" },
  'bronza': { emoji: '🟤', color: '#b45309', label: "Bronza" },
  // Ruscha kirill
  'черный': { emoji: '⚫', color: '#1f2937', label: "Qora" },
  'белый': { emoji: '⚪', color: '#f3f4f6', label: "Oq" },
  'красный': { emoji: '🔴', color: '#ef4444', label: "Qizil" },
  'синий': { emoji: '🔵', color: '#3b82f6', label: "Ko'k" },
  'зеленый': { emoji: '🟢', color: '#22c55e', label: "Yashil" },
  'желтый': { emoji: '🟡', color: '#eab308', label: "Sariq" },
  'розовый': { emoji: '🩷', color: '#ec4899', label: "Pushti" },
  'фиолетовый': { emoji: '🟣', color: '#8b5cf6', label: "Binafsha" },
  'коричневый': { emoji: '🟤', color: '#92400e', label: "Jigarang" },
  'серый': { emoji: '⚪', color: '#6b7280', label: "Kulrang" },
  'золотой': { emoji: '🟡', color: '#f59e0b', label: "Oltin" },
  'серебряный': { emoji: '⚪', color: '#9ca3af', label: "Kumush" },
  'оранжевый': { emoji: '🟠', color: '#f97316', label: "To'q sariq" },
  'голубой': { emoji: '🔵', color: '#06b6d4', label: "Moviy" },
  'бронзовый': { emoji: '🟤', color: '#b45309', label: "Bronza" },
  // Inglizcha
  'black': { emoji: '⚫', color: '#1f2937', label: "Black" },
  'white': { emoji: '⚪', color: '#f3f4f6', label: "White" },
  'red': { emoji: '🔴', color: '#ef4444', label: "Red" },
  'blue': { emoji: '🔵', color: '#3b82f6', label: "Blue" },
  'green': { emoji: '🟢', color: '#22c55e', label: "Green" },
  'yellow': { emoji: '🟡', color: '#eab308', label: "Yellow" },
  'pink': { emoji: '🩷', color: '#ec4899', label: "Pink" },
  'brown': { emoji: '🟤', color: '#92400e', label: "Brown" },
  'gray': { emoji: '⚪', color: '#6b7280', label: "Gray" },
  'grey': { emoji: '⚪', color: '#6b7280', label: "Grey" },
  'purple': { emoji: '🟣', color: '#8b5cf6', label: "Purple" },
  'orange': { emoji: '🟠', color: '#f97316', label: "Orange" },
  // Ruscha lotin transliteratsiya
  'cherniy': { emoji: '⚫', color: '#1f2937', label: "Qora" },
  'chernyy': { emoji: '⚫', color: '#1f2937', label: "Qora" },
  'chorny': { emoji: '⚫', color: '#1f2937', label: "Qora" },
  'beliy': { emoji: '⚪', color: '#f3f4f6', label: "Oq" },
  'belyy': { emoji: '⚪', color: '#f3f4f6', label: "Oq" },
  'bely': { emoji: '⚪', color: '#f3f4f6', label: "Oq" },
  'krasnyy': { emoji: '🔴', color: '#ef4444', label: "Qizil" },
  'krasniy': { emoji: '🔴', color: '#ef4444', label: "Qizil" },
  'krasni': { emoji: '🔴', color: '#ef4444', label: "Qizil" },
  'siniy': { emoji: '🔵', color: '#3b82f6', label: "Ko'k" },
  'sinii': { emoji: '🔵', color: '#3b82f6', label: "Ko'k" },
  'sini': { emoji: '🔵', color: '#3b82f6', label: "Ko'k" },
  'zelonyy': { emoji: '🟢', color: '#22c55e', label: "Yashil" },
  'zelyoniy': { emoji: '🟢', color: '#22c55e', label: "Yashil" },
  'zeleni': { emoji: '🟢', color: '#22c55e', label: "Yashil" },
  'zeleniy': { emoji: '🟢', color: '#22c55e', label: "Yashil" },
  'jeltyy': { emoji: '🟡', color: '#eab308', label: "Sariq" },
  'jeltyj': { emoji: '🟡', color: '#eab308', label: "Sariq" },
  'jelti': { emoji: '🟡', color: '#eab308', label: "Sariq" },
  'zhyoltyy': { emoji: '🟡', color: '#eab308', label: "Sariq" },
  'rozoviy': { emoji: '🩷', color: '#ec4899', label: "Pushti" },
  'rozovi': { emoji: '🩷', color: '#ec4899', label: "Pushti" },
  'fioletoviy': { emoji: '🟣', color: '#8b5cf6', label: "Binafsha" },
  'fioletovi': { emoji: '🟣', color: '#8b5cf6', label: "Binafsha" },
  'korichneviy': { emoji: '🟤', color: '#92400e', label: "Jigarang" },
  'korichnevi': { emoji: '🟤', color: '#92400e', label: "Jigarang" },
  'korichnevoye': { emoji: '🟤', color: '#92400e', label: "Jigarang" },
  'seryy': { emoji: '⚪', color: '#6b7280', label: "Kulrang" },
  'seriy': { emoji: '⚪', color: '#6b7280', label: "Kulrang" },
  'seri': { emoji: '⚪', color: '#6b7280', label: "Kulrang" },
  'oranjeviy': { emoji: '🟠', color: '#f97316', label: "To'q sariq" },
  'oranzheviy': { emoji: '🟠', color: '#f97316', label: "To'q sariq" },
  'oranji': { emoji: '🟠', color: '#f97316', label: "To'q sariq" },
  'oranzhevi': { emoji: '🟠', color: '#f97316', label: "To'q sariq" },
  'goluboy': { emoji: '🔵', color: '#06b6d4', label: "Moviy" },
  'golubiy': { emoji: '🔵', color: '#06b6d4', label: "Moviy" },
  'goluboye': { emoji: '🔵', color: '#06b6d4', label: "Moviy" },
  'zolotoy': { emoji: '🟡', color: '#f59e0b', label: "Oltin" },
  'zoloti': { emoji: '🟡', color: '#f59e0b', label: "Oltin" },
  'zolotiye': { emoji: '🟡', color: '#f59e0b', label: "Oltin" },
  'serebryanyy': { emoji: '⚪', color: '#9ca3af', label: "Kumush" },
  'serebryani': { emoji: '⚪', color: '#9ca3af', label: "Kumush" },
  'serebri': { emoji: '⚪', color: '#9ca3af', label: "Kumush" },
  'bronzoviy': { emoji: '🟤', color: '#b45309', label: "Bronza" },
  'bronzovi': { emoji: '🟤', color: '#b45309', label: "Bronza" },
  'prozrachnyy': { emoji: '🔲', color: '#e5e7eb', label: "Shaffof" },
  'prozrachni': { emoji: '🔲', color: '#e5e7eb', label: "Shaffof" },
};

export interface ProductVariant {
  id: string;
  productId?: string; // Asosiy mahsulot ID
  name: string;
  variantName: string | null;
  stock: number;
  price: number | null;
  costPrice: number | null;        // Tannarx (xarid narxi)
  costPriceCurrency: string | null; // Tannarx valyutasi (CNY, USD, UZS)
  image?: string;
  category?: string | null;
  notes?: string | null; // Izoh
  variantAttributes?: Record<string, string>; // Variant xususiyatlari
}

export interface ProductGroup {
  baseName: string;
  displayName: string;
  variants: ProductVariant[];
  totalStock: number;
  avgPrice: number;
  totalValue: number;
  category: string | null;
  representativeImage?: string;
  isSingleProduct: boolean;
  notes?: string | null; // Guruh izohi
}

export interface GroupingStats {
  totalGroups: number;
  totalVariants: number;
  largestGroup: { name: string; count: number } | null;
  singleProducts: number;
}

// Check if a word is a color keyword
export function isColorKeyword(word: string): boolean {
  const normalized = word.toLowerCase().trim();
  return COLOR_KEYWORDS.some(color => 
    normalized === color.toLowerCase() || 
    normalized.endsWith(color.toLowerCase())
  );
}

// Extract base name and variant from product name
export function extractVariant(name: string): { base: string; variant: string | null } {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  
  if (words.length < 2) {
    return { base: trimmed, variant: null };
  }
  
  const lastWord = words[words.length - 1].toLowerCase();
  
  if (isColorKeyword(lastWord)) {
    const base = words.slice(0, -1).join(' ');
    return { base, variant: lastWord };
  }
  
  return { base: trimmed, variant: null };
}

// Get color style for a variant
export function getColorStyle(variant: string | null): { emoji: string; color: string; label: string } {
  if (!variant) {
    return { emoji: '📦', color: '#6b7280', label: 'Variant' };
  }
  
  const normalized = variant.toLowerCase();
  return COLOR_STYLES[normalized] || { emoji: '🏷️', color: '#6b7280', label: variant };
}

// Capitalize first letter of each word
function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Group products by base name
export function groupProducts<T extends {
  id: string;
  name: string;
  notes?: string | null;
  has_variants?: boolean;
  tashkent_manual_stock?: number | null;
  warehouse_price?: number | null;
  main_image_url?: string | null;
  categories_hierarchy?: { name: string } | null;
  product_variants?: Array<{
    id: string;
    sku?: string;
    variant_attributes: unknown; // Json turidan keladi
    stock_quantity: number;
    price?: number | null;
    cost_price?: number | null;
    cost_price_currency?: string | null;
  }>;
}>(products: T[]): ProductGroup[] {
  const groupMap = new Map<string, { variants: ProductVariant[]; notes: string | null }>();
  
  for (const product of products) {
    const variants = product.product_variants || [];
    const category = (product.categories_hierarchy as any)?.name || null;
    const productManualStock = product.tashkent_manual_stock || 0;
    
    // Agar mahsulotda haqiqiy variantlar bo'lsa
    if (product.has_variants && variants.length > 0) {
      const baseName = product.name.toLowerCase();
      
      if (!groupMap.has(baseName)) {
        groupMap.set(baseName, { variants: [], notes: product.notes || null });
      }
      
      // Check if all variant stocks are 0 but product has manual stock
      const totalVariantStock = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
      const useProductStock = totalVariantStock === 0 && productManualStock > 0;
      
      for (const variant of variants) {
        // Json turidan Record ga xavfsiz o'girish
        const attrs: Record<string, string> = (typeof variant.variant_attributes === 'object' && variant.variant_attributes !== null) 
          ? variant.variant_attributes as Record<string, string>
          : {};
        const attrValues = Object.values(attrs).filter(Boolean);
        const variantLabel = attrValues.join(' / ');
        
        // Use variant stock, or distribute product stock evenly if variant stocks are all 0
        const variantStock = variant.stock_quantity || 0;
        const effectiveStock = variantStock > 0 ? variantStock : (useProductStock ? Math.floor(productManualStock / variants.length) : 0);
        
        // Stoki 0 bo'lgan variantlarni ko'rsatmaslik
        if (effectiveStock <= 0) continue;
        
        groupMap.get(baseName)!.variants.push({
          id: variant.id,
          productId: product.id,
          name: `${product.name}${variantLabel ? ` - ${variantLabel}` : ''}`,
          variantName: attrs.rang || variantLabel || null,
          stock: effectiveStock,
          price: variant.price ?? product.warehouse_price ?? null,
          costPrice: variant.cost_price ?? null,
          costPriceCurrency: variant.cost_price_currency ?? null,
          image: product.main_image_url || undefined,
          category,
          notes: product.notes || null,
          variantAttributes: attrs,
        });
      }
    } else {
      // Variantsiz mahsulot - avvalgidek nom bo'yicha guruhlash
      const { base, variant } = extractVariant(product.name);
      const normalizedBase = base.toLowerCase();
      
      if (!groupMap.has(normalizedBase)) {
        groupMap.set(normalizedBase, { variants: [], notes: product.notes || null });
      }
      
      groupMap.get(normalizedBase)!.variants.push({
        id: product.id,
        productId: product.id,
        name: product.name,
        variantName: variant,
        stock: productManualStock,
        price: product.warehouse_price || null,
        costPrice: (product as any).cost_price ?? null,
        costPriceCurrency: (product as any).cost_price_currency ?? null,
        image: product.main_image_url || undefined,
        category,
        notes: product.notes || null,
      });
    }
  }
  
  // Create ProductGroup objects
  const groups: ProductGroup[] = [];
  
  for (const [baseName, data] of groupMap.entries()) {
    const { variants, notes } = data;
    
    // Bo'sh variantlar ro'yxati bilan group qo'shmaslik
    if (variants.length === 0) continue;
    
    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const pricesWithValues = variants.filter(v => v.price !== null);
    const avgPrice = pricesWithValues.length > 0
      ? pricesWithValues.reduce((sum, v) => sum + (v.price || 0), 0) / pricesWithValues.length
      : 0;
    const totalValue = variants.reduce((sum, v) => sum + (v.stock * (v.price || 0)), 0);
    
    const category = variants.find(v => v.category)?.category || null;
    const representativeImage = variants.find(v => v.image)?.image;
    
    groups.push({
      baseName,
      displayName: capitalizeWords(baseName),
      variants,
      totalStock,
      avgPrice,
      totalValue,
      category,
      representativeImage,
      isSingleProduct: variants.length === 1 && (!variants[0].variantAttributes || Object.keys(variants[0].variantAttributes).length === 0),
      notes,
    });
  }
  
  // Sort by total stock (descending), then by name
  groups.sort((a, b) => {
    if (b.totalStock !== a.totalStock) {
      return b.totalStock - a.totalStock;
    }
    return a.displayName.localeCompare(b.displayName, 'uz');
  });
  
  return groups;
}

// Calculate grouping statistics
export function calculateGroupingStats(groups: ProductGroup[]): GroupingStats {
  const multiVariantGroups = groups.filter(g => !g.isSingleProduct);
  const singleProducts = groups.filter(g => g.isSingleProduct).length;
  
  let largestGroup: { name: string; count: number } | null = null;
  for (const group of multiVariantGroups) {
    if (!largestGroup || group.variants.length > largestGroup.count) {
      largestGroup = { name: group.displayName, count: group.variants.length };
    }
  }
  
  const totalVariants = groups.reduce((sum, g) => sum + g.variants.length, 0);
  
  return {
    totalGroups: multiVariantGroups.length,
    totalVariants,
    largestGroup,
    singleProducts,
  };
}

// Filter groups by search query
export function filterGroups(groups: ProductGroup[], query: string): ProductGroup[] {
  if (!query.trim()) {
    return groups;
  }
  
  const normalizedQuery = query.toLowerCase().trim();
  
  return groups.filter(group => {
    // Match by group base name
    if (group.baseName.toLowerCase().includes(normalizedQuery)) {
      return true;
    }
    
    // Match by any variant name
    if (group.variants.some(v => v.name.toLowerCase().includes(normalizedQuery))) {
      return true;
    }
    
    // Match by variant color
    if (group.variants.some(v => v.variantName?.toLowerCase().includes(normalizedQuery))) {
      return true;
    }
    
    // Match by category
    if (group.category?.toLowerCase().includes(normalizedQuery)) {
      return true;
    }
    
    return false;
  });
}
