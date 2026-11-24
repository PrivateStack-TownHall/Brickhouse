import { Link } from 'react-router';
import { routeFor } from '../../services/schema';

/** Link to a record's detail page; falls back to plain text. */
export default function EntityLink({ entity, record, children, showId = false, className = '' }) {
  if (!record) return <span className="text-subtle">—</span>;
  const to = routeFor(entity, record.id);
  const content = children || (
    <>{record.name}{showId && <span className="bh-id ms-2">{record.id}</span>}</>
  );
  return to ? <Link to={to} className={`fw-semibold ${className}`}>{content}</Link> : <span className={className}>{content}</span>;
}
