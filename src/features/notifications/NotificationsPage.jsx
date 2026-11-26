import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Bell, CheckCheck, Trash2, RefreshCw, AlertTriangle, Rocket, Activity, Search, ExternalLink, X, FilterX, Check,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
import TableFooter from '../../components/tables/TableFooter';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/dialogs/Modal';
import ConfirmDialog from '../../components/dialogs/ConfirmDialog';
import StatusBadge from '../../components/badges/StatusBadge';
import { useNotifications } from '../../hooks/useNotifications';
import { useFormat } from '../../hooks/useFormat';

const KIND_META = {
  sync: { label: 'Git Sync', icon: RefreshCw },
  deployment: { label: 'Deployment', icon: Rocket },
  error: { label: 'Error', icon: AlertTriangle },
  activity: { label: 'Registry', icon: Activity },
};

export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead, removeNotification, clearNotifications } = useNotifications();
  const fmt = useFormat();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all'); // all | unread | read
  const [kind, setKind] = useState('all');     // all | sync | alerts | activity
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'single' | 'read' | 'all', item? }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifications.filter((n) => {
      if (status === 'unread' && n.read) return false;
      if (status === 'read' && !n.read) return false;
      if (kind === 'sync' && n.kind !== 'sync') return false;
      if (kind === 'alerts' && n.kind !== 'error' && n.kind !== 'deployment') return false;
      if (kind === 'activity' && n.kind !== 'activity') return false;
      if (q && !`${n.title} ${n.message}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notifications, search, status, kind]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const syncCount = notifications.filter((n) => n.kind === 'sync').length;
  const alertCount = notifications.filter((n) => n.kind === 'error' || n.kind === 'deployment').length;
  const activityCount = notifications.filter((n) => n.kind === 'activity').length;
  const hasRead = notifications.some((n) => n.read);
  const filtersActive = Boolean(search.trim() || status !== 'all' || kind !== 'all');

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setKind('all');
    setPage(1);
  };

  const summary = [
    {
      key: 'total', label: 'Total Notifications', value: notifications.length, icon: Bell, tone: 'orange',
      onClick: () => { setStatus('all'); setKind('all'); setPage(1); }, active: status === 'all' && kind === 'all',
    },
    {
      key: 'unread', label: 'Unread', value: unreadCount, icon: CheckCheck, tone: 'info',
      onClick: () => { setStatus(status === 'unread' ? 'all' : 'unread'); setPage(1); }, active: status === 'unread',
    },
    {
      key: 'sync', label: 'Git Syncs', value: syncCount, icon: RefreshCw, tone: 'success',
      onClick: () => { setKind(kind === 'sync' ? 'all' : 'sync'); setPage(1); }, active: kind === 'sync',
    },
    {
      key: 'alerts', label: 'Errors & Failed', value: alertCount, icon: AlertTriangle, tone: 'danger',
      onClick: () => { setKind(kind === 'alerts' ? 'all' : 'alerts'); setPage(1); }, active: kind === 'alerts',
    },
    {
      key: 'activity', label: 'Registry Events', value: activityCount, icon: Activity, tone: 'navy',
      onClick: () => { setKind(kind === 'activity' ? 'all' : 'activity'); setPage(1); }, active: kind === 'activity',
    },
  ];

  const openNote = (n) => {
    markRead(n.id);
    setSelected({ ...n, read: true });
  };

  const readCount = notifications.filter((n) => n.read).length;

  const confirmMeta = confirmAction?.type === 'single'
    ? {
        title: 'Dismiss notification?',
        message: `Are you sure you want to remove "${confirmAction.item?.title}" from your notifications?`,
        confirmLabel: 'Dismiss',
      }
    : confirmAction?.type === 'read'
      ? {
          title: 'Clear read notifications?',
          message: `Remove ${readCount} read ${readCount === 1 ? 'notification' : 'notifications'} from the list?`,
          confirmLabel: 'Clear read',
        }
      : {
          title: 'Clear all notifications?',
          message: `Remove all ${notifications.length} ${notifications.length === 1 ? 'notification' : 'notifications'} from the list?`,
          confirmLabel: 'Clear all',
        };

  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'single' && confirmAction.item) {
      removeNotification(confirmAction.item.id);
      if (selected?.id === confirmAction.item.id) setSelected(null);
    } else if (confirmAction.type === 'read') {
      clearNotifications('read');
      if (selected?.read) setSelected(null);
    } else if (confirmAction.type === 'all') {
      clearNotifications('all');
      setSelected(null);
    }
    setConfirmAction(null);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Git sync results, failed deployments, action errors, and key registry events."
        actions={(
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button type="button" className="btn btn-secondary" disabled={unreadCount === 0} onClick={markAllRead}>
              <CheckCheck size={16} />Mark all read
            </button>
            <button type="button" className="btn btn-outline-secondary" disabled={!hasRead} onClick={() => setConfirmAction({ type: 'read' })}>
              Clear read
            </button>
            <button type="button" className="btn btn-outline-danger" disabled={notifications.length === 0} onClick={() => setConfirmAction({ type: 'all' })}>
              <Trash2 size={16} />Clear all
            </button>
          </div>
        )}
      />

      <SummaryCards items={summary} min={160} />

      <div className="bh-card">
        <div className="bh-filterbar">
          <div className="bh-search">
            <Search size={15} />
            <input
              className="form-control form-control-sm"
              placeholder="Search notifications…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            aria-label="Filter by status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="all">Status: All</option>
            <option value="unread">Unread only</option>
            <option value="read">Read only</option>
          </select>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            aria-label="Filter by type"
            value={kind}
            onChange={(e) => { setKind(e.target.value); setPage(1); }}
          >
            <option value="all">Type: All</option>
            <option value="sync">Git Sync</option>
            <option value="alerts">Errors & Failed Deployments</option>
            <option value="activity">Registry Events</option>
          </select>
          {filtersActive && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <FilterX size={15} />Clear filters
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={notifications.length === 0 ? 'No notifications yet' : 'No matching notifications'}
            message={notifications.length === 0
              ? 'Git syncs, failed deployments, errors, and key registry updates will appear here.'
              : 'Try adjusting your search or filter criteria.'}
          />
        ) : (
          <div className="p-2 d-flex flex-column gap-1">
            {visible.map((n) => {
              const meta = KIND_META[n.kind] || KIND_META.activity;
              const Icon = meta.icon;
              return (
                <div key={n.id} className={`bh-notif-item border ${!n.read ? 'unread' : ''}`} style={{ borderColor: 'var(--bh-border)' }}>
                  <button type="button" className="bh-notif-btn" onClick={() => openNote(n)}>
                    <span className={`bh-notif-icon bh-tone-${n.tone || 'info'}`}>
                      <Icon size={16} />
                    </span>
                    <span className="flex-grow-1 min-w-0 text-start">
                      <span className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="bh-notif-title">{n.title}</span>
                        <span className="bh-chip">{meta.label}</span>
                        {!n.read && <span className="bh-notif-unread-dot m-0" aria-label="Unread" />}
                      </span>
                      {n.message && <span className="bh-notif-msg">{n.message}</span>}
                      <span className="text-subtle d-block mt-1" style={{ fontSize: 11.5 }}>
                        {fmt.dateTime(n.createdAt)} · {fmt.relative(n.createdAt)}
                      </span>
                    </span>
                    {n.to && (
                      <span className="text-muted align-self-center px-2 d-none d-sm-inline-flex align-items-center gap-1" style={{ fontSize: 12 }}>
                        Details
                      </span>
                    )}
                  </button>
                  <div className="d-flex align-items-center gap-1 pe-2">
                    {!n.read && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        title="Mark as read"
                        aria-label={`Mark ${n.title} as read`}
                        onClick={() => markRead(n.id)}
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="bh-notif-remove"
                      title="Dismiss"
                      aria-label={`Dismiss ${n.title}`}
                      onClick={() => setConfirmAction({ type: 'single', item: n })}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <TableFooter
          page={safePage}
          pageSize={pageSize}
          total={filtered.length}
          pages={pages}
          onPage={setPage}
          onPageSize={(s) => { setPageSize(s); setPage(1); }}
          noun="notifications"
        />
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected?.title || 'Notification Detail'}
        onClose={() => { if (!confirmAction) setSelected(null); }}
        footer={selected && (
          <>
            <button
              type="button"
              className="btn btn-outline-danger me-auto"
              onClick={() => setConfirmAction({ type: 'single', item: selected })}
            >
              <Trash2 size={15} />Dismiss
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>
              Close
            </button>
            {selected.to && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { const target = selected.to; setSelected(null); navigate(target); }}
              >
                <ExternalLink size={15} />Open Page
              </button>
            )}
          </>
        )}
      >
        {selected && (() => {
          const meta = KIND_META[selected.kind] || KIND_META.activity;
          const Icon = meta.icon;
          return (
            <div className="d-flex flex-column gap-3">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className={`bh-notif-icon bh-tone-${selected.tone || 'info'}`}><Icon size={16} /></span>
                <span className="bh-chip">{meta.label}</span>
                <StatusBadge value={selected.read ? 'active' : 'warning'} label={selected.read ? 'Read' : 'Unread'} dot={false} />
                <span className="text-subtle small ms-auto">{fmt.dateTime(selected.createdAt)}</span>
              </div>
              <div className="p-3 rounded border bg-body-tertiary small" style={{ lineHeight: 1.55 }}>
                {selected.message || selected.title}
              </div>
              {selected.to && (
                <div className="text-subtle small">
                  Target route: <span className="mono">{selected.to}</span>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmMeta.title}
        message={confirmMeta.message}
        confirmLabel={confirmMeta.confirmLabel}
        tone="danger"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
