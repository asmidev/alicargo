import { 
  Package, 
  ArrowRightLeft, 
  ShoppingBag, 
  Truck, 
  TrendingDown, 
  TrendingUp,
  DollarSign,
  CreditCard,
  Banknote,
  CheckCircle,
  Clock,
  AlertCircle,
  Store,
  RotateCcw,
  RefreshCw,
  FileSpreadsheet,
  ListChecks,
  ShieldCheck,
  AlertTriangle,
  PackageX
} from 'lucide-react';

// Unified Activity Types
export type ActivitySource = 'tracking' | 'movement' | 'sale' | 'finance' | 'task' | 'system' | 'verification';
export type ActivityCategory = 'box' | 'product' | 'sale' | 'finance' | 'task' | 'system' | 'verification';

export interface UnifiedActivity {
  id: string;
  source: ActivitySource;
  category: ActivityCategory;
  action_type: string;
  title: string;
  description: string | null;
  entity_name: string | null;
  entity_id: string | null;
  amount: number | null;
  currency: string | null;
  quantity: number | null;
  location: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

// Database types for transformation
export interface TrackingEvent {
  id: string;
  entity_type: string;
  entity_id: string | null;
  event_type: string;
  description: string | null;
  location: string | null;
  created_at: string;
  created_by?: string | null;
  metadata?: unknown;
}

interface InventoryMovement {
  id: string;
  movement_type: string;
  reference_type: string | null;
  quantity: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  product?: { name: string; uuid: string } | null;
  from_location?: { zone: string; shelf: string | null; warehouse?: { name: string } | null } | null;
  to_location?: { zone: string; shelf: string | null; warehouse?: { name: string } | null } | null;
}

interface DirectSale {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  sold_by: string | null;
  created_at: string;
  notes: string | null;
}

interface FinanceTransaction {
  id: string;
  transaction_type: string;
  category: string | null;
  amount: number;
  currency: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  reference_type: string | null;
}


// NEW: Excel import log type
interface ExcelImportLog {
  id: string;
  file_name: string;
  rows_processed: number | null;
  rows_success: number | null;
  rows_failed: number | null;
  imported_by: string | null;
  created_at: string;
}

// NEW: Task type
interface TaskRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_by: string;
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  location: string | null;
  created_at: string;
}

// NEW: Verification session type
interface VerificationSession {
  id: string;
  box_id: string;
  status: string | null;
  total_items: number | null;
  ok_count: number | null;
  defective_count: number | null;
  missing_count: number | null;
  verified_by: string | null;
  completed_at: string | null;
  created_at: string | null;
  box?: { box_number: string } | null;
}

// NEW: Defect claim type
interface DefectClaim {
  id: string;
  claim_number: string;
  status: string | null;
  defect_description: string | null;
  claim_amount: number | null;
  claim_currency: string | null;
  created_by: string | null;
  created_at: string | null;
  product?: { name: string } | null;
  box?: { box_number: string } | null;
}

// NEW: Stock alert type
interface StockAlert {
  id: string;
  alert_type: string;
  current_stock: number;
  threshold: number;
  is_resolved: boolean | null;
  created_at: string | null;
  product?: { name: string } | null;
}

// ====== TRANSFORM FUNCTIONS ======

// Transform tracking_events → UnifiedActivity
export function transformTrackingEvents(events: TrackingEvent[] | null): UnifiedActivity[] {
  if (!events) return [];
  
  return events.map((event) => {
    const entityName = extractEntityName(event.description);
    const metadata: Record<string, unknown> = (typeof event.metadata === 'object' && event.metadata !== null) 
      ? event.metadata as Record<string, unknown>
      : {};
    
    return {
      id: `tracking-${event.id}`,
      source: 'tracking' as ActivitySource,
      category: 'box' as ActivityCategory,
      action_type: event.event_type,
      title: getTrackingEventTitle(event.event_type),
      description: event.description,
      entity_name: entityName,
      entity_id: event.entity_id,
      amount: null,
      currency: null,
      quantity: null,
      location: event.location,
      created_by: event.created_by || null,
      created_by_name: null,
      created_at: event.created_at,
      metadata,
    };
  });
}

// Transform inventory_movements → UnifiedActivity
export function transformMovements(movements: InventoryMovement[] | null): UnifiedActivity[] {
  if (!movements) return [];
  
  return movements.map((movement) => ({
    id: `movement-${movement.id}`,
    source: 'movement' as ActivitySource,
    category: 'product' as ActivityCategory,
    action_type: movement.movement_type,
    title: getMovementTitle(movement.movement_type, movement.reference_type),
    description: movement.notes,
    entity_name: movement.product?.name || null,
    entity_id: movement.id,
    amount: null,
    currency: null,
    quantity: movement.quantity,
    location: formatMovementLocation(movement),
    created_by: movement.created_by,
    created_by_name: null,
    created_at: movement.created_at,
    metadata: {
      product_uuid: movement.product?.uuid,
      from_location: movement.from_location,
      to_location: movement.to_location,
      reference_type: movement.reference_type,
    },
  }));
}

// Transform direct_sales → UnifiedActivity
export function transformSales(sales: DirectSale[] | null): UnifiedActivity[] {
  if (!sales) return [];
  
  return sales.map((sale) => ({
    id: `sale-${sale.id}`,
    source: 'sale' as ActivitySource,
    category: 'sale' as ActivityCategory,
    action_type: sale.payment_method,
    title: getSaleTitle(sale.payment_method),
    description: `${sale.product_name} - ${sale.quantity} dona`,
    entity_name: sale.product_name,
    entity_id: sale.id,
    amount: sale.total_price,
    currency: sale.currency,
    quantity: sale.quantity,
    location: 'Toshkent',
    created_by: sale.sold_by,
    created_by_name: null,
    created_at: sale.created_at,
    metadata: {
      unit_price: sale.unit_price,
      payment_status: sale.payment_status,
      notes: sale.notes,
    },
  }));
}

// Transform finance_transactions → UnifiedActivity
// Server-side da marketplace_order dublikatlar filtrlanadi (.neq), shuning uchun bu yerda faqat haqiqiy finance yozuvlari keladi
export function transformFinance(transactions: FinanceTransaction[] | null): UnifiedActivity[] {
  if (!transactions) return [];
  
  return transactions.map((transaction) => ({
    id: `finance-${transaction.id}`,
    source: 'finance' as ActivitySource,
    category: 'finance' as ActivityCategory,
    action_type: transaction.transaction_type,
    title: getFinanceTitle(transaction.transaction_type),
    description: transaction.category 
      ? `${transaction.category}${transaction.description ? ` - ${transaction.description}` : ''}`
      : transaction.description,
    entity_name: transaction.category,
    entity_id: transaction.id,
    amount: transaction.amount,
    currency: transaction.currency || 'USD',
    quantity: null,
    location: 'Moliya',
    created_by: transaction.created_by,
    created_by_name: null,
    created_at: transaction.created_at,
    metadata: {
      reference_type: transaction.reference_type,
    },
  }));
}

// NEW: Transform excel_import_logs → UnifiedActivity
export function transformExcelImports(logs: ExcelImportLog[] | null): UnifiedActivity[] {
  if (!logs) return [];
  
  return logs.map((log) => ({
    id: `import-${log.id}`,
    source: 'system' as ActivitySource,
    category: 'system' as ActivityCategory,
    action_type: 'excel_import',
    title: 'Excel import',
    description: `${log.file_name} — ${log.rows_success || 0} muvaffaqiyatli${log.rows_failed ? `, ${log.rows_failed} xato` : ''}`,
    entity_name: log.file_name,
    entity_id: log.id,
    amount: null,
    currency: null,
    quantity: log.rows_processed,
    location: null,
    created_by: log.imported_by,
    created_by_name: null,
    created_at: log.created_at,
    metadata: {
      rows_success: log.rows_success,
      rows_failed: log.rows_failed,
    },
  }));
}

// NEW: Transform tasks → UnifiedActivity
export function transformTasks(tasks: TaskRecord[] | null): UnifiedActivity[] {
  if (!tasks) return [];
  
  return tasks.map((task) => ({
    id: `task-${task.id}`,
    source: 'task' as ActivitySource,
    category: 'task' as ActivityCategory,
    action_type: task.status,
    title: getTaskTitle(task.status),
    description: task.title,
    entity_name: task.title,
    entity_id: task.id,
    amount: null,
    currency: null,
    quantity: null,
    location: task.location,
    created_by: task.completed_by || task.created_by,
    created_by_name: null,
    created_at: task.completed_at || task.created_at,
    metadata: {
      priority: task.priority,
      assigned_to: task.assigned_to,
      status: task.status,
    },
  }));
}

// NEW: Transform verification_sessions → UnifiedActivity
export function transformVerificationSessions(sessions: VerificationSession[] | null): UnifiedActivity[] {
  if (!sessions) return [];
  
  return sessions.map((session) => {
    const boxNum = session.box?.box_number || session.box_id;
    const ok = session.ok_count || 0;
    const defective = session.defective_count || 0;
    const missing = session.missing_count || 0;
    
    return {
      id: `verification-${session.id}`,
      source: 'verification' as ActivitySource,
      category: 'verification' as ActivityCategory,
      action_type: session.status || 'in_progress',
      title: getVerificationTitle(session.status),
      description: `${boxNum} — OK: ${ok}, Nuqsonli: ${defective}, Yo'q: ${missing}`,
      entity_name: boxNum,
      entity_id: session.id,
      amount: null,
      currency: null,
      quantity: session.total_items,
      location: 'china',
      created_by: session.verified_by,
      created_by_name: null,
      created_at: session.completed_at || session.created_at || new Date().toISOString(),
      metadata: {
        ok_count: ok,
        defective_count: defective,
        missing_count: missing,
      },
    };
  });
}

// NEW: Transform defect_claims → UnifiedActivity
export function transformDefectClaims(claims: DefectClaim[] | null): UnifiedActivity[] {
  if (!claims) return [];
  
  return claims.map((claim) => ({
    id: `claim-${claim.id}`,
    source: 'verification' as ActivitySource,
    category: 'verification' as ActivityCategory,
    action_type: claim.status || 'new',
    title: getClaimTitle(claim.status),
    description: `${claim.claim_number} — ${claim.defect_description || 'Tavsif yo\'q'}`,
    entity_name: claim.claim_number,
    entity_id: claim.id,
    amount: claim.claim_amount,
    currency: claim.claim_currency || 'USD',
    quantity: null,
    location: 'china',
    created_by: claim.created_by,
    created_by_name: null,
    created_at: claim.created_at || new Date().toISOString(),
    metadata: {
      product_name: claim.product?.name,
      box_number: claim.box?.box_number,
    },
  }));
}

// NEW: Transform stock_alerts → UnifiedActivity
export function transformStockAlerts(alerts: StockAlert[] | null): UnifiedActivity[] {
  if (!alerts) return [];
  
  return alerts.map((alert) => ({
    id: `stock-alert-${alert.id}`,
    source: 'system' as ActivitySource,
    category: 'product' as ActivityCategory,
    action_type: alert.alert_type,
    title: alert.alert_type === 'out_of_stock' ? 'Stock tugadi' : 'Stock kam qoldi',
    description: `${alert.product?.name || 'Mahsulot'} — ${alert.current_stock} dona qoldi (limit: ${alert.threshold})`,
    entity_name: alert.product?.name || null,
    entity_id: alert.id,
    amount: null,
    currency: null,
    quantity: alert.current_stock,
    location: 'Toshkent',
    created_by: null,
    created_by_name: null,
    created_at: alert.created_at || new Date().toISOString(),
    metadata: {
      alert_type: alert.alert_type,
      threshold: alert.threshold,
      is_resolved: alert.is_resolved,
    },
  }));
}

// ====== HELPER FUNCTIONS ======

function extractEntityName(description: string | null, boxNumber?: string | null): string | null {
  if (boxNumber) return boxNumber;
  if (!description) return null;
  
  const boxMatch = description.match(/BOX-[\w-]+/);
  if (boxMatch) return boxMatch[0];
  
  const fsMatch = description.match(/FS\d+[-\/\d]*/);
  if (fsMatch) return fsMatch[0];
  
  const trackMatch = description.match(/Trek:\s*(\d{10,})/i);
  if (trackMatch) return trackMatch[1];
  
  const digitMatch = description.match(/\b(\d{10,})\b/);
  if (digitMatch) return digitMatch[1];
  
  const prefixMatch = description.match(/^([\w\d-\/]+):/);
  if (prefixMatch && prefixMatch[1].length >= 3) return prefixMatch[1];
  
  return null;
}

function getTrackingEventTitle(eventType: string): string {
  const titles: Record<string, string> = {
    created: 'Quti yaratildi',
    sealed: 'Quti yopildi',
    packing: 'Joylashtirilmoqda',
    china_verified: 'Tekshirildi (Xitoy)',
    in_transit: 'Yo\'lga chiqdi',
    arrived: 'Yetib keldi',
    verified_uz: 'Tekshirildi (O\'zbekiston)',
    verified: 'Tekshirildi',
    auto_sealed: 'Avtomatik yopildi',
    packed: 'Joylashtirildi',
    unpacked: 'Ochildi',
    box_created: 'Quti yaratildi',
    item_added: 'Mahsulot qo\'shildi',
    item_removed: 'Mahsulot olib tashlandi',
    status_changed: 'Status o\'zgardi',
  };
  return titles[eventType] || eventType;
}

function getMovementTitle(movementType: string, referenceType: string | null): string {
  if (referenceType === 'sale' || movementType === 'sale') return 'Sotildi';
  
  const titles: Record<string, string> = {
    transfer: 'Ko\'chirildi',
    receive: 'Qabul qilindi',
    ship: 'Jo\'natildi',
    adjustment: 'Tuzatish kiritildi',
  };
  return titles[movementType] || movementType;
}

function getSaleTitle(paymentMethod: string): string {
  const titles: Record<string, string> = {
    cash: 'Naqd sotuv',
    card: 'Karta orqali sotuv',
    transfer: 'O\'tkazma orqali sotuv',
  };
  return titles[paymentMethod] || 'Sotuv';
}

function getFinanceTitle(transactionType: string): string {
  const titles: Record<string, string> = {
    income: 'Daromad kiritildi',
    expense: 'Xarajat kiritildi',
  };
  return titles[transactionType] || transactionType;
}


function getTaskTitle(status: string): string {
  const titles: Record<string, string> = {
    todo: 'Vazifa yaratildi',
    in_progress: 'Vazifa boshlandi',
    done: 'Vazifa tugallandi',
    cancelled: 'Vazifa bekor qilindi',
  };
  return titles[status] || 'Vazifa';
}

function getVerificationTitle(status: string | null): string {
  if (status === 'completed') return 'Tekshirish tugallandi';
  if (status === 'in_progress') return 'Tekshirish davom etmoqda';
  return 'Tekshirish boshlandi';
}

function getClaimTitle(status: string | null): string {
  const titles: Record<string, string> = {
    new: 'Yangi da\'vo',
    submitted: 'Da\'vo yuborildi',
    in_review: 'Ko\'rib chiqilmoqda',
    approved: 'Da\'vo tasdiqlandi',
    rejected: 'Da\'vo rad etildi',
    resolved: 'Da\'vo hal qilindi',
  };
  return titles[status || 'new'] || 'Nuqson da\'vosi';
}

function formatMovementLocation(movement: InventoryMovement): string | null {
  const from = movement.from_location;
  const to = movement.to_location;
  
  if (!from && !to) return null;
  
  const formatLoc = (loc: typeof from) => {
    if (!loc) return '';
    const warehouse = loc.warehouse?.name || '';
    return `${warehouse} - ${loc.zone}${loc.shelf ? `/${loc.shelf}` : ''}`;
  };
  
  if (from && to) {
    return `${formatLoc(from)} → ${formatLoc(to)}`;
  }
  
  return formatLoc(from) || formatLoc(to);
}

// ====== BADGE & ICON FUNCTIONS ======

export function getActivityBadgeClass(activity: UnifiedActivity): string {
  const { source, action_type } = activity;
  
  if (source === 'tracking') {
    switch (action_type) {
      case 'sealed': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'in_transit': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'arrived': case 'verified': case 'china_verified': case 'verified_uz':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'created': case 'packing':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  }
  
  if (source === 'movement') {
    switch (action_type) {
      case 'transfer': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'sale': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'ship': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'receive': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      default: return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    }
  }
  
  if (source === 'sale') return 'bg-green-500/10 text-green-600 border-green-500/20';
  
  if (source === 'finance') {
    return action_type === 'income' 
      ? 'bg-green-500/10 text-green-600 border-green-500/20'
      : 'bg-red-500/10 text-red-600 border-red-500/20';
  }
  
  
  if (source === 'system') {
    if (action_type === 'error') return 'bg-red-500/10 text-red-600 border-red-500/20';
    if (action_type === 'success') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
  }
  
  if (source === 'verification') {
    if (action_type === 'completed' || action_type === 'approved' || action_type === 'resolved')
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (action_type === 'rejected') return 'bg-red-500/10 text-red-600 border-red-500/20';
    return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  }
  
  if (source === 'task') {
    switch (action_type) {
      case 'done': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
    }
  }
  
  return 'bg-muted text-muted-foreground';
}

export function getActivityIcon(activity: UnifiedActivity) {
  const { source, action_type } = activity;
  
  if (source === 'tracking') {
    switch (action_type) {
      case 'in_transit': return Truck;
      case 'arrived': case 'verified': case 'china_verified': case 'verified_uz': return CheckCircle;
      default: return Package;
    }
  }
  
  if (source === 'movement') {
    switch (action_type) {
      case 'transfer': return ArrowRightLeft;
      case 'sale': return ShoppingBag;
      case 'ship': return Truck;
      case 'receive': return TrendingDown;
      default: return TrendingUp;
    }
  }
  
  if (source === 'sale') {
    switch (action_type) {
      case 'card': return CreditCard;
      case 'transfer': return Banknote;
      default: return DollarSign;
    }
  }
  
  if (source === 'finance') return action_type === 'income' ? TrendingUp : TrendingDown;
  
  
  if (source === 'system') {
    if (action_type === 'excel_import') return FileSpreadsheet;
    return RefreshCw;
  }
  
  if (source === 'verification') {
    if (activity.category === 'verification' && action_type !== 'new') return ShieldCheck;
    return AlertTriangle;
  }
  
  if (source === 'task') return ListChecks;
  
  return AlertCircle;
}

// ====== CATEGORY HELPERS ======

export function getCategoryLabel(category: ActivityCategory): string {
  const labels: Record<ActivityCategory, string> = {
    box: 'Quti',
    product: 'Mahsulot',
    sale: 'Sotuv',
    finance: 'Moliya',
    task: 'Vazifa',
    system: 'Tizim',
    verification: 'Tekshirish',
  };
  return labels[category] || category;
}

export function getCategoryBadgeClass(category: ActivityCategory): string {
  const classes: Record<ActivityCategory, string> = {
    box: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    product: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    sale: 'bg-green-500/10 text-green-600 border-green-500/20',
    finance: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    task: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    system: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    verification: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  };
  return classes[category] || 'bg-muted text-muted-foreground';
}

// ====== FORMAT HELPERS ======

export function formatLocationLabel(location: string | null): string {
  if (!location) return '-';
  
  const locationLabels: Record<string, string> = {
    china: 'Xitoy',
    transit: 'Tranzit',
    uzbekistan: 'O\'zbekiston',
    tashkent: 'Toshkent',
    toshkent: 'Toshkent',
  };
  
  return locationLabels[location.toLowerCase()] || location;
}

export function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return '-';
  
  if (currency === 'UZS') return `${amount.toLocaleString('uz-UZ')} so'm`;
  if (currency === 'USD') return `$${amount.toFixed(2)}`;
  if (currency === 'CNY') return `¥${amount.toFixed(2)}`;
  
  return `${amount.toLocaleString()} ${currency || ''}`;
}

// ====== COMBINE & FILTER ======

export function combineAndSortActivities(...sources: UnifiedActivity[][]): UnifiedActivity[] {
  const combined = sources.flat();
  return combined.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function filterByCategory(
  activities: UnifiedActivity[], 
  category: ActivityCategory | 'all'
): UnifiedActivity[] {
  if (category === 'all') return activities;
  return activities.filter(a => a.category === category);
}

export function filterByLocation(
  activities: UnifiedActivity[], 
  location: string | 'all'
): UnifiedActivity[] {
  if (location === 'all') return activities;
  return activities.filter(a => 
    a.location?.toLowerCase() === location.toLowerCase()
  );
}

export function filterBySearch(
  activities: UnifiedActivity[], 
  searchTerm: string
): UnifiedActivity[] {
  if (!searchTerm.trim()) return activities;
  
  const term = searchTerm.toLowerCase();
  return activities.filter(a => 
    a.title.toLowerCase().includes(term) ||
    a.entity_name?.toLowerCase().includes(term) ||
    a.description?.toLowerCase().includes(term) ||
    a.created_by_name?.toLowerCase().includes(term)
  );
}


// ====== STATS ======

export interface ActivityStats {
  total: number;
  box: number;
  product: number;
  sale: number;
  finance: number;
  system: number;
  verification: number;
  task: number;
}

export function calculateStats(activities: UnifiedActivity[]): ActivityStats {
  return activities.reduce<ActivityStats>((stats, a) => {
    stats.total++;
    if (a.category in stats) {
      (stats as any)[a.category]++;
    }
    return stats;
  }, { total: 0, box: 0, product: 0, sale: 0, finance: 0, system: 0, verification: 0, task: 0 });
}
