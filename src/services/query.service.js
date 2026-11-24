// Read-side helpers: lookups and relationship traversal over the normalized dataset.
import { RELATIONS, ENTITY_KEYS } from './schema';

const indexCache = new WeakMap();

/** id → record maps per entity, cached per dataset object. */
export function getIndex(ds) {
  let idx = indexCache.get(ds);
  if (!idx) {
    idx = {};
    for (const k of ENTITY_KEYS) idx[k] = new Map((ds[k] || []).map((r) => [r.id, r]));
    indexCache.set(ds, idx);
  }
  return idx;
}

export const byId = (ds, entity, id) => (id ? getIndex(ds)[entity]?.get(id) || null : null);

/**
 * Follow a junction collection from one record.
 * side = side of the relation that `id` is on. Returns [{ link, record }].
 */
export function linked(ds, relation, side, id) {
  const def = RELATIONS[relation];
  const other = side === 'from' ? 'to' : 'from';
  return (ds[relation] || [])
    .filter((l) => l[def[side].field] === id)
    .map((l) => ({ link: l, record: byId(ds, def[other].entity, l[def[other].field]) }))
    .filter((x) => x.record);
}

const uniqBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) if (!m.has(key(r))) m.set(key(r), r);
  return [...m.values()];
};

export const companyOf = (ds, app) => byId(ds, 'companies', app?.ownerId);
export const applicationOfComponent = (ds, cmp) => byId(ds, 'applications', cmp?.applicationId);
export const componentOfDeployment = (ds, dep) => byId(ds, 'components', dep?.componentId);
export const applicationOfDeployment = (ds, dep) => applicationOfComponent(ds, componentOfDeployment(ds, dep));
export const providerOfApi = (ds, apiId) => linked(ds, 'applicationApis', 'to', apiId)[0]?.record || null;
export const consumersOfApi = (ds, apiId) => linked(ds, 'apiConsumers', 'from', apiId);
export const companyOfApi = (ds, apiId) => companyOf(ds, providerOfApi(ds, apiId));

export const componentsOfApp = (ds, appId) => (ds.components || []).filter((c) => c.applicationId === appId);
export const sharedComponentsOfApp = (ds, appId) => linked(ds, 'applicationComponents', 'from', appId);
export const deploymentsOfComponent = (ds, cmpId) => (ds.deployments || []).filter((d) => d.componentId === cmpId);
export const deploymentsOfApp = (ds, appId) => {
  const ids = new Set(componentsOfApp(ds, appId).map((c) => c.id));
  return (ds.deployments || []).filter((d) => ids.has(d.componentId));
};

/** Repositories of an application: direct links plus repositories of its components. */
export function repositoriesOfApp(ds, appId) {
  const direct = linked(ds, 'applicationRepositories', 'from', appId).map(({ link, record }) => ({ record, role: link.role, source: 'Application', linkId: link.id }));
  const via = componentsOfApp(ds, appId).flatMap((c) => linked(ds, 'componentRepositories', 'from', c.id).map(({ record }) => ({ record, role: '', source: c.name })));
  return uniqBy([...direct, ...via], (x) => x.record.id);
}

/** Applications using a repository (direct or through components). */
export function applicationsOfRepo(ds, repoId) {
  const direct = linked(ds, 'applicationRepositories', 'to', repoId).map(({ record, link }) => ({ record, role: link.role }));
  const via = linked(ds, 'componentRepositories', 'to', repoId).map(({ record }) => ({ record: applicationOfComponent(ds, record), role: `via ${record.name}` })).filter((x) => x.record);
  return uniqBy([...direct, ...via], (x) => x.record.id);
}

export function technologiesOfApp(ds, appId) {
  const direct = linked(ds, 'applicationTechnologies', 'from', appId).map(({ link, record }) => ({ record, role: link.role, version: link.version, source: 'Application' }));
  const via = componentsOfApp(ds, appId).flatMap((c) => linked(ds, 'componentTechnologies', 'from', c.id).map(({ link, record }) => ({ record, role: link.role, version: link.version, source: c.name })));
  return [...direct, ...via];
}

export function infrastructureOfApp(ds, appId) {
  const direct = linked(ds, 'applicationInfrastructure', 'from', appId).map(({ link, record }) => ({ record, role: link.role || '', source: 'Application' }));
  const via = componentsOfApp(ds, appId).flatMap((c) => linked(ds, 'componentInfrastructure', 'from', c.id).map(({ link, record }) => ({ record, role: link.resourceName || '', source: c.name })));
  const viaDeploy = deploymentsOfApp(ds, appId).filter((d) => d.infrastructureId).map((d) => ({ record: byId(ds, 'infrastructure', d.infrastructureId), role: `Deployment: ${d.name}`, source: 'Deployment' })).filter((x) => x.record);
  return [...direct, ...via, ...viaDeploy];
}

export function apisOfApp(ds, appId) {
  const provided = linked(ds, 'applicationApis', 'from', appId).map(({ record }) => ({ record, relation: 'provider' }));
  const consumed = linked(ds, 'apiConsumers', 'to', appId).map(({ record }) => ({ record, relation: 'consumer' }));
  return [...provided, ...consumed];
}

/** Applications and components using a technology, with the version recorded on the relationship. */
export function technologyUsage(ds, techId) {
  const components = linked(ds, 'componentTechnologies', 'to', techId).map(({ link, record }) => ({ record, role: link.role, version: link.version, app: applicationOfComponent(ds, record) }));
  const direct = linked(ds, 'applicationTechnologies', 'to', techId).map(({ link, record }) => ({ record, role: link.role, version: link.version }));
  const applications = uniqBy([...direct, ...components.filter((c) => c.app).map((c) => ({ record: c.app, role: `via ${c.record.name}`, version: c.version }))], (x) => x.record.id);
  return { components, applications };
}

export function infrastructureUsage(ds, infId) {
  const components = linked(ds, 'componentInfrastructure', 'to', infId).map(({ link, record }) => ({ record, resourceName: link.resourceName, app: applicationOfComponent(ds, record) }));
  const deployments = (ds.deployments || []).filter((d) => d.infrastructureId === infId);
  const apis = linked(ds, 'apiInfrastructure', 'to', infId).map(({ record }) => record);
  const direct = linked(ds, 'applicationInfrastructure', 'to', infId).map(({ link, record }) => ({ record, role: link.role }));
  const apps = uniqBy([
    ...direct,
    ...components.filter((c) => c.app).map((c) => ({ record: c.app, role: `via ${c.record.name}` })),
    ...deployments.map((d) => ({ record: applicationOfDeployment(ds, d), role: `via ${d.name}` })).filter((x) => x.record),
  ], (x) => x.record.id);
  return { components, deployments, apis, applications: apps };
}

export function componentDependencies(ds, cmpId) {
  return {
    dependsOn: linked(ds, 'componentServices', 'from', cmpId),
    dependents: linked(ds, 'componentServices', 'to', cmpId),
  };
}

/** Generic keyword match across selected fields. */
export function matchesSearch(record, query, fields = ['id', 'name', 'code', 'description', 'tags']) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => {
    const v = record?.[f];
    if (Array.isArray(v)) return v.some((x) => String(x).toLowerCase().includes(q));
    return v !== undefined && v !== null && String(v).toLowerCase().includes(q);
  });
}

export const relationCount = (ds) => Object.keys(RELATIONS).reduce((n, k) => n + (ds[k] || []).length, 0);
