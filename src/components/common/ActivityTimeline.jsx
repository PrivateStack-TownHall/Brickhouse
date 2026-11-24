import { Plus, Pencil, Trash2, RefreshCcw, Link2, Settings2 } from 'lucide-react';
import { ACTIVITY_CATEGORIES } from '../../services/activity.service';
import { useFormat } from '../../hooks/useFormat';
import EmptyState from './EmptyState';

const ICONS = { create: [Plus, 'success'], update: [Pencil, 'info'], delete: [Trash2, 'danger'], lifecycle: [RefreshCcw, 'warning'], relationship: [Link2, 'orange'], system: [Settings2, 'gray'] };

export default function ActivityTimeline({ activities, empty = 'No activity recorded yet.' }) {
  const fmt = useFormat();
  if (!activities.length) return <EmptyState title={empty} />;
  return (
    <div className="d-flex flex-column gap-3">
      {activities.map((a) => {
        const [Icon, tone] = ICONS[a.category] || ICONS.system;
        return (
          <div key={a.id} className="d-flex gap-3">
            <span className={`bh-rel-icon bh-tone-${tone}`}><Icon size={15} /></span>
            <div className="min-w-0">
              <div className="fw-semibold">{a.action} <span className="bh-id ms-1">{a.resourceId}</span></div>
              <div className="text-muted small">{a.description}</div>
              <div className="text-subtle" style={{ fontSize: 12 }}>{fmt.dateTime(a.timestamp)} · {a.actor} · {ACTIVITY_CATEGORIES[a.category]}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
