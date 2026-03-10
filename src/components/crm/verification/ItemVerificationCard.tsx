import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Check, X, AlertTriangle, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { DefectCategorySelector } from './DefectCategorySelector';
import { DefectPhotoCapture } from './DefectPhotoCapture';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTranslation } from 'react-i18next';
import { getColorStyle } from '@/lib/productGrouping';

export interface ItemVerificationStatus {
  status: 'pending' | 'ok' | 'defective' | 'missing';
  defectType: string | null;
  notes: string;
  photoUrls: string[];
}

interface ItemVerificationCardProps {
  item: {
    id: string;
    item_uuid: string;
    products: {
      name: string;
      uuid: string;
    } | null;
    product_variants?: {
      variant_attributes: any;
      sku: string;
    } | null;
  };
  sessionId: string;
  status: ItemVerificationStatus;
  onStatusChange: (status: ItemVerificationStatus) => void;
  disabled?: boolean;
  index: number;
  isMobileFullView?: boolean;
}

export function ItemVerificationCard({
  item,
  sessionId,
  status,
  onStatusChange,
  disabled,
  index,
  isMobileFullView,
}: ItemVerificationCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(status.status !== 'pending' || isMobileFullView);
  const notesRef = useRef<HTMLDivElement>(null);

  const scrollToNotes = () => {
    setTimeout(() => {
      notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleStatusChange = (newStatus: 'ok' | 'defective' | 'missing') => {
    onStatusChange({
      ...status,
      status: newStatus,
      defectType: newStatus === 'ok' ? null : status.defectType,
      notes: newStatus === 'ok' ? '' : status.notes,
      photoUrls: newStatus === 'ok' ? [] : status.photoUrls,
    });
    
    if (newStatus === 'defective' || newStatus === 'missing') {
      setIsExpanded(true);
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'ok': return 'border-green-500/30 bg-green-500/5';
      case 'defective': return 'border-red-500/30 bg-red-500/5';
      case 'missing': return 'border-yellow-500/30 bg-yellow-500/5';
      default: return 'border-border bg-muted/30';
    }
  };

  const getStatusBadge = () => {
    switch (status.status) {
      case 'ok': 
        return <Badge className="bg-green-500 gap-1"><Check className="h-3 w-3" />OK</Badge>;
      case 'defective': 
        return <Badge className="bg-red-500 gap-1"><X className="h-3 w-3" />{t('vr_defective')}</Badge>;
      case 'missing': 
        return <Badge className="bg-yellow-500 gap-1"><AlertTriangle className="h-3 w-3" />{t('vr_missing')}</Badge>;
      default: 
        return <Badge variant="secondary" className="gap-1">{t('vr_waiting')}</Badge>;
    }
  };

  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${getStatusColor()} ${
        isMobileFullView ? 'h-full flex flex-col' : ''
      }`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className={`p-3 sm:p-4 ${isMobileFullView ? 'flex-1 flex flex-col' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-medium text-foreground text-sm truncate">
                  {item.products?.name || t('vr_unknown_product')}
                </p>
                {item.product_variants?.variant_attributes?.rang && (() => {
                  const colorStyle = getColorStyle(item.product_variants.variant_attributes.rang);
                  return (
                    <Badge variant="outline" className="text-xs gap-1 items-center px-1.5 py-0">
                      <span 
                        className="inline-block w-2.5 h-2.5 rounded-full border-2 border-gray-400 shrink-0 shadow-sm" 
                        style={{ backgroundColor: colorStyle.color }} 
                      />
                      {item.product_variants.variant_attributes.rang}
                    </Badge>
                  );
                })()}
              </div>
              <p className="text-xs text-muted-foreground break-all line-clamp-2">
                {item.item_uuid}
              </p>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Action Buttons */}
        <div className={`grid gap-2 ${isMobileFullView ? 'mb-4 grid-cols-1' : 'mb-3 grid-cols-3 min-w-fit'}`}>
          <Button
            variant={status.status === 'ok' ? 'default' : 'outline'}
            size={isMobileFullView ? 'lg' : 'sm'}
            onClick={() => handleStatusChange('ok')}
            disabled={disabled}
            className={`w-full ${isMobileFullView ? 'min-h-[56px]' : 'min-h-[44px]'} transition-all duration-200 ${
              status.status === 'ok' 
                ? 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20' 
                : 'hover:border-green-500/50'
            }`}
          >
            <Check className={isMobileFullView ? 'h-5 w-5 mr-2' : 'h-4 w-4 mr-1'} />
            <span className={isMobileFullView ? '' : 'hidden sm:inline'}>OK</span>
            <span className={isMobileFullView ? 'hidden' : 'sm:hidden'}>✓</span>
          </Button>
          <Button
            variant={status.status === 'defective' ? 'default' : 'outline'}
            size={isMobileFullView ? 'lg' : 'sm'}
            onClick={() => handleStatusChange('defective')}
            disabled={disabled}
            className={`w-full ${isMobileFullView ? 'min-h-[56px]' : 'min-h-[44px]'} transition-all duration-200 ${
              status.status === 'defective' 
                ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20' 
                : 'hover:border-red-500/50'
            }`}
          >
            <X className={isMobileFullView ? 'h-5 w-5 mr-2' : 'h-4 w-4 mr-1'} />
            <span className={isMobileFullView ? '' : 'hidden sm:inline'}>{t('vr_defective')}</span>
            <span className={isMobileFullView ? 'hidden' : 'sm:hidden'}>✗</span>
          </Button>
          <Button
            variant={status.status === 'missing' ? 'default' : 'outline'}
            size={isMobileFullView ? 'lg' : 'sm'}
            onClick={() => handleStatusChange('missing')}
            disabled={disabled}
            className={`w-full ${isMobileFullView ? 'min-h-[56px]' : 'min-h-[44px]'} transition-all duration-200 ${
              status.status === 'missing' 
                ? 'bg-yellow-500 hover:bg-yellow-600 shadow-lg shadow-yellow-500/20' 
                : 'hover:border-yellow-500/50'
            }`}
          >
            <AlertTriangle className={isMobileFullView ? 'h-5 w-5 mr-2' : 'h-4 w-4 mr-1'} />
            <span className={isMobileFullView ? '' : 'hidden sm:inline'}>{t('vr_missing')}</span>
            <span className={isMobileFullView ? 'hidden' : 'sm:hidden'}>?</span>
          </Button>
        </div>

        {/* Expandable Details for Defective/Missing */}
        {(status.status === 'defective' || status.status === 'missing') && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-between text-muted-foreground hover:text-foreground"
              >
                <span className="text-xs">
                  {status.status === 'defective' ? t('vr_defect_details') : t('vr_extra_info')}
                </span>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              {status.status === 'defective' && (
                <DefectCategorySelector
                  selectedCategory={status.defectType}
                  onSelect={(category) => onStatusChange({ ...status, defectType: category })}
                  disabled={disabled}
                />
              )}

              {status.status === 'defective' && (
                <DefectPhotoCapture
                  sessionId={sessionId}
                  itemId={item.id}
                  photos={status.photoUrls}
                  onPhotosChange={(photos) => onStatusChange({ ...status, photoUrls: photos })}
                  disabled={disabled}
                  onPhotoUploaded={scrollToNotes}
                />
              )}

              <div ref={notesRef} className="space-y-2">
                <p className="text-sm font-medium text-foreground">{t('vr_note')}</p>
                <Textarea
                  placeholder={status.status === 'defective' ? t('vr_defect_note_ph') : t('vr_missing_note_ph')}
                  value={status.notes}
                  onChange={(e) => onStatusChange({ ...status, notes: e.target.value })}
                  disabled={disabled}
                  className="min-h-[60px] bg-input border-border"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
