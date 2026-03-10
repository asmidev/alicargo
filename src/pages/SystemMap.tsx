import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useSystemMapRegistry, RadialNodeData, Connection } from '@/hooks/useSystemMapRegistry';
import { useSystemHealth, HealthStatus } from '@/hooks/useSystemHealth';
import { Loader2, ZoomIn, ZoomOut, Maximize, RotateCcw, RefreshCw } from 'lucide-react';

const CANVAS = 6000;
const CENTER = CANVAS / 2;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const RING_RADII = [0, 280, 500, 780, 1100, 1480, 1850, 2220, 2550];
const RING_LABELS = ['Hub', 'Portallar', 'Guruhlar', 'Sahifalar', 'Komponentlar', 'Hooklar', 'DB Jadvallar', 'Edge Functions', 'Infra'];
const SECTOR_COLORS = ['#3b82f6', '#f59e0b', '#14b8a6', '#a855f7', '#8b5cf6', '#22c55e'];
const SECTOR_LABELS = ['CRM', 'Moliya', 'Marketplace', 'Ali AI', 'Tashkent/Do\'kon', 'Infra/Public'];

const HEALTH_COLORS: Record<HealthStatus, string> = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' };
const HEALTH_CLOUD_OPACITY: Record<HealthStatus, number> = { green: 0.15, amber: 0.30, red: 0.45 };

interface NodePosition { x: number; y: number; w: number; h: number; fontSize: number; }

function computePositions(nodes: RadialNodeData[]): Record<string, NodePosition> {
  const pos: Record<string, NodePosition> = {};
  // Group by ring+sector
  const groups: Record<string, RadialNodeData[]> = {};
  nodes.forEach(n => {
    const key = `${n.ring}-${n.sector}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  });

  const sizeByRing: Record<number, { w: number; h: number; fs: number }> = {
    0: { w: 160, h: 40, fs: 12 },
    1: { w: 110, h: 28, fs: 9 },
    2: { w: 110, h: 28, fs: 9 },
    3: { w: 90, h: 22, fs: 7 },
    4: { w: 90, h: 22, fs: 7 },
    5: { w: 80, h: 22, fs: 6 },
    6: { w: 80, h: 22, fs: 6 },
    7: { w: 80, h: 22, fs: 6 },
    8: { w: 80, h: 22, fs: 6 },
  };

  nodes.forEach(n => {
    if (n.ring === 0) {
      const s = sizeByRing[0];
      pos[n.id] = { x: CENTER, y: CENTER, w: s.w, h: s.h, fontSize: s.fs };
      return;
    }
    const key = `${n.ring}-${n.sector}`;
    const group = groups[key];
    const idx = group.indexOf(n);
    const count = group.length;

    const sectorAngleStart = (n.sector / 6) * Math.PI * 2 - Math.PI / 2;
    const sectorAngleSpan = (1 / 6) * Math.PI * 2;
    const padding = sectorAngleSpan * 0.08;
    const usable = sectorAngleSpan - padding * 2;

    const angle = sectorAngleStart + padding + (count > 1 ? (idx / (count - 1)) * usable : usable / 2);
    
    // Stagger sub-rows for crowded rings
    const baseRadius = RING_RADII[n.ring];
    const staggerOffset = count > 8 ? (idx % 3 - 1) * 35 : count > 5 ? (idx % 2) * 25 : 0;
    const r = baseRadius + staggerOffset;

    const x = CENTER + r * Math.cos(angle);
    const y = CENTER + r * Math.sin(angle);
    const s = sizeByRing[n.ring] || sizeByRing[8];
    pos[n.id] = { x, y, w: s.w, h: s.h, fontSize: s.fs };
  });

  return pos;
}

function getConnectedNodes(nodeId: string, connections: Connection[], hops: number): Set<string> {
  const connected = new Set<string>([nodeId]);
  let frontier = new Set<string>([nodeId]);
  for (let i = 0; i < hops; i++) {
    const next = new Set<string>();
    connections.forEach(c => {
      if (frontier.has(c.from) && !connected.has(c.to)) { next.add(c.to); connected.add(c.to); }
      if (frontier.has(c.to) && !connected.has(c.from)) { next.add(c.from); connected.add(c.from); }
    });
    frontier = next;
  }
  return connected;
}

const SystemMap: React.FC = () => {
  const { nodes, connections, loading } = useSystemMapRegistry();
  const allNodeIds = useMemo(() => nodes.map(n => n.id), [nodes]);
  const { health, lastUpdated, refetch: refetchHealth } = useSystemHealth(connections, allNodeIds);

  const [zoom, setZoom] = useState(0.2);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [lockedNode, setLockedNode] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<Record<HealthStatus, boolean>>({ green: true, amber: true, red: true });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const positions = useMemo(() => computePositions(nodes), [nodes]);
  const activeHighlight = lockedNode || hoveredNode;
  const highlightedNodes = useMemo(
    () => activeHighlight ? getConnectedNodes(activeHighlight, connections, 3) : null,
    [activeHighlight, connections]
  );

  const healthCounts = useMemo(() => {
    const counts = { green: 0, amber: 0, red: 0 };
    allNodeIds.forEach(id => { counts[health[id] || 'green']++; });
    return counts;
  }, [health, allNodeIds]);

  // Native wheel listener (passive: false) — must be useEffect to prevent passive scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom(prevZoom => {
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * factor));
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        setPan(prevPan => ({
          x: mx - (mx - prevPan.x) * (newZoom / prevZoom),
          y: my - (my - prevPan.y) * (newZoom / prevZoom),
        }));
        return newZoom;
      });
    };
    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => { setDragging(false); }, []);

  const fitAll = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = Math.min(rect.width / CANVAS, rect.height / CANVAS) * 0.9;
    setZoom(scale);
    setPan({ x: (rect.width - CANVAS * scale) / 2, y: (rect.height - CANVAS * scale) / 2 });
  }, []);

  useEffect(() => { if (!loading && nodes.length > 0) fitAll(); }, [loading, nodes.length, fitAll]);

  const handleDoubleClick = useCallback((e: React.MouseEvent, nodeId?: string) => {
    if (nodeId) { setLockedNode(prev => prev === nodeId ? null : nodeId); }
    else { setLockedNode(null); }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a1a' }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#3b82f6' }} />
          <p style={{ color: '#94a3b8' }}>Loading system map...</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>Fetching {nodes.length || '...'} nodes</p>
        </div>
      </div>
    );
  }

  const visibleNodes = nodes.filter(n => healthFilter[health[n.id] || 'green']);
  const visibleIds = new Set(visibleNodes.map(n => n.id));

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen overflow-hidden select-none"
      style={{ background: '#0a0a1a', cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={(e) => handleDoubleClick(e)}
    >
      {/* Stats badge */}
      <div className="fixed top-4 left-4 z-20 px-3 py-2 rounded-lg" style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(148,163,184,0.2)' }}>
        <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{nodes.length} nodes · {connections.length} connections</div>
        <div style={{ color: '#94a3b8', fontSize: 11 }}>
          <span style={{ color: '#22c55e' }}>●</span> {healthCounts.green} &nbsp;
          <span style={{ color: '#f59e0b' }}>●</span> {healthCounts.amber} &nbsp;
          <span style={{ color: '#ef4444' }}>●</span> {healthCounts.red}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="fixed top-4 right-4 z-20 flex flex-col gap-1">
        {[{ label: '+', fn: () => setZoom(z => Math.min(MAX_ZOOM, z * 1.3)) },
          { label: '-', fn: () => setZoom(z => Math.max(MIN_ZOOM, z / 1.3)) }].map(b => (
          <button key={b.label} onClick={b.fn} className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold"
            style={{ background: 'rgba(30,41,59,0.9)', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.2)' }}>
            {b.label}
          </button>
        ))}
        <div style={{ color: '#94a3b8', fontSize: 9, textAlign: 'center' }}>{Math.round(zoom * 100)}%</div>
        {[
          { label: 'Fit', fn: fitAll, zoom: -1 },
          { label: '50%', fn: () => { setZoom(0.5); setPan({ x: 0, y: 0 }); }, zoom: 0.5 },
          { label: '100%', fn: () => { setZoom(1); setPan({ x: 0, y: 0 }); }, zoom: 1 },
          { label: '200%', fn: () => { setZoom(2); setPan({ x: 0, y: 0 }); }, zoom: 2 },
          { label: '500%', fn: () => { setZoom(5); setPan({ x: 0, y: 0 }); }, zoom: 5 },
        ].map(b => (
          <button key={b.label} onClick={b.fn}
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: b.zoom > 0 && Math.abs(zoom - b.zoom) < 0.05 ? 'rgba(59,130,246,0.4)' : 'rgba(30,41,59,0.9)', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.2)', fontSize: 9 }}>
            {b.label}
          </button>
        ))}
        <button onClick={fitAll} className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: 'rgba(30,41,59,0.9)', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.2)' }}>
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Legend */}
      <div className="fixed bottom-4 left-4 z-20 p-3 rounded-lg max-w-[200px]" style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.2)' }}>
        <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>RINGS</div>
        {RING_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5 py-0.5" style={{ fontSize: 10, color: '#94a3b8' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: SECTOR_COLORS[Math.min(i, 5)] }} />
            <span>{i}: {label}</span>
          </div>
        ))}
        <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600, margin: '8px 0 4px' }}>SECTORS</div>
        {SECTOR_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5 py-0.5" style={{ fontSize: 10, color: '#94a3b8' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: SECTOR_COLORS[i] }} />
            <span>{label}</span>
          </div>
        ))}
        <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600, margin: '8px 0 4px' }}>SYSTEM HEALTH</div>
        {([['green', 'Healthy', healthCounts.green], ['amber', 'Needs attention', healthCounts.amber], ['red', 'Has problems', healthCounts.red]] as [HealthStatus, string, number][]).map(([status, label, count]) => (
          <button key={status} onClick={() => setHealthFilter(f => ({ ...f, [status]: !f[status] }))}
            className="flex items-center gap-1.5 py-0.5 w-full text-left"
            style={{ fontSize: 10, color: healthFilter[status] ? '#e2e8f0' : '#475569', opacity: healthFilter[status] ? 1 : 0.5 }}>
            <div className="w-2 h-2 rounded-full" style={{ background: HEALTH_COLORS[status] }} />
            <span className="flex-1">{label}</span>
            <span>{count}</span>
          </button>
        ))}
        <button onClick={() => refetchHealth()} className="flex items-center gap-1 mt-2 w-full" style={{ fontSize: 9, color: '#64748b' }}>
          <RefreshCw className="w-3 h-3" /> Refresh
          {lastUpdated && <span>· {new Date(lastUpdated).toLocaleTimeString()}</span>}
        </button>
        <div style={{ fontSize: 9, color: '#475569', marginTop: 6 }}>💡 Hover any node for impact analysis</div>
      </div>

      {/* SVG Canvas */}
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${CANVAS} ${CANVAS}`}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        <defs>
          {/* Health cloud gradients */}
          {allNodeIds.map(id => {
            const status = health[id] || 'green';
            const color = HEALTH_COLORS[status];
            return (
              <radialGradient key={`hg-${id}`} id={`health-${id}`}>
                <stop offset="0%" stopColor={color} stopOpacity={HEALTH_CLOUD_OPACITY[status]} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </radialGradient>
            );
          })}
        </defs>

        {/* Ring circles */}
        {RING_RADII.slice(1).map((r, i) => (
          <g key={`ring-${i}`}>
            <circle cx={CENTER} cy={CENTER} r={r} fill="none" stroke="white" strokeOpacity={0.06} strokeDasharray="8 8" />
            <text x={CENTER + r + 8} y={CENTER - 8} fill="white" fillOpacity={0.15} fontSize={10}>{RING_LABELS[i + 1]}</text>
          </g>
        ))}

        {/* Connections */}
        {connections.map((c, i) => {
          const from = positions[c.from];
          const to = positions[c.to];
          if (!from || !to || !visibleIds.has(c.from) || !visibleIds.has(c.to)) return null;
          const dimmed = highlightedNodes && (!highlightedNodes.has(c.from) || !highlightedNodes.has(c.to));
          // Bezier pulled toward center
          const mx = (from.x + to.x) / 2 + (CENTER - (from.x + to.x) / 2) * 0.15;
          const my = (from.y + to.y) / 2 + (CENTER - (from.y + to.y) / 2) * 0.15;
          return (
            <path key={i}
              d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
              fill="none"
              stroke={c.color || '#475569'}
              strokeWidth={dimmed ? 0.5 : 1}
              strokeOpacity={dimmed ? 0.05 : (c.opacity ?? 0.3)}
              strokeDasharray={c.dashed ? '6 4' : undefined}
            />
          );
        })}

        {/* Health clouds + Nodes */}
        {visibleNodes.map(n => {
          const p = positions[n.id];
          if (!p) return null;
          const status = health[n.id] || 'green';
          const dimmed = highlightedNodes && !highlightedNodes.has(n.id);
          const highlighted = highlightedNodes?.has(n.id);
          const cloudR = n.ring === 0 ? 180 : n.ring <= 2 ? 120 : n.ring <= 4 ? 90 : 70;

          return (
            <g key={n.id}
              onMouseEnter={() => !lockedNode && setHoveredNode(n.id)}
              onMouseLeave={() => !lockedNode && setHoveredNode(null)}
              onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(e, n.id); }}
              style={{ cursor: 'pointer', opacity: dimmed ? 0.15 : 1, transition: 'opacity 0.2s' }}
            >
              {/* Health cloud */}
              <circle cx={p.x} cy={p.y} r={cloudR} fill={`url(#health-${n.id})`} />

              {/* Node rectangle */}
              <rect
                x={p.x - p.w / 2} y={p.y - p.h / 2}
                width={p.w} height={p.h}
                rx={6}
                fill={n.color + '30'}
                stroke={highlighted ? '#ffffff' : n.color}
                strokeWidth={highlighted ? 2 : 1}
                strokeOpacity={highlighted ? 1 : 0.6}
              />

              {/* Label */}
              <text x={p.x} y={p.y + p.fontSize * 0.35}
                textAnchor="middle" fill={n.textColor || '#e2e8f0'}
                fontSize={p.fontSize} fontWeight={n.ring <= 1 ? 600 : 400}
              >
                {n.label.length > (p.w / (p.fontSize * 0.55)) ? n.label.slice(0, Math.floor(p.w / (p.fontSize * 0.55))) + '…' : n.label}
              </text>

              {/* Health dot */}
              <circle cx={p.x + p.w / 2 - 4} cy={p.y - p.h / 2 + 4} r={3}
                fill={HEALTH_COLORS[status]}
              >
                {status === 'red' && <animate attributeName="r" values="3;4.5;3" dur="1.5s" repeatCount="indefinite" />}
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default SystemMap;
