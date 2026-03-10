import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MobileListingCardProps {
  listing: {
    id: string;
    title: string | null;
    external_sku: string;
    fulfillment_type: string | null;
    _fulfillmentTypes?: string[]; // grouped fulfillment types
    price: number | null;
    currency: string;
    stock: number;
    status: string;
    last_synced_at: string | null;
    marketplace_stores: {
      name: string;
      platform: string;
    };
    products: {
      name: string;
      main_image_url: string | null;
    } | null;
  };
  formatCurrency: (amount: number | null, currency: string) => string;
  onClick?: () => void;
}

export function MobileListingCard({ listing, formatCurrency, onClick }: MobileListingCardProps) {
  const { t } = useTranslation();

  const stockColor = listing.stock === 0
    ? 'text-destructive'
    : listing.stock < 5
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';

  const platformClass = listing.marketplace_stores.platform === 'uzum'
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300';

  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
    active: { variant: 'default', label: t('mp_status_active') },
    inactive: { variant: 'secondary', label: t('mp_status_inactive') },
    pending: { variant: 'outline', label: t('mp_status_pending') },
    error: { variant: 'destructive', label: t('mp_status_error') },
  };

  const status = statusConfig[listing.status] || { variant: 'outline' as const, label: listing.status };

  return (
    <Card className="p-3 space-y-2 cursor-pointer active:scale-[0.98] transition-transform" onClick={onClick}>
      <div className="flex items-start gap-3">
        {(listing as any).image_url || listing.products?.main_image_url ? (
          <img
            src={(listing as any).image_url || listing.products?.main_image_url}
            alt=""
            className="w-12 h-12 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-2 leading-tight">
            {listing.title || listing.products?.name || t('mp_unnamed')}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', platformClass)}>
              {listing.marketplace_stores.platform.toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground truncate">
              {listing.marketplace_stores.name}
            </span>
          </div>
        </div>
        <Badge variant={status.variant} className="text-[10px] px-1.5 py-0 shrink-0">
          {status.label}
        </Badge>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-muted-foreground truncate">
          {listing.external_sku}
        </span>
        {(listing._fulfillmentTypes && listing._fulfillmentTypes.length > 0
          ? listing._fulfillmentTypes
          : listing.fulfillment_type ? [listing.fulfillment_type] : []
        ).map(ft => (
          <Badge key={ft} variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0",
            ft.toLowerCase() === 'fbs' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200',
            ft.toLowerCase() === 'fbu' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-purple-200',
            ft.toLowerCase() === 'fbo' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-purple-200',
            ft.toLowerCase() === 'fby' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200',
          )}>
            {ft.toUpperCase()}
          </Badge>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <span className="font-semibold text-sm">
          {formatCurrency(listing.price, listing.currency)}
        </span>
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-medium', stockColor)}>
            {listing.stock} {t('mp_pcs')}
          </span>
          {listing.last_synced_at && (
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(listing.last_synced_at), 'dd.MM HH:mm')}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}