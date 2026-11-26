import { ACTIVITY_CATEGORIES } from '../../services/activity.service';
import { ACTIVITY_CATEGORY_STYLES } from '../../constants/ui';
import { useFormat } from '../../hooks/useFormat';
import EmptyState from './EmptyState';

export default function ActivityTimeline({ activities, empty = 'No activity recorded yet.' }) {
  const fmt = useFormat();
  if (!activities.length) return <EmptyState title={empty} />;
  return (
    <div className="d-flex flex-column gap-3">
      {activities.map((a) => {
        const [Icon, tone] = ACTIVITY_CATEGORY_STYLES[a.category] || ACTIVITY_CATEGORY_STYLES.system;
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
