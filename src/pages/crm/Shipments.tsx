import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramAlert } from '@/hooks/useTelegramAlert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Upload, Ship, Search, FileText, Plus, Edit, Calendar, ShieldAlert, AlertCircle, 
  Package, Check, Trash2, Eye, Box, MapPin, CheckCircle, Clock, Truck, 
  Filter, BarChart3, TrendingUp, Calculator, MoreVertical
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserRole } from '@/hooks/useUserRole';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { PDFImportDialog } from '@/components/crm/PDFImportDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ShipmentCostDistributionDialog } from '@/components/crm/ShipmentCostDistributionDialog';

export default function Shipments() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { notifyShipmentDeparted } = useTelegramAlert();
  const queryClient = useQueryClient();
  const { isChiefManager, isChinaManager, isChinaStaff, isUzManager, isUzStaff, isSupport, isMarketplaceManager, isLoading: roleLoading } = useUserRole();
  
  // Role-based access control
  const canAccess = isChiefManager || isChinaManager || isChinaStaff || isUzManager || isUzStaff || isSupport || isMarketplaceManager;
  const canCreate = isChiefManager || isChinaManager || isChinaStaff;
  const canEdit = isChiefManager || isChinaManager || isUzManager;
  const canDelete = isChiefManager || isChinaManager;
  
  const [activeTab, setActiveTab] = useState('shipments');
  const [searchQuery, setSearchQuery] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [shipmentToDelete, setShipmentToDelete] = useState<any>(null);
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [boxSearchQuery, setBoxSearchQuery] = useState('');
  const [costDistributionOpen, setCostDistributionOpen] = useState(false);
  const [costDistributionBoxIds, setCostDistributionBoxIds] = useState<string[]>([]);
  
  // Tracking filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    shipment_number: '',
    carrier: 'AbuSaxiy',
    tracking_number: '',
    status: 'pending',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Access denied check
  if (!roleLoading && !canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('ship_access_denied')}</h2>
        <p className="text-muted-foreground">{t('ship_access_denied_msg')}</p>
      </div>
    );
  }

  const { data: shipments, isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch track codes for shipments from associated boxes (store_number = trek raqam)
  const { data: shipmentTrackCodes } = useQuery({
    queryKey: ['shipment-track-codes', shipments?.map(s => s.id)],
    queryFn: async () => {
      const { data: links } = await supabase
        .from('shipment_boxes')
        .select('shipment_id, box_id, boxes(store_number, abusaxiy_receipt_number)');
      
      // Map: shipment_id -> first track code (store_number primary, abusaxiy_receipt_number fallback)
      const trackMap: Record<string, string> = {};
      links?.forEach(link => {
        const boxData = link.boxes as any;
        const trackCode = boxData?.store_number || boxData?.abusaxiy_receipt_number;
        if (!trackMap[link.shipment_id] && trackCode) {
          trackMap[link.shipment_id] = String(trackCode).trim();
        }
      });
      return trackMap;
    },
    enabled: !!shipments && shipments.length > 0,
  });

  // Fetch tracking events
  const { data: trackingEvents, isLoading: trackingLoading } = useQuery({
    queryKey: ['tracking-events-boxes'],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('tracking_events')
        .select('*')
        .eq('entity_type', 'box')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      
      if (events && events.length > 0) {
        const boxIds = [...new Set(events.map(e => e.entity_id))];
        const { data: boxes } = await supabase
          .from('boxes')
          .select('id, box_number')
          .in('id', boxIds);
        
        const boxMap = new Map(boxes?.map(b => [b.id, b.box_number]) || []);
        
        return events.map(event => ({
          ...event,
          box_number: boxMap.get(event.entity_id) || event.entity_id.slice(0, 8),
        }));
      }
      
      return events || [];
    },
  });

  // Fetch tracking statistics
  const { data: trackingStats } = useQuery({
    queryKey: ['tracking-stats'],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const { data: allEvents } = await supabase
        .from('tracking_events')
        .select('id, event_type, created_at, location')
        .eq('entity_type', 'box');
      
      const { data: boxes } = await supabase
        .from('boxes')
        .select('id, status, location');
      
      const todayEvents = allEvents?.filter(e => new Date(e.created_at) >= today).length || 0;
      const weekEvents = allEvents?.filter(e => new Date(e.created_at) >= weekAgo).length || 0;
      
      const boxesByStatus = {
        packing: boxes?.filter(b => b.status === 'packing').length || 0,
        sealed: boxes?.filter(b => b.status === 'sealed').length || 0,
        in_transit: boxes?.filter(b => b.status === 'in_transit' || b.location === 'transit').length || 0,
        arrived: boxes?.filter(b => b.status === 'arrived').length || 0,
      };
      
      const boxesByLocation = {
        china: boxes?.filter(b => b.location === 'china').length || 0,
        transit: boxes?.filter(b => b.location === 'transit').length || 0,
        uzbekistan: boxes?.filter(b => b.location === 'uzbekistan').length || 0,
      };
      
      return {
        totalEvents: allEvents?.length || 0,
        todayEvents,
        weekEvents,
        boxesByStatus,
        boxesByLocation,
      };
    },
  });

  // Fetch available boxes (sealed or with track code, not yet assigned to any shipment)
  const { data: availableBoxes } = useQuery({
    queryKey: ['available-boxes-for-shipment'],
    queryFn: async () => {
      const { data: assignedBoxIds } = await supabase
        .from('shipment_boxes')
        .select('box_id');
      
      const excludeIds = assignedBoxIds?.map(sb => sb.box_id) || [];
      
      let query = supabase
        .from('boxes')
        .select('id, box_number, store_number, abusaxiy_receipt_number, weight_kg, volume_m3, status, location')
        .eq('status', 'sealed')
        .order('created_at', { ascending: false });
      
      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: createDialogOpen,
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('shipments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['shipments'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const generateShipmentNumber = () => {
    return 'SHIP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.shipment_number.trim()) errors.shipment_number = 'Jo\'natma raqami majburiy';
    if (!formData.carrier.trim()) errors.carrier = 'Tashuvchi tanlash majburiy';
    if (selectedBoxIds.length === 0) errors.boxes = 'Kamida bitta quti tanlash majburiy';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = () => {
    return formData.shipment_number.trim() && 
           formData.carrier.trim() && 
           selectedBoxIds.length > 0;
  };

  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) throw new Error('Form xatolari mavjud');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const selectedBoxesData = availableBoxes?.filter(b => selectedBoxIds.includes(b.id)) || [];
      const totalWeight = selectedBoxesData.reduce((sum, b) => sum + (Number(b.weight_kg) || 0), 0);
      const totalVolume = selectedBoxesData.reduce((sum, b) => sum + (Number(b.volume_m3) || 0), 0);
      
      const { data: newShipment, error } = await supabase.from('shipments').insert({
        shipment_number: formData.shipment_number,
        carrier: formData.carrier,
        tracking_number: formData.tracking_number || null,
        status: formData.status,
        notes: formData.notes || null,
        created_by: user?.id,
        total_places: selectedBoxIds.length,
        total_weight_kg: totalWeight,
        total_volume_m3: totalVolume,
      }).select('id').single();
      if (error) throw error;
      
      if (selectedBoxIds.length > 0) {
        const shipmentBoxes = selectedBoxIds.map(boxId => ({
          shipment_id: newShipment.id,
          box_id: boxId,
        }));
        
        const { error: linkError } = await supabase.from('shipment_boxes').insert(shipmentBoxes);
        if (linkError) throw linkError;
        
        await supabase
          .from('boxes')
          .update({ status: 'in_transit', location: 'transit' })
          .in('id', selectedBoxIds);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['available-boxes-for-shipment'] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory-overview'] });
      // Send Telegram alert for shipment departure
      notifyShipmentDeparted(formData.shipment_number, selectedBoxIds.length, formData.carrier).catch(() => {});
      toast({ title: t('ship_created'), description: t('ship_created_desc', { count: selectedBoxIds.length }) });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.message !== 'Form xatolari mavjud') {
        toast({ title: t('toast_error'), description: error.message, variant: 'destructive' });
      }
    },
  });

  const updateShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedShipment) return;
      
      const { error } = await supabase
        .from('shipments')
        .update({
          carrier: formData.carrier,
          tracking_number: formData.tracking_number || null,
          status: formData.status,
          notes: formData.notes || null,
        })
        .eq('id', selectedShipment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast({ title: t('ship_updated'), description: t('ship_updated_desc') });
      setEditDialogOpen(false);
      setSelectedShipment(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: t('toast_error'), description: error.message, variant: 'destructive' });
    },
  });

  const deleteShipmentMutation = useMutation({
    mutationFn: async (shipmentId: string) => {
      await supabase.from('shipment_boxes').delete().eq('shipment_id', shipmentId);
      const { data, error } = await supabase.from('shipments').delete().eq('id', shipmentId).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Jo\'natmani o\'chirishga ruxsat yo\'q');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      toast({ title: t('ship_deleted'), description: t('ship_deleted_desc') });
      setDeleteDialogOpen(false);
      setShipmentToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: t('toast_error'), description: error.message, variant: 'destructive' });
    },
  });

  const handleDeleteShipment = (shipment: any) => {
    setShipmentToDelete(shipment);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      shipment_number: '',
      carrier: 'AbuSaxiy',
      tracking_number: '',
      status: 'pending',
      notes: '',
    });
    setFormErrors({});
    setSelectedBoxIds([]);
    setBoxSearchQuery('');
  };

  const handleEdit = (shipment: any) => {
    setSelectedShipment(shipment);
    setFormData({
      shipment_number: shipment.shipment_number,
      carrier: shipment.carrier || 'AbuSaxiy',
      tracking_number: shipment.tracking_number || '',
      status: shipment.status || 'pending',
      notes: shipment.notes || '',
    });
    setEditDialogOpen(true);
  };

  const handleCreateOpen = () => {
    resetForm();
    setFormData(prev => ({ ...prev, shipment_number: generateShipmentNumber() }));
    setCreateDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'in_transit': return 'bg-blue-500/10 text-blue-500';
      case 'arrived': return 'bg-green-500/10 text-green-500';
      case 'delivered': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return t('ship_status_pending');
      case 'in_transit': return t('ship_status_in_transit');
      case 'arrived': return t('ship_status_arrived');
      case 'delivered': return t('ship_status_delivered');
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
      case 'verified': return CheckCircle;
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
      case 'verified': return 'bg-emerald-500/10 text-emerald-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredShipments = shipments?.filter(shipment => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const trackCode = shipmentTrackCodes?.[shipment.id] || '';
    return (
      shipment.shipment_number.toLowerCase().includes(query) ||
      shipment.carrier?.toLowerCase().includes(query) ||
      shipment.tracking_number?.toLowerCase().includes(query) ||
      shipment.status?.toLowerCase().includes(query) ||
      shipment.notes?.toLowerCase().includes(query) ||
      trackCode.toLowerCase().includes(query)
    );
  });

  // Filter tracking events
  const filteredEvents = trackingEvents?.filter(event => {
    if (searchQuery && activeTab === 'tracking') {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        event.entity_id.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.event_type.toLowerCase().includes(query) ||
        (event as any).box_number?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }
    
    if (eventTypeFilter !== 'all' && event.event_type !== eventTypeFilter) return false;
    if (locationFilter !== 'all' && event.location !== locationFilter) return false;
    
    if (dateRange !== 'all') {
      const eventDate = new Date(event.created_at);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (dateRange === 'today' && eventDate < today) return false;
      if (dateRange === 'week') {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (eventDate < weekAgo) return false;
      }
      if (dateRange === 'month') {
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (eventDate < monthAgo) return false;
      }
    }
    
    return true;
  }) || [];

  const filteredBoxes = availableBoxes?.filter(box => {
    if (!boxSearchQuery) return true;
    const query = boxSearchQuery.toLowerCase();
    return box.box_number.toLowerCase().includes(query) ||
           (box as any).abusaxiy_receipt_number?.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {t('logistics')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Jo'natmalar va kuzatuvlarni boshqarish
          </p>
        </div>
        {canCreate && activeTab === 'shipments' && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline"
              className="gap-2 min-h-[44px] w-full sm:w-auto"
              onClick={handleCreateOpen}
            >
              <Plus className="h-4 w-4" />
              <span className="sm:inline">Yangi jo'natma</span>
            </Button>
            <Button 
              className="gap-2 bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20 min-h-[44px] w-full sm:w-auto"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Fayl yuklash
            </Button>
          </div>
        )}
      </div>

      <PDFImportDialog 
        open={importDialogOpen} 
        onOpenChange={setImportDialogOpen} 
      />

      <ShipmentCostDistributionDialog
        boxIds={costDistributionBoxIds}
        open={costDistributionOpen}
        onOpenChange={setCostDistributionOpen}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="shipments" className="gap-2">
            <Ship className="h-4 w-4" />
            Jo'natmalar
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-2">
            <MapPin className="h-4 w-4" />
            Kuzatuv
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shipments" className="mt-6">
          <Card className="p-6 bg-card border-border">
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('search') + '...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-input border-border"
                />
              </div>
            </div>

            {isLoading ? (
              <LoadingSkeleton count={4} />
            ) : filteredShipments && filteredShipments.length > 0 ? (
              <div className="space-y-3">
                {filteredShipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-muted rounded-xl hover:bg-muted/70 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Ship className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground">
                        {shipmentTrackCodes?.[shipment.id] || shipment.shipment_number}
                      </h3>
                      {shipmentTrackCodes?.[shipment.id] && (
                        <p className="text-xs text-muted-foreground/70">№ {shipment.shipment_number}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {shipment.carrier} • {(shipment as any).total_places || 0} ta joy
                      </p>
                      {((shipment as any).total_weight_kg || (shipment as any).total_volume_m3) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {(shipment as any).total_weight_kg && `${Number((shipment as any).total_weight_kg).toFixed(2)} kg`}
                          {(shipment as any).total_weight_kg && (shipment as any).total_volume_m3 && ' • '}
                          {(shipment as any).total_volume_m3 && `${Number((shipment as any).total_volume_m3).toFixed(4)} m³`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex flex-col items-start sm:items-end gap-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(shipment.status || 'pending')}`}>
                          {getStatusText(shipment.status || 'pending')}
                        </span>
                        {(shipment as any).estimated_arrival && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date((shipment as any).estimated_arrival).toLocaleDateString('uz-UZ')}
                          </span>
                        )}
                      </div>
                      {isMobile ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/crm/shipments/${shipment.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ko'rish
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(shipment)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Tahrirlash
                            </DropdownMenuItem>
                            {canDelete && (
                              <DropdownMenuItem 
                                onClick={() => handleDeleteShipment(shipment)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                O'chirish
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/crm/shipments/${shipment.id}`)}
                            className="gap-1 min-h-[44px]"
                          >
                            <Eye className="h-3 w-3" />
                            Ko'rish
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(shipment)}
                            className="gap-1 min-h-[44px]"
                          >
                            <Edit className="h-3 w-3" />
                            Tahrirlash
                          </Button>
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteShipment(shipment)}
                              className="gap-1 min-h-[44px] border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash2 className="h-3 w-3" />
                              O'chirish
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : shipments && shipments.length > 0 ? (
              <div className="text-center py-12">
                <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-2">Qidiruv natijasi topilmadi</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <Ship className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-2">Hozircha jo'natmalar yo'q</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  AbuSaxiy Telegram botidan Excel fayl yuklang yoki qo'lda yangi jo'natma yarating.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" className="gap-2" onClick={handleCreateOpen}>
                    <Plus className="h-4 w-4" />
                    Qo'lda qo'shish
                  </Button>
                  <Button className="gap-2 bg-gradient-to-r from-primary to-secondary" onClick={() => setImportDialogOpen(true)}>
                    <Upload className="h-4 w-4" />
                    PDF yuklash
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="tracking" className="mt-6 space-y-6">
          {/* Tracking Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card 
              className="p-4 bg-card border-border cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
              onClick={() => { setEventTypeFilter('all'); setDateRange('all'); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{trackingStats?.totalEvents || 0}</p>
                  <p className="text-xs text-muted-foreground">{t('totalEvents')}</p>
                </div>
              </div>
            </Card>
            
            <Card 
              className="p-4 bg-card border-border cursor-pointer hover:shadow-lg hover:border-green-500/50 transition-all"
              onClick={() => { setDateRange('today'); setEventTypeFilter('all'); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{trackingStats?.todayEvents || 0}</p>
                  <p className="text-xs text-muted-foreground">{t('today')}</p>
                </div>
              </div>
            </Card>
            
            <Card 
              className="p-4 bg-card border-border cursor-pointer hover:shadow-lg hover:border-blue-500/50 transition-all"
              onClick={() => setEventTypeFilter('in_transit')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{trackingStats?.boxesByStatus.in_transit || 0}</p>
                  <p className="text-xs text-muted-foreground">{t('inTransit')}</p>
                </div>
              </div>
            </Card>
            
            <Card 
              className="p-4 bg-card border-border cursor-pointer hover:shadow-lg hover:border-emerald-500/50 transition-all"
              onClick={() => setEventTypeFilter('arrived')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{trackingStats?.boxesByStatus.arrived || 0}</p>
                  <p className="text-xs text-muted-foreground">{t('arrived')}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Box Status and Location Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-card border-border">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t('boxStatus')}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('packing')}</span>
                  <Badge className="bg-purple-500/10 text-purple-500">{trackingStats?.boxesByStatus.packing || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('sealed')}</span>
                  <Badge className="bg-blue-500/10 text-blue-500">{trackingStats?.boxesByStatus.sealed || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('inTransit')}</span>
                  <Badge className="bg-yellow-500/10 text-yellow-500">{trackingStats?.boxesByStatus.in_transit || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('arrived')}</span>
                  <Badge className="bg-green-500/10 text-green-500">{trackingStats?.boxesByStatus.arrived || 0}</Badge>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 bg-card border-border">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t('byLocation')}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">🇨🇳 {t('china')}</span>
                  <Badge className="bg-red-500/10 text-red-500">{trackingStats?.boxesByLocation.china || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">🚚 {t('transit')}</span>
                  <Badge className="bg-yellow-500/10 text-yellow-500">{trackingStats?.boxesByLocation.transit || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">🇺🇿 {t('uzbekistan')}</span>
                  <Badge className="bg-green-500/10 text-green-500">{trackingStats?.boxesByLocation.uzbekistan || 0}</Badge>
                </div>
              </div>
            </Card>
          </div>

          {/* Tracking Filters and Events */}
          <Card className="p-4 sm:p-6 bg-card border-border">
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchByBoxOrLocation')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-input border-border min-h-[44px]"
                />
              </div>
              
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-full sm:w-[160px] min-h-[44px]">
                  <SelectValue placeholder={t('eventType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allEvents')}</SelectItem>
                  <SelectItem value="created">{t('created')}</SelectItem>
                  <SelectItem value="sealed">{t('eventSealed')}</SelectItem>
                  <SelectItem value="in_transit">{t('departed')}</SelectItem>
                  <SelectItem value="arrived">{t('arrived')}</SelectItem>
                  <SelectItem value="verified">{t('verified')}</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full sm:w-[150px] min-h-[44px]">
                  <SelectValue placeholder={t('location')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allLocations')}</SelectItem>
                  <SelectItem value="china">🇨🇳 {t('china')}</SelectItem>
                  <SelectItem value="transit">🚚 {t('transit')}</SelectItem>
                  <SelectItem value="uzbekistan">🇺🇿 {t('uzbekistan')}</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full sm:w-[130px] min-h-[44px]">
                  <SelectValue placeholder={t('time')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTime')}</SelectItem>
                  <SelectItem value="today">{t('today')}</SelectItem>
                  <SelectItem value="week">{t('thisWeek')}</SelectItem>
                  <SelectItem value="month">{t('thisMonth')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Active Filters */}
            {(eventTypeFilter !== 'all' || locationFilter !== 'all' || dateRange !== 'all' || searchQuery) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    {t('search')}: {searchQuery}
                    <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-destructive">×</button>
                  </Badge>
                )}
                {eventTypeFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {t('type')}: {eventTypeFilter}
                    <button onClick={() => setEventTypeFilter('all')} className="ml-1 hover:text-destructive">×</button>
                  </Badge>
                )}
                {locationFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {t('location')}: {locationFilter}
                    <button onClick={() => setLocationFilter('all')} className="ml-1 hover:text-destructive">×</button>
                  </Badge>
                )}
                {dateRange !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {t('time')}: {dateRange}
                    <button onClick={() => setDateRange('all')} className="ml-1 hover:text-destructive">×</button>
                  </Badge>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSearchQuery('');
                    setEventTypeFilter('all');
                    setLocationFilter('all');
                    setDateRange('all');
                  }}
                  className="text-xs h-6"
                >
                  {t('clearAll')}
                </Button>
              </div>
            )}

            <div className="text-sm text-muted-foreground mb-4">
              {filteredEvents.length} {t('eventsFound')}
            </div>

            {trackingLoading ? (
              <LoadingSkeleton count={5} />
            ) : filteredEvents.length > 0 ? (
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>
                
                <div className="space-y-6">
                  {filteredEvents.map((event) => {
                    const Icon = getEventIcon(event.event_type);
                    return (
                      <div key={event.id} className="relative pl-16">
                        <div className={`absolute left-0 w-12 h-12 rounded-xl flex items-center justify-center ${getEventColor(event.event_type)}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        
                        <Card className="p-4 bg-muted border-border transition-all duration-200 hover:bg-muted/70 hover:shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 mb-2">
                            <h3 className="font-medium text-foreground capitalize">
                              {event.event_type.replace('_', ' ')}
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.created_at).toLocaleString('uz-UZ')}
                            </span>
                          </div>
                          
                          {event.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {event.description}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            {event.location && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>{event.location}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Quti:</span>
                              <span className="text-xs font-mono text-primary font-medium">
                                {(event as any).box_number || event.entity_id.slice(0, 8)}
                              </span>
                            </div>
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : trackingEvents && trackingEvents.length > 0 ? (
              <div className="text-center py-12">
                <Filter className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-2">Filtr natijasi topilmadi</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setEventTypeFilter('all');
                    setLocationFilter('all');
                    setDateRange('all');
                  }}
                >
                  Filtrlarni tozalash
                </Button>
              </div>
            ) : (
              <div className="text-center py-12">
                <Box className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">Hozircha quti kuzatuv voqealari yo'q</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Shipment Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground">Yangi Jo'natma Yaratish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Jo'natma raqami *</label>
              <Input
                placeholder="SHIP-..."
                value={formData.shipment_number}
                onChange={(e) => {
                  setFormData({ ...formData, shipment_number: e.target.value });
                  if (formErrors.shipment_number) setFormErrors({ ...formErrors, shipment_number: '' });
                }}
                className={`bg-input border-border ${formErrors.shipment_number ? 'border-destructive' : ''}`}
              />
              {formErrors.shipment_number && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {formErrors.shipment_number}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Tashuvchi</label>
                <Select value={formData.carrier} onValueChange={(value) => setFormData({ ...formData, carrier: value })}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="AbuSaxiy">AbuSaxiy</SelectItem>
                    <SelectItem value="Other">Boshqa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Tracking raqami</label>
                <Input
                  placeholder="Track raqami"
                  value={formData.tracking_number}
                  onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                  className="bg-input border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Holat</label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="pending">Kutilmoqda</SelectItem>
                    <SelectItem value="in_transit">Yo'lda</SelectItem>
                    <SelectItem value="arrived">Yetib keldi</SelectItem>
                    <SelectItem value="delivered">Topshirildi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Izoh</label>
              <Textarea
                placeholder="Qo'shimcha ma'lumotlar..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-input border-border min-h-[80px]"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Qutilarni tanlang * ({selectedBoxIds.length} ta tanlangan)
              </label>
              {formErrors.boxes && (
                <p className="text-xs text-destructive mb-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {formErrors.boxes}
                </p>
              )}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Qutini qidiring..."
                  value={boxSearchQuery}
                  onChange={(e) => setBoxSearchQuery(e.target.value)}
                  className="pl-10 bg-input border-border"
                />
              </div>
              <ScrollArea className="h-[200px] border border-border rounded-lg p-2">
                {filteredBoxes && filteredBoxes.length > 0 ? (
                  <div className="space-y-2">
                    {filteredBoxes.map((box) => (
                      <div
                        key={box.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedBoxIds.includes(box.id) ? 'bg-primary/10 border border-primary/30' : 'bg-muted hover:bg-muted/70'
                        }`}
                        onClick={() => {
                          if (selectedBoxIds.includes(box.id)) {
                            setSelectedBoxIds(selectedBoxIds.filter(id => id !== box.id));
                          } else {
                            setSelectedBoxIds([...selectedBoxIds, box.id]);
                          }
                          if (formErrors.boxes) setFormErrors({ ...formErrors, boxes: '' });
                        }}
                      >
                        <Checkbox
                          checked={selectedBoxIds.includes(box.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{box.box_number}</p>
                            {((box as any).store_number || (box as any).abusaxiy_receipt_number) && (
                              <span className="text-[10px] text-primary">
                                Trek: {(box as any).store_number || (box as any).abusaxiy_receipt_number}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {box.weight_kg && `${Number(box.weight_kg).toFixed(2)} kg`}
                            {box.weight_kg && box.volume_m3 && ' • '}
                            {box.volume_m3 && `${Number(box.volume_m3).toFixed(4)} m³`}
                          </p>
                        </div>
                        {selectedBoxIds.includes(box.id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Tayyor qutilar topilmadi</p>
                    <p className="text-xs">Avval qutilarni muhrlang (seal qiling)</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Bekor qilish</Button>
            <Button
              onClick={() => createShipmentMutation.mutate()}
              disabled={createShipmentMutation.isPending || !isFormValid()}
              className="bg-gradient-to-r from-primary to-secondary"
            >
              {createShipmentMutation.isPending ? 'Yaratilmoqda...' : 'Yaratish'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Shipment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Jo'natmani Tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Jo'natma raqami</label>
              <Input
                value={formData.shipment_number}
                disabled
                className="bg-muted border-border"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Tashuvchi</label>
                <Select value={formData.carrier} onValueChange={(value) => setFormData({ ...formData, carrier: value })}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="AbuSaxiy">AbuSaxiy</SelectItem>
                    <SelectItem value="Other">Boshqa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Tracking raqami</label>
                <Input
                  placeholder="Track raqami"
                  value={formData.tracking_number}
                  onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                  className="bg-input border-border"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Holat</label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="pending">Kutilmoqda</SelectItem>
                  <SelectItem value="in_transit">Yo'lda</SelectItem>
                  <SelectItem value="arrived">Yetib keldi</SelectItem>
                  <SelectItem value="delivered">Topshirildi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Izoh</label>
              <Textarea
                placeholder="Qo'shimcha ma'lumotlar..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-input border-border min-h-[80px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Bekor qilish</Button>
            <Button
              onClick={() => updateShipmentMutation.mutate()}
              disabled={updateShipmentMutation.isPending}
              className="bg-gradient-to-r from-primary to-secondary"
            >
              {updateShipmentMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Jo'natmani o'chirish"
        description={`"${shipmentToDelete?.shipment_number}" jo'natmasini o'chirishni xohlaysizmi? Bu amalni ortga qaytarib bo'lmaydi.`}
        confirmText="O'chirish"
        cancelText="Bekor qilish"
        variant="destructive"
        onConfirm={() => {
          if (shipmentToDelete) {
            deleteShipmentMutation.mutate(shipmentToDelete.id);
          }
        }}
      />
    </div>
  );
}
