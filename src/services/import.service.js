// JSON restore: parse → validate structure → migrate → validate integrity → preview.
// Nothing replaces the runtime data until the user confirms the preview.
import { validateBackup, validateDataset } from './validation.service';
import { migrateDataset, normalizeDataset, appendSystemActivity, carrySequences } from './storage.service';
import { ENTITY_KEYS, RELATION_KEYS } from './schema';

export async function readBackupFile(file) {
  const text = await file.text();
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
  const structure = validateBackup(obj);
  if (!structure.ok) return { ok: false, errors: structure.errors };
  let dataset;
  try {
    const { dataset: migrated } = migrateDataset({ ...obj.data, schemaVersion: obj.data.schemaVersion || obj.schemaVersion });
    dataset = normalizeDataset(migrated);
  } catch (e) {
    return { ok: false, errors: [String(e.message || e)] };
  }
  const issues = validateDataset(dataset);
  const errors = issues.filter((i) => i.severity === 'error');
  const counts = Object.fromEntries([...ENTITY_KEYS, ...RELATION_KEYS].map((k) => [k, dataset[k].length]));
  return {
    ok: errors.length === 0,
    errors: errors.map((e) => e.message),
    warnings: issues.filter((i) => i.severity === 'warning').map((w) => w.message),
    dataset,
    counts,
    exportedAt: obj.exportedAt || null,
    fileName: file.name,
  };
}

export function finalizeRestore(dataset, fileName, current) {
  const at = new Date().toISOString();
  const ds = { ...carrySequences(dataset, current), meta: { ...dataset.meta, lastRestoreAt: at, source: `backup:${fileName}` } };
  return appendSystemActivity(ds, 'Backup restored', `Runtime data replaced from backup file "${fileName}" after validation and confirmation.`);
}
