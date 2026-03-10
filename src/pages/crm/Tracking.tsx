import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, Box, MapPin, CheckCircle, Clock, Truck, ShieldAlert, 
  Package, Ship, Calendar, Filter, BarChart3, TrendingUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useUserRole } from '@/hooks/useUserRole';

export default function Tracking() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  
  const { isChiefManager, isChinaManager, isChinaStaff, isUzManager, isUzStaff, isMarketplaceManager, isSupport, isLoading: roleLoading } = useUserRole();
  
  // Role-based access control - most staff can view tracking
  const canAccess = isChiefManager || isChinaManager || isChinaStaff || isUzManager || isUzStaff || isMarketplaceManager || isSupport;
  
  // Access denied check
  if (!roleLoading && !canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Ruxsat yo'q</h2>
        <p className="text-muted-foreground">Sizda kuzatuv sahifasiga kirish huquqi yo'q.</p>
      </div>
    );
  }

  const { data: trackingEvents, isLoading } = useQuery({
    queryKey: ['tracking-events-boxes'],
    queryFn: async () => {
      // Get box tracking events with box details
      const events = await fetchAllRows(
        supabase
          .from('tracking_events')
          .select('*')
          .eq('entity_type', 'box')
          .order('created_at', { ascending: false })
      );
      
      // Get box numbers for display
      if (events && events.length > 0) {
        const boxIds = [...new Set(events.map((e: any) => e.entity_id))] as string[];
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

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['tracking-stats'],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Get event counts
      const { data: allEvents } = await supabase
        .from('tracking_events')
        .select('id, event_type, created_at, location')
        .eq('entity_type', 'box');
      
      // Get box counts
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
      
      const eventsByType = {
        created: allEvents?.filter(e => e.event_type === 'created').length || 0,
        sealed: allEvents?.filter(e => e.event_type === 'sealed').length || 0,
        in_transit: allEvents?.filter(e => e.event_type === 'in_transit').length || 0,
        arrived: allEvents?.filter(e => e.event_type === 'arrived').length || 0,
        verified: allEvents?.filter(e => e.event_type === 'verified').length || 0,
      };
      
      return {
        totalEvents: allEvents?.length || 0,
        todayEvents,
        weekEvents,
        boxesByStatus,
        boxesByLocation,
        eventsByType,
      };
    },
  });

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

  // Filter events
  const filteredEvents = trackingEvents?.filter(event => {
    // Search filter
    if (searchQuery) {
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
    
    // Event type filter
    if (eventTypeFilter !== 'all' && event.event_type !== eventTypeFilter) {
      return false;
    }
    
    // Location filter
    if (locationFilter !== 'all' && event.location !== locationFilter) {
      return false;
    }
    
    // Date range filter
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {t('tracking')}
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t('trackingDescription')}
        </p>
      </div>

      {/* Statistics Cards */}
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
              <p className="text-2xl font-bold text-foreground">{stats?.totalEvents || 0}</p>
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
              <p className="text-2xl font-bold text-foreground">{stats?.todayEvents || 0}</p>
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
              <p className="text-2xl font-bold text-foreground">{stats?.boxesByStatus.in_transit || 0}</p>
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
              <p className="text-2xl font-bold text-foreground">{stats?.boxesByStatus.arrived || 0}</p>
              <p className="text-xs text-muted-foreground">{t('arrived')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Box Status Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('boxStatus')}
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('packing')}</span>
              <Badge className="bg-purple-500/10 text-purple-500">{stats?.boxesByStatus.packing || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('sealed')}</span>
              <Badge className="bg-blue-500/10 text-blue-500">{stats?.boxesByStatus.sealed || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('inTransit')}</span>
              <Badge className="bg-yellow-500/10 text-yellow-500">{stats?.boxesByStatus.in_transit || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('arrived')}</span>
              <Badge className="bg-green-500/10 text-green-500">{stats?.boxesByStatus.arrived || 0}</Badge>
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
              <Badge className="bg-red-500/10 text-red-500">{stats?.boxesByLocation.china || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">🚚 {t('transit')}</span>
              <Badge className="bg-yellow-500/10 text-yellow-500">{stats?.boxesByLocation.transit || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">🇺🇿 {t('uzbekistan')}</span>
              <Badge className="bg-green-500/10 text-green-500">{stats?.boxesByLocation.uzbekistan || 0}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
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

        {/* Results count */}
        <div className="text-sm text-muted-foreground mb-4">
          {filteredEvents.length} {t('eventsFound')}
        </div>

        {isLoading ? (
          <LoadingSkeleton count={5} />
        ) : filteredEvents.length > 0 ? (
          <div className="relative">
            <div className="absolute left-4 sm:left-6 top-0 bottom-0 w-0.5 bg-border"></div>
            
            <div className="space-y-6">
              {filteredEvents.map((event) => {
                const Icon = getEventIcon(event.event_type);
                return (
                  <div key={event.id} className="relative pl-12 sm:pl-16">
                    <div className={`absolute left-0 w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center ${getEventColor(event.event_type)}`}>
                      <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
                    </div>
                    
                    <Card className="p-3 sm:p-4 bg-muted border-border transition-all duration-200 hover:bg-muted/70 hover:shadow-sm">
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
    </div>
  );
}