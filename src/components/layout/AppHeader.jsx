import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Bell, Menu, Database, ShieldCheck, AlertTriangle, Compass, ExternalLink } from 'lucide-react';
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
  const issues = useMemo(() => validateDataset(data), [data]);
  const notes = [
    ...(!health.persistence || health.status === 'error' ? [{ key: 'storage', tone: 'danger', text: health.message }] : []),
    ...issues.filter((i) => i.severity === 'error').slice(0, 5).map((i, n) => ({ key: `i${n}`, tone: 'danger', text: i.message })),
    ...(() => { const n = data.repositories.filter((r) => r.accessStatus === 'inaccessible').length; return n ? [{ key: 'access', tone: 'warning', text: `${n} repositor${n === 1 ? 'y is' : 'ies are'} inaccessible (404) — see Repositories → Access Issues.` }] : []; })(),
    ...(!data.meta?.lastBackupAt ? [{ key: 'backup', tone: 'warning', text: 'No backup has been exported yet.' }] : []),
  ];
  const lighthouseUrl = data.settings?.general?.lighthouseUrl || 'http://localhost:5174';

  return (
    <header className="bh-header">
      <button type="button" className="bh-icon-btn d-lg-none" onClick={onMenu} aria-label="Open navigation"><Menu size={18} /></button>
      <div className="flex-shrink-1 min-w-0 me-2 d-none d-sm-block"><Breadcrumb /></div>
      <div className="flex-grow-1 d-flex justify-content-center px-2">
        <GlobalSearch />
      </div>
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
      <div className="d-flex align-items-center">
        <a
          href={lighthouseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary d-inline-flex align-items-center gap-2 bh-lighthouse-btn"
          title="Open Lighthouse"
        >
          <Compass size={17} />
          <span>Lighthouse</span>
          <ExternalLink size={13} className="opacity-75" />
        </a>
      </div>
    </header>
  );
}
