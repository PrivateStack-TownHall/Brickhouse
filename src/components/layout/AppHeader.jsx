import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, Menu, CheckCheck, Compass, ExternalLink, Activity, Settings, X,
} from 'lucide-react';
import Breadcrumb from './Breadcrumb';
import GlobalSearch from './GlobalSearch';
import { useRegistry } from '../../hooks/useRegistry';
import { useNotifications } from '../../hooks/useNotifications';
import { useFormat } from '../../hooks/useFormat';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { DEFAULT_LIGHTHOUSE_URL } from '../../constants/registry';
import { NOTIFICATION_KIND_META } from '../../constants/ui';

export default function AppHeader({ onMenu }) {
  const { data } = useRegistry();
  const { notifications, unreadCount, markRead, markAllRead, removeNotification, clearNotifications } = useNotifications();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(null);
  const [tab, setTab] = useState('all');
  const close = useCallback(() => setMenu(null), []);
  const notifRef = useOutsideClick(close);
  const visibleNotes = useMemo(
    () => (tab === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, tab],
  );
  const lighthouseUrl = data.settings?.general?.lighthouseUrl || DEFAULT_LIGHTHOUSE_URL;

  const onOpenNote = (n) => {
    markRead(n.id);
    close();
    if (n.to) navigate(n.to);
  };

  return (
    <header className="bh-header">
      <button type="button" className="bh-icon-btn d-lg-none" onClick={onMenu} aria-label="Open navigation"><Menu size={18} /></button>
      <div className="flex-shrink-1 min-w-0 me-2 d-none d-sm-block"><Breadcrumb /></div>
      <div className="flex-grow-1 d-flex justify-content-center px-2">
        <GlobalSearch />
      </div>
      <div className="position-relative" ref={notifRef}>
        <button type="button" className="bh-icon-btn" aria-label={`Notifications (${unreadCount} unread)`} onClick={() => setMenu(menu === 'n' ? null : 'n')}>
          <Bell size={18} />
          {unreadCount > 0 && <span className="bh-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>
        <AnimatePresence>
          {menu === 'n' && (
            <motion.div
              className="bh-dropdown bh-notif-menu"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <div className="bh-notif-head">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold" style={{ fontSize: 13.5 }}>Notifications</span>
                  {unreadCount > 0 && <span className="bh-chip">{unreadCount} unread</span>}
                </div>
                <div className="d-flex align-items-center gap-1">
                  {unreadCount > 0 && (
                    <button type="button" className="btn btn-ghost btn-sm py-1 px-2" style={{ fontSize: 12 }} onClick={markAllRead}>
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button type="button" className="btn btn-ghost btn-sm py-1 px-2 text-muted" style={{ fontSize: 12 }} onClick={() => clearNotifications('all')}>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="bh-notif-tabs">
                <button type="button" className={`bh-notif-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
                  All ({notifications.length})
                </button>
                <button type="button" className={`bh-notif-tab ${tab === 'unread' ? 'active' : ''}`} onClick={() => setTab('unread')}>
                  Unread ({unreadCount})
                </button>
              </div>

              <div className="bh-notif-list">
                {visibleNotes.length === 0 ? (
                  <div className="bh-notif-empty">
                    <CheckCheck size={20} color="var(--bh-success)" />
                    <div className="fw-semibold">{tab === 'unread' ? "You're all caught up" : 'No notifications yet'}</div>
                    <div className="text-subtle">Git syncs, failed deployments, errors, and key registry updates appear here.</div>
                  </div>
                ) : (
                  visibleNotes.map((n) => {
                    const Icon = NOTIFICATION_KIND_META[n.kind]?.icon || Activity;
                    return (
                      <div key={n.id} className={`bh-notif-item ${!n.read ? 'unread' : ''}`}>
                        <button type="button" className="bh-notif-btn" onClick={() => onOpenNote(n)}>
                          <span className={`bh-notif-icon bh-tone-${n.tone || 'info'}`}>
                            <Icon size={15} />
                          </span>
                          <span className="flex-grow-1 min-w-0 text-start">
                            <span className="d-flex align-items-center justify-content-between gap-2">
                              <span className="bh-notif-title text-truncate">{n.title}</span>
                              <span className="text-subtle text-nowrap" style={{ fontSize: 11 }}>{fmt.relative(n.createdAt)}</span>
                            </span>
                            {n.message && <span className="bh-notif-msg text-truncate-2">{n.message}</span>}
                          </span>
                          {!n.read && <span className="bh-notif-unread-dot" aria-label="Unread" />}
                        </button>
                        <button
                          type="button"
                          className="bh-notif-remove"
                          aria-label={`Dismiss ${n.title}`}
                          title="Dismiss"
                          onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="bh-notif-foot">
                <Link to="/notifications" className="bh-dropdown-item justify-content-center" style={{ fontSize: 12.5 }} onClick={close}><Bell size={14} />All Notifications</Link>
                <Link to="/settings" className="bh-dropdown-item justify-content-center" style={{ fontSize: 12.5 }} onClick={close}><Settings size={14} />Integrations</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
