import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RadialNodeData {
  id: string;
  label: string;
  ring: number;
  sector: number;
  color: string;
  textColor?: string;
}

export interface Connection {
  from: string;
  to: string;
  color?: string;
  dashed?: boolean;
  opacity?: number;
}

async function fetchNodes(): Promise<RadialNodeData[]> {
  const { data, error } = await supabase
    .from('system_map_nodes')
    .select('id, label, ring, sector, color, text_color')
    .order('ring', { ascending: true });
  if (error) { console.error('Failed to fetch system map nodes:', error); return []; }
  return (data || []).map(row => ({
    id: row.id, label: row.label, ring: row.ring,
    sector: row.sector, color: row.color, textColor: row.text_color ?? undefined,
  }));
}

async function fetchConnections(): Promise<Connection[]> {
  const { data, error } = await supabase
    .from('system_map_connections')
    .select('from_node, to_node, color, opacity, dashed');
  if (error) { console.error('Failed to fetch system map connections:', error); return []; }
  return (data || []).map(row => ({
    from: row.from_node, to: row.to_node, color: row.color ?? undefined,
    opacity: row.opacity != null ? Number(row.opacity) : 0.3, dashed: row.dashed ?? false,
  }));
}

export function useSystemMapRegistry() {
  const nodesQuery = useQuery({ queryKey: ['system-map-nodes'], queryFn: fetchNodes, staleTime: 5 * 60 * 1000, retry: 1 });
  const connectionsQuery = useQuery({ queryKey: ['system-map-connections'], queryFn: fetchConnections, staleTime: 5 * 60 * 1000, retry: 1 });
  return { nodes: nodesQuery.data ?? [], connections: connectionsQuery.data ?? [], loading: nodesQuery.isLoading || connectionsQuery.isLoading };
}
