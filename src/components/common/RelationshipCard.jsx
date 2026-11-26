import { Link } from 'react-router';
import { Unlink } from 'lucide-react';
import EntityIcon, { ENTITY_ICONS } from './EntityIcon';
import Avatar from './Avatar';
import EmptyState from './EmptyState';
import SectionCard from './SectionCard';
import { routeFor } from '../../services/schema';
import { resolveLogo } from '../../assets/logos';

const TITLE_ICONS = [
  [/repositor/i, 'repositories'],
  [/component|depends on|included/i, 'components'],
  [/api|provided|consumed/i, 'apis'],
  [/infrastruct|resource/i, 'infrastructure'],
  [/deploy/i, 'deployments'],
  [/tech/i, 'technologies'],
  [/application/i, 'applications'],
];

export default function RelationshipCard({ icon: Icon, entity, title, subtitle, items, emptyText = 'No related records.', action, columns = 1 }) {
  const inferredEntity = entity || items?.[0]?.entity || TITLE_ICONS.find(([re]) => re.test(title || ''))?.[1];
  const HeaderIcon = Icon || (inferredEntity ? ENTITY_ICONS[inferredEntity] : null);
  return (
    <SectionCard variant="colored" icon={HeaderIcon} title={title} subtitle={subtitle} count={items.length} actions={action}>
      {items.length === 0 ? <EmptyState title={emptyText} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 10 }}>
          {items.map((it) => <RelationshipRow key={it.key || it.record.id} {...it} />)}
        </div>
      )}
    </SectionCard>
  );
}

export function RelationshipRow({ entity, record, avatarSrc, meta, badge, onUnlink }) {
  const to = routeFor(entity, record.id);
  const customLogo = entity === 'apis'
    ? undefined
    : (avatarSrc || record.logoUrl || (entity === 'infrastructure' ? resolveLogo(record.provider) : undefined) || resolveLogo(record.name, record.id));
  const body = (
    <>
      {customLogo ? <Avatar name={record.name} seed={record.id} src={customLogo} size={28} /> : <EntityIcon entity={entity} boxed />}
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
