import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';

interface OrderItem {
  skuTitle?: string;
  quantity?: number;
  price?: number;
}

interface Order {
  id: string;
  external_order_id: string;
  ordered_at: string | null;
  status: string;
  fulfillment_status: string | null;
  total_amount: number | null;
  commission: number | null;
  currency: string | null;
  items: any;
}

interface ListingOrdersTableProps {
  orders: Order[];
  isLoading: boolean;
  sku: string;
  currency: string;
}

export function ListingOrdersTable({ orders, isLoading, sku, currency }: ListingOrdersTableProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Package className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">Buyurtmalar topilmadi</p>
      </div>
    );
  }

  const findMatchedItem = (items: any): OrderItem | undefined => {
    if (!Array.isArray(items)) return undefined;
    return items.find((i: any) => 
      i.skuTitle === sku || 
      i.offerId === sku || 
      String(i.productId) === sku
    );
  };

  const getSkuQuantity = (items: any): number => {
    const matched = findMatchedItem(items);
    return matched?.quantity || 1;
  };

  const getSkuRevenue = (items: any, totalAmount: number | null): number => {
    if (!Array.isArray(items) || !totalAmount) return totalAmount || 0;
    const matched = findMatchedItem(items);
    if (matched?.price && matched?.quantity) return matched.price * matched.quantity;
    return totalAmount;
  };

  const statusMap: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
    delivered: { variant: 'default', label: 'Yetkazildi' },
    cancelled: { variant: 'destructive', label: 'Bekor' },
    shipped: { variant: 'outline', label: 'Yo\'lda' },
    processing: { variant: 'secondary', label: 'Jarayonda' },
    pending: { variant: 'secondary', label: 'Kutilmoqda' },
    returned: { variant: 'destructive', label: 'Qaytarildi' },
  };

  const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));

  // Stats
  const delivered = orders.filter(o => o.fulfillment_status === 'delivered' || o.status === 'delivered').length;
  const cancelled = orders.filter(o => o.fulfillment_status === 'cancelled' || o.status === 'cancelled').length;
  const totalRevenue = orders.reduce((s, o) => s + getSkuRevenue(o.items, o.total_amount), 0);

  return (
    <div className="space-y-4">
      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Jami</p>
          <p className="text-lg font-bold">{orders.length}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Yetkazildi</p>
          <p className="text-lg font-bold text-emerald-600">{delivered}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Bekor</p>
          <p className="text-lg font-bold text-destructive">{cancelled}</p>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sana</TableHead>
              <TableHead>Buyurtma</TableHead>
              <TableHead>Soni</TableHead>
              <TableHead>Summa</TableHead>
              <TableHead>Holat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.slice(0, 50).map(order => {
              const s = statusMap[order.fulfillment_status || order.status] || { variant: 'outline' as const, label: order.status };
              return (
                <TableRow key={order.id}>
                  <TableCell className="text-sm">
                    {order.ordered_at ? format(new Date(order.ordered_at), 'dd.MM.yy') : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{order.external_order_id.slice(-8)}</TableCell>
                  <TableCell>{getSkuQuantity(order.items)}</TableCell>
                  <TableCell className="font-medium">{fmt(getSkuRevenue(order.items, order.total_amount))}</TableCell>
                  <TableCell>
                    <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {orders.length > 50 && (
        <p className="text-xs text-muted-foreground text-center">
          Faqat oxirgi 50 ta ko'rsatilmoqda ({orders.length} ta jami)
        </p>
      )}
    </div>
  );
}
