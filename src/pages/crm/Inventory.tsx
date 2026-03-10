import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Warehouse, 
  MapPin, 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  ArrowRightLeft,
  Plus,
  Search,
  Building2,
  CheckCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { WarehouseDialog } from '@/components/inventory/WarehouseDialog';
import { LocationDialog } from '@/components/inventory/LocationDialog';
import { StockAlertPanel } from '@/components/inventory/StockAlertPanel';
import { TashkentWarehouseIndicators } from '@/components/inventory/TashkentWarehouseIndicators';
import { Link } from 'react-router-dom';

export default function Inventory() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [isWarehouseDialogOpen, setIsWarehouseDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [selectedWarehouseForLocation, setSelectedWarehouseForLocation] = useState<any>(null);

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('location', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch warehouse locations
  const { data: locations = [] } = useQuery({
    queryKey: ['warehouse-locations', selectedWarehouse],
    queryFn: async () => {
      let query = supabase
        .from('warehouse_locations')
        .select('*, warehouse:warehouses(name, location)')
        .order('zone', { ascending: true });
      
      if (selectedWarehouse !== 'all') {
        query = query.eq('warehouse_id', selectedWarehouse);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch stock alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_alerts')
        .select(`
          *,
          product:products(name),
          warehouse:warehouses(name)
        `)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch inventory movements
  const { data: movements = [] } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: async () => {
      return await fetchAllRows(
        supabase
          .from('inventory_movements')
          .select(`
            *,
            product:products(name),
            from_location:warehouse_locations!inventory_movements_from_location_id_fkey(zone, shelf),
            to_location:warehouse_locations!inventory_movements_to_location_id_fkey(zone, shelf)
          `)
          .order('created_at', { ascending: false })
      );
    },
  });

  // Fetch product items with locations
  const { data: productItems = [] } = useQuery({
    queryKey: ['product-items-inventory', selectedWarehouse],
    queryFn: async () => {
      let query = supabase
        .from('product_items')
        .select(`
          *,
          product:products(name, category),
          location:warehouse_locations(zone, shelf, warehouse:warehouses(name, location))
        `)
        .not('warehouse_location_id', 'is', null)
        .order('created_at', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Stats
  const stats = {
    totalWarehouses: warehouses.length,
    chinaWarehouses: warehouses.filter(w => w.location === 'china').length,
    uzWarehouses: warehouses.filter(w => w.location === 'uzbekistan').length,
    totalLocations: locations.length,
    activeAlerts: alerts.length,
    totalItems: productItems.length,
  };

  // Filter locations by search
  const filteredLocations = locations.filter(loc => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      loc.zone?.toLowerCase().includes(search) ||
      loc.shelf?.toLowerCase().includes(search) ||
      loc.warehouse?.name?.toLowerCase().includes(search)
    );
  });

  const handleAddLocation = (warehouse: any) => {
    if (!warehouse || !warehouse.id || !warehouse.name) {
      toast.error(t('inv_data_incomplete'));
      return;
    }
    setSelectedWarehouseForLocation(warehouse);
    setIsLocationDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('inventory.title')}</h1>
          <p className="text-muted-foreground">{t('inventory.description')}</p>
        </div>
        <Button onClick={() => setIsWarehouseDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('inventory.newWarehouse')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card 
          className="bg-gradient-to-br from-primary/10 to-primary/5 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => document.querySelector('[value="warehouses"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('inventory.warehouses')}</p>
                <p className="text-2xl font-bold">{stats.totalWarehouses}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-red-500/10 to-red-500/5 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setSelectedWarehouse(warehouses.find(w => w.location === 'china')?.id || 'all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('china')}</p>
                <p className="text-2xl font-bold text-red-600">{stats.chinaWarehouses}</p>
              </div>
              <Warehouse className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setSelectedWarehouse(warehouses.find(w => w.location === 'uzbekistan')?.id || 'all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('uzbekistan')}</p>
                <p className="text-2xl font-bold text-blue-600">{stats.uzWarehouses}</p>
              </div>
              <Warehouse className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-green-500/10 to-green-500/5 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => document.querySelector('[value="locations"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('inventory.locations')}</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalLocations}</p>
              </div>
              <MapPin className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => document.querySelector('[value="alerts"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('inventory.alerts')}</p>
                <p className="text-2xl font-bold text-orange-600">{stats.activeAlerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>
        <Link to="/crm/products">
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 cursor-pointer hover:shadow-lg transition-all h-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('products')}</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.totalItems}</p>
                </div>
                <Package className="h-8 w-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="indicators" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="indicators">{t('inventory.keyIndicators')}</TabsTrigger>
          <TabsTrigger value="warehouses">{t('inventory.warehouses')}</TabsTrigger>
          <TabsTrigger value="locations">{t('inventory.locations')}</TabsTrigger>
          <TabsTrigger value="alerts">
            {t('inventory.alerts')}
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="movements">{t('inventory.movements')}</TabsTrigger>
        </TabsList>
        
        {/* Key Indicators Tab */}
        <TabsContent value="indicators">
          <TashkentWarehouseIndicators />
        </TabsContent>

        {/* Warehouses Tab */}
        <TabsContent value="warehouses" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((warehouse) => {
              const warehouseLocations = locations.filter(l => l.warehouse_id === warehouse.id);
              const totalCapacity = warehouseLocations.reduce((sum, l) => sum + (l.capacity || 0), 0);
              const totalUsed = warehouseLocations.reduce((sum, l) => sum + (l.current_count || 0), 0);
              const usagePercent = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;
              
              return (
                <Card key={warehouse.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Warehouse className="h-5 w-5" />
                        {warehouse.name}
                      </CardTitle>
                      <Badge variant={warehouse.location === 'china' ? 'destructive' : 'default'}>
                        {warehouse.location === 'china' ? t('china') : t('uzbekistan')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {warehouse.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {warehouse.address}
                      </p>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{t('inv_locations_count')}: {warehouseLocations.length}</span>
                        <span>{usagePercent.toFixed(0)}% {t('inv_occupied_pct')}</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            usagePercent > 80 ? 'bg-red-500' : 
                            usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleAddLocation(warehouse)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('inventory.addLocation')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('inv_search_zone_shelf')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className={isMobile ? "p-2" : "p-0"}>
              {filteredLocations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('inventory.noLocations')}</div>
              ) : isMobile ? (
                <div className="space-y-2">
                  {filteredLocations.map((location) => {
                    const usage = location.capacity > 0 ? (location.current_count / location.capacity) * 100 : 0;
                    return (
                      <div key={location.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{location.warehouse?.name}</Badge>
                          <Badge variant="outline" className={
                            usage > 80 ? 'bg-red-500/20 text-red-600' :
                            usage > 50 ? 'bg-yellow-500/20 text-yellow-600' :
                            'bg-green-500/20 text-green-600'
                          }>{usage.toFixed(0)}%</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span><span className="text-muted-foreground">{t('inv_zone_label')}:</span> <span className="font-medium">{location.zone}</span></span>
                          <span><span className="text-muted-foreground">{t('inv_shelf_label')}:</span> {location.shelf || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t('inv_capacity_label')}: {location.capacity}</span>
                          <span>{t('inv_current_label')}: {location.current_count}</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${usage > 80 ? 'bg-red-500' : usage > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(usage, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('inv_warehouse_label')}</TableHead>
                      <TableHead>{t('inv_zone_label')}</TableHead>
                      <TableHead>{t('inv_shelf_label')}</TableHead>
                      <TableHead>{t('inv_position_label')}</TableHead>
                      <TableHead>{t('inv_capacity_label')}</TableHead>
                      <TableHead>{t('inv_current_label')}</TableHead>
                      <TableHead>{t('inv_status_label')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLocations.map((location) => {
                      const usage = location.capacity > 0 ? (location.current_count / location.capacity) * 100 : 0;
                      return (
                        <TableRow key={location.id}>
                          <TableCell><Badge variant="outline">{location.warehouse?.name}</Badge></TableCell>
                          <TableCell className="font-medium">{location.zone}</TableCell>
                          <TableCell>{location.shelf || '-'}</TableCell>
                          <TableCell>{location.position || '-'}</TableCell>
                          <TableCell>{location.capacity}</TableCell>
                          <TableCell>{location.current_count}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              usage > 80 ? 'bg-red-500/20 text-red-600' :
                              usage > 50 ? 'bg-yellow-500/20 text-yellow-600' :
                              'bg-green-500/20 text-green-600'
                            }>{usage.toFixed(0)}%</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <StockAlertPanel alerts={alerts} />
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardContent className={isMobile ? "p-2" : "p-0"}>
              {movements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('inventory.noMovements')}</div>
              ) : isMobile ? (
                <div className="space-y-2">
                  {movements.map((movement) => (
                    <div key={movement.id} className="border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate flex-1">{movement.product?.name || '-'}</span>
                        <Badge variant="outline" className="capitalize ml-2">{movement.movement_type}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{movement.from_location ? `${movement.from_location.zone}/${movement.from_location.shelf || '-'}` : '-'}</span>
                        <ArrowRightLeft className="h-3 w-3" />
                        <span>{movement.to_location ? `${movement.to_location.zone}/${movement.to_location.shelf || '-'}` : '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{format(new Date(movement.created_at), 'dd.MM.yyyy HH:mm')}</span>
                        <Badge variant="secondary">{movement.quantity} {t('pcs')}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('inv_date_label')}</TableHead>
                      <TableHead>{t('inv_product_label')}</TableHead>
                      <TableHead>{t('inv_movement_type_label')}</TableHead>
                      <TableHead>{t('inv_from_label')}</TableHead>
                      <TableHead>{t('inv_to_label')}</TableHead>
                      <TableHead>{t('inv_qty_label')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{format(new Date(movement.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                        <TableCell>{movement.product?.name || '-'}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{movement.movement_type}</Badge></TableCell>
                        <TableCell>{movement.from_location ? `${movement.from_location.zone}/${movement.from_location.shelf || '-'}` : '-'}</TableCell>
                        <TableCell>{movement.to_location ? `${movement.to_location.zone}/${movement.to_location.shelf || '-'}` : '-'}</TableCell>
                        <TableCell>{movement.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <WarehouseDialog
        open={isWarehouseDialogOpen}
        onOpenChange={setIsWarehouseDialogOpen}
      />
      
      <LocationDialog
        open={isLocationDialogOpen}
        onOpenChange={setIsLocationDialogOpen}
        warehouse={selectedWarehouseForLocation}
      />
    </div>
  );
}