// Centralized Local Storage service.
// 1. Load seed JSON  2. Check Local Storage  3. Initialize from seed when empty
// 4. Persist  5. Hand the active dataset to the app.
// Seed files are never modified. Local Storage is never silently reset.
import { STORAGE_KEY, SCHEMA_VERSION, ENTITY_KEYS, RELATION_KEYS, DEFAULT_SETTINGS } from './schema';
import { buildSeedDataset } from './seed';
import { reconcileSequences, formatId } from './id-generator.service';
import { integrationConnections } from './git-integrations.service';

const RECOVERY_KEY = `${STORAGE_KEY}.recovery`;

function storage() {
  try {
    const s = window.localStorage;
    const probe = '__brickhouse_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** Fill in missing collections / settings keys without touching existing data. */
export function normalizeDataset(ds, seed = buildSeedDataset()) {
  const out = { ...ds };
  for (const k of [...ENTITY_KEYS, ...RELATION_KEYS]) if (!Array.isArray(out[k])) out[k] = [];
  const existingCompanyIds = new Set((out.companies || []).map((c) => c.id));
  for (const sc of seed.companies || []) {
    if (!existingCompanyIds.has(sc.id)) out.companies.push(sc);
  }
  out.categories = { ...seed.categories, ...(out.categories || {}) };
  out.categories.lifecycleOptions = seed.categories.lifecycleOptions; // canonical, not editable
  const s = out.settings || {};
  out.settings = {
    general: { ...DEFAULT_SETTINGS.general, ...(s.general || {}) },
    preferences: { ...DEFAULT_SETTINGS.preferences, ...(s.preferences || {}) },
    integrations: {
      github: { ...DEFAULT_SETTINGS.integrations.github, ...(s.integrations?.github || {}) },
      gitlab: { ...DEFAULT_SETTINGS.integrations.gitlab, ...(s.integrations?.gitlab || {}) },
      bitbucket: { ...DEFAULT_SETTINGS.integrations.bitbucket, ...(s.integrations?.bitbucket || {}) },
      connections: integrationConnections(s.integrations || DEFAULT_SETTINGS.integrations),
    },
  };
  out.meta = { source: 'seed', initializedAt: null, lastBackupAt: null, lastRestoreAt: null, ...(out.meta || {}) };
  out.schemaVersion = out.schemaVersion || SCHEMA_VERSION;
  return reconcileSequences(out);
}

// Ordered migrations: { from: n, to: n+1, migrate(ds) }. Never drop user data.
const MIGRATIONS = [
  {
    from: 1,
    to: 2,
    // v2: recorded Git commits + repository access status.
    migrate: (ds) => ({
      ...ds,
      commits: Array.isArray(ds.commits) ? ds.commits : [],
      repositories: (ds.repositories || []).map((r) => ({ accessStatus: 'unknown', ...r })),
    }),
  },
];

export function migrateDataset(ds) {
  let current = Number(ds.schemaVersion || 1);
  let out = ds;
  const applied = [];
  while (current < SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === current);
    if (!step) throw new Error(`No migration path from schema v${current} to v${SCHEMA_VERSION}.`);
    out = { ...step.migrate(out), schemaVersion: step.to };
    applied.push(`v${step.from}→v${step.to}`);
    current = step.to;
  }
  return { dataset: out, applied };
}

function appendSystemActivity(ds, action, description) {
  const seq = { ...(ds.idSequences || {}) };
  seq.ACT = (seq.ACT || 0) + 1;
  const entry = {
    id: formatId('ACT', seq.ACT), timestamp: new Date().toISOString(),
    actor: ds.settings?.general?.ownerName || 'Registry Owner', category: 'system',
    action, resourceType: 'System', resourceId: null, applicationId: null, description,
  };
  return { ...ds, idSequences: seq, activities: [...(ds.activities || []), entry] };
}
export { appendSystemActivity };

export function persistDataset(ds) {
  const s = storage();
  if (!s) return { ok: false, error: 'Local Storage is not available in this browser.' };
  try {
    const raw = JSON.stringify({ ...ds, meta: { ...ds.meta, savedAt: new Date().toISOString() } });
    s.setItem(STORAGE_KEY, raw);
    return { ok: true, bytes: raw.length };
  } catch (e) {
    return { ok: false, error: e?.name === 'QuotaExceededError' ? 'Local Storage is full.' : String(e?.message || e) };
  }
}

/**
 * Returns { dataset, health } where health = { status, persistence, message }.
 * status: ok | initialized | migrated | unavailable | corrupt | incompatible
 */
export function initializeRegistry() {
  const seed = buildSeedDataset();
  const s = storage();
  if (!s) {
    return {
      dataset: normalizeDataset(seed, seed),
      health: { status: 'unavailable', persistence: false, message: 'Local Storage is unavailable. Changes will be lost when this tab closes.' },
    };
  }
  const raw = s.getItem(STORAGE_KEY);
  if (!raw) {
    let ds = normalizeDataset(seed, seed);
    ds = appendSystemActivity(ds, 'Registry initialized', 'Runtime dataset initialized from seed JSON files.');
    const saved = persistDataset(ds);
    return { dataset: ds, health: { status: 'initialized', persistence: saved.ok, message: saved.ok ? 'Initialized from seed data.' : saved.error } };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.applications)) throw new Error('Unexpected structure');
  } catch {
    try { s.setItem(RECOVERY_KEY, raw); } catch { /* keep going: raw stays under the main key */ }
    return {
      dataset: normalizeDataset(seed, seed),
      health: {
        status: 'corrupt', persistence: false,
        message: 'Stored registry data could not be read. It has been left untouched; seed data is shown read-only. Restore a backup or reset in Data Management.',
      },
    };
  }
  if (Number(parsed.schemaVersion) > SCHEMA_VERSION) {
    return {
      dataset: normalizeDataset(parsed, seed),
      health: { status: 'incompatible', persistence: false, message: `Stored data uses schema v${parsed.schemaVersion}, newer than this app (v${SCHEMA_VERSION}). Changes are not saved to avoid overwriting it.` },
    };
  }
  try {
    const { dataset, applied } = migrateDataset(parsed);
    let ds = normalizeDataset(dataset, seed);
    if (applied.length) {
      ds = appendSystemActivity(ds, 'Schema migrated', `Dataset migrated ${applied.join(', ')}; user data preserved.`);
      persistDataset(ds);
      return { dataset: ds, health: { status: 'migrated', persistence: true, message: `Migrated ${applied.join(', ')}.` } };
    }
    return { dataset: ds, health: { status: 'ok', persistence: true, message: 'Loaded from Local Storage.' } };
  } catch (e) {
    return { dataset: normalizeDataset(parsed, seed), health: { status: 'incompatible', persistence: false, message: String(e.message) } };
  }
}

/** Keep counters of locked prefixes (API, ACT) monotonic across reset / restore. */
export function carrySequences(ds, previous) {
  const seq = { ...ds.idSequences };
  for (const [k, v] of Object.entries(previous?.idSequences || {})) seq[k] = Math.max(seq[k] || 0, v);
  return { ...ds, idSequences: seq };
}

/** Reset runtime data to seed. Callers must obtain explicit confirmation first. */
export function resetToSeed(current) {
  const seed = buildSeedDataset();
  let ds = carrySequences(normalizeDataset(seed, seed), current);
  ds = appendSystemActivity(ds, 'Registry reset', 'Runtime data was reset to the seed JSON dataset after explicit confirmation.');
  const saved = persistDataset(ds);
  try { window.localStorage.removeItem(RECOVERY_KEY); } catch { /* ignore */ }
  return { dataset: ds, saved };
}

export function storageUsage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || '';
    return { bytes: raw.length * 2, hasRecovery: !!window.localStorage.getItem(RECOVERY_KEY) };
  } catch {
    return { bytes: 0, hasRecovery: false };
  }
}

export function readRecoveryCopy() {
  try { return window.localStorage.getItem(RECOVERY_KEY); } catch { return null; }
}

