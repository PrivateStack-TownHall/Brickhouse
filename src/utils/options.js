// Option lists for selects / multi-selects, built from existing registry records.
import { byId } from '../services/query.service';

const byName = (a, b) => String(a.label).localeCompare(String(b.label));

export const companyOptions = (ds) => ds.companies.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));
export const applicationOptions = (ds) => ds.applications.map((a) => ({ value: a.id, label: a.name, meta: byId(ds, 'companies', a.ownerId)?.name })).sort(byName);
export const repositoryOptions = (ds) => ds.repositories.map((r) => ({ value: r.id, label: r.name, meta: `${r.provider} · ${r.organization || '—'} · ${r.type}` })).sort(byName);
export const componentOptions = (ds, filter = () => true) => ds.components.filter(filter)
  .map((c) => ({ value: c.id, label: c.name, meta: `${byId(ds, 'applications', c.applicationId)?.name || '—'} · ${c.layer} ${c.type}` })).sort(byName);
export const technologyOptions = (ds, categories) => ds.technologies
  .filter((t) => !categories || categories.includes(t.category))
  .map((t) => ({ value: t.id, label: t.name, meta: `${t.category}${t.status !== 'active' ? ` · ${t.status}` : ''}` })).sort(byName);
export const infrastructureOptions = (ds) => ds.infrastructure.map((i) => ({ value: i.id, label: i.name, meta: `${i.provider} · ${i.category} · ${i.resourceType}` })).sort(byName);
export const apiOptions = (ds, filter = () => true) => ds.apis.filter(filter).map((a) => ({ value: a.id, label: a.name, meta: `${a.protocol} · ${a.serviceType} · ${a.version}` })).sort(byName);
export const deploymentOptions = (ds) => ds.deployments.map((d) => ({ value: d.id, label: d.name, meta: `${d.environment} · ${d.platform}` })).sort(byName);

/** Existing links of `ownerId` in a junction, as MultiSelect values. */
export function linkValues(ds, relation, ownerField, targetField, ownerId, extraKeys = []) {
  return (ds[relation] || []).filter((l) => l[ownerField] === ownerId)
    .map((l) => ({ targetId: l[targetField], ...Object.fromEntries(extraKeys.map((k) => [k, l[k] ?? ''])) }));
}

export const nameList = (ds, entity, items) => items.map((i) => byId(ds, entity, i.targetId)?.name || i.targetId).join(', ');
