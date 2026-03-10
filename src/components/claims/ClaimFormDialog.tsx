import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTelegramAlert } from '@/hooks/useTelegramAlert';
import { useTranslation } from 'react-i18next';

interface ClaimFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim?: any;
}

export function ClaimFormDialog({ open, onOpenChange, claim }: ClaimFormDialogProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { sendAlert } = useTelegramAlert();
  
  const [formData, setFormData] = useState({
    box_id: '',
    product_id: '',
    defect_category_id: '',
    defect_description: '',
    claim_amount: '',
    claim_currency: 'USD',
  });

  // Fetch boxes
  const { data: boxes = [] } = useQuery({
    queryKey: ['boxes-for-claims'],
    queryFn: async () => {
      return await fetchAllRows(
        supabase
          .from('boxes')
          .select('id, box_number')
          .order('created_at', { ascending: false })
      );
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-claims'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch defect categories
  const { data: defectCategories = [] } = useQuery({
    queryKey: ['defect-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('defect_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Reset form when claim changes
  useEffect(() => {
    if (claim) {
      setFormData({
        box_id: claim.box_id || '',
        product_id: claim.product_id || '',
        defect_category_id: claim.defect_category_id || '',
        defect_description: claim.defect_description || '',
        claim_amount: claim.claim_amount?.toString() || '',
        claim_currency: claim.claim_currency || 'USD',
      });
    } else {
      setFormData({
        box_id: '',
        product_id: '',
        defect_category_id: '',
        defect_description: '',
        claim_amount: '',
        claim_currency: 'USD',
      });
    }
  }, [claim, open]);

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (claim) {
        const { error } = await supabase
          .from('defect_claims')
          .update(data)
          .eq('id', claim.id);
        if (error) throw error;
      } else {
        const { data: newClaim, error } = await supabase
          .from('defect_claims')
          .insert([{ ...data, created_by: user?.id }])
          .select()
          .single();
        if (error) throw error;
        return newClaim;
      }
    },
    onSuccess: (newClaim) => {
      queryClient.invalidateQueries({ queryKey: ['defect-claims'] });
      toast.success(claim ? t('cf_updated') : t('cf_created'));
      onOpenChange(false);
      
      // Send Telegram notification for new claims
      if (!claim && newClaim) {
        sendAlert({
          eventType: 'defect_found',
          data: {
            claim_number: newClaim.claim_number,
            message: "Yangi nuqsonli mahsulot da'vosi yaratildi"
          },
          targetRoles: ['rahbar', 'bosh_admin', 'xitoy_manager', 'uz_manager']
        });
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Xatolik yuz berdi');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      box_id: formData.box_id || null,
      product_id: formData.product_id || null,
      defect_category_id: formData.defect_category_id || null,
      defect_description: formData.defect_description,
      claim_amount: formData.claim_amount ? parseFloat(formData.claim_amount) : null,
      claim_currency: formData.claim_currency,
    };
    
    mutation.mutate(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {claim ? t('cf_edit') : t('cf_create')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Box Selection */}
          <div className="space-y-2">
            <Label>{t('cf_box')}</Label>
            <Select
              value={formData.box_id}
              onValueChange={(value) => setFormData({ ...formData, box_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('cf_select_box')} />
              </SelectTrigger>
              <SelectContent>
                {boxes.map((box) => (
                  <SelectItem key={box.id} value={box.id}>
                    {box.box_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label>{t('cf_product')}</Label>
            <Select
              value={formData.product_id}
              onValueChange={(value) => setFormData({ ...formData, product_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('cf_select_product')} />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Defect Category */}
          <div className="space-y-2">
            <Label>{t('cf_defect_type')} *</Label>
            <Select
              value={formData.defect_category_id}
              onValueChange={(value) => setFormData({ ...formData, defect_category_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder={t('cf_select_defect')} />
              </SelectTrigger>
              <SelectContent>
                {defectCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name_uz || category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>{t('cf_description')}</Label>
            <Textarea
              value={formData.defect_description}
              onChange={(e) => setFormData({ ...formData, defect_description: e.target.value })}
              placeholder={t('cf_desc_placeholder')}
              rows={3}
            />
          </div>

          {/* Claim Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('cf_amount')}</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.claim_amount}
                onChange={(e) => setFormData({ ...formData, claim_amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('cf_currency')}</Label>
              <Select
                value={formData.claim_currency}
                onValueChange={(value) => setFormData({ ...formData, claim_currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CNY">CNY</SelectItem>
                  <SelectItem value="UZS">UZS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}