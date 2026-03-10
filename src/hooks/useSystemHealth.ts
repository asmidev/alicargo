import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Connection } from './useSystemMapRegistry';

export type HealthStatus = 'green' | 'amber' | 'red';

async function fetchHealthData(): Promise<Record<string, HealthStatus>> {
  const health: Record<string, HealthStatus> = {};

  // Tasks: overdue ratio
  const { count: totalTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
  const { count: overdueTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'todo').lt('due_date', new Date().toISOString());
  if (totalTasks && totalTasks > 0) {
    const ratio = (overdueTasks || 0) / totalTasks;
    health['db-tasks'] = ratio > 0.3 ? 'red' : ratio > 0.1 ? 'amber' : 'green';
  } else {
    health['db-tasks'] = 'green';
  }

  // Stock alerts: unresolved
  const { count: unresolvedAlerts } = await supabase.from('stock_alerts').select('*', { count: 'exact', head: true }).eq('is_resolved', false);
  health['db-stock-alerts'] = (unresolvedAlerts || 0) > 10 ? 'red' : (unresolvedAlerts || 0) > 3 ? 'amber' : 'green';

  // Defect claims: open
  const { count: openClaims } = await supabase.from('defect_claims').select('*', { count: 'exact', head: true }).in('status', ['new', 'submitted', 'in_review']);
  health['db-defect-claims'] = (openClaims || 0) > 10 ? 'red' : (openClaims || 0) > 3 ? 'amber' : 'green';

  // Finance transactions: today's count
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const { count: todayTx } = await supabase.from('finance_transactions').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString());
  health['db-finance-transactions'] = (todayTx || 0) > 0 ? 'green' : 'amber';

  // Exchange rates: staleness
  const { data: latestRate } = await supabase.from('exchange_rates_history').select('fetched_at').order('fetched_at', { ascending: false }).limit(1).single();
  if (latestRate) {
    const hoursSince = (Date.now() - new Date(latestRate.fetched_at).getTime()) / 3600000;
    health['db-exchange-rates-history'] = hoursSince > 48 ? 'red' : hoursSince > 24 ? 'amber' : 'green';
  } else {
    health['db-exchange-rates-history'] = 'red';
  }

  return health;
}

function propagateHealth(
  directHealth: Record<string, HealthStatus>,
  connections: Connection[],
  allNodeIds: string[]
): Record<string, HealthStatus> {
  const result: Record<string, HealthStatus> = {};
  allNodeIds.forEach(id => { result[id] = directHealth[id] || 'green'; });

  // Build adjacency (reverse: child health propagates to parent)
  const childrenOf: Record<string, string[]> = {};
  connections.forEach(c => {
    if (!childrenOf[c.from]) childrenOf[c.from] = [];
    childrenOf[c.from].push(c.to);
  });

  const severity = { green: 0, amber: 1, red: 2 };
  const fromSeverity = (s: number): HealthStatus => s >= 2 ? 'red' : s >= 1 ? 'amber' : 'green';

  // Propagate up: if any child is worse, parent gets worse (dampened by 1 level)
  const visited = new Set<string>();
  function propagate(nodeId: string): HealthStatus {
    if (visited.has(nodeId)) return result[nodeId] || 'green';
    visited.add(nodeId);
    const children = childrenOf[nodeId] || [];
    let worstChild = 0;
    children.forEach(childId => {
      const childHealth = propagate(childId);
      worstChild = Math.max(worstChild, severity[childHealth]);
    });
    // Dampen: parent severity = max(own, child - 1)
    const dampened = Math.max(0, worstChild - 1);
    const own = severity[result[nodeId] || 'green'];
    result[nodeId] = fromSeverity(Math.max(own, dampened));
    return result[nodeId];
  }

  allNodeIds.forEach(id => propagate(id));
  return result;
}

export function useSystemHealth(connections: Connection[], allNodeIds: string[]) {
  const healthQuery = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchHealthData,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  });

  const directHealth = healthQuery.data ?? {};
  const propagatedHealth = propagateHealth(directHealth, connections, allNodeIds);

  return {
    health: propagatedHealth,
    loading: healthQuery.isLoading,
    lastUpdated: healthQuery.dataUpdatedAt ? new Date(healthQuery.dataUpdatedAt) : null,
    refetch: healthQuery.refetch,
  };
}
