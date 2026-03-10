import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Search, FileText, AlertTriangle, CheckCircle, XCircle, Clock, Send, Eye, Calendar as CalendarIcon } from 'lucide-react';
import { TableLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ClaimFormDialog } from '@/components/claims/ClaimFormDialog';
import { ClaimDetailDialog } from '@/components/claims/ClaimDetailDialog';
import { useTelegramAlert } from '@/hooks/useTelegramAlert';
import { cn } from '@/lib/utils';

const statusConfig = {
  pending: { label: 'pending', color: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30', icon: Clock },
  submitted: { label: 'submitted', color: 'bg-blue-500/20 text-blue-600 border-blue-500/30', icon: Send },
  approved: { label: 'approved', color: 'bg-green-500/20 text-green-600 border-green-500/30', icon: CheckCircle },
  rejected: { label: 'rejected', color: 'bg-red-500/20 text-red-600 border-red-500/30', icon: XCircle },
  compensated: { label: 'compensated', color: 'bg-purple-500/20 text-purple-600 border-purple-500/30', icon: CheckCircle },
};

export default function Claims() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { sendAlert } = useTelegramAlert();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const activeFiltersCount = [
    statusFilter !== 'all',
    categoryFilter !== 'all',
    dateFrom !== null,
    dateTo !== null,
    amountMin !== '',
    amountMax !== '',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setDateFrom(null);
    setDateTo(null);
    setAmountMin('');
    setAmountMax('');
  };

  // Fetch claims
  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['defect-claims'],
    queryFn: async () => {
      return await fetchAllRows(
        supabase
          .from('defect_claims')
          .select(`
            *,
            box:boxes(box_number),
            product:products(name),
            defect_category:defect_categories(id, name, name_uz)
          `)
          .order('created_at', { ascending: false })
      );
    },
  });

  // Fetch defect categories for filter
  const { data: defectCategories = [] } = useQuery({
    queryKey: ['defect-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('defect_categories')
        .select('id, name, name_uz')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  // Stats
  const stats = {
    total: claims.length,
    pending: claims.filter(c => c.status === 'pending').length,
    submitted: claims.filter(c => c.status === 'submitted').length,
    approved: claims.filter(c => c.status === 'approved').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
  };

  // Filter claims
  const filteredClaims = claims.filter(claim => {
    // Search filter
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const matchesSearch = (
        claim.claim_number?.toLowerCase().includes(search) ||
        claim.box?.box_number?.toLowerCase().includes(search) ||
        claim.product?.name?.toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (statusFilter !== 'all' && claim.status !== statusFilter) return false;
    
    // Category filter
    if (categoryFilter !== 'all' && claim.defect_category_id !== categoryFilter) return false;
    
    // Date range filter
    if (dateFrom) {
      const claimDate = new Date(claim.created_at);
      if (claimDate < startOfDay(dateFrom)) return false;
    }
    if (dateTo) {
      const claimDate = new Date(claim.created_at);
      if (claimDate > endOfDay(dateTo)) return false;
    }
    
    // Amount range filter
    if (amountMin && claim.claim_amount && claim.claim_amount < parseFloat(amountMin)) return false;
    if (amountMax && claim.claim_amount && claim.claim_amount > parseFloat(amountMax)) return false;
    
    return true;
  });

  // Update claim status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ claimId, status, notes }: { claimId: string; status: string; notes?: string }) => {
      const updateData: any = { status };
      if (status === 'submitted') {
        updateData.submitted_to_abusaxiy = true;
      }
      if (status === 'approved' || status === 'rejected' || status === 'compensated') {
        updateData.resolved_at = new Date().toISOString();
        if (notes) updateData.resolution_notes = notes;
      }
      
      const { error } = await supabase
        .from('defect_claims')
        .update(updateData)
        .eq('id', claimId);
      
      if (error) throw error;
      return { claimId, status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['defect-claims'] });
      toast.success(t('claims_status_updated'));
      
      // Send Telegram notification
      sendAlert({
        eventType: 'defect_found',
        data: {
          claim_number: selectedClaim?.claim_number,
          new_status: data.status,
          message: `Da'vo ${data.status} holatiga o'zgartirildi`
        },
        targetRoles: ['rahbar', 'bosh_admin', 'uz_manager']
      });
    },
    onError: () => {
      toast.error(t('claims_status_update_error'));
    },
  });

  const handleViewClaim = (claim: any) => {
    setSelectedClaim(claim);
    setIsDetailOpen(true);
  };

  const handleEditClaim = (claim: any) => {
    setSelectedClaim(claim);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('claimsTitle')}</h1>
          <p className="text-muted-foreground">{t('claimsDescription')}</p>
        </div>
        <Button onClick={() => { setSelectedClaim(null); setIsFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          {t('newClaim')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card 
          className="bg-gradient-to-br from-muted/50 to-muted/30 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('total')}</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setStatusFilter('pending')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('pending')}</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setStatusFilter('submitted')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('submitted')}</p>
                <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
              </div>
              <Send className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-green-500/10 to-green-500/5 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setStatusFilter('approved')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('approved')}</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-red-500/10 to-red-500/5 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setStatusFilter('rejected')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('rejected')}</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Search and main filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('claims_search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('claims_status_filter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('claims_all_statuses')}</SelectItem>
                  <SelectItem value="pending">{t('pending')}</SelectItem>
                  <SelectItem value="submitted">{t('submitted')}</SelectItem>
                  <SelectItem value="approved">{t('approved')}</SelectItem>
                  <SelectItem value="rejected">{t('rejected')}</SelectItem>
                  <SelectItem value="compensated">{t('compensated')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder={t('claims_defect_type_filter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('claims_all_defects')}</SelectItem>
                  {defectCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name_uz || cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Advanced filters row */}
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[120px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {dateFrom ? format(dateFrom, "dd.MM.yy") : t('claims_date_from')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom || undefined}
                    onSelect={(date) => setDateFrom(date || null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[120px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {dateTo ? format(dateTo, "dd.MM.yy") : t('claims_date_to')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo || undefined}
                    onSelect={(date) => setDateTo(date || null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Input
                type="number"
                placeholder={t('claims_min_amount')}
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                className="w-[110px] h-9"
              />
              <Input
                type="number"
                placeholder={t('claims_max_amount')}
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                className="w-[110px] h-9"
              />

              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
                  {t('clear')} ({activeFiltersCount})
                </Button>
              )}
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              {filteredClaims.length} / {claims.length} {t('claims_count')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claims Table / Mobile Cards */}
      <Card>
        <CardContent className={isMobile ? "p-2" : "p-0"}>
          {isLoading ? (
            <TableLoadingSkeleton rows={5} />
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              {t('noClaims')}
            </div>
          ) : isMobile ? (
            <div className="space-y-2">
              {filteredClaims.map((claim) => {
                const statusInfo = statusConfig[claim.status as keyof typeof statusConfig];
                const StatusIcon = statusInfo?.icon || Clock;
                return (
                  <div
                    key={claim.id}
                    className="border rounded-lg p-3 space-y-2 cursor-pointer active:bg-muted/50"
                    onClick={() => handleViewClaim(claim)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium">{claim.claim_number}</span>
                      <Badge variant="outline" className={statusInfo?.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {t(statusInfo?.label || claim.status)}
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium truncate">{claim.product?.name || '-'}</p>
                      <p className="text-xs text-muted-foreground">{claim.defect_category?.name_uz || claim.defect_category?.name || '-'}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{claim.box?.box_number ? `📦 ${claim.box.box_number}` : ''}</span>
                      <span>{claim.claim_amount ? `${claim.claim_amount} ${claim.claim_currency}` : '-'}</span>
                      <span>{format(new Date(claim.created_at), 'dd.MM.yyyy')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('claims_claim_number')}</TableHead>
                  <TableHead>{t('claims_box')}</TableHead>
                  <TableHead>{t('inv_product_label')}</TableHead>
                  <TableHead>{t('claims_defect_type')}</TableHead>
                  <TableHead>{t('claims_amount')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => {
                  const statusInfo = statusConfig[claim.status as keyof typeof statusConfig];
                  const StatusIcon = statusInfo?.icon || Clock;
                  return (
                    <TableRow key={claim.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{claim.claim_number}</TableCell>
                      <TableCell>{claim.box?.box_number || '-'}</TableCell>
                      <TableCell>{claim.product?.name || '-'}</TableCell>
                      <TableCell>{claim.defect_category?.name_uz || claim.defect_category?.name || '-'}</TableCell>
                      <TableCell>
                        {claim.claim_amount ? `${claim.claim_amount} ${claim.claim_currency}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusInfo?.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {t(statusInfo?.label || claim.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(claim.created_at), 'dd.MM.yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleViewClaim(claim)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ClaimFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        claim={selectedClaim}
      />
      
      <ClaimDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        claim={selectedClaim}
        onStatusChange={(status, notes) => {
          if (selectedClaim) {
            updateStatusMutation.mutate({ claimId: selectedClaim.id, status, notes });
          }
        }}
      />
    </div>
  );
}