import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Bell, Menu, Settings, Database, ShieldCheck, AlertTriangle, ChevronDown } from 'lucide-react';
import Breadcrumb from './Breadcrumb';
import GlobalSearch from './GlobalSearch';
import { useRegistry } from '../../hooks/useRegistry';
import { validateDataset } from '../../services/validation.service';

function useOutside(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return ref;
}

export default function AppHeader({ onMenu }) {
  const { data, health } = useRegistry();
  const [menu, setMenu] = useState(null);
  const close = () => setMenu(null);
  const notifRef = useOutside(close);
  const profileRef = useOutside(close);
  const issues = useMemo(() => validateDataset(data), [data]);
  const notes = [
    ...(!health.persistence || health.status === 'error' ? [{ key: 'storage', tone: 'danger', text: health.message }] : []),
    ...issues.filter((i) => i.severity === 'error').slice(0, 5).map((i, n) => ({ key: `i${n}`, tone: 'danger', text: i.message })),
    ...(() => { const n = data.repositories.filter((r) => r.accessStatus === 'inaccessible').length; return n ? [{ key: 'access', tone: 'warning', text: `${n} repositor${n === 1 ? 'y is' : 'ies are'} inaccessible (404) — see Repositories → Access Issues.` }] : []; })(),
    ...(!data.meta?.lastBackupAt ? [{ key: 'backup', tone: 'warning', text: 'No backup has been exported yet.' }] : []),
  ];
  const name = data.settings.general.ownerName || 'Registry Owner';
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <header className="bh-header">
      <button type="button" className="bh-icon-btn d-lg-none" onClick={onMenu} aria-label="Open navigation"><Menu size={18} /></button>
      <div className="flex-grow-1 min-w-0"><Breadcrumb /></div>
      <GlobalSearch />
      <div className="position-relative" ref={notifRef}>
        <button type="button" className="bh-icon-btn" aria-label={`Notifications (${notes.length})`} onClick={() => setMenu(menu === 'n' ? null : 'n')}>
          <Bell size={18} />{notes.length > 0 && <span className="bh-dot" />}
        </button>
        {menu === 'n' && (
          <div className="bh-dropdown" style={{ width: 340 }}>
            <div className="small-caps px-2 py-1">Registry notifications</div>
            {notes.length === 0 && <div className="d-flex gap-2 p-2 small"><ShieldCheck size={16} color="var(--bh-success)" />All integrity checks pass.</div>}
            {notes.map((n) => (
              <div key={n.key} className="d-flex gap-2 p-2 small"><AlertTriangle size={16} className="flex-shrink-0" color={`var(--bh-${n.tone})`} />{n.text}</div>
            ))}
            <Link to="/data" className="bh-dropdown-item mt-1" onClick={close}><Database size={16} />Open Data Management</Link>
          </div>
        )}
      </div>
      <div className="position-relative" ref={profileRef}>
        <button type="button" className="btn btn-ghost px-1" onClick={() => setMenu(menu === 'p' ? null : 'p')} aria-label="Profile menu">
          <span className="bh-avatar">{initials}</span><ChevronDown size={15} className="d-none d-sm-inline" />
        </button>
        {menu === 'p' && (
          <div className="bh-dropdown">
            <div className="px-2 py-1">
              <div className="fw-semibold">{name}</div>
              <div className="text-subtle small">Single-user local workspace</div>
            </div>
            <hr className="my-2" />
            <Link to="/settings" className="bh-dropdown-item" onClick={close}><Settings size={16} />Settings</Link>
            <Link to="/data" className="bh-dropdown-item" onClick={close}><Database size={16} />Data Management</Link>
          </div>
        )}
      </div>
    </header>
  );
}
