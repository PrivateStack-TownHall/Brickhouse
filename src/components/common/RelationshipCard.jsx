import { Link } from 'react-router';
import { Unlink } from 'lucide-react';
import EntityIcon from './EntityIcon';
import EmptyState from './EmptyState';
import { routeFor } from '../../services/schema';

/**
 * A titled list of related records.
 * items: [{ key, entity, record, meta, badge, onUnlink }]
 */
export default function RelationshipCard({ title, subtitle, items, emptyText = 'No related records.', action, columns = 1 }) {
  return (
    <div className="bh-card h-100">
      <div className="bh-card-header">
        <div>
          <h3 className="bh-card-title">{title} <span className="text-subtle fw-normal">({items.length})</span></h3>
          {subtitle && <p className="bh-card-sub">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="bh-card-body">
        {items.length === 0 ? <EmptyState title={emptyText} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 10 }}>
            {items.map((it) => <RelationshipRow key={it.key || it.record.id} {...it} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function RelationshipRow({ entity, record, meta, badge, onUnlink }) {
  const to = routeFor(entity, record.id);
  const body = (
    <>
      <EntityIcon entity={entity} boxed />
      <div className="min-w-0 flex-grow-1">
        <div className="fw-semibold text-truncate">{record.name || record.id}</div>
        <div className="text-subtle text-truncate" style={{ fontSize: 12 }}><span className="bh-id">{record.id}</span>{meta && <> · {meta}</>}</div>
      </div>
      {badge}
    </>
  );
  return (
    <div className="d-flex align-items-center gap-2">
      {to ? <Link to={to} className="bh-rel-item flex-grow-1 min-w-0">{body}</Link> : <div className="bh-rel-item flex-grow-1 min-w-0">{body}</div>}
      {onUnlink && (
        <button type="button" className="btn btn-ghost btn-icon" title="Unlink" aria-label={`Unlink ${record.name}`} onClick={onUnlink}><Unlink size={15} /></button>
      )}
    </div>
  );
}
