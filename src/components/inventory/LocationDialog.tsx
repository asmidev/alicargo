import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse: any;
  location?: any;
}

export function LocationDialog({ open, onOpenChange, warehouse, location }: LocationDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    zone: '',
    shelf: '',
    position: '',
    capacity: '100',
  });

  useEffect(() => {
    if (location) {
      setFormData({
        zone: location.zone || '',
        shelf: location.shelf || '',
        position: location.position || '',
        capacity: location.capacity?.toString() || '100',
      });
    } else {
      setFormData({
        zone: '',
        shelf: '',
        position: '',
        capacity: '100',
      });
    }
  }, [location, open]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // Validate warehouse exists
      if (!warehouse?.id) {
        throw new Error(t('loc_warehouse_not_selected'));
      }
      if (!warehouse?.name) {
        throw new Error(t('loc_warehouse_name_missing'));
      }
      
      if (location) {
        const { error } = await supabase
          .from('warehouse_locations')
          .update(data)
          .eq('id', location.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('warehouse_locations')
          .insert([{ ...data, warehouse_id: warehouse.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
      toast.success(location ? t('loc_updated') : t('loc_created'));
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || t('toast_unknown_error'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.zone) {
      toast.error(t('loc_zone_required'));
      return;
    }
    mutation.mutate({
      zone: formData.zone,
      shelf: formData.shelf || null,
      position: formData.position || null,
      capacity: parseInt(formData.capacity) || 100,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {location ? t('loc_edit_title') : t('loc_new_title', { name: warehouse?.name })}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('loc_zone')}</Label>
            <Input
              value={formData.zone}
              onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
              placeholder={t('loc_zone_placeholder')}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('loc_shelf')}</Label>
              <Input
                value={formData.shelf}
                onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                placeholder={t('loc_shelf_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('loc_position')}</Label>
              <Input
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder={t('loc_position_placeholder')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('loc_capacity')}</Label>
            <Input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="100"
              min="1"
            />
          </div>

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