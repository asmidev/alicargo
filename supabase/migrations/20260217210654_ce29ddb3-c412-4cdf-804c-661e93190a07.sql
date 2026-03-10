
-- system_map_nodes: every node on the map
CREATE TABLE IF NOT EXISTS public.system_map_nodes (
  id text PRIMARY KEY,
  label text NOT NULL,
  ring integer NOT NULL CHECK (ring >= 0 AND ring <= 8),
  sector integer NOT NULL CHECK (sector >= 0 AND sector <= 5),
  color text NOT NULL DEFAULT '#666666',
  text_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- system_map_connections: every edge between nodes
CREATE TABLE IF NOT EXISTS public.system_map_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node text NOT NULL REFERENCES public.system_map_nodes(id) ON DELETE CASCADE,
  to_node text NOT NULL REFERENCES public.system_map_nodes(id) ON DELETE CASCADE,
  color text,
  opacity numeric DEFAULT 0.3,
  dashed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_smn_ring ON public.system_map_nodes(ring);
CREATE INDEX IF NOT EXISTS idx_smc_from ON public.system_map_connections(from_node);
CREATE INDEX IF NOT EXISTS idx_smc_to ON public.system_map_connections(to_node);

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.system_map_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.system_map_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_map_connections ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated
CREATE POLICY "auth_read_nodes" ON public.system_map_nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_connections" ON public.system_map_connections FOR SELECT TO authenticated USING (true);

-- Write: rahbar/bosh_admin only
CREATE POLICY "admin_write_nodes" ON public.system_map_nodes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin'));

CREATE POLICY "admin_write_connections" ON public.system_map_connections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'rahbar') OR public.has_role(auth.uid(), 'bosh_admin'));
