import { motion } from 'framer-motion';
import { Package, Layers, Store, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  uuid: string;
  name: string;
  category?: string | null;
  category_id?: string | null;
  brand?: string | null;
  quantity?: number | null;
  weight?: number | null;
  price?: number | null;
  status?: string | null;
  has_variants?: boolean;
  marketplace_ready?: boolean;
}

interface MobileProductCardProps {
  product: Product;
  categoryName?: string | null;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTap?: () => void;
}

export function MobileProductCard({ 
  product, 
  categoryName, 
  canEdit, 
  onEdit, 
  onDelete,
  onTap 
}: MobileProductCardProps) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
    packed: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    in_transit: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    arrived: 'bg-green-500/10 text-green-600 border-green-500/30',
    sold: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Kutilmoqda',
    packed: 'Qadoqlangan',
    in_transit: "Yo'lda",
    arrived: 'Yetib keldi',
    sold: 'Sotildi',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className="bg-card rounded-xl p-4 border border-border active:bg-muted/50 transition-colors"
    >
      {/* Header: UUID badge + Name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-primary font-mono text-xs font-medium">
            {product.uuid?.slice(0, 4)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {product.brand && `${product.brand} • `}
            {categoryName || product.category || 'Kategoriyasiz'}
          </p>
        </div>
      </div>

      {/* Meta row: Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {product.status && (
          <Badge 
            variant="outline" 
            className={cn("text-[10px] px-1.5", statusColors[product.status])}
          >
            {statusLabels[product.status] || product.status}
          </Badge>
        )}
        {product.has_variants && (
          <Badge variant="secondary" className="text-[10px] px-1.5 gap-0.5">
            <Layers className="h-2.5 w-2.5" />
            Variantli
          </Badge>
        )}
        {product.marketplace_ready && (
          <Badge variant="outline" className="text-[10px] px-1.5 text-green-600 border-green-600/30">
            <Store className="h-2.5 w-2.5 mr-0.5" />
            Marketplace
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 pb-3 border-b border-border/50">
        {product.quantity && (
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            <span>{product.quantity} dona</span>
          </div>
        )}
        {product.weight && (
          <span>{product.weight}kg</span>
        )}
        {product.price && (
          <span className="font-medium text-foreground">{product.price.toLocaleString()} so'm</span>
        )}
      </div>

      {/* Actions row */}
      {canEdit && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex-1 h-9 text-xs gap-1.5"
          >
            <Edit className="h-3.5 w-3.5" />
            Tahrirlash
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-9 w-9 p-0 text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}
