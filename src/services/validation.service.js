// Record-level and dataset-level validation (used before saving, on restore,
// and by the Data Quality / Registry Health views).
import {
  ENTITIES, RELATIONS, FOREIGN_KEYS, LIFECYCLES, ENTITY_KEYS, RELATION_KEYS, SCHEMA_VERSION,
  TECHNOLOGY_STATUSES, INFRASTRUCTURE_STATUSES, DEPLOYMENT_STATUSES, ACCESS_STATUSES,
} from './schema';

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
const isUrl = (v) => {
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
};
const isLogoValue = (v) => isUrl(v) || /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(String(v).trim());

const FIELD_LABELS = {
  name: 'Name', code: 'Code', ownerId: 'Company ownership', category: 'Category', type: 'Type', lifecycle: 'Lifecycle',
  provider: 'Provider', visibility: 'Visibility', applicationId: 'Parent application', layer: 'Layer', serviceType: 'Service type',
  protocol: 'Protocol', authentication: 'Authentication', apiId: 'API', method: 'Method', path: 'Path', componentId: 'Component',
  environment: 'Environment', status: 'Status', repositoryId: 'Repository',
};
export const fieldLabel = (f) => FIELD_LABELS[f] || f;

/** Validate a single record about to be saved. Returns { field: message }. */
export function validateRecord(entity, values, ds, { id = null } = {}) {
  const def = ENTITIES[entity];
  const errors = {};
  for (const f of def.required || []) {
    if (isBlank(values[f])) errors[f] = `${fieldLabel(f)} is required.`;
  }
  for (const fk of FOREIGN_KEYS.filter((k) => k.entity === entity)) {
    const v = values[fk.field];
    if (!isBlank(v) && !(ds[fk.target] || []).some((r) => r.id === v)) {
      errors[fk.field] = `${fieldLabel(fk.field)} refers to a record that does not exist (${v}).`;
    }
  }
  if (def.lifecycleField && values[def.lifecycleField] && !LIFECYCLES.includes(values[def.lifecycleField])) {
    errors[def.lifecycleField] = 'Lifecycle must be one of the canonical values.';
  }
  for (const f of def.unique || []) {
    const v = String(values[f] || '').trim().toLowerCase();
    if (v && (ds[entity] || []).some((r) => r.id !== id && String(r[f] || '').trim().toLowerCase() === v)) {
      errors[f] = `Another ${def.label.toLowerCase()} already uses this ${fieldLabel(f).toLowerCase()}.`;
    }
  }
  for (const [k, v] of Object.entries(values)) {
    if (k === 'logoUrl' && !isBlank(v) && !isLogoValue(v)) errors[k] = 'Enter a full http(s):// image URL or upload an image file.';
    else if (k !== 'logoUrl' && /(Url|URL)$/.test(k) && !isBlank(v) && !isUrl(v)) errors[k] = 'Enter a full URL starting with http:// or https://';
  }
  if (entity === 'endpoints' && values.path && !String(values.path).startsWith('/')) errors.path = 'Path must start with "/".';
  return errors;
}

/** Full data-quality scan. Returns a list of issues. */
export function validateDataset(ds) {
  const issues = [];
  const add = (severity, type, collection, recordId, message) => issues.push({ severity, type, collection, recordId, message });
  const ids = {};

  for (const key of ENTITY_KEYS) {
    const def = ENTITIES[key];
    const rows = ds[key];
    if (!Array.isArray(rows)) { add('error', 'missing-collection', key, null, `Collection "${key}" is missing or not a list.`); continue; }
    const seen = new Set();
    ids[key] = seen;
    for (const r of rows) {
      if (!r || typeof r !== 'object' || !r.id) { add('error', 'missing-required', key, null, `A ${def.label.toLowerCase()} record has no ID.`); continue; }
      if (seen.has(r.id)) add('error', 'duplicate-id', key, r.id, `Duplicate ID ${r.id} in ${def.plural}.`);
      seen.add(r.id);
      if (!String(r.id).startsWith(def.prefix + '-')) add('warning', 'invalid-id', key, r.id, `ID ${r.id} does not use the ${def.prefix} prefix.`);
      const missing = (def.required || []).filter((f) => isBlank(r[f]) && !(key === 'applications' && f === 'ownerId'));
      if (missing.length) add('warning', 'missing-required', key, r.id, `${r.id} is missing: ${missing.map(fieldLabel).join(', ')}.`);
      if (def.lifecycleField && r[def.lifecycleField] && !LIFECYCLES.includes(r[def.lifecycleField])) {
        add('error', 'invalid-lifecycle', key, r.id, `${r.id} has invalid lifecycle "${r[def.lifecycleField]}".`);
      }
    }
  }
  for (const r of ds.technologies || []) if (r.status && !TECHNOLOGY_STATUSES.includes(r.status)) add('warning', 'invalid-status', 'technologies', r.id, `${r.id} has unknown status "${r.status}".`);
  for (const r of ds.infrastructure || []) if (r.status && !INFRASTRUCTURE_STATUSES.includes(r.status)) add('warning', 'invalid-status', 'infrastructure', r.id, `${r.id} has unknown status "${r.status}".`);
  for (const r of ds.deployments || []) if (r.status && !DEPLOYMENT_STATUSES.includes(r.status)) add('warning', 'invalid-status', 'deployments', r.id, `${r.id} has unknown status "${r.status}".`);

  for (const r of ds.repositories || []) if (r.accessStatus && !ACCESS_STATUSES.includes(r.accessStatus)) add('warning', 'invalid-status', 'repositories', r.id, `${r.id} has unknown access status "${r.accessStatus}".`);
  for (const r of ds.applications || []) {
    if (isBlank(r.ownerId)) add('error', 'missing-ownership', 'applications', r.id, `${r.id} (${r.name}) has no company ownership.`);
  }
  for (const fk of FOREIGN_KEYS) {
    for (const r of ds[fk.entity] || []) {
      const v = r[fk.field];
      if (!isBlank(v) && ids[fk.target] && !ids[fk.target].has(v)) {
        add('error', 'invalid-fk', fk.entity, r.id, `${r.id}.${fk.field} points to missing ${ENTITIES[fk.target].label.toLowerCase()} ${v}.`);
      }
    }
  }
  for (const key of RELATION_KEYS) {
    const def = RELATIONS[key];
    const rows = ds[key];
    if (!Array.isArray(rows)) { add('error', 'missing-collection', key, null, `Relationship collection "${key}" is missing.`); continue; }
    const seen = new Set();
    const pairs = new Set();
    for (const r of rows) {
      if (!r?.id) { add('error', 'missing-required', key, null, `A ${def.label} link has no ID.`); continue; }
      if (seen.has(r.id)) add('error', 'duplicate-id', key, r.id, `Duplicate relationship ID ${r.id}.`);
      seen.add(r.id);
      const a = r[def.from.field];
      const b = r[def.to.field];
      if (!ids[def.from.entity]?.has(a) || !ids[def.to.entity]?.has(b)) {
        add('error', 'orphaned-relationship', key, r.id, `${r.id} (${def.label}) links ${a || '∅'} → ${b || '∅'}, but one side does not exist.`);
      }
      const pk = `${a}|${b}|${r.role || ''}`;
      if (pairs.has(pk)) add('warning', 'duplicate-link', key, r.id, `${r.id} duplicates an existing ${def.label} link.`);
      pairs.add(pk);
    }
  }
  // An API may only have one provider application.
  const providers = {};
  for (const r of ds.applicationApis || []) providers[r.apiId] = (providers[r.apiId] || 0) + 1;
  Object.entries(providers).filter(([, n]) => n > 1).forEach(([apiId]) => add('warning', 'multiple-providers', 'applicationApis', apiId, `${apiId} has more than one provider application.`));
  return issues;
}

export const QUALITY_CHECKS = [
  { type: 'missing-required', label: 'Missing required fields' },
  { type: 'duplicate-id', label: 'Duplicate IDs' },
  { type: 'invalid-fk', label: 'Invalid foreign keys' },
  { type: 'orphaned-relationship', label: 'Orphaned relationships' },
  { type: 'invalid-lifecycle', label: 'Invalid lifecycle values' },
  { type: 'missing-ownership', label: 'Missing ownership' },
];

/** Structural validation of an imported backup file. */
export function validateBackup(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['The file does not contain a JSON object.'] };
  if (obj.format !== 'brickhouse-backup') errors.push('Not a BRICKHOUSE backup (missing "format": "brickhouse-backup").');
  const data = obj.data;
  if (!data || typeof data !== 'object') return { ok: false, errors: [...errors, 'Backup has no "data" section.'] };
  const v = Number(obj.schemaVersion ?? data.schemaVersion);
  if (!v) errors.push('Backup has no schema version.');
  else if (v > SCHEMA_VERSION) errors.push(`Backup schema v${v} is newer than this BRICKHOUSE (v${SCHEMA_VERSION}).`);
  for (const k of [...ENTITY_KEYS, ...RELATION_KEYS]) {
    if (data[k] !== undefined && !Array.isArray(data[k])) errors.push(`"${k}" must be a list.`);
  }
  for (const k of ['companies', 'applications']) if (!Array.isArray(data[k])) errors.push(`Backup is missing the "${k}" collection.`);
  if (data.settings !== undefined && typeof data.settings !== 'object') errors.push('"settings" must be an object.');
  return { ok: errors.length === 0, errors };
}
