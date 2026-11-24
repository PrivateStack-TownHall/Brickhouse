import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, action }) {
  return (
    <div className="bh-empty">
      <span className="bh-empty-icon"><Icon size={22} /></span>
      <div className="fw-semibold" style={{ color: 'var(--bh-text)' }}>{title}</div>
      {message && <div className="small mt-1">{message}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
