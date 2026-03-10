import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { 
  Package, 
  Plus, 
  Loader2, 
  ImagePlus, 
  Search,
  Check,
  X,
  Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { LazyImage } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';
import { NestedVariantBuilder, NestedVariantItem, generateVariantsFromNested } from '@/components/products/NestedVariantBuilder';
import { VariantMatrix } from '@/components/products/VariantMatrix';
import { ExchangeRateBanner } from '@/components/crm/ExchangeRateBanner';

interface AddProductToWarehouseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ExistingProduct {
  id: string;
  name: string;
  main_image_url: string | null;
  category_id: string | null;
  tashkent_manual_stock: number | null;
  warehouse_price: number | null;
}

interface VariantData {
  id?: string;
  sku: string;
  barcode: string;
  price: string;
  stock_quantity: string;
  weight: string;
  variant_attributes: Record<string, string>;
  is_active: boolean;
  cost_price: string;
  cost_price_currency: string;
}

interface CustomAttribute {
  key: string;
  value: string;
}

export function AddProductToWarehouseDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddProductToWarehouseDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  // Mode: 'new' for creating new product, 'existing' for updating existing
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  
  // Search for existing products
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ExistingProduct | null>(null);
  
  // New product form fields - Basic
  const [productName, setProductName] = useState('');
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string>('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [notes, setNotes] = useState('');
  
  // Custom attributes (key-value pairs)
  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>([]);
  
  // Variants
  const [nestedVariants, setNestedVariants] = useState<NestedVariantItem[]>([]);
  const [variants, setVariants] = useState<VariantData[]>([]);
  const [variantCurrency, setVariantCurrency] = useState<string>('UZS');
  
  // SKU mappings: index -> { store_id: sku[] }
  const [skuMappings, setSkuMappings] = useState<Record<number, Record<string, string[]>>>({});
  
  // Simple quantity for products without variants
  const [simpleQuantity, setSimpleQuantity] = useState<number>(0);
  
  // Cost price for existing product mode only
  const [costPrice, setCostPrice] = useState<number>(0);
  const [costPriceCurrency, setCostPriceCurrency] = useState<string>('CNY');
  const [shippingCostToChina, setShippingCostToChina] = useState('');

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setMode('new');
      setSearchTerm('');
      setSelectedProduct(null);
      setProductName('');
      setProductImage(null);
      setImagePreview(null);
      setCategoryId('');
      setBrand('');
      setModel('');
      setNotes('');
      setCustomAttributes([]);
      setNestedVariants([]);
      setVariants([]);
      setVariantCurrency('UZS');
      setSkuMappings({});
      setSimpleQuantity(0);
      setCostPrice(0);
      setCostPriceCurrency('CNY');
      setShippingCostToChina('');
    }
  }, [open]);

  // Generate variants when nested variants change
  useEffect(() => {
    if (nestedVariants.length > 0) {
      const generated = generateVariantsFromNested(nestedVariants, productName);
      // Preserve existing variant data where possible
      setVariants(prev => {
        return generated.map(newVar => {
          const existing = prev.find(p => 
            p.variant_attributes.rang === newVar.variant_attributes.rang &&
            p.variant_attributes.material === newVar.variant_attributes.material
          );
          if (existing) {
            return { ...newVar, ...existing, variant_attributes: newVar.variant_attributes };
          }
          return newVar;
        });
      });
    } else {
      setVariants([]);
    }
  }, [nestedVariants, productName]);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories-list-dialog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories_hierarchy')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Search existing products
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['search-products-warehouse', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, main_image_url, category_id, tashkent_manual_stock, warehouse_price')
        .ilike('name', `%${searchTerm}%`)
        .order('name')
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: searchTerm.length >= 2 && mode === 'existing',
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProductImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  // Variant handlers
  const handleVariantChange = (index: number, field: keyof VariantData, value: string | boolean) => {
    setVariants(prev => prev.map((v, i) => 
      i === index ? { ...v, [field]: value } : v
    ));
  };

  const handleVariantToggle = (index: number) => {
    setVariants(prev => prev.map((v, i) => 
      i === index ? { ...v, is_active: !v.is_active } : v
    ));
  };

  // Create new product mutation
  const createProductMutation = useMutation({
    mutationFn: async () => {
      let imageUrl = null;
      if (productImage) {
        imageUrl = await uploadImage(productImage);
      }

      // Generate a unique UUID for the product
      const productUuid = `PRD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Calculate total stock from variants OR use simple quantity
      const activeVariants = variants.filter(v => v.is_active);
      const totalVariantStock = activeVariants.reduce((sum, v) => sum + parseInt(v.stock_quantity || '0'), 0);
      const finalStock = activeVariants.length > 0 ? totalVariantStock : simpleQuantity;

      // Build custom attributes object
      const customAttrsObj = customAttributes.reduce((acc, attr) => {
        if (attr.key.trim()) acc[attr.key] = attr.value;
        return acc;
      }, {} as Record<string, string>);

      const { data: product, error } = await supabase
        .from('products')
        .insert([{
          uuid: productUuid,
          name: productName,
          brand: brand || null,
          model: model || null,
          main_image_url: imageUrl,
          category_id: categoryId || null,
          notes: notes || null,
          warehouse_price: null,
          cost_price: null,
          purchase_currency: 'UZS',
          tashkent_manual_stock: finalStock,
          has_variants: activeVariants.length > 0,
          custom_attributes: Object.keys(customAttrsObj).length > 0 ? customAttrsObj : null,
          status: 'active',
        }])
        .select()
        .single();

      if (error) throw error;

      // Insert variants if any
      if (activeVariants.length > 0 && product) {
        const variantInserts = activeVariants.map(v => ({
          product_id: product.id,
          sku: v.sku,
          barcode: v.barcode || null,
          price: v.price ? parseFloat(v.price) : null,
          stock_quantity: parseInt(v.stock_quantity) || 0,
          weight: v.weight ? parseFloat(v.weight) : null,
          variant_attributes: v.variant_attributes,
          is_active: v.is_active,
          cost_price: v.cost_price ? parseFloat(v.cost_price) : null,
          cost_price_currency: v.cost_price_currency || 'CNY',
        }));

        const { data: insertedVariants, error: variantError } = await supabase
          .from('product_variants')
          .insert(variantInserts)
          .select('id');

        if (variantError) {
          console.error('Error inserting variants:', variantError);
        } else if (insertedVariants && insertedVariants.length > 0) {
          // Save SKU mappings
          const skuInserts: { variant_id: string; store_id: string; external_sku: string }[] = [];
          insertedVariants.forEach((v: { id: string }, idx: number) => {
            const mappings = skuMappings[idx];
            if (mappings) {
              for (const [storeId, skus] of Object.entries(mappings)) {
                for (const sku of skus) {
                  if (sku.trim()) {
                    skuInserts.push({ variant_id: v.id, store_id: storeId, external_sku: sku.trim() });
                  }
                }
              }
            }
          });
          if (skuInserts.length > 0) {
            const { error: skuError } = await supabase
              .from('variant_sku_mappings')
              .insert(skuInserts);
            if (skuError) console.error('Error saving SKU mappings:', skuError);
          }
        }
      }

      return product;
    },
    onSuccess: () => {
      toast.success(t('inventory.productCreated', 'Mahsulot yaratildi'));
      queryClient.invalidateQueries({ queryKey: ['product-inventory-overview'] });
      queryClient.invalidateQueries({ queryKey: ['tashkent-category-counts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error creating product:', error);
      toast.error(t('common.error', 'Xatolik yuz berdi'));
    },
  });

  // Update existing product mutation
  const updateProductMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error('No product selected');

      const { error } = await supabase
        .from('products')
        .update({
          cost_price: costPrice || null,
          purchase_currency: costPriceCurrency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('inventory.productUpdated', 'Mahsulot yangilandi'));
      queryClient.invalidateQueries({ queryKey: ['product-inventory-overview'] });
      queryClient.invalidateQueries({ queryKey: ['tashkent-category-counts'] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating product:', error);
      toast.error(t('common.error', 'Xatolik yuz berdi'));
    },
  });

  const handleSubmit = () => {
    if (mode === 'new') {
      if (!productName.trim()) {
        toast.error(t('inventory.nameRequired', 'Mahsulot nomi kiritilmagan'));
        return;
      }
      // Variantsiz mahsulot uchun miqdor majburiy
      if (nestedVariants.length === 0 && simpleQuantity <= 0) {
        toast.error(t('inventory.quantityRequired', 'Miqdor kiritilmagan'));
        return;
      }
      createProductMutation.mutate();
    } else {
      if (!selectedProduct) {
        toast.error(t('inventory.noProductSelected', 'Mahsulot tanlanmagan'));
        return;
      }
      updateProductMutation.mutate();
    }
  };

  const isPending = createProductMutation.isPending || updateProductMutation.isPending;

  // Get selected attributes for VariantMatrix (from nested variants structure)
  const selectedAttributes = nestedVariants.length > 0 ? ['rang', 'material'] : [];
  const attributeDefinitions = [
    { id: '1', name: 'Rang', attribute_key: 'rang', attribute_type: 'color' },
    { id: '2', name: 'Material', attribute_key: 'material', attribute_type: 'text' },
  ];

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent fullScreen className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-2xl">
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('inventory.addProduct', 'Mahsulot qo\'shish')}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="flex-1 min-h-0">
          <div className="space-y-4 pb-4 min-w-0 pr-1">
            {/* Mode Toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <Button
                  type="button"
                  variant={mode === 'new' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setMode('new');
                    setSelectedProduct(null);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('inv_new_product')}
                </Button>
                <Button
                  type="button"
                  variant={mode === 'existing' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setMode('existing');
                    setProductImage(null);
                    setImagePreview(null);
                  }}
                >
                  <Link2 className="h-4 w-4 mr-1" />
                  {t('inv_existing_product')}
                </Button>
              </div>

              {/* === NEW PRODUCT FORM === */}
              {mode === 'new' && (
                <div className="space-y-4">
                  {/* Image + Name */}
                  <div className="flex gap-4">
                    {/* Image Upload */}
                    <div className="relative w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden shrink-0">
                      {imagePreview ? (
                        <>
                          <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductImage(null);
                              setImagePreview(null);
                            }}
                            className="absolute top-1 right-1 p-0.5 bg-destructive text-destructive-foreground rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2">
                          <ImagePlus className="h-5 w-5 mx-auto text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">{t('inv_image')}</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>

                    {/* Name */}
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="product-name" className="text-xs">{t('inv_product_name')}</Label>
                      <Input
                        id="product-name"
                        placeholder={t('inv_product_name_placeholder')}
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Brand, Model, Category - 3 columns */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('inv_brand')}</Label>
                      <Input
                        placeholder="Apple"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('inv_model')}</Label>
                      <Input
                        placeholder="A3106"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('inv_category')}</Label>
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Exchange Rate Banner — always visible in new product mode */}
                  <ExchangeRateBanner className="mb-1" />

                  {/* === RANG VA MATERIAL BO'LIMI === */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-medium text-muted-foreground">Rang va material</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    
                    <NestedVariantBuilder
                      nestedVariants={nestedVariants}
                      onNestedVariantsChange={setNestedVariants}
                    />
                  </div>

                  {/* === MIQDOR (variantsiz mahsulotlar uchun) === */}
                  {nestedVariants.length === 0 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="simple-quantity" className="text-xs">Miqdor *</Label>
                      <Input
                        id="simple-quantity"
                        type="number"
                        min="1"
                        placeholder="Nechta mahsulot bor?"
                        value={simpleQuantity || ''}
                        onChange={(e) => setSimpleQuantity(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  )}

                  {/* === VARIANT MATRITSASI === */}
                  {variants.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs font-medium text-muted-foreground">Variantlar</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>

                      <VariantMatrix
                        mode="warehouse"
                        variants={variants}
                        selectedAttributes={selectedAttributes}
                        attributes={attributeDefinitions}
                        onVariantChange={handleVariantChange}
                        onVariantToggle={handleVariantToggle}
                        currency="UZS"
                        onCurrencyChange={setVariantCurrency}
                        shippingCost={shippingCostToChina}
                        onShippingCostChange={setShippingCostToChina}
                        skuMappings={skuMappings}
                        onSkuMappingsChange={(index, mappings) => setSkuMappings(prev => ({ ...prev, [index]: mappings }))}
                      />
                    </div>
                  )}

                  {/* === IZOH === */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Izoh</Label>
                    <Textarea
                      placeholder="Mahsulot haqida qo'shimcha ma'lumot..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[60px] resize-none"
                    />
                  </div>
                </div>
              )}

              {/* === EXISTING PRODUCT SEARCH === */}
              {mode === 'existing' && (
                <div className="space-y-3">
                  {/* Exchange Rate Banner — always visible in existing product mode */}
                  <ExchangeRateBanner />

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Mahsulot qidirish..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {searchTerm.length >= 2 && (
                    <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                      {isSearching ? (
                        <LoadingSkeleton count={2} compact />
                      ) : searchResults.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          Natija topilmadi
                        </div>
                      ) : (
                        searchResults.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => setSelectedProduct(product)}
                            className={cn(
                              'w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors',
                              selectedProduct?.id === product.id && 'bg-primary/10'
                            )}
                          >
                            <LazyImage
                              src={product.main_image_url || '/placeholder.svg'}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Omborda: {product.tashkent_manual_stock || 0} dona
                              </p>
                            </div>
                            {selectedProduct?.id === product.id && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Selected Product Preview */}
                  {selectedProduct && (
                    <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <LazyImage
                        src={selectedProduct.main_image_url || '/placeholder.svg'}
                        alt={selectedProduct.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{selectedProduct.name}</p>
                        <p className="text-sm text-muted-foreground">Tanlangan mahsulot</p>
                      </div>
                    </div>
                  )}

                  {/* Tan narx for existing product */}
                  {selectedProduct && (
                    <Card className="border-dashed">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Tan narx</CardTitle>
                        <CardDescription className="text-xs">
                          Mahsulotning sotib olish narxi
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex gap-2">
                          <Select 
                            value={costPriceCurrency} 
                            onValueChange={setCostPriceCurrency}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CNY">CNY (¥)</SelectItem>
                              <SelectItem value="USD">USD ($)</SelectItem>
                              <SelectItem value="UZS">UZS</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={costPrice || ''}
                            onChange={(e) => setCostPrice(Number(e.target.value) || 0)}
                            className="flex-1"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('common.cancel', 'Bekor qilish')}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || (mode === 'existing' && !selectedProduct)}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === 'new' ? t('common.create', 'Yaratish') : t('common.save', 'Saqlash')}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
