// Builds the Architecture Map graph from live registry data (never a static image).
import { byId, componentsOfApp, linked } from '../../services/query.service';

export const NODE_TYPES = {
  company: { label: 'Company', entity: 'companies', slot: 0 },
  application: { label: 'Application', entity: 'applications', slot: 1 },
  component: { label: 'Component', entity: 'components', slot: 2 },
  repository: { label: 'Repository', entity: 'repositories', slot: 3 },
  api: { label: 'API / Service', entity: 'apis', slot: 4 },
  technology: { label: 'Technology', entity: 'technologies', slot: 5 },
  infrastructure: { label: 'Infrastructure', entity: 'infrastructure', slot: 6 },
  deployment: { label: 'Deployment', entity: 'deployments', slot: 7 },
};
const TYPE_ORDER = Object.keys(NODE_TYPES);

export const VIEWS = [
  { key: 'ecosystem', label: 'Ecosystem Map', description: 'Companies, applications, components and the services between them.' },
  { key: 'application', label: 'Application View', description: 'Everything connected to one application.' },
  { key: 'infrastructure', label: 'Infrastructure View', description: 'Which deployments, components and applications run on each resource.' },
  { key: 'dependency', label: 'Dependency Graph', description: 'Component-to-component dependencies and API provider/consumer links.' },
];

const COLUMNS = {
  ecosystem: { company: 0, application: 1, component: 2, repository: 3, api: 3, deployment: 3, technology: 4, infrastructure: 4 },
  application: { company: 0, application: 1, component: 2, repository: 3, api: 3, deployment: 3, technology: 4, infrastructure: 4 },
  infrastructure: { company: 0, application: 1, component: 2, deployment: 3, api: 3, infrastructure: 4 },
};
export const DEFAULT_TYPES = {
  ecosystem: ['company', 'application', 'component', 'api'],
  application: TYPE_ORDER,
  infrastructure: ['application', 'component', 'deployment', 'api', 'infrastructure'],
  dependency: ['component', 'api'],
};

function collector() {
  const nodes = new Map();
  const edges = new Map();
  const node = (type, record, extra = {}) => {
    if (!record) return null;
    const id = `${type}:${record.id}`;
    if (!nodes.has(id)) {
      nodes.set(id, {
        id, type, record, label: record.name || record.id,
        status: record.lifecycle || record.status || null, ...extra,
      });
    }
    return id;
  };
  const edge = (from, to, label) => {
    if (!from || !to || from === to) return;
    const id = `${from}->${to}:${label}`;
    if (!edges.has(id)) edges.set(id, { id, from, to, label });
  };
  return { nodes, edges, node, edge };
}

function addApplication(ds, g, app, { deep = true } = {}) {
  const a = g.node('application', app);
  g.edge(g.node('company', byId(ds, 'companies', app.ownerId)), a, 'owns');
  if (!deep) return a;
  for (const c of componentsOfApp(ds, app.id)) addComponent(ds, g, c, a);
  for (const { record } of linked(ds, 'applicationComponents', 'from', app.id)) g.edge(a, g.node('component', record), 'uses (shared)');
  for (const { record } of linked(ds, 'applicationRepositories', 'from', app.id)) g.edge(a, g.node('repository', record), 'uses');
  for (const { record } of linked(ds, 'applicationApis', 'from', app.id)) g.edge(a, g.node('api', record), 'provides');
  for (const { record } of linked(ds, 'apiConsumers', 'to', app.id)) g.edge(g.node('api', record), a, 'consumed by');
  for (const { record } of linked(ds, 'applicationInfrastructure', 'from', app.id)) g.edge(a, g.node('infrastructure', record), 'uses');
  for (const d of (ds.deployments || []).filter((x) => x.applicationId === app.id && !x.componentId)) {
    const dn = g.node('deployment', d);
    g.edge(a, dn, 'has deployment');
    if (d.infrastructureId) g.edge(dn, g.node('infrastructure', byId(ds, 'infrastructure', d.infrastructureId)), 'runs on');
  }
  return a;
}

function addComponent(ds, g, c, appNode) {
  const n = g.node('component', c);
  if (appNode) g.edge(appNode, n, 'contains');
  for (const { record } of linked(ds, 'componentRepositories', 'from', c.id)) g.edge(n, g.node('repository', record), 'uses');
  for (const { record } of linked(ds, 'componentTechnologies', 'from', c.id)) g.edge(n, g.node('technology', record), 'uses');
  for (const { record } of linked(ds, 'componentInfrastructure', 'from', c.id)) g.edge(n, g.node('infrastructure', record), 'uses');
  for (const { link, record } of linked(ds, 'componentApis', 'from', c.id)) g.edge(n, g.node('api', record), link.role === 'provider' ? 'provides' : 'consumes');
  for (const d of ds.deployments.filter((x) => x.componentId === c.id)) {
    const dn = g.node('deployment', d);
    g.edge(n, dn, 'has deployment');
    if (d.infrastructureId) g.edge(dn, g.node('infrastructure', byId(ds, 'infrastructure', d.infrastructureId)), 'runs on');
  }
  return n;
}

/**
 * view: ecosystem | application | infrastructure | dependency
 * opts: { applicationId, companyId }
 */
export function buildGraph(ds, view, opts = {}) {
  const g = collector();
  if (view === 'ecosystem') {
    ds.companies.filter((c) => !opts.companyId || c.id === opts.companyId).forEach((c) => g.node('company', c));
    ds.applications.filter((a) => !opts.companyId || a.ownerId === opts.companyId).forEach((a) => addApplication(ds, g, a));
  } else if (view === 'application') {
    const app = byId(ds, 'applications', opts.applicationId) || ds.applications[0];
    if (app) {
      addApplication(ds, g, app);
      // provider apps of consumed APIs and consumers of provided APIs, shallow
      for (const { record: api } of linked(ds, 'apiConsumers', 'to', app.id)) {
        const p = linked(ds, 'applicationApis', 'to', api.id)[0]?.record;
        if (p) g.edge(addApplication(ds, g, p, { deep: false }), g.node('api', api), 'provides');
      }
      for (const { record: api } of linked(ds, 'applicationApis', 'from', app.id)) {
        for (const { record: c } of linked(ds, 'apiConsumers', 'from', api.id)) g.edge(g.node('api', api), addApplication(ds, g, c, { deep: false }), 'consumed by');
      }
      for (const { record: c } of linked(ds, 'applicationComponents', 'from', app.id)) addComponent(ds, g, c, null);
    }
  } else if (view === 'infrastructure') {
    for (const inf of ds.infrastructure) {
      const i = g.node('infrastructure', inf);
      for (const d of ds.deployments.filter((x) => x.infrastructureId === inf.id)) {
        const dn = g.node('deployment', d);
        g.edge(dn, i, 'runs on');
        const c = byId(ds, 'components', d.componentId);
        if (c) {
          const cn = g.node('component', c);
          g.edge(cn, dn, 'has deployment');
          const app = byId(ds, 'applications', c.applicationId);
          if (app) g.edge(g.node('application', app), cn, 'contains');
        } else if (d.applicationId) {
          const app = byId(ds, 'applications', d.applicationId);
          if (app) g.edge(g.node('application', app), dn, 'has deployment');
        }
      }
      for (const { record: c } of linked(ds, 'componentInfrastructure', 'to', inf.id)) {
        const cn = g.node('component', c);
        g.edge(cn, i, 'uses');
        const app = byId(ds, 'applications', c.applicationId);
        if (app) g.edge(g.node('application', app), cn, 'contains');
      }
      for (const { record: a } of linked(ds, 'apiInfrastructure', 'to', inf.id)) g.edge(g.node('api', a), i, 'hosted on');
      for (const { record: a } of linked(ds, 'applicationInfrastructure', 'to', inf.id)) g.edge(g.node('application', a), i, 'uses');
    }
  } else if (view === 'dependency') {
    for (const l of ds.componentServices) {
      const s = byId(ds, 'components', l.sourceComponentId);
      const t = byId(ds, 'components', l.targetComponentId);
      g.edge(g.node('component', s, { app: byId(ds, 'applications', s?.applicationId)?.name }), g.node('component', t, { app: byId(ds, 'applications', t?.applicationId)?.name }), (l.relationshipType || 'depends_on').replace('_', ' '));
    }
    for (const l of ds.componentApis) {
      const c = byId(ds, 'components', l.componentId);
      g.edge(g.node('component', c, { app: byId(ds, 'applications', c?.applicationId)?.name }), g.node('api', byId(ds, 'apis', l.apiId)), l.role === 'provider' ? 'provides' : 'consumes');
    }
  }
  return { nodes: [...g.nodes.values()], edges: [...g.edges.values()] };
}

export const NODE_W = 200;
export const NODE_H = 46;
const COL_GAP = 120;
const ROW_GAP = 14;

/** Layered left-to-right layout with a barycenter pass to reduce crossings. */
export function layoutGraph(graph, view) {
  const { nodes, edges } = graph;
  const col = new Map();
  if (view === 'dependency') {
    // Column = longest dependency path from a root; APIs go to the right of their providers.
    const out = new Map(nodes.map((n) => [n.id, []]));
    edges.filter((e) => e.from.startsWith('component:') && e.to.startsWith('component:')).forEach((e) => out.get(e.from).push(e.to));
    const depth = new Map();
    const visit = (id, stack = new Set()) => {
      if (depth.has(id)) return depth.get(id);
      if (stack.has(id)) return 0; // cycle guard
      stack.add(id);
      const incoming = edges.filter((e) => e.to === id && e.from.startsWith('component:'));
      const d = incoming.length ? 1 + Math.max(...incoming.map((e) => visit(e.from, stack))) : 0;
      stack.delete(id);
      depth.set(id, d);
      return d;
    };
    nodes.filter((n) => n.type === 'component').forEach((n) => visit(n.id));
    const maxC = Math.max(0, ...[...depth.values()]);
    nodes.forEach((n) => col.set(n.id, n.type === 'api' ? maxC + 1 : depth.get(n.id) || 0));
  } else {
    nodes.forEach((n) => col.set(n.id, COLUMNS[view]?.[n.type] ?? 0));
  }
  const columns = new Map();
  nodes.forEach((n) => {
    const c = col.get(n.id);
    if (!columns.has(c)) columns.set(c, []);
    columns.get(c).push(n);
  });
  const neighbors = new Map(nodes.map((n) => [n.id, []]));
  edges.forEach((e) => { neighbors.get(e.from)?.push(e.to); neighbors.get(e.to)?.push(e.from); });
  const pos = new Map();
  const keys = [...columns.keys()].sort((a, b) => a - b);
  // Tall columns wrap into sub-columns so large registries keep a readable aspect ratio.
  const MAX_ROWS = 14;
  const SUB_GAP = 36;
  const place = () => {
    let x = 0;
    for (const c of keys) {
      const list = columns.get(c);
      const nsub = Math.max(1, Math.ceil(list.length / MAX_ROWS));
      const per = Math.ceil(list.length / nsub);
      list.forEach((n, i) => {
        pos.set(n.id, { x: x + Math.floor(i / per) * (NODE_W + SUB_GAP), y: (i % per) * (NODE_H + ROW_GAP) });
      });
      x += nsub * (NODE_W + SUB_GAP) - SUB_GAP + COL_GAP;
    }
  };
  // initial order: type, then name
  keys.forEach((c) => columns.get(c).sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.label.localeCompare(b.label)));
  place();
  for (let iter = 0; iter < 3; iter += 1) {
    keys.forEach((c) => {
      const bary = (n) => {
        const ys = neighbors.get(n.id).map((m) => pos.get(m)?.y).filter((v) => v !== undefined);
        return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : pos.get(n.id).y;
      };
      columns.get(c).sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || bary(a) - bary(b));
    });
    place();
  }
  // vertically center columns against the tallest
  const heights = keys.map((c) => Math.max(...columns.get(c).map((n) => pos.get(n.id).y)) + NODE_H);
  const tallest = Math.max(0, ...heights);
  keys.forEach((c, i) => {
    const off = (tallest - heights[i]) / 2;
    columns.get(c).forEach((n) => { pos.get(n.id).y += off; });
  });
  return pos;
}
