import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ZoomIn, ZoomOut, Maximize2, X, ExternalLink, Search } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DetailTabs from '../../components/common/DetailTabs';
import StatusBadge from '../../components/badges/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { useRegistry } from '../../hooks/useRegistry';
import { seriesColor } from '../../components/charts/palette';
import { routeFor } from '../../services/schema';
import { companyOptions, applicationOptions } from '../../utils/options';
import { NODE_TYPES, VIEWS, DEFAULT_TYPES, NODE_W, NODE_H, buildGraph, layoutGraph } from './graph';

const typeColor = (t) => seriesColor(NODE_TYPES[t].slot);
const clip = (s, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function ArchitectureMapPage() {
  const { data } = useRegistry();
  const [view, setView] = useState('ecosystem');
  const [types, setTypes] = useState(() => Object.fromEntries(VIEWS.map((v) => [v.key, new Set(DEFAULT_TYPES[v.key])])));
  const [companyId, setCompanyId] = useState('');
  const [applicationId, setApplicationId] = useState(data.applications[0]?.id || '');
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [t, setT] = useState({ x: 40, y: 40, k: 1 });
  const [dragging, setDragging] = useState(false);
  const box = useRef(null);
  const drag = useRef(null);

  // Graph is rebuilt from registry data on every change — the map always reflects current relationships.
  const full = useMemo(() => buildGraph(data, view, { companyId, applicationId }), [data, view, companyId, applicationId]);
  const visibleTypes = types[view];
  const graph = useMemo(() => {
    const nodes = full.nodes.filter((n) => visibleTypes.has(n.type));
    const ids = new Set(nodes.map((n) => n.id));
    return { nodes, edges: full.edges.filter((e) => ids.has(e.from) && ids.has(e.to)) };
  }, [full, visibleTypes]);
  const pos = useMemo(() => layoutGraph(graph, view), [graph, view]);
  const presentTypes = useMemo(() => Object.keys(NODE_TYPES).filter((k) => full.nodes.some((n) => n.type === k)), [full]);

  const neighborIds = useMemo(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    graph.edges.forEach((e) => { if (e.from === selected) s.add(e.to); if (e.to === selected) s.add(e.from); });
    return s;
  }, [selected, graph]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? new Set(graph.nodes.filter((n) => `${n.label} ${n.record.id}`.toLowerCase().includes(q)).map((n) => n.id)) : null;
  }, [query, graph]);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el || !graph.nodes.length) return;
    const xs = graph.nodes.map((n) => pos.get(n.id).x);
    const ys = graph.nodes.map((n) => pos.get(n.id).y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs) + NODE_W;
    const minY = Math.min(...ys); const maxY = Math.max(...ys) + NODE_H;
    const W = el.clientWidth; const H = el.clientHeight;
    const legend = 96; // keep nodes clear of the legend overlay
    const k = Math.min(1.4, Math.max(0.2, Math.min((W - 80) / (maxX - minX), (H - 60 - legend) / (maxY - minY))));
    setT({ k, x: (W - (maxX - minX) * k) / 2 - minX * k, y: (H - legend - (maxY - minY) * k) / 2 - minY * k + 10 });
  }, [graph, pos]);
  useEffect(() => { fit(); }, [view, companyId, applicationId, visibleTypes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelected(null); }, [view, companyId, applicationId]);

  const centerOn = (id) => {
    const p = pos.get(id);
    const el = box.current;
    if (!p || !el) return;
    setT((s) => ({ ...s, x: el.clientWidth / 2 - (p.x + NODE_W / 2) * s.k, y: el.clientHeight / 2 - (p.y + NODE_H / 2) * s.k }));
  };
  const zoomBy = (f, cx, cy) => setT((s) => {
    const el = box.current;
    const px = cx ?? el.clientWidth / 2; const py = cy ?? el.clientHeight / 2;
    const k = Math.min(2.5, Math.max(0.15, s.k * f));
    return { k, x: px - ((px - s.x) / s.k) * k, y: py - ((py - s.y) / s.k) * k };
  });
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const onPointerDown = (e) => {
    if (e.target.closest('.bh-node, .bh-map-panel, .bh-map-controls, .bh-map-legend')) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true;
    setT((s) => ({ ...s, x: d.tx + e.clientX - d.x, y: d.ty + e.clientY - d.y }));
  };
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) setSelected(null);
    drag.current = null;
    setDragging(false);
  };
  const toggleType = (k) => setTypes((all) => {
    const s = new Set(all[view]);
    if (s.has(k)) s.delete(k); else s.add(k);
    return { ...all, [view]: s };
  });
  const searchEnter = () => {
    const first = matches && [...matches][0];
    if (first) { setSelected(first); centerOn(first); }
  };

  const sel = selected ? graph.nodes.find((n) => n.id === selected) : null;
  const selEdges = sel ? graph.edges.filter((e) => e.from === sel.id || e.to === sel.id) : [];
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  const edgePath = (e) => {
    const a = pos.get(e.from); const b = pos.get(e.to);
    if (!a || !b) return '';
    if (Math.abs(a.x - b.x) < 1) { // same column: arc on the right
      const x = a.x + NODE_W; const y1 = a.y + NODE_H / 2; const y2 = b.y + NODE_H / 2;
      const bulge = 40 + Math.min(80, Math.abs(y2 - y1) / 4);
      return `M${x},${y1} C${x + bulge},${y1} ${x + bulge},${y2} ${x},${y2}`;
    }
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    const x1 = l.x + NODE_W; const y1 = l.y + NODE_H / 2; const x2 = r.x; const y2 = r.y + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  };

  return (
    <>
      <PageHeader title="Architecture Map" description="A live, data-driven view of how the VSG Group ecosystem connects. Edit any record and the map updates." />
      <DetailTabs tabs={VIEWS.map((v) => ({ key: v.key, label: v.label }))} active={view} onChange={setView} />
      <div className="bh-card">
        <div className="bh-filterbar">
          <div className="bh-search" style={{ flex: '1 1 220px', maxWidth: 300 }}>
            <Search size={15} />
            <input type="search" className="form-control" placeholder="Search nodes… (Enter to focus)" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchEnter()} aria-label="Search nodes" />
          </div>
          {view === 'ecosystem' && (
            <select className="form-select" value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Company">
              <option value="">All companies</option>
              {companyOptions(data).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {view === 'application' && (
            <select className="form-select" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} aria-label="Application">
              {applicationOptions(data).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {presentTypes.map((k) => (
              <label key={k} className="bh-chip" style={{ cursor: 'pointer', opacity: visibleTypes.has(k) ? 1 : 0.55 }}>
                <input type="checkbox" className="form-check-input m-0 me-1" checked={visibleTypes.has(k)} onChange={() => toggleType(k)} />
                <span className="bh-legend-swatch" style={{ background: typeColor(k), marginRight: 4 }} />{NODE_TYPES[k].label}
              </label>
            ))}
          </div>
          <span className="text-subtle small ms-auto">{graph.nodes.length} nodes · {graph.edges.length} relationships</span>
        </div>
        <div ref={box} className={`bh-map ${dragging ? 'dragging' : ''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
          {graph.nodes.length === 0 ? <div className="pt-5"><EmptyState title="Nothing to show" message="Turn on more node types or pick another view." /></div> : (
            <svg role="img" aria-label={`${VIEWS.find((v) => v.key === view).label}: ${graph.nodes.length} nodes`}>
              <defs>
                <marker id="bh-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--bh-gray-500)" /></marker>
                <marker id="bh-arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--bh-orange)" /></marker>
              </defs>
              <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
                {graph.edges.map((e) => {
                  const hl = sel && (e.from === sel.id || e.to === sel.id);
                  const a = pos.get(e.from); const b = pos.get(e.to);
                  const forward = !a || !b || a.x <= b.x;
                  return (
                    <path key={e.id} className="bh-edge" d={edgePath(e)} stroke={hl ? 'var(--bh-orange)' : 'var(--bh-gray-300)'} strokeWidth={hl ? 2.2 : 1.4}
                      opacity={sel && !hl ? 0.15 : 1} markerEnd={forward ? `url(#${hl ? 'bh-arrow-hl' : 'bh-arrow'})` : undefined}
                      markerStart={!forward ? `url(#${hl ? 'bh-arrow-hl' : 'bh-arrow'})` : undefined}>
                      <title>{`${nodeById.get(e.from)?.label} ${e.label} ${nodeById.get(e.to)?.label}`}</title>
                    </path>
                  );
                })}
                {graph.nodes.map((n) => {
                  const p = pos.get(n.id);
                  const dim = neighborIds && !neighborIds.has(n.id);
                  const isSel = selected === n.id;
                  const isMatch = matches?.has(n.id);
                  const color = typeColor(n.type);
                  return (
                    <g key={n.id} className="bh-node" transform={`translate(${p.x},${p.y})`} opacity={dim ? 0.25 : 1}
                      onClick={(ev) => { ev.stopPropagation(); setSelected(isSel ? null : n.id); }} role="button" tabIndex={0}
                      onKeyDown={(ev) => ev.key === 'Enter' && setSelected(n.id)} aria-label={`${NODE_TYPES[n.type].label} ${n.label}`}>
                      <rect width={NODE_W} height={NODE_H} rx={8} fill="var(--bh-surface)" stroke={isSel ? color : isMatch ? 'var(--bh-orange)' : 'var(--bh-border)'} strokeWidth={isSel || isMatch ? 2.5 : 1} />
                      <rect width={5} height={NODE_H - 12} x={8} y={6} rx={2.5} fill={color} />
                      <text x={22} y={18} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', fill: 'var(--bh-text-subtle)' }}>{NODE_TYPES[n.type].label.toUpperCase()}{n.app ? ` · ${clip(n.app, 14)}` : ''}</text>
                      <text x={22} y={34} style={{ fontSize: 12.5, fontWeight: 600, fill: 'var(--bh-text)' }}>{clip(n.label)}</text>
                      <title>{`${n.record.id} · ${n.label}`}</title>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          <div className="bh-map-controls">
            <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in" title="Zoom in"><ZoomIn size={17} /></button>
            <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" title="Zoom out"><ZoomOut size={17} /></button>
            <button type="button" onClick={fit} aria-label="Fit to screen" title="Fit to screen"><Maximize2 size={16} /></button>
          </div>

          <div className="bh-map-legend">
            <div className="small-caps mb-1">Legend</div>
            <div className="bh-legend">
              {presentTypes.map((k) => <span key={k}><span className="bh-legend-swatch" style={{ background: typeColor(k) }} />{NODE_TYPES[k].label}</span>)}
              <span><span className="bh-legend-swatch" style={{ background: 'var(--bh-orange)', height: 3, width: 14 }} />Highlighted relationship</span>
            </div>
            <div className="text-subtle mt-1" style={{ fontSize: 11 }}>Drag to pan · scroll to zoom · click a node for details</div>
          </div>

          {sel && (
            <div className="bh-map-panel" onPointerDown={(e) => e.stopPropagation()}>
              <div className="d-flex justify-content-between align-items-start p-3 border-bottom" style={{ borderColor: 'var(--bh-border)' }}>
                <div className="min-w-0">
                  <div className="small-caps" style={{ color: typeColor(sel.type) }}>{NODE_TYPES[sel.type].label}</div>
                  <div className="fw-bold">{sel.label}</div>
                  <div className="d-flex gap-2 align-items-center mt-1"><span className="bh-id">{sel.record.id}</span>{sel.status && <StatusBadge value={sel.status} />}</div>
                </div>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setSelected(null)} aria-label="Close details"><X size={16} /></button>
              </div>
              <div className="p-3">
                {sel.record.description && <p className="small text-muted">{sel.record.description}</p>}
                <div className="small-caps mb-2">Relationships ({selEdges.length})</div>
                <div className="d-flex flex-column gap-1">
                  {selEdges.map((e) => {
                    const other = nodeById.get(e.from === sel.id ? e.to : e.from);
                    const text = e.from === sel.id ? `${e.label} →` : `← ${e.label}`;
                    return (
                      <button key={e.id} type="button" className="bh-dropdown-item p-1" onClick={() => { setSelected(other.id); centerOn(other.id); }}>
                        <span className="bh-legend-swatch flex-shrink-0" style={{ background: typeColor(other.type), margin: 0 }} />
                        <span className="text-subtle" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{text}</span>
                        <span className="text-truncate fw-semibold">{other.label}</span>
                      </button>
                    );
                  })}
                </div>
                {routeFor(NODE_TYPES[sel.type].entity, sel.record.id) && (
                  <Link to={routeFor(NODE_TYPES[sel.type].entity, sel.record.id)} className="btn btn-secondary btn-sm w-100 justify-content-center mt-3"><ExternalLink size={14} />Open record</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="text-subtle small mt-2">{VIEWS.find((v) => v.key === view).description}</p>
    </>
  );
}
