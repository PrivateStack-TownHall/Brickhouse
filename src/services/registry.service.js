// Registry business logic: create / update / delete entities, maintain junction
// collections, enforce referential integrity and write the Activity Log.
// Every function is pure: it receives a dataset and returns { dataset, result }.
import { ENTITIES, RELATIONS, RELATION_KEYS, FOREIGN_KEYS } from './schema';
import { reserveId } from './id-generator.service';
import { logActivity } from './activity.service';
import { validateRecord } from './validation.service';

export class ValidationError extends Error {
  constructor(errors, message = 'Please fix the highlighted fields.') {
    super(message);
    this.errors = errors;
  }
}

const ROLE_KEYED = new Set(['componentApis', 'applicationTechnologies']);

/** Copy-on-write transaction over a dataset. */
export function transaction(ds) {
  const d = { ...ds };
  const copied = new Set();
  const arr = (k) => {
    if (!copied.has(k)) { d[k] = [...(d[k] || [])]; copied.add(k); }
    return d[k];
  };
  return {
    get data() { return d; },
    nextId: (prefix) => reserveId(d, prefix),
    insert: (k, rec) => arr(k).push(rec),
    update: (k, id, patch) => {
      const a = arr(k);
      const i = a.findIndex((r) => r.id === id);
      if (i >= 0) a[i] = { ...a[i], ...patch };
    },
    removeWhere: (k, pred) => {
      const before = d[k] || [];
      const after = before.filter((r) => !pred(r));
      if (after.length !== before.length) { d[k] = after; copied.add(k); }
      return before.length - after.length;
    },
    set: (k, v) => { d[k] = v; },
  };
}

const now = () => new Date().toISOString();
const SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt'];

function cleanValues(values) {
  const out = {};
  for (const [k, v] of Object.entries(values || {})) {
    if (SYSTEM_FIELDS.includes(k)) continue;
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

export function displayName(record) {
  if (!record) return '';
  return record.name || (record.method ? `${record.method} ${record.path}` : record.id);
}

/** Which application an activity about this record belongs to (for Activity Log filtering). */
export function contextApplicationId(ds, entity, record) {
  if (!record) return null;
  if (entity === 'applications') return record.id;
  if (entity === 'components') return record.applicationId || null;
  if (entity === 'deployments') return record.applicationId || (ds.components || []).find((c) => c.id === record.componentId)?.applicationId || null;
  if (entity === 'apis') return (ds.applicationApis || []).find((l) => l.apiId === record.id)?.applicationId || null;
  if (entity === 'endpoints') return (ds.applicationApis || []).find((l) => l.apiId === record.apiId)?.applicationId || null;
  return null;
}

/**
 * Replace the links of one owner record inside a junction collection.
 * side: which side of the relation the owner is on ('from' | 'to').
 * items: [{ targetId, ...extraFields }]
 */
function syncRelation(tx, relKey, side, ownerId, items) {
  const def = RELATIONS[relKey];
  const ownerField = def[side].field;
  const targetField = def[side === 'from' ? 'to' : 'from'].field;
  // Only these relations may link the same pair twice with different roles.
  const keyOf = (targetId, role) => (ROLE_KEYED.has(relKey) ? `${targetId}|${role ?? ''}` : targetId);
  const desired = new Map();
  for (const it of items || []) {
    if (!it?.targetId) continue;
    if (relKey === 'componentServices' && it.targetId === ownerId) continue; // no self-dependency
    desired.set(keyOf(it.targetId, it.role), it);
  }
  const existing = (tx.data[relKey] || []).filter((r) => r[ownerField] === ownerId);
  const keep = new Set();
  let removed = 0;
  let updated = 0;
  let added = 0;
  for (const r of existing) {
    const k = keyOf(r[targetField], r.role);
    if (!desired.has(k)) {
      tx.removeWhere(relKey, (x) => x.id === r.id);
      removed += 1;
    } else {
      keep.add(k);
      const { targetId, ...extra } = desired.get(k);
      const changed = Object.entries(extra).some(([f, v]) => (r[f] ?? '') !== (v ?? ''));
      if (changed) { tx.update(relKey, r.id, extra); updated += 1; }
    }
  }
  for (const [k, it] of desired) {
    if (keep.has(k)) continue;
    const { targetId, ...extra } = it;
    tx.insert(relKey, { id: tx.nextId(def.prefix), [ownerField]: ownerId, [targetField]: targetId, ...extra });
    added += 1;
  }
  return { added, removed, updated };
}

function applyLinks(tx, ownerEntity, ownerId, links, { log = true, applicationId = null } = {}) {
  let total = 0;
  for (const { relation, side, items } of links || []) {
    const res = syncRelation(tx, relation, side, ownerId, items);
    const n = res.added + res.removed + res.updated;
    total += res.added;
    if (log && n > 0) {
      const parts = [];
      if (res.added) parts.push(`${res.added} added`);
      if (res.removed) parts.push(`${res.removed} removed`);
      if (res.updated) parts.push(`${res.updated} updated`);
      logActivity(tx, {
        category: 'relationship', action: 'Relationships updated', resourceType: ENTITIES[ownerEntity].label,
        resourceId: ownerId, applicationId, description: `${RELATIONS[relation].label}: ${parts.join(', ')}.`,
      });
    }
  }
  return total;
}

export function createEntity(ds, entity, values, links = []) {
  const def = ENTITIES[entity];
  const clean = cleanValues(values);
  const errors = validateRecord(entity, clean, ds);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const tx = transaction(ds);
  const id = tx.nextId(def.prefix);
  const ts = now();
  const record = { id, ...clean, createdAt: ts, updatedAt: ts };
  tx.insert(entity, record);
  const linkCount = applyLinks(tx, entity, id, links, { log: false });
  const appId = contextApplicationId(tx.data, entity, record);
  logActivity(tx, {
    category: 'create', action: `${def.label} created`, resourceType: def.label, resourceId: id, applicationId: appId,
    description: `Created ${def.label.toLowerCase()} "${displayName(record)}"${linkCount ? ` with ${linkCount} relationship${linkCount > 1 ? 's' : ''}` : ''}.`,
  });
  return { dataset: tx.data, result: id };
}

export function updateEntity(ds, entity, id, values, links = null) {
  const def = ENTITIES[entity];
  const existing = (ds[entity] || []).find((r) => r.id === id);
  if (!existing) throw new Error(`${def.label} ${id} no longer exists.`);
  const clean = cleanValues(values);
  const merged = { ...existing, ...clean, id, createdAt: existing.createdAt };
  const errors = validateRecord(entity, merged, ds, { id });
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const changed = Object.keys(clean).filter((k) => JSON.stringify(existing[k] ?? null) !== JSON.stringify(merged[k] ?? null));
  const tx = transaction(ds);
  const appId = contextApplicationId(ds, entity, merged);
  const lf = def.lifecycleField;
  if (changed.length) {
    tx.update(entity, id, { ...clean, updatedAt: now() });
    if (lf && changed.includes(lf)) {
      logActivity(tx, {
        category: 'lifecycle', action: 'Lifecycle changed', resourceType: def.label, resourceId: id, applicationId: appId,
        description: `"${displayName(merged)}" lifecycle changed from ${existing[lf] || '—'} to ${merged[lf]}.`,
      });
    }
    const other = changed.filter((k) => k !== lf);
    if (other.length) {
      logActivity(tx, {
        category: 'update', action: `${def.label} updated`, resourceType: def.label, resourceId: id, applicationId: appId,
        description: `Updated "${displayName(merged)}": ${other.join(', ')}.`,
      });
    }
  }
  if (links) {
    const before = tx.data.activities.length;
    applyLinks(tx, entity, id, links, { applicationId: appId });
    if (!changed.length && tx.data.activities.length > before) tx.update(entity, id, { updatedAt: now() });
  }
  return { dataset: tx.data, result: id };
}

/** Everything that references a record. */
export function getDependents(ds, entity, id) {
  const blocking = [];
  const optional = [];
  const cascade = [];
  for (const fk of FOREIGN_KEYS.filter((k) => k.target === entity)) {
    const records = (ds[fk.entity] || []).filter((r) => r[fk.field] === id);
    if (!records.length) continue;
    const item = { entity: fk.entity, field: fk.field, records };
    if (fk.cascade) cascade.push(item); else (fk.required ? blocking : optional).push(item);
  }
  const links = [];
  for (const k of RELATION_KEYS) {
    const def = RELATIONS[k];
    const records = (ds[k] || []).filter((r) => (def.from.entity === entity && r[def.from.field] === id) || (def.to.entity === entity && r[def.to.field] === id));
    if (records.length) links.push({ relation: k, label: def.label, records });
  }
  return { blocking, optional, cascade, links };
}

export function deleteEntity(ds, entity, id) {
  const def = ENTITIES[entity];
  const record = (ds[entity] || []).find((r) => r.id === id);
  if (!record) throw new Error(`${def.label} ${id} no longer exists.`);
  const deps = getDependents(ds, entity, id);
  if (deps.blocking.length) {
    const summary = deps.blocking.map((b) => `${b.records.length} ${ENTITIES[b.entity].plural.toLowerCase()}`).join(', ');
    throw new Error(`Cannot delete ${id}: still referenced by ${summary}.`);
  }
  const tx = transaction(ds);
  const appId = contextApplicationId(ds, entity, record);
  let unlinked = 0;
  for (const l of deps.links) {
    const ids = new Set(l.records.map((r) => r.id));
    unlinked += tx.removeWhere(l.relation, (r) => ids.has(r.id));
  }
  for (const o of deps.optional) {
    for (const r of o.records) tx.update(o.entity, r.id, { [o.field]: null, updatedAt: now() });
  }
  let removedChildren = 0;
  for (const c of deps.cascade) {
    const ids = new Set(c.records.map((r) => r.id));
    removedChildren += tx.removeWhere(c.entity, (r) => ids.has(r.id));
  }
  tx.removeWhere(entity, (r) => r.id === id);
  const extra = [];
  if (unlinked) extra.push(`${unlinked} relationship${unlinked > 1 ? 's' : ''} unlinked`);
  const cleared = deps.optional.reduce((n, o) => n + o.records.length, 0);
  if (cleared) extra.push(`${cleared} optional reference${cleared > 1 ? 's' : ''} cleared`);
  if (removedChildren) extra.push(`${removedChildren} dependent record${removedChildren > 1 ? 's' : ''} removed`);
  logActivity(tx, {
    category: 'delete', action: `${def.label} deleted`, resourceType: def.label, resourceId: id, applicationId: entity === 'applications' ? null : appId,
    description: `Deleted ${def.label.toLowerCase()} "${displayName(record)}"${extra.length ? ` (${extra.join('; ')})` : ''}.`,
  });
  return { dataset: tx.data, result: id };
}

/** Remove a single relationship record (safe unlink). */
export function removeLink(ds, relation, linkId) {
  const def = RELATIONS[relation];
  const link = (ds[relation] || []).find((r) => r.id === linkId);
  if (!link) return { dataset: ds, result: null };
  const tx = transaction(ds);
  tx.removeWhere(relation, (r) => r.id === linkId);
  logActivity(tx, {
    category: 'relationship', action: 'Relationship removed', resourceType: 'Relationship', resourceId: linkId,
    description: `${def.label}: unlinked ${link[def.from.field]} → ${link[def.to.field]}.`,
  });
  return { dataset: tx.data, result: linkId };
}

export function updateCategories(ds, key, values) {
  const list = [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
  const tx = transaction(ds);
  tx.set('categories', { ...ds.categories, [key]: list });
  logActivity(tx, { category: 'system', action: 'Registry configuration updated', resourceType: 'Configuration', description: `Updated option list "${key}" (${list.length} values).` });
  return { dataset: tx.data, result: key };
}

export function updateSettings(ds, section, values, description) {
  const tx = transaction(ds);
  const settings = { ...ds.settings };
  if (section === 'integrations') settings.integrations = { ...settings.integrations, ...values };
  else settings[section] = { ...settings[section], ...values };
  tx.set('settings', settings);
  logActivity(tx, { category: 'system', action: 'Settings updated', resourceType: 'Settings', description: description || `Updated ${section} settings.` });
  return { dataset: tx.data, result: section };
}

export function recordBackup(ds) {
  const tx = transaction(ds);
  const at = now();
  tx.set('meta', { ...ds.meta, lastBackupAt: at });
  logActivity(tx, { category: 'system', action: 'Backup exported', resourceType: 'System', description: 'Full JSON backup downloaded.' });
  return { dataset: tx.data, result: at };
}

export function logSystem(ds, action, description) {
  const tx = transaction(ds);
  logActivity(tx, { category: 'system', action, resourceType: 'System', description });
  return { dataset: tx.data, result: null };
}
