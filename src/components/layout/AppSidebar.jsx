import { NavLink } from 'react-router';
import Logo from '../common/Logo';
import { NAV_GROUPS } from './navigation';
import { APP_VERSION } from '../../services/schema';
import skyline from '../../assets/images/sidebar-skyline.png';

export default function AppSidebar({ open, onNavigate, organization }) {
  return (
    <aside className={`bh-sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
      <Logo />
      <nav className="bh-nav">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <div className="bh-nav-group">{g.label}</div>
            {g.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `bh-nav-link ${isActive ? 'active' : ''}`} onClick={onNavigate}>
                <Icon size={18} />{label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="bh-sidebar-art" style={{ backgroundImage: `url(${skyline})` }} aria-hidden />
      <div className="bh-sidebar-foot">{organization} · v{APP_VERSION} · local-first</div>
    </aside>
  );
}
