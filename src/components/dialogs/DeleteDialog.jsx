import { AlertTriangle, Link2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { ENTITIES, LOCKED_ID_PREFIXES } from '../../services/schema';

/** Delete confirmation that explains dependent relationships before anything is removed. */
export default function DeleteDialog({ target, dependents, onConfirm, onCancel }) {
  if (!target) return null;
  const def = ENTITIES[target.entity];
  const blocked = dependents.blocking.length > 0;
  const linkCount = dependents.links.reduce((n, l) => n + l.records.length, 0);
  return (
    <ConfirmDialog open title={blocked ? `Cannot delete ${def.label.toLowerCase()}` : `Delete ${def.label.toLowerCase()}?`}
      confirmLabel={blocked ? 'Delete' : linkCount ? 'Delete and unlink' : 'Delete'} tone="danger" confirmDisabled={blocked}
      onConfirm={onConfirm} onCancel={onCancel}>
      <p className="mb-3"><strong>{target.record.name || target.record.id}</strong> <span className="bh-id">{target.record.id}</span></p>
      {blocked ? (
        <div className="bh-sample-banner" style={{ background: 'var(--bh-danger-soft)', borderColor: 'rgba(225,85,84,.35)' }}>
          <AlertTriangle size={18} color="var(--bh-danger)" className="flex-shrink-0 mt-1" />
          <div>
            This record is still referenced and cannot be deleted. Reassign or delete these first:
            <ul className="mb-0 mt-2 ps-3">
              {dependents.blocking.map((b) => (
                <li key={b.entity + b.field}>{b.records.length} {ENTITIES[b.entity].plural.toLowerCase()}: {b.records.slice(0, 5).map((r) => r.id).join(', ')}{b.records.length > 5 ? '…' : ''}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <>
          <p className="text-muted mb-2">This permanently removes the record from the registry. {LOCKED_ID_PREFIXES.includes(def.prefix) ? `${def.label} IDs are locked: ${target.id} will never be reused.` : `Its ID becomes free and will be given to the next new ${def.label.toLowerCase()}.`}</p>
          {(linkCount > 0 || dependents.optional.length > 0 || dependents.cascade.length > 0) && (
            <div className="bh-sample-banner">
              <Link2 size={18} className="flex-shrink-0 mt-1" />
              <div>
                The following will also be updated:
                <ul className="mb-0 mt-2 ps-3">
                  {dependents.links.map((l) => <li key={l.relation}>{l.records.length} × {l.label} link removed</li>)}
                  {dependents.cascade.map((c) => <li key={c.entity}>{c.records.length} {ENTITIES[c.entity].plural.toLowerCase()} removed</li>)}
                  {dependents.optional.map((o) => <li key={o.entity + o.field}>{o.records.length} {ENTITIES[o.entity].plural.toLowerCase()}: “{o.field}” cleared</li>)}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </ConfirmDialog>
  );
}
