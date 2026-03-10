import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProductExportImportProps {
  products: any[];
  categories: any[];
}

interface ImportError {
  row: number;
  sheet: string;
  field: string;
  message: string;
  data?: any;
}

interface ImportResult {
  productsCreated: number;
  variantsCreated: number;
  productItemsCreated: number;
  errors: ImportError[];
}

// Case-insensitive column mapping with multiple variations
const PRODUCT_COLUMN_MAPPINGS: Record<string, string[]> = {
  uuid: ['UUID', 'uuid', 'ID', 'id', 'Product ID', 'product_id'],
  name: ['Nomi*', 'Nomi', 'name', 'Name', 'Mahsulot nomi', 'mahsulot', 'Mahsulot', 'Nom'],
  brand: ['Brend', 'brand', 'Brand', 'BREND', 'brend'],
  category: ['Kategoriya', 'category', 'Category', 'KATEGORIYA', 'kategoriya', 'Kategoriya nomi'],
  price: ['Narx', 'narx', 'price', 'Price', 'NARX', 'Narxi', 'narxi', 'Sotib olish narxi'],
  currency: ['Valyuta', 'currency', 'Currency', 'VALYUTA', 'valyuta'],
  weight: ['Vazn (kg)', 'Vazn', 'vazn', 'weight', 'Weight', 'VAZN', 'Og\'irlik', 'ogirlik'],
  barcode: ['Shtrix kod', 'barcode', 'Barcode', 'BARCODE', 'shtrix', 'Shtrix', 'SKU', 'sku'],
  notes: ['Izoh', 'izoh', 'notes', 'Notes', 'IZOH', 'Eslatma', 'eslatma', 'Tavsif', 'tavsif'],
};

const VARIANT_COLUMN_MAPPINGS: Record<string, string[]> = {
  product_uuid: ['Mahsulot UUID', 'product_uuid', 'Product UUID', 'PRODUCT_UUID', 'parent_uuid', 'product_id'],
  product_name: ['Mahsulot nomi', 'product_name', 'Product Name', 'Mahsulot'],
  sku: ['SKU', 'sku', 'Sku', 'variant_sku', 'Variant SKU'],
  barcode: ['Shtrix kod', 'barcode', 'Barcode', 'variant_barcode'],
  price: ['Narx', 'price', 'Price', 'Variant narxi', 'variant_price'],
  stock: ['Zaxira', 'stock', 'Stock', 'Miqdor', 'stock_quantity', 'quantity'],
  weight: ['Vazn', 'weight', 'Weight', 'variant_weight'],
  attributes: ['Xususiyatlar', 'attributes', 'Attributes', 'variant_attributes'],
  is_active: ['Faol', 'is_active', 'Active', 'active'],
};

// Find the value from row using any of the column variations
const getColumnValue = (row: any, mappings: Record<string, string[]>, field: string): any => {
  const variations = mappings[field] || [];
  for (const variation of variations) {
    if (row[variation] !== undefined && row[variation] !== null && row[variation] !== '') {
      return row[variation];
    }
  }
  return null;
};

// Get any attribute columns from a row (columns not in standard mappings)
const getAttributeColumns = (row: any, standardColumns: string[]): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const allMappedCols = new Set<string>();
  
  // Collect all known column names from mappings
  Object.values(VARIANT_COLUMN_MAPPINGS).forEach(variations => {
    variations.forEach(v => allMappedCols.add(v.toLowerCase()));
  });
  standardColumns.forEach(c => allMappedCols.add(c.toLowerCase()));

  // Find attribute columns (not in standard mappings)
  Object.keys(row).forEach(key => {
    if (!allMappedCols.has(key.toLowerCase()) && key !== '#' && !key.startsWith('__')) {
      const value = row[key];
      if (value !== undefined && value !== null && value !== '') {
        attrs[key.toLowerCase()] = String(value);
      }
    }
  });
  
  return attrs;
};

export function ProductExportImport({ products, categories }: ProductExportImportProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '';
    return categories?.find(c => c.id === categoryId)?.name || '';
  };

  // Fetch variants for all products
  const fetchProductVariants = async (productIds: string[]) => {
    if (productIds.length === 0) return [];
    
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .in('product_id', productIds)
      .eq('is_active', true);
    
    if (error) throw error;
    return data || [];
  };

  // Export with variants - creates 2 sheets
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const productIds = products.map(p => p.id);
      const allVariants = await fetchProductVariants(productIds);
      
      // Create product UUID map for quick lookup
      const productMap = new Map(products.map(p => [p.id, p]));
      
      // Sheet 1: Products
      const productsData = products.map((product, index) => ({
        '#': index + 1,
        'UUID': product.uuid,
        'Nomi': product.name,
        'Brend': product.brand || '',
        'Kategoriya': getCategoryName(product.category_id) || product.category || '',
        'Narx': product.price || '',
        'Valyuta': product.purchase_currency || 'CNY',
        'Vazn (kg)': product.weight || '',
        'Shtrix kod': product.barcode || '',
        'Variantlar soni': allVariants.filter(v => v.product_id === product.id).length,
        'Jami zaxira': allVariants
          .filter(v => v.product_id === product.id)
          .reduce((sum, v) => sum + (v.stock_quantity || 0), 0),
        'Izoh': product.notes || '',
        'Yaratilgan sana': new Date(product.created_at).toLocaleDateString('uz-UZ'),
      }));

      // Sheet 2: Variants with dynamic attribute columns
      const allAttrKeys = new Set<string>();
      allVariants.forEach(v => {
        const attrs = v.variant_attributes as Record<string, string> || {};
        Object.keys(attrs).forEach(k => allAttrKeys.add(k));
      });
      const attrKeysList = Array.from(allAttrKeys);

      const variantsData = allVariants.map((variant, index) => {
        const product = productMap.get(variant.product_id);
        const attrs = variant.variant_attributes as Record<string, string> || {};
        
        const row: Record<string, any> = {
          '#': index + 1,
          'Mahsulot UUID': product?.uuid || '',
          'Mahsulot nomi': product?.name || '',
          'SKU': variant.sku,
          'Shtrix kod': variant.barcode || '',
          'Narx': variant.price || '',
          'Zaxira': variant.stock_quantity || 0,
          'Vazn': variant.weight || '',
          'Faol': variant.is_active ? 'Ha' : 'Yo\'q',
        };

        // Add attribute columns dynamically
        attrKeysList.forEach(key => {
          row[key.charAt(0).toUpperCase() + key.slice(1)] = attrs[key] || '';
        });

        return row;
      });

      const wb = XLSX.utils.book_new();

      // Products sheet
      const wsProducts = XLSX.utils.json_to_sheet(productsData);
      wsProducts['!cols'] = [
        { wch: 5 },  // #
        { wch: 20 }, // UUID
        { wch: 30 }, // Name
        { wch: 15 }, // Brand
        { wch: 20 }, // Category
        { wch: 12 }, // Price
        { wch: 8 },  // Currency
        { wch: 10 }, // Weight
        { wch: 15 }, // Barcode
        { wch: 12 }, // Variants count
        { wch: 10 }, // Total stock
        { wch: 30 }, // Notes
        { wch: 15 }, // Created date
      ];
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Mahsulotlar');

      // Variants sheet
      if (variantsData.length > 0) {
        const wsVariants = XLSX.utils.json_to_sheet(variantsData);
        const variantColWidths = [
          { wch: 5 },  // #
          { wch: 20 }, // Product UUID
          { wch: 25 }, // Product name
          { wch: 18 }, // SKU
          { wch: 15 }, // Barcode
          { wch: 12 }, // Price
          { wch: 8 },  // Stock
          { wch: 8 },  // Weight
          { wch: 8 },  // Active
          ...attrKeysList.map(() => ({ wch: 12 })), // Attribute columns
        ];
        wsVariants['!cols'] = variantColWidths;
        XLSX.utils.book_append_sheet(wb, wsVariants, 'Variantlar');
      }
      
      const fileName = `mahsulotlar_variantlar_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Eksport muvaffaqiyatli',
        description: `${products.length} ta mahsulot, ${allVariants.length} ta variant eksport qilindi`,
      });
    } catch (error: any) {
      toast({
        title: 'Eksport xatosi',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export template with example data
  const handleExportTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Products template sheet
    const productsTemplate = [
      {
        'UUID': 'PROD-EXAMPLE-001',
        'Nomi*': 'Misol mahsulot',
        'Brend': 'Apple',
        'Kategoriya': 'Elektronika',
        'Narx': 50,
        'Valyuta': 'CNY',
        'Vazn (kg)': 0.5,
        'Shtrix kod': '',
        'Izoh': 'Bu misol mahsulot',
      },
      {
        'UUID': 'PROD-EXAMPLE-002',
        'Nomi*': 'Ikkinchi mahsulot',
        'Brend': 'Samsung',
        'Kategoriya': 'Aksessuarlar',
        'Narx': 30,
        'Valyuta': 'CNY',
        'Vazn (kg)': 0.2,
        'Shtrix kod': '',
        'Izoh': '',
      },
    ];

    // Variants template sheet with attribute columns
    const variantsTemplate = [
      {
        'Mahsulot UUID': 'PROD-EXAMPLE-001',
        'SKU': 'APL-QIZ-S-001',
        'Shtrix kod': '',
        'Narx': 55,
        'Zaxira': 10,
        'Vazn': 0.5,
        'Rang': 'Qizil',
        'O\'lcham': 'S',
      },
      {
        'Mahsulot UUID': 'PROD-EXAMPLE-001',
        'SKU': 'APL-QIZ-M-002',
        'Shtrix kod': '',
        'Narx': 55,
        'Zaxira': 15,
        'Vazn': 0.5,
        'Rang': 'Qizil',
        'O\'lcham': 'M',
      },
      {
        'Mahsulot UUID': 'PROD-EXAMPLE-001',
        'SKU': 'APL-KOK-S-003',
        'Shtrix kod': '',
        'Narx': 55,
        'Zaxira': 8,
        'Vazn': 0.5,
        'Rang': 'Ko\'k',
        'O\'lcham': 'S',
      },
      {
        'Mahsulot UUID': 'PROD-EXAMPLE-002',
        'SKU': 'SAM-OQ-001',
        'Shtrix kod': '',
        'Narx': 35,
        'Zaxira': 20,
        'Vazn': 0.2,
        'Rang': 'Oq',
      },
    ];

    // Instructions sheet
    const instructionsData = [
      { 'Ko\'rsatmalar': '📋 IMPORT QO\'LLANMASI' },
      { 'Ko\'rsatmalar': '' },
      { 'Ko\'rsatmalar': '1. MAHSULOTLAR VARAG\'I:' },
      { 'Ko\'rsatmalar': '   - "Nomi*" - majburiy maydon' },
      { 'Ko\'rsatmalar': '   - "UUID" - bo\'sh qoldirsangiz avtomatik yaratiladi' },
      { 'Ko\'rsatmalar': '   - "Valyuta" - CNY, USD yoki UZS' },
      { 'Ko\'rsatmalar': '' },
      { 'Ko\'rsatmalar': '2. VARIANTLAR VARAG\'I:' },
      { 'Ko\'rsatmalar': '   - "Mahsulot UUID" - qaysi mahsulotga tegishli' },
      { 'Ko\'rsatmalar': '   - "SKU" - majburiy, noyob bo\'lishi kerak' },
      { 'Ko\'rsatmalar': '   - Rang, O\'lcham va boshqa ustunlar - xususiyatlar sifatida import qilinadi' },
      { 'Ko\'rsatmalar': '' },
      { 'Ko\'rsatmalar': '3. MUHIM:' },
      { 'Ko\'rsatmalar': '   - Avval mahsulotlarni, keyin variantlarni kiritish kerak' },
      { 'Ko\'rsatmalar': '   - Bir mahsulotga bir nechta variant qo\'shish mumkin' },
      { 'Ko\'rsatmalar': '   - UUID mavjud bo\'lsa, mahsulot yangilanadi' },
    ];

    const wsProducts = XLSX.utils.json_to_sheet(productsTemplate);
    wsProducts['!cols'] = [
      { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, 
      { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 15 }, { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Mahsulotlar');

    const wsVariants = XLSX.utils.json_to_sheet(variantsTemplate);
    wsVariants['!cols'] = [
      { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 10 }, 
      { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsVariants, 'Variantlar');

    const wsInstructions = XLSX.utils.json_to_sheet(instructionsData);
    wsInstructions['!cols'] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Ko\'rsatmalar');

    XLSX.writeFile(wb, 'mahsulot_import_shabloni.xlsx');

    toast({
      title: 'Shablon yuklandi',
      description: 'Shablonda 3 ta varaq mavjud: Mahsulotlar, Variantlar, Ko\'rsatmalar',
    });
  };

  // Import with variants support
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const result: ImportResult = {
            productsCreated: 0,
            variantsCreated: 0,
            productItemsCreated: 0,
            errors: [],
          };

          // Get user for created_by
          const { data: { user } } = await supabase.auth.getUser();

          // Map to track UUID -> product ID for variants
          const uuidToProductId = new Map<string, string>();
          const uuidToProductData = new Map<string, any>();

          // Step 1: Process Products sheet
          const productsSheet = workbook.Sheets['Mahsulotlar'] || workbook.Sheets[workbook.SheetNames[0]];
          if (productsSheet) {
            const productsJson = XLSX.utils.sheet_to_json(productsSheet);
            
            for (let i = 0; i < productsJson.length; i++) {
              const row = productsJson[i] as any;
              const rowNumber = i + 2;
              
              const productName = getColumnValue(row, PRODUCT_COLUMN_MAPPINGS, 'name');
              if (!productName) {
                result.errors.push({
                  row: rowNumber,
                  sheet: 'Mahsulotlar',
                  field: 'Nomi',
                  message: 'Mahsulot nomi topilmadi',
                  data: row,
                });
                continue;
              }

              // Generate or use existing UUID
              let uuid = getColumnValue(row, PRODUCT_COLUMN_MAPPINGS, 'uuid');
              if (!uuid) {
                uuid = `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
              }

              const priceValue = getColumnValue(row, PRODUCT_COLUMN_MAPPINGS, 'price');
              const weightValue = getColumnValue(row, PRODUCT_COLUMN_MAPPINGS, 'weight');
              const currency = getColumnValue(row, PRODUCT_COLUMN_MAPPINGS, 'currency') || 'CNY';

              const price = priceValue ? parseFloat(String(priceValue).replace(/[^0-9.]/g, '')) : null;
              const weight = weightValue ? parseFloat(String(weightValue).replace(/[^0-9.]/g, '')) : null;

              // Check if product with UUID exists
              const { data: existingProduct } = await supabase
                .from('products')
                .select('id, uuid')
                .eq('uuid', uuid)
                .single();

              const productData = {
                uuid,
                name: String(productName).trim(),
                brand: getColumnValue(row, PRODUCT_COLUMN_MAPPINGS, 'brand') || null,
                category: getColumnValue(row, PRODUCT_COLUMN_MAPPINGS, 'category') || null,
                price: isNaN(price as number) ? null : price,
                purchase_currency: currency,
                weight: isNaN(weight as number) ? null : weight,
                barcode: getColumnValue(row, PRODUCT_COLUMN_MAPPINGS, 'barcode') || null,
                notes: getColumnValue(row, PRODUCT_COLUMN_MAPPINGS, 'notes') || null,
                has_variants: true,
                status: 'pending',
                created_by: user?.id,
              };

              let productId: string;
              
              if (existingProduct) {
                // Update existing product
                const { error } = await supabase
                  .from('products')
                  .update(productData)
                  .eq('id', existingProduct.id);
                
                if (error) {
                  result.errors.push({
                    row: rowNumber,
                    sheet: 'Mahsulotlar',
                    field: 'Database',
                    message: `Yangilashda xato: ${error.message}`,
                    data: { name: productName },
                  });
                  continue;
                }
                productId = existingProduct.id;
              } else {
                // Insert new product
                const { data: newProduct, error } = await supabase
                  .from('products')
                  .insert(productData)
                  .select('id')
                  .single();
                
                if (error) {
                  result.errors.push({
                    row: rowNumber,
                    sheet: 'Mahsulotlar',
                    field: 'Database',
                    message: `Yaratishda xato: ${error.message}`,
                    data: { name: productName },
                  });
                  continue;
                }
                productId = newProduct.id;
                result.productsCreated++;
              }

              uuidToProductId.set(uuid, productId);
              uuidToProductData.set(uuid, productData);
            }
          }

          // Step 2: Process Variants sheet
          const variantsSheet = workbook.Sheets['Variantlar'];
          if (variantsSheet) {
            const variantsJson = XLSX.utils.sheet_to_json(variantsSheet);
            
            for (let i = 0; i < variantsJson.length; i++) {
              const row = variantsJson[i] as any;
              const rowNumber = i + 2;
              
              const productUuid = getColumnValue(row, VARIANT_COLUMN_MAPPINGS, 'product_uuid');
              const sku = getColumnValue(row, VARIANT_COLUMN_MAPPINGS, 'sku');
              
              if (!productUuid) {
                result.errors.push({
                  row: rowNumber,
                  sheet: 'Variantlar',
                  field: 'Mahsulot UUID',
                  message: 'Mahsulot UUID topilmadi',
                  data: row,
                });
                continue;
              }

              if (!sku) {
                result.errors.push({
                  row: rowNumber,
                  sheet: 'Variantlar',
                  field: 'SKU',
                  message: 'SKU majburiy',
                  data: row,
                });
                continue;
              }

              // Find product ID
              let productId = uuidToProductId.get(productUuid);
              
              // If not in map, try to find in database
              if (!productId) {
                const { data: existingProduct } = await supabase
                  .from('products')
                  .select('id')
                  .eq('uuid', productUuid)
                  .single();
                
                if (existingProduct) {
                  productId = existingProduct.id;
                  uuidToProductId.set(productUuid, productId);
                }
              }

              if (!productId) {
                result.errors.push({
                  row: rowNumber,
                  sheet: 'Variantlar',
                  field: 'Mahsulot UUID',
                  message: `Mahsulot topilmadi: ${productUuid}`,
                  data: row,
                });
                continue;
              }

              // Extract variant attributes from non-standard columns
              const standardCols = ['#', 'Mahsulot UUID', 'Mahsulot nomi', 'SKU', 'Shtrix kod', 'Narx', 'Zaxira', 'Vazn', 'Faol'];
              const variantAttributes = getAttributeColumns(row, standardCols);

              const priceValue = getColumnValue(row, VARIANT_COLUMN_MAPPINGS, 'price');
              const stockValue = getColumnValue(row, VARIANT_COLUMN_MAPPINGS, 'stock');
              const weightValue = getColumnValue(row, VARIANT_COLUMN_MAPPINGS, 'weight');
              const isActiveValue = getColumnValue(row, VARIANT_COLUMN_MAPPINGS, 'is_active');

              const price = priceValue ? parseFloat(String(priceValue).replace(/[^0-9.]/g, '')) : null;
              const stock = stockValue ? parseInt(String(stockValue).replace(/[^0-9]/g, '')) : 0;
              const weight = weightValue ? parseFloat(String(weightValue).replace(/[^0-9.]/g, '')) : null;
              const isActive = !isActiveValue || isActiveValue === 'Ha' || isActiveValue === 'true' || isActiveValue === '1';

              // Check if variant with SKU exists for this product
              const { data: existingVariant } = await supabase
                .from('product_variants')
                .select('id')
                .eq('product_id', productId)
                .eq('sku', sku)
                .single();

              const variantData = {
                product_id: productId,
                sku: String(sku).trim(),
                barcode: getColumnValue(row, VARIANT_COLUMN_MAPPINGS, 'barcode') || null,
                price: isNaN(price as number) ? null : price,
                stock_quantity: isNaN(stock) ? 0 : stock,
                weight: isNaN(weight as number) ? null : weight,
                variant_attributes: variantAttributes,
                is_active: isActive,
              };

              let variantId: string;

              if (existingVariant) {
                // Update existing variant
                const { error } = await supabase
                  .from('product_variants')
                  .update(variantData)
                  .eq('id', existingVariant.id);
                
                if (error) {
                  result.errors.push({
                    row: rowNumber,
                    sheet: 'Variantlar',
                    field: 'Database',
                    message: `Variant yangilashda xato: ${error.message}`,
                    data: { sku },
                  });
                  continue;
                }
                variantId = existingVariant.id;
              } else {
                // Insert new variant
                const { data: newVariant, error } = await supabase
                  .from('product_variants')
                  .insert(variantData)
                  .select('id')
                  .single();
                
                if (error) {
                  result.errors.push({
                    row: rowNumber,
                    sheet: 'Variantlar',
                    field: 'Database',
                    message: `Variant yaratishda xato: ${error.message}`,
                    data: { sku },
                  });
                  continue;
                }
                variantId = newVariant.id;
                result.variantsCreated++;
              }

              // Create product_items for stock
              if (stock > 0 && isActive) {
                // Check existing items for this variant
                const { data: existingItems } = await supabase
                  .from('product_items')
                  .select('id')
                  .eq('product_id', productId)
                  .eq('variant_id', variantId)
                  .is('box_id', null);

                const existingCount = existingItems?.length || 0;
                const diff = stock - existingCount;

                if (diff > 0) {
                  const productData = uuidToProductData.get(productUuid) || {};
                  const itemsToCreate = Array.from({ length: diff }, (_, idx) => ({
                    item_uuid: `${productUuid}-${sku}-${Date.now()}-${idx + 1}`,
                    product_id: productId,
                    variant_id: variantId,
                    status: 'pending',
                    location: 'china',
                    unit_cost: price,
                    unit_cost_currency: productData.purchase_currency || 'CNY',
                  }));

                  const { error: itemError } = await supabase
                    .from('product_items')
                    .insert(itemsToCreate);

                  if (!itemError) {
                    result.productItemsCreated += diff;
                  }
                }
              }
            }
          }

          // Update product quantities based on variants
          for (const [uuid, productId] of uuidToProductId.entries()) {
            const { data: variants } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('product_id', productId)
              .eq('is_active', true);

            if (variants && variants.length > 0) {
              const totalQty = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
              await supabase
                .from('products')
                .update({ quantity: totalQty })
                .eq('id', productId);
            }
          }

          queryClient.invalidateQueries({ queryKey: ['products'] });
          
          setImportResult(result);
          setShowResultDialog(true);

          toast({
            title: 'Import yakunlandi',
            description: `${result.productsCreated} mahsulot, ${result.variantsCreated} variant yaratildi`,
            variant: result.errors.length > 0 ? 'default' : 'default',
          });
        } catch (error: any) {
          toast({
            title: 'Import xatosi',
            description: error.message,
            variant: 'destructive',
          });
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      toast({
        title: 'Fayl o\'qish xatosi',
        description: error.message,
        variant: 'destructive',
      });
      setIsImporting(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImport}
          className="hidden"
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-h-[44px]" disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Eksport
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border">
            <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" />
              Excel yuklash (variantlar bilan)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExportTemplate} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" />
              Shablon yuklash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 min-h-[44px]"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
        >
          {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Import
        </Button>
      </div>

      {/* Import Results Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {importResult && importResult.errors.length === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-orange-500" />
              )}
              Import Natijalari
            </DialogTitle>
            <DialogDescription>
              Import jarayoni yakunlandi
            </DialogDescription>
          </DialogHeader>
          
          {importResult && (
            <div className="space-y-4">
              {/* Success summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="text-2xl font-bold text-green-600">{importResult.productsCreated}</div>
                  <div className="text-xs text-muted-foreground">Yangi mahsulot</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-600">{importResult.variantsCreated}</div>
                  <div className="text-xs text-muted-foreground">Yangi variant</div>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="text-2xl font-bold text-purple-600">{importResult.productItemsCreated}</div>
                  <div className="text-xs text-muted-foreground">Zaxira birlik</div>
                </div>
              </div>

              {/* Errors if any */}
              {importResult.errors.length > 0 && (
                <Tabs defaultValue="errors" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="errors" className="flex-1 gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Xatolar
                      <Badge variant="destructive" className="ml-1">{importResult.errors.length}</Badge>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="errors">
                    <ScrollArea className="h-[250px] rounded-md border border-border p-3">
                      <div className="space-y-2">
                        {importResult.errors.map((error, index) => (
                          <div key={index} className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                            <div className="flex items-start gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {error.sheet} - Qator {error.row}
                              </Badge>
                              <span className="text-sm text-destructive">{error.message}</span>
                            </div>
                            {error.data?.name && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Mahsulot: {error.data.name}
                              </p>
                            )}
                            {error.data?.sku && (
                              <p className="text-xs text-muted-foreground mt-1">
                                SKU: {error.data.sku}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              )}

              {importResult.errors.length === 0 && (
                <Alert className="border-green-500/20 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Barcha ma'lumotlar muvaffaqiyatli import qilindi!
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowResultDialog(false)}>
                  Yopish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
