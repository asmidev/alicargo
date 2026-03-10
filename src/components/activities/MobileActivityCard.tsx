import { format, formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { Clock, MapPin, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  UnifiedActivity,
  getActivityBadgeClass,
  getActivityIcon,
  getCategoryLabel,
  getCategoryBadgeClass,
  formatLocationLabel,
  formatAmount,
} from '@/lib/unifiedActivities';

interface MobileActivityCardProps {
  activity: UnifiedActivity;
}

export function MobileActivityCard({ activity }: MobileActivityCardProps) {
  const IconComponent = getActivityIcon(activity);
  const hasAmount = activity.amount !== null;
  const hasQuantity = activity.quantity !== null;

  return (
    <Card className="p-3 space-y-2 active:scale-[0.99] transition-transform touch-manipulation">
      {/* Header Row: Icon + Title + Amount/Time */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "p-2 rounded-lg shrink-0",
          getActivityBadgeClass(activity)
        )}>
          <IconComponent className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title and Amount/Time Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{activity.title}</p>
              {activity.entity_name && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {activity.entity_name}
                </p>
              )}
            </div>
            
            {/* Amount or Time */}
            <div className="text-right shrink-0">
              {hasAmount ? (
                <span className={cn(
                  "font-semibold text-sm",
                  activity.action_type === 'expense' ? 'text-red-600' : 
                  activity.action_type === 'income' || activity.category === 'sale' ? 'text-green-600' : ''
                )}>
                  {formatAmount(activity.amount, activity.currency)}
                </span>
              ) : hasQuantity ? (
                <span className="font-semibold text-sm">{activity.quantity} dona</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Meta Row: Category + Location + Time */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category Badge */}
        <Badge 
          variant="outline" 
          className={cn("text-[10px] px-1.5 py-0", getCategoryBadgeClass(activity.category))}
        >
          {getCategoryLabel(activity.category)}
        </Badge>

        {/* Location */}
        {activity.location && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{formatLocationLabel(activity.location)}</span>
          </div>
        )}

        {/* Who */}
        {activity.created_by_name && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[80px]">{activity.created_by_name}</span>
          </div>
        )}

        {/* Time - pushed to the right */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
          <Clock className="h-3 w-3" />
          <span title={format(new Date(activity.created_at), 'dd.MM.yyyy HH:mm')}>
            {formatDistanceToNow(new Date(activity.created_at), { 
              addSuffix: true, 
              locale: uz 
            })}
          </span>
        </div>
      </div>

      {/* Description (if exists and different from entity_name) */}
      {activity.description && activity.description !== activity.entity_name && (
        <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t border-border/50">
          {activity.description}
        </p>
      )}
    </Card>
  );
}
