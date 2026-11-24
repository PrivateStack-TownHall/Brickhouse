// Full JSON backup: all entities, relationship collections, catalog, settings,
// activity log, ID sequences and schema version.
import { APP_VERSION, SCHEMA_VERSION, ENTITY_KEYS, RELATION_KEYS } from './schema';

export function buildBackup(ds) {
  const data = { schemaVersion: SCHEMA_VERSION };
  for (const k of [...ENTITY_KEYS, ...RELATION_KEYS]) data[k] = ds[k] || [];
  data.categories = ds.categories;
  data.settings = ds.settings;
  data.idSequences = ds.idSequences;
  data.meta = ds.meta;
  const counts = Object.fromEntries([...ENTITY_KEYS, ...RELATION_KEYS].map((k) => [k, (ds[k] || []).length]));
  return {
    format: 'brickhouse-backup',
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    organization: ds.settings?.general?.organization || 'VSG Group',
    counts,
    data,
  };
}

export function backupFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `brickhouse-backup-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
