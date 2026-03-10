import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Package, Tags, Layers, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';

type AttributeTypeValue = "text" | "number" | "select" | "multi_select" | "boolean" | "date" | "color" | "size";

const ATTRIBUTE_TYPES = [
  { value: "text" as const, label: "Matn" },
  { value: "number" as const, label: "Raqam" },
  { value: "select" as const, label: "Tanlash" },
  { value: "multi_select" as const, label: "Ko'p tanlash" },
  { value: "boolean" as const, label: "Ha/Yo'q" },
  { value: "color" as const, label: "Rang" },
  { value: "size" as const, label: "O'lcham" },
];

interface AttributeForm {
  id?: string;
  name: string;
  name_ru: string;
  name_en: string;
  attribute_key: string;
  attribute_type: AttributeTypeValue;
  is_required: boolean;
  is_filterable: boolean;
  is_variant: boolean;
  options: string;
  unit: string;
}

const emptyAttribute: AttributeForm = {
  name: '',
  name_ru: '',
  name_en: '',
  attribute_key: '',
  attribute_type: 'text',
  is_required: false,
  is_filterable: false,
  is_variant: false,
  options: '',
  unit: '',
};

export default function Categories() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    name_ru: '',
    name_en: '',
    slug: '',
    description: '',
    sort_order: 0,
  });
  
  const [attributes, setAttributes] = useState<AttributeForm[]>([]);
  const [newAttribute, setNewAttribute] = useState<AttributeForm>({ ...emptyAttribute });

  // Fetch categories with attributes count - all queries run in parallel
  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories-admin-full'],
    queryFn: async () => {
      // Run all queries in parallel for faster loading
      const [categoriesResult, attrResult, variantResult, productsResult] = await Promise.all([
        supabase.from('categories_hierarchy').select('*').order('sort_order', { ascending: true }),
        supabase.from('attribute_definitions').select('category_id'),
        supabase.from('attribute_definitions').select('category_id').eq('is_variant', true),
        supabase.from('products').select('category_id'),
      ]);
      
      if (categoriesResult.error) throw categoriesResult.error;

      const attrCounts: Record<string, { total: number; variants: number }> = {};
      attrResult.data?.forEach(attr => {
        if (attr.category_id) {
          if (!attrCounts[attr.category_id]) {
            attrCounts[attr.category_id] = { total: 0, variants: 0 };
          }
          attrCounts[attr.category_id].total++;
        }
      });

      variantResult.data?.forEach(attr => {
        if (attr.category_id) {
          if (!attrCounts[attr.category_id]) {
            attrCounts[attr.category_id] = { total: 0, variants: 0 };
          }
          attrCounts[attr.category_id].variants++;
        }
      });

      const productCounts: Record<string, number> = {};
      productsResult.data?.forEach(p => {
        if (p.category_id) {
          productCounts[p.category_id] = (productCounts[p.category_id] || 0) + 1;
        }
      });

      return categoriesResult.data.map(cat => ({
        ...cat,
        attributeCount: attrCounts[cat.id]?.total || 0,
        variantCount: attrCounts[cat.id]?.variants || 0,
        productCount: productCounts[cat.id] || 0,
      }));
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in memory for 5 minutes
  });

  // Fetch attributes for editing category
  const fetchCategoryAttributes = async (categoryId: string) => {
    const { data, error } = await supabase
      .from('attribute_definitions')
      .select('*')
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data?.map(attr => ({
      id: attr.id,
      name: attr.name,
      name_ru: attr.name_ru || '',
      name_en: attr.name_en || '',
      attribute_key: attr.attribute_key,
      attribute_type: attr.attribute_type as AttributeTypeValue,
      is_required: attr.is_required || false,
      is_filterable: attr.is_filterable || false,
      is_variant: attr.is_variant || false,
      options: Array.isArray(attr.options) ? attr.options.join(', ') : '',
      unit: attr.unit || '',
    })) || [];
  };

  const saveMutation = useMutation({
    mutationFn: async (data: { category: typeof formData; attributes: AttributeForm[]; existingAttributeIds: string[] }) => {
      let categoryId: string;
      
      if (editingCategory) {
        const { error } = await supabase
          .from('categories_hierarchy')
          .update({
            name: data.category.name,
            name_ru: data.category.name_ru || null,
            name_en: data.category.name_en || null,
            slug: data.category.slug,
          })
          .eq('id', editingCategory.id);
        if (error) throw error;
        categoryId = editingCategory.id;

        // Delete removed attributes
        const currentIds = data.attributes.filter(a => a.id).map(a => a.id);
        const toDelete = data.existingAttributeIds.filter(id => !currentIds.includes(id));
        if (toDelete.length > 0) {
          const { error: delError } = await supabase
            .from('attribute_definitions')
            .delete()
            .in('id', toDelete);
          if (delError) throw delError;
        }
      } else {
        const { data: newCat, error } = await supabase
          .from('categories_hierarchy')
          .insert([{
            name: data.category.name,
            name_ru: data.category.name_ru || null,
            name_en: data.category.name_en || null,
            slug: data.category.slug,
            sort_order: data.category.sort_order,
            level: 0,
          }])
          .select()
          .single();
        if (error) throw error;
        categoryId = newCat.id;
      }

      // Save attributes
      for (const attr of data.attributes) {
        const attrData = {
          category_id: categoryId,
          name: attr.name,
          name_ru: attr.name_ru || null,
          name_en: attr.name_en || null,
          attribute_key: attr.attribute_key,
          attribute_type: attr.attribute_type,
          is_required: attr.is_required,
          is_filterable: attr.is_filterable,
          is_variant: attr.is_variant,
          options: attr.options ? attr.options.split(',').map(o => o.trim()) : null,
          unit: attr.unit || null,
        };

        if (attr.id) {
          const { error } = await supabase
            .from('attribute_definitions')
            .update(attrData)
            .eq('id', attr.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('attribute_definitions')
            .insert(attrData);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-admin-full'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['attribute-definitions'] });
      toast.success(editingCategory ? t('cat_updated') : t('cat_added'));
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Xatolik yuz berdi');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('categories_hierarchy')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-admin-full'] });
      toast.success(t('cat_status_changed'));
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete attributes first
      await supabase.from('attribute_definitions').delete().eq('category_id', id);
      const { error } = await supabase.from('categories_hierarchy').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-admin-full'] });
      toast.success(t('cat_deleted'));
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Xatolik yuz berdi');
    },
  });

  const [existingAttributeIds, setExistingAttributeIds] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ category: formData, attributes, existingAttributeIds });
  };

  const handleEdit = async (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      name_ru: category.name_ru || '',
      name_en: category.name_en || '',
      slug: category.slug,
      description: '',
      sort_order: category.sort_order || 0,
    });
    
    const attrs = await fetchCategoryAttributes(category.id);
    setAttributes(attrs);
    setExistingAttributeIds(attrs.filter(a => a.id).map(a => a.id!));
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCategory(null);
    setFormData({ name: '', name_ru: '', name_en: '', slug: '', description: '', sort_order: 0 });
    setAttributes([]);
    setExistingAttributeIds([]);
    setNewAttribute({ ...emptyAttribute });
  };

  const handleDeleteClick = (category: any) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  const generateKey = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
  };

  const addAttribute = () => {
    if (!newAttribute.name || !newAttribute.attribute_key) {
      toast.error(t('cat_attr_fill_error'));
      return;
    }
    setAttributes([...attributes, { ...newAttribute }]);
    setNewAttribute({ ...emptyAttribute });
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateAttribute = (index: number, field: keyof AttributeForm, value: any) => {
    const updated = [...attributes];
    updated[index] = { ...updated[index], [field]: value };
    setAttributes(updated);
  };

  if (isLoading) {
    return <div className="p-6"><LoadingSkeleton count={5} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('cat_title')}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('cat_subtitle')}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(newOpen) => !newOpen && handleClose()}>
          <DialogTrigger asChild>
            <Button onClick={() => setOpen(true)} className="gap-2 bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20 min-h-[44px] w-full sm:w-auto transition-all duration-200 hover:scale-[1.02]">
              <Plus className="h-4 w-4" />
              {t('cat_add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-[95vw] sm:max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingCategory ? t('cat_edit_title') : t('cat_new_title')}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-120px)]">
              <form onSubmit={handleSubmit} className="space-y-6 pr-4">
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="general">{t('cat_general')}</TabsTrigger>
                    <TabsTrigger value="attributes" className="gap-2">
                      <Tags className="h-4 w-4" />
                      {t('cat_attributes')} ({attributes.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-foreground">{t('cat_name_uz')}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setFormData({ ...formData, name, slug: generateSlug(name) });
                        }}
                        className="bg-background border-border text-foreground"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name_ru" className="text-foreground">{t('cat_name_ru')}</Label>
                        <Input
                          id="name_ru"
                          value={formData.name_ru}
                          onChange={(e) => setFormData({ ...formData, name_ru: e.target.value })}
                          className="bg-background border-border text-foreground"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name_en" className="text-foreground">{t('cat_name_en')}</Label>
                        <Input
                          id="name_en"
                          value={formData.name_en}
                          onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                          className="bg-background border-border text-foreground"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug" className="text-foreground">Slug (URL)</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        className="bg-background border-border text-foreground"
                        required
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="attributes" className="space-y-4 mt-4">
                    {attributes.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-foreground">{t('cat_existing_attrs')}</Label>
                        {attributes.map((attr, index) => (
                          <Card key={index} className="p-3 bg-background/50">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-2">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <Input
                                    value={attr.name}
                                    onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                                    placeholder={t('cat_attr_name_placeholder')}
                                    className="flex-1"
                                  />
                                  <Select
                                    value={attr.attribute_type}
                                    onValueChange={(v) => updateAttribute(index, 'attribute_type', v)}
                                  >
                                    <SelectTrigger className="w-full sm:w-[120px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ATTRIBUTE_TYPES.map(at => (
                                        <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                  <label className="flex items-center gap-2">
                                    <Switch
                                      checked={attr.is_variant}
                                      onCheckedChange={(v) => updateAttribute(index, 'is_variant', v)}
                                    />
                                    <span className="text-muted-foreground">{t('cat_variant')}</span>
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <Switch
                                      checked={attr.is_required}
                                      onCheckedChange={(v) => updateAttribute(index, 'is_required', v)}
                                    />
                                    <span className="text-muted-foreground">{t('cat_required')}</span>
                                  </label>
                                </div>
                                {(attr.attribute_type === 'select' || attr.attribute_type === 'multi_select' || attr.attribute_type === 'color' || attr.attribute_type === 'size') && (
                                  <Input
                                    value={attr.options}
                                    onChange={(e) => updateAttribute(index, 'options', e.target.value)}
                                    placeholder={t('cat_options_placeholder')}
                                    className="text-sm"
                                  />
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAttribute(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-3">
                      <Label className="text-foreground">{t('cat_add_attr')}</Label>
                      <Card className="p-4 bg-primary/5 border-primary/20">
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={newAttribute.name}
                              onChange={(e) => setNewAttribute({ 
                                ...newAttribute, 
                                name: e.target.value,
                                attribute_key: generateKey(e.target.value)
                              })}
                              placeholder={t('cat_attr_name_placeholder')}
                            />
                            <Input
                              value={newAttribute.attribute_key}
                              onChange={(e) => setNewAttribute({ ...newAttribute, attribute_key: e.target.value })}
                              placeholder={t('cat_attr_key_placeholder')}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={newAttribute.name_ru}
                              onChange={(e) => setNewAttribute({ ...newAttribute, name_ru: e.target.value })}
                              placeholder={t('cat_name_ru')}
                            />
                            <Input
                              value={newAttribute.name_en}
                              onChange={(e) => setNewAttribute({ ...newAttribute, name_en: e.target.value })}
                              placeholder={t('cat_name_en')}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={newAttribute.attribute_type}
                              onValueChange={(v) => setNewAttribute({ ...newAttribute, attribute_type: v as AttributeTypeValue })}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ATTRIBUTE_TYPES.map(at => (
                                  <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <label className="flex items-center gap-2">
                              <Switch
                                checked={newAttribute.is_variant}
                                onCheckedChange={(v) => setNewAttribute({ ...newAttribute, is_variant: v })}
                              />
                              <span className="text-sm text-muted-foreground">{t('cat_variant')}</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <Switch
                                checked={newAttribute.is_required}
                                onCheckedChange={(v) => setNewAttribute({ ...newAttribute, is_required: v })}
                              />
                              <span className="text-sm text-muted-foreground">{t('cat_required')}</span>
                            </label>
                          </div>
                          {(newAttribute.attribute_type === 'select' || newAttribute.attribute_type === 'multi_select' || newAttribute.attribute_type === 'color' || newAttribute.attribute_type === 'size') && (
                            <Input
                              value={newAttribute.options}
                              onChange={(e) => setNewAttribute({ ...newAttribute, options: e.target.value })}
                              placeholder={t('cat_attr_options_placeholder')}
                            />
                          )}
                          <Button type="button" onClick={addAttribute} className="w-full gap-2">
                            <Plus className="h-4 w-4" />
                            {t('cat_attr_add_btn')}
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90">
                    {saveMutation.isPending ? t('saving') : t('save')}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    {t('cancel')}
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {categories?.map((category) => (
          <Card key={category.id} className="p-4 sm:p-6 bg-card border-border transition-all duration-200 hover:shadow-md hover:border-primary/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground">{category.name}</h3>
                  <Badge variant={category.is_active ? "default" : "secondary"}>
                    {category.is_active ? t('cat_active') : t('cat_inactive')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">/{category.slug}</p>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Tags className="h-4 w-4" />
                    <span>{t('cat_n_attributes', { count: category.attributeCount })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Layers className="h-4 w-4" />
                    <span>{t('cat_n_variants', { count: category.variantCount })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    <span>{t('cat_n_products', { count: category.productCount })}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${category.id}`} className="text-sm text-muted-foreground hidden sm:inline">
                    {t('cat_active')}
                  </Label>
                  <Switch
                    id={`active-${category.id}`}
                    checked={category.is_active}
                    onCheckedChange={(checked) => 
                      toggleStatusMutation.mutate({ id: category.id, is_active: checked })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(category)}
                  className="min-h-[44px] min-w-[44px] hover:bg-primary/10 transition-all duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t('edit')}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteClick(category)}
                  className="min-h-[44px] min-w-[44px] hover:bg-destructive/10 hover:text-destructive transition-all duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t('delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t('cat_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t('cat_delete_confirm', { name: categoryToDelete?.name })}
              {(categoryToDelete?.productCount > 0 || categoryToDelete?.attributeCount > 0) && (
                <span className="block mt-2 text-destructive font-medium">
                  {t('cat_delete_warning', { products: categoryToDelete.productCount, attrs: categoryToDelete.attributeCount })}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => categoryToDelete && deleteMutation.mutate(categoryToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
