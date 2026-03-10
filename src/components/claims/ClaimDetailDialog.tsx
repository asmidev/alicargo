import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Send, CheckCircle, XCircle, DollarSign, Clock, Package, Box, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';

interface ClaimDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: any;
  onStatusChange: (status: string, notes?: string) => void;
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  submitted: Send,
  approved: CheckCircle,
  rejected: XCircle,
  compensated: DollarSign,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  submitted: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  approved: 'bg-green-500/20 text-green-600 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-600 border-red-500/30',
  compensated: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'clm_status_pending',
  submitted: 'clm_status_submitted',
  approved: 'clm_status_approved',
  rejected: 'clm_status_rejected',
  compensated: 'clm_status_compensated',
};

export function ClaimDetailDialog({ open, onOpenChange, claim, onStatusChange }: ClaimDetailDialogProps) {
  const { t } = useTranslation();
  const [resolutionNotes, setResolutionNotes] = useState('');
  const { isOwner, isChiefManager, isUzManager } = useUserRole();
  const canChangeStatus = isOwner || isChiefManager || isUzManager;

  const { data: history = [] } = useQuery({
    queryKey: ['claim-history', claim?.id],
    queryFn: async () => {
      if (!claim?.id) return [];
      const { data, error } = await supabase
        .from('claim_status_history')
        .select(`
          *,
          changed_by_profile:profiles!claim_status_history_changed_by_fkey(full_name)
        `)
        .eq('claim_id', claim.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        const { data: simpleData, error: simpleError } = await supabase
          .from('claim_status_history')
          .select('*')
          .eq('claim_id', claim.id)
          .order('created_at', { ascending: false });
        if (simpleError) throw simpleError;
        return simpleData || [];
      }
      return data;
    },
    enabled: !!claim?.id,
  });

  if (!claim) return null;

  const statusColor = STATUS_COLORS[claim.status] || STATUS_COLORS.pending;
  const StatusIcon = STATUS_ICONS[claim.status] || Clock;
  const statusLabel = t(STATUS_LABEL_KEYS[claim.status] || 'clm_status_pending');

  const handleStatusChange = (newStatus: string) => {
    onStatusChange(newStatus, resolutionNotes || undefined);
    setResolutionNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{t('clm_detail_title')}: {claim.claim_number}</span>
            <Badge variant="outline" className={statusColor}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusLabel}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('clm_created_date')}</p>
              <p className="font-medium">{format(new Date(claim.created_at), 'dd.MM.yyyy HH:mm')}</p>
            </div>
            {claim.resolved_at && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('clm_resolved_date')}</p>
                <p className="font-medium">{format(new Date(claim.resolved_at), 'dd.MM.yyyy HH:mm')}</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {claim.box && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Box className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('cf_box')}</p>
                  <p className="font-medium">{claim.box.box_number}</p>
                </div>
              </div>
            )}
            {claim.product && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('cf_product')}</p>
                  <p className="font-medium">{claim.product.name}</p>
                </div>
              </div>
            )}
          </div>

          {claim.defect_category && (
            <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <span className="font-medium text-destructive">{t('clm_defect_type')}</span>
              </div>
              <p>{claim.defect_category.name_uz || claim.defect_category.name}</p>
            </div>
          )}

          {claim.defect_description && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('clm_description')}</p>
              <p className="text-muted-foreground">{claim.defect_description}</p>
            </div>
          )}

          {claim.claim_amount && (
            <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{t('clm_amount')}</p>
                <p className="text-2xl font-bold text-primary">
                  {claim.claim_amount} {claim.claim_currency}
                </p>
              </div>
            </div>
          )}

          {claim.compensation_amount && (
            <div className="flex items-center gap-4 p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">{t('clm_compensation')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {claim.compensation_amount} {claim.compensation_currency}
                </p>
              </div>
            </div>
          )}

          {claim.resolution_notes && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('clm_resolution_notes')}</p>
              <p className="text-muted-foreground p-3 bg-muted/50 rounded-lg">{claim.resolution_notes}</p>
            </div>
          )}

          <Separator />

          {history.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{t('clm_history')}</p>
              <div className="space-y-2">
                {history.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 text-sm p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">
                      {format(new Date(item.created_at), 'dd.MM.yyyy HH:mm')}
                    </span>
                    <span>
                      {t(STATUS_LABEL_KEYS[item.old_status] || 'clm_status_pending')} → {t(STATUS_LABEL_KEYS[item.new_status] || 'clm_status_pending')}
                    </span>
                    {item.notes && <span className="text-muted-foreground">({item.notes})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {canChangeStatus && claim.status !== 'compensated' && (
            <>
              <Separator />
              <div className="space-y-4">
                <p className="text-sm font-medium">{t('clm_change_status')}</p>
                
                <Textarea
                  placeholder={t('clm_note_placeholder')}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={2}
                />
                
                <div className="flex flex-wrap gap-2">
                  {claim.status === 'pending' && (
                    <Button
                      variant="outline"
                      className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      onClick={() => handleStatusChange('submitted')}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {t('clm_submit_abusaxiy')}
                    </Button>
                  )}
                  
                  {(claim.status === 'pending' || claim.status === 'submitted') && (
                    <>
                      <Button
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50"
                        onClick={() => handleStatusChange('approved')}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('clm_approve')}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-500 text-red-600 hover:bg-red-50"
                        onClick={() => handleStatusChange('rejected')}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {t('clm_reject')}
                      </Button>
                    </>
                  )}
                  
                  {claim.status === 'approved' && (
                    <Button
                      variant="outline"
                      className="border-purple-500 text-purple-600 hover:bg-purple-50"
                      onClick={() => handleStatusChange('compensated')}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      {t('clm_compensated')}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}