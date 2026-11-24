// Stable IDs in PREFIX-001 format.
// A new record gets the lowest number not currently used by its collection, so IDs freed by a
// delete are given out again and numbering has no gaps. Prefixes in LOCKED_ID_PREFIXES use a
// persistent counter instead and are never reused. IDs are never derived from array length,
// and an existing record's ID never changes.
import { ENTITIES, RELATIONS, LOCKED_ID_PREFIXES } from './schema';

const COLLECTION_BY_PREFIX = Object.fromEntries([
  ...Object.entries(ENTITIES).map(([k, d]) => [d.prefix, k]),
  ...Object.entries(RELATIONS).map(([k, d]) => [d.prefix, k]),
]);

export function formatId(prefix, n) {
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

export function parseIdNumber(id) {
  const m = /-(\d+)$/.exec(String(id || ''));
  return m ? Number(m[1]) : 0;
}

/** Keep every counter at least as high as the highest ID present (counters record the highest
 * number ever issued; they drive allocation only for locked prefixes). */
export function reconcileSequences(ds) {
  const seq = { ...(ds.idSequences || {}) };
  const scan = (rows, prefix) => {
    let max = seq[prefix] || 0;
    for (const r of rows || []) {
      if (String(r.id).startsWith(prefix + '-')) max = Math.max(max, parseIdNumber(r.id));
    }
    seq[prefix] = max;
  };
  Object.entries(ENTITIES).forEach(([key, def]) => scan(ds[key], def.prefix));
  Object.entries(RELATIONS).forEach(([key, def]) => scan(ds[key], def.prefix));
  return { ...ds, idSequences: seq };
}

/** The number the next record with this prefix will get. */
export function nextIdNumber(ds, prefix) {
  const seq = ds.idSequences || {};
  if (LOCKED_ID_PREFIXES.includes(prefix)) return (seq[prefix] || 0) + 1;
  const used = new Set((ds[COLLECTION_BY_PREFIX[prefix]] || []).map((r) => (String(r.id).startsWith(`${prefix}-`) ? parseIdNumber(r.id) : 0)));
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

/** Reserve the next ID for a prefix inside a transaction draft. */
export function reserveId(draft, prefix) {
  const n = nextIdNumber(draft, prefix);
  draft.idSequences = { ...(draft.idSequences || {}), [prefix]: Math.max((draft.idSequences || {})[prefix] || 0, n) };
  return formatId(prefix, n);
}
