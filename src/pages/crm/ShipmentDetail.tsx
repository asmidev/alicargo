import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Ship, Package, Scale, Box as Cube, DollarSign, 
  Calendar, MapPin, Clock, CheckCircle, Truck, Box, ShieldAlert, Calculator
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { DashboardLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ShipmentCostDistributionDialog } from '@/components/crm/ShipmentCostDistributionDialog';

export default function ShipmentDetail() {
  const { t } = useTranslation();
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const { isChiefManager, isChinaManager, isChinaStaff, isUzManager, isUzStaff, isSupport, isLoading: roleLoading } = useUserRole();
  const [costDistributionOpen, setCostDistributionOpen] = useState(false);
  
  const isMobile = useIsMobile();
  const canAccess = isChiefManager || isChinaManager || isChinaStaff || isUzManager || isUzStaff || isSupport;
  const canDistributeCosts = isChiefManager || isChinaManager;
  
  // Fetch shipment details
  const { data: shipment, isLoading: shipmentLoading } = useQuery({
    queryKey: ['shipment-detail', shipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!shipmentId,
  });
  
  // Fetch boxes in this shipment
  const { data: shipmentBoxes, isLoading: boxesLoading } = useQuery({
    queryKey: ['shipment-boxes', shipmentId],
    queryFn: async () => {
      const { data: links, error: linkError } = await supabase
        .from('shipment_boxes')
        .select('box_id')
        .eq('shipment_id', shipmentId!);
      if (linkError) throw linkError;
      
      if (!links || links.length === 0) return [];
      
      const boxIds = links.map(l => l.box_id);
      const { data: boxes, error } = await supabase
        .from('boxes')
        .select('*')
        .in('id', boxIds)
        .order('box_number', { ascending: true });
      if (error) throw error;
      return boxes || [];
    },
    enabled: !!shipmentId,
  });
  
  // Fetch tracking events for this shipment's boxes
  const { data: trackingEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['shipment-tracking-events', shipmentId],
    queryFn: async () => {
      if (!shipmentBoxes || shipmentBoxes.length === 0) return [];
      
      const boxIds = shipmentBoxes.map(b => b.id);
      const { data: events, error } = await supabase
        .from('tracking_events')
        .select('*')
        .in('entity_id', boxIds)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      
      // Add box_number to events
      const boxMap = new Map(shipmentBoxes.map(b => [b.id, b.box_number]));
      return (events || []).map(e => ({
        ...e,
        box_number: boxMap.get(e.entity_id) || e.entity_id.slice(0, 8),
      }));
    },
    enabled: !!shipmentBoxes && shipmentBoxes.length > 0,
  });
  
  if (!roleLoading && !canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Ruxsat yo'q</h2>
        <p className="text-muted-foreground">Sizda jo'natma tafsilotlariga kirish huquqi yo'q.</p>
      </div>
    );
  }
  
  const isLoading = shipmentLoading || boxesLoading;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'packing': return 'bg-purple-500/10 text-purple-500';
      case 'sealed': return 'bg-blue-500/10 text-blue-500';
      case 'in_transit': return 'bg-blue-500/10 text-blue-500';
      case 'arrived': return 'bg-green-500/10 text-green-500';
      case 'delivered': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Kutilmoqda';
      case 'packing': return 'Yig\'ilmoqda';
      case 'sealed': return 'Muhrlangan';
      case 'in_transit': return 'Yo\'lda';
      case 'arrived': return 'Yetib keldi';
      case 'delivered': return 'Topshirildi';
      default: return status;
    }
  };
  
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'created': return Box;
      case 'sealed': return Package;
      case 'in_transit': return Truck;
      case 'arrived': return CheckCircle;
      case 'delivered': return CheckCircle;
      default: return Clock;
    }
  };
  
  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'created': return 'bg-blue-500/10 text-blue-500';
      case 'sealed': return 'bg-purple-500/10 text-purple-500';
      case 'in_transit': return 'bg-yellow-500/10 text-yellow-500';
      case 'arrived': return 'bg-green-500/10 text-green-500';
      case 'delivered': return 'bg-green-500/10 text-green-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };
  
  // Calculate aggregated stats
  const stats = {
    totalBoxes: shipmentBoxes?.length || 0,
    totalWeight: shipmentBoxes?.reduce((sum, b) => sum + (Number(b.weight_kg) || 0), 0) || 0,
    totalVolume: shipmentBoxes?.reduce((sum, b) => sum + (Number(b.volume_m3) || 0), 0) || 0,
    totalCost: shipmentBoxes?.reduce((sum, b) => sum + (Number(b.shipping_cost) || 0), 0) || 0,
    arrivedCount: shipmentBoxes?.filter(b => b.status === 'arrived' || b.status === 'delivered').length || 0,
    inTransitCount: shipmentBoxes?.filter(b => b.status === 'in_transit' || b.location === 'transit').length || 0,
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to="/crm/shipments">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 truncate max-w-[60vw] sm:max-w-none">
              {shipmentBoxes?.find(b => b.store_number)?.store_number || shipmentBoxes?.find(b => b.abusaxiy_receipt_number)?.abusaxiy_receipt_number || shipment?.shipment_number || 'Jo\'natma'}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              {(shipmentBoxes?.find(b => b.store_number)?.store_number || shipmentBoxes?.find(b => b.abusaxiy_receipt_number)?.abusaxiy_receipt_number) && (
                <span className="text-xs text-muted-foreground">№ {shipment?.shipment_number}</span>
              )}
              <span className="text-muted-foreground">{shipment?.carrier || 'AbuSaxiy'}</span>
              {shipment?.status && (
                <Badge className={`${getStatusColor(shipment.status)}`}>
                  {getStatusText(shipment.status)}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {canDistributeCosts && shipmentBoxes && shipmentBoxes.length > 0 && (
          <Button 
            onClick={() => setCostDistributionOpen(true)}
            className="gap-2 w-full sm:w-auto min-h-[44px] sm:min-h-0"
          >
            <Calculator className="h-4 w-4" />
            {!isMobile && 'Logistika taqsimlash'}
            {isMobile && 'Taqsimlash'}
          </Button>
        )}
      </div>

      <ShipmentCostDistributionDialog
        boxIds={shipmentBoxes?.map(b => b.id) || []}
        open={costDistributionOpen}
        onOpenChange={setCostDistributionOpen}
      />
      
      {isLoading ? (
        <DashboardLoadingSkeleton cardCount={4} />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalBoxes}</p>
                  <p className="text-xs text-muted-foreground">Qutilar</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Scale className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalWeight.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">kg jami</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Cube className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalVolume.toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground">m³ hajm</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">${stats.totalCost.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Yetkazish narxi</p>
                </div>
              </div>
            </Card>
          </div>
          
          {/* Shipment Info */}
          <Card className="p-4 bg-card border-border">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {shipment?.estimated_arrival && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Taxminiy yetib kelish</p>
                    <p className="font-medium text-foreground">
                      {new Date(shipment.estimated_arrival).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                </div>
              )}
              {shipment?.arrival_date && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Yetib kelgan sana</p>
                    <p className="font-medium text-foreground">
                      {new Date(shipment.arrival_date).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                </div>
              )}
              {shipment?.tracking_number && (
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Kuzatuv raqami</p>
                    <p className="font-medium text-foreground font-mono">{shipment.tracking_number}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Holat</p>
                  <p className="font-medium text-foreground">
                    {stats.arrivedCount}/{stats.totalBoxes} yetib keldi
                  </p>
                </div>
              </div>
            </div>
          </Card>
          
          {/* Tabs */}
          <Tabs defaultValue="boxes" className="space-y-4">
            <TabsList className="bg-muted">
              <TabsTrigger value="boxes" className="gap-1.5">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Qutilar</span> ({stats.totalBoxes})
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Tarix</span> ({trackingEvents?.length || 0})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="boxes">
              <Card className="p-4 bg-card border-border">
                {shipmentBoxes && shipmentBoxes.length > 0 ? (
                  <div className="space-y-3">
                    {shipmentBoxes.map((box) => (
                      <div
                        key={box.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/70 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground">{box.box_number}</h4>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                            {box.weight_kg && <span>{Number(box.weight_kg).toFixed(2)} kg</span>}
                            {box.volume_m3 && <span>{Number(box.volume_m3).toFixed(4)} m³</span>}
                            {box.shipping_cost && <span>${Number(box.shipping_cost).toFixed(0)}</span>}
                            {box.product_description && (
                              <span className="truncate max-w-[200px]" title={box.product_description}>
                                📦 {box.product_description}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(box.status || 'pending')}`}>
                            {getStatusText(box.status || 'pending')}
                          </Badge>
                          {box.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {box.location}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">Bu jo'natmada qutilar yo'q</p>
                  </div>
                )}
              </Card>
            </TabsContent>
            
            <TabsContent value="timeline">
              <Card className="p-4 bg-card border-border">
                {trackingEvents && trackingEvents.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="relative pl-6 sm:pl-8">
                      <div className="absolute left-2 sm:left-3 top-0 bottom-0 w-0.5 bg-border"></div>
                      
                      <div className="space-y-4">
                        {trackingEvents.map((event) => {
                          const Icon = getEventIcon(event.event_type);
                          return (
                            <div key={event.id} className="relative">
                              <div className={`absolute -left-5 w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(event.event_type)}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              
                              <div className="p-3 bg-muted rounded-lg ml-4">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 mb-1">
                                  <h4 className="font-medium text-foreground capitalize text-sm">
                                    {event.event_type.replace('_', ' ')}
                                  </h4>
                                  <span className="text-xs text-muted-foreground">
                                    {isMobile 
                                      ? new Date(event.created_at).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' }) + ' ' + new Date(event.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
                                      : new Date(event.created_at).toLocaleString('uz-UZ')
                                    }
                                  </span>
                                </div>
                                
                                {event.description && (
                                  <p className="text-xs text-muted-foreground mb-1">{event.description}</p>
                                )}
                                
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  {event.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {event.location}
                                    </span>
                                  )}
                                  <span className="font-mono text-primary">
                                    {(event as any).box_number}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">Kuzatuv voqealari yo'q</p>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Notes */}
          {shipment?.notes && (
            <Card className="p-4 bg-card border-border">
              <h3 className="text-sm font-medium text-foreground mb-2">Izohlar</h3>
              <p className="text-sm text-muted-foreground">{shipment.notes}</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}