import { Link, useLocation, useMatches } from 'react-router';
import { Home } from 'lucide-react';
import { useRegistry } from '../../hooks/useRegistry';
import { NAV_GROUPS } from './navigation';
import { titleCase } from '../../helpers';

/** "Group / Page / Record" breadcrumbs. Crumbs come from each route's handle.crumb. */
export default function Breadcrumb() {
  const matches = useMatches();
  const { pathname } = useLocation();
  const { data } = useRegistry();
  const crumbs = matches
    .filter((m) => m.handle?.crumb)
    .map((m) => ({ to: m.pathname, label: typeof m.handle.crumb === 'function' ? m.handle.crumb(m.params, data) : m.handle.crumb }));
  const first = `/${pathname.split('/')[1] || ''}`;
  const group = NAV_GROUPS.find((g) => g.items.some((i) => (i.to === '/' ? first === '/' : first === i.to)));
  return (
    <nav className="bh-breadcrumb" aria-label="Breadcrumb">
      <Link to="/" aria-label="Overview"><Home size={19} /></Link>
      {group && <span className="group">{titleCase(group.label.toLowerCase())}</span>}
      {crumbs.map((c, i) => (
        <span key={c.to + i} className="d-inline-flex align-items-center gap-2 min-w-0">
          <span className="sep">/</span>
          {i === crumbs.length - 1 ? <span className="current">{c.label}</span> : <Link to={c.to}>{c.label}</Link>}
        </span>
      ))}
    </nav>
  );
}
