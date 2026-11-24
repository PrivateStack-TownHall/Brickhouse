import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';

/** Two-column shortcut tiles. items: [{ to, label, icon, count? }] */
export default function QuickLinkGrid({ items }) {
  return (
    <div className="bh-quick">
      {items.map(({ to, label, icon: Icon, count }) => (
        <Link key={to} to={to}>
          {Icon && <Icon size={21} color="var(--bh-orange)" />}
          <span className="text-truncate">{label}</span>
          {count !== undefined && <span className="bh-chip ms-auto">{count}</span>}
          <ChevronRight size={17} className={count !== undefined ? 'text-muted' : 'chev'} />
        </Link>
      ))}
    </div>
  );
}
