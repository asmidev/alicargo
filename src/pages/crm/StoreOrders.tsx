import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ShoppingBag, Phone, MapPin, Clock, Package, 
  CheckCircle, Truck, XCircle, Eye, RefreshCw,
  MessageCircle, Tag
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';

interface StoreOrder {
  id: string;
  order_number: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  delivery_type: string;
  payment_type: string;
  status: OrderStatus;
  items: any[];
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  promo_code?: string | null;
  discount_amount?: number | null;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: 'Yangi', color: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: ShoppingBag },
  confirmed: { label: 'Tasdiqlangan', color: 'bg-green-500/10 text-green-600 border-green-200', icon: CheckCircle },
  preparing: { label: 'Tayyorlanmoqda', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200', icon: Package },
  delivering: { label: 'Yetkazilmoqda', color: 'bg-purple-500/10 text-purple-600 border-purple-200', icon: Truck },
  delivered: { label: 'Yetkazildi', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', icon: CheckCircle },
  cancelled: { label: 'Bekor qilindi', color: 'bg-red-500/10 text-red-600 border-red-200', icon: XCircle },
};

const statusMessages: Record<string, string> = {
  confirmed: '✅ Buyurtmangiz #{order} tasdiqlandi! Tez orada tayyorlanadi.',
  preparing: '📦 Buyurtmangiz #{order} tayyorlanmoqda.',
  delivering: '🚚 Buyurtmangiz #{order} yetkazilmoqda! Tez orada yetib boradi.',
  delivered: '✅ Buyurtmangiz #{order} muvaffaqiyatli yetkazildi! Rahmat!',
};

const formatPrice = (amount: number) => amount.toLocaleString('uz-UZ') + " so'm";

function getWhatsAppLink(phone: string, order: StoreOrder, newStatus?: string) {
  const clean = phone.replace(/[^0-9]/g, '');
  const msg = statusMessages[newStatus || order.status]?.replace('#{order}', order.order_number || order.id.slice(0, 8)) || '';
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

function getTelegramLink(phone: string, order: StoreOrder, newStatus?: string) {
  const clean = phone.replace(/[^0-9]/g, '');
  const msg = statusMessages[newStatus || order.status]?.replace('#{order}', order.order_number || order.id.slice(0, 8)) || '';
  return `https://t.me/+${clean}?text=${encodeURIComponent(msg)}`;
}

export default function StoreOrders() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [changeStatusTo, setChangeStatusTo] = useState<OrderStatus | ''>('');
  const [statusNote, setStatusNote] = useState('');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['store-orders', statusFilter],
    queryFn: async () => {
      let query = supabase.from('store_orders').select('*').order('created_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('status', statusFilter as OrderStatus);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as StoreOrder[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('store-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['store-orders'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const updateStatus = useMutation({
    mutationFn: async ({ orderId, newStatus, note }: { orderId: string; newStatus: OrderStatus; note?: string }) => {
      const { error } = await supabase
        .from('store_orders')
        .update({ status: newStatus, confirmed_by: (await supabase.auth.getUser()).data.user?.id })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status yangilandi');
      queryClient.invalidateQueries({ queryKey: ['store-orders'] });
      setChangeStatusTo('');
      setStatusNote('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: statusHistory } = useQuery({
    queryKey: ['store-order-history', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return [];
      const { data } = await supabase.from('store_order_status_history').select('*').eq('order_id', selectedOrder.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!selectedOrder,
  });

  const newCount = orders?.filter(o => o.status === 'new').length || 0;

  const stats = [
    { label: 'Yangi', value: orders?.filter(o => o.status === 'new').length || 0, color: 'text-blue-600' },
    { label: 'Jarayonda', value: orders?.filter(o => ['confirmed', 'preparing', 'delivering'].includes(o.status)).length || 0, color: 'text-yellow-600' },
    { label: 'Yetkazildi', value: orders?.filter(o => o.status === 'delivered').length || 0, color: 'text-emerald-600' },
    { label: 'Jami', value: orders?.length || 0, color: 'text-foreground' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sayt buyurtmalari</h1>
          <p className="text-sm text-muted-foreground">Online do'kon buyurtmalarini boshqarish</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['store-orders'] })}>
          <RefreshCw className="w-4 h-4 mr-2" /> Yangilash
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label}><CardContent className="p-4 text-center"><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {['all', 'new', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled'].map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" className="shrink-0" onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'Barchasi' : statusConfig[s as OrderStatus]?.label || s}
            {s === 'new' && newCount > 0 && <span className="ml-1.5 bg-destructive text-destructive-foreground rounded-full px-1.5 text-xs">{newCount}</span>}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : !orders?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Buyurtmalar topilmadi</p></CardContent></Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {orders.map(order => {
            const sc = statusConfig[order.status];
            return (
              <Card key={order.id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-medium">{order.order_number || order.id.slice(0, 8)}</span>
                    <Badge variant="outline" className={sc.color}>{sc.label}</Badge>
                  </div>
                  <p className="font-medium text-sm">{order.customer_name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1"><Phone className="w-3 h-3" />{order.customer_phone}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold">{formatPrice(order.total_amount)}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd.MM HH:mm')}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№</TableHead>
                <TableHead>Mijoz</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Summa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => {
                const sc = statusConfig[order.status];
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.order_number || order.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium">{order.customer_name}</TableCell>
                    <TableCell>{order.customer_phone}</TableCell>
                    <TableCell className="font-bold">{formatPrice(order.total_amount)}</TableCell>
                    <TableCell><Badge variant="outline" className={sc.color}>{sc.label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(order.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)}><Eye className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Order Detail Sheet */}
      <Sheet open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedOrder && (
            <>
              <SheetHeader>
                <SheetTitle>Buyurtma #{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}</SheetTitle>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-base px-3 py-1 ${statusConfig[selectedOrder.status].color}`}>
                    {statusConfig[selectedOrder.status].label}
                  </Badge>
                </div>

                {/* Customer info + contact buttons */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Mijoz ma'lumotlari</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-muted-foreground" /> {selectedOrder.customer_name}</div>
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> <a href={`tel:${selectedOrder.customer_phone}`} className="text-primary">{selectedOrder.customer_phone}</a></div>
                    {selectedOrder.customer_address && (
                      <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5" /> {selectedOrder.customer_address}</div>
                    )}
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /> {format(new Date(selectedOrder.created_at), 'dd.MM.yyyy HH:mm')}</div>
                    
                    {/* Quick contact buttons */}
                    {statusMessages[selectedOrder.status] && (
                      <div className="flex gap-2 pt-2 border-t border-border/50">
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
                          <a href={getWhatsAppLink(selectedOrder.customer_phone, selectedOrder)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
                          <a href={getTelegramLink(selectedOrder.customer_phone, selectedOrder)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-4 h-4 text-blue-500" /> Telegram
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Items */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Buyurtma tarkibi</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {(selectedOrder.items as any[]).map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        {item.image && item.image !== '/placeholder.svg' && (
                          <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.quantity} × {formatPrice(item.price)}</p>
                        </div>
                        <span className="font-medium text-sm">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Mahsulotlar</span><span>{formatPrice(selectedOrder.subtotal)}</span></div>
                      {(selectedOrder.discount_amount || 0) > 0 && (
                        <div className="flex justify-between text-primary">
                          <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Chegirma {selectedOrder.promo_code && `(${selectedOrder.promo_code})`}</span>
                          <span>-{formatPrice(selectedOrder.discount_amount || 0)}</span>
                        </div>
                      )}
                      {selectedOrder.delivery_fee > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Yetkazish</span><span>{formatPrice(selectedOrder.delivery_fee)}</span></div>
                      )}
                      <div className="flex justify-between font-bold text-base"><span>Jami</span><span>{formatPrice(selectedOrder.total_amount)}</span></div>
                    </div>
                  </CardContent>
                </Card>

                {selectedOrder.notes && (
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{selectedOrder.notes}</p></CardContent></Card>
                )}

                {/* Change status */}
                {!['delivered', 'cancelled'].includes(selectedOrder.status) && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Statusni o'zgartirish</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <Select value={changeStatusTo} onValueChange={(v) => setChangeStatusTo(v as OrderStatus)}>
                        <SelectTrigger><SelectValue placeholder="Yangi status tanlang" /></SelectTrigger>
                        <SelectContent>
                          {selectedOrder.status === 'new' && <SelectItem value="confirmed">✅ Tasdiqlash</SelectItem>}
                          {selectedOrder.status === 'confirmed' && <SelectItem value="preparing">📦 Tayyorlashni boshlash</SelectItem>}
                          {selectedOrder.status === 'preparing' && <SelectItem value="delivering">🚚 Yetkazishga berish</SelectItem>}
                          {selectedOrder.status === 'delivering' && <SelectItem value="delivered">✅ Yetkazildi</SelectItem>}
                          <SelectItem value="cancelled">❌ Bekor qilish</SelectItem>
                        </SelectContent>
                      </Select>
                      {changeStatusTo && (
                        <>
                          <Textarea placeholder="Izoh (ixtiyoriy)" value={statusNote} onChange={e => setStatusNote(e.target.value)} />
                          
                          {/* Show notify button when changing status */}
                          {statusMessages[changeStatusTo] && (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-green-600" asChild>
                                <a href={getWhatsAppLink(selectedOrder.customer_phone, selectedOrder, changeStatusTo)} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle className="w-4 h-4" /> WhatsApp xabar
                                </a>
                              </Button>
                            </div>
                          )}

                          <Button
                            className="w-full"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ orderId: selectedOrder.id, newStatus: changeStatusTo as OrderStatus, note: statusNote })}
                          >
                            {updateStatus.isPending ? 'Saqlanmoqda...' : 'Tasdiqlash'}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {statusHistory && statusHistory.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Status tarixi</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {statusHistory.map((h: any) => (
                        <div key={h.id} className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className={statusConfig[h.old_status as OrderStatus]?.color || ''}>
                            {statusConfig[h.old_status as OrderStatus]?.label || h.old_status}
                          </Badge>
                          <span>→</span>
                          <Badge variant="outline" className={statusConfig[h.new_status as OrderStatus]?.color || ''}>
                            {statusConfig[h.new_status as OrderStatus]?.label || h.new_status}
                          </Badge>
                          <span className="text-muted-foreground ml-auto">{format(new Date(h.created_at), 'dd.MM HH:mm')}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
