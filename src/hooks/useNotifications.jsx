import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRegistry } from './useRegistry';
import {
  loadNotifications,
  saveNotifications,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  clearNotifications,
  syncFailedDeployments,
  notificationsFromActivities,
} from '../services/notifications.service';

const noop = () => {};
const NotificationsContext = createContext({
  notifications: [],
  unreadCount: 0,
  notify: noop,
  markRead: noop,
  markAllRead: noop,
  removeNotification: noop,
  clearNotifications: noop,
});

export function NotificationsProvider({ children }) {
  const { data, health } = useRegistry();
  const [state, setState] = useState(() => syncFailedDeployments(loadNotifications(), data.deployments));
  const seenActivityIds = useRef(new Set((data.activities || []).map((a) => a.id)));
  const lastStorageError = useRef(null);

  // Persist changes to localStorage whenever state updates.
  useEffect(() => {
    saveNotifications(state);
  }, [state]);

  // Keep failed deployment alerts in sync with dataset changes.
  useEffect(() => {
    setState((prev) => syncFailedDeployments(prev, data.deployments));
  }, [data.deployments]);

  // Capture newly appended important activities (Create, Delete, Lifecycle, Backup/Restore/Reset)
  // while keeping historical seed activities out of the initial unread feed.
  useEffect(() => {
    const incoming = (data.activities || []).filter((a) => a?.id && !seenActivityIds.current.has(a.id));
    if (!incoming.length) return;
    for (const a of incoming) seenActivityIds.current.add(a.id);
    const items = notificationsFromActivities(incoming);
    if (!items.length) return;
    setState((prev) => items.reduce((acc, item) => addNotification(acc, item), prev));
  }, [data.activities]);

  // Surface active storage write errors as actionable notifications.
  useEffect(() => {
    if (health?.status === 'error' && health.message && lastStorageError.current !== health.message) {
      lastStorageError.current = health.message;
      setState((prev) => addNotification(prev, {
        kind: 'error',
        tone: 'danger',
        title: 'Storage error',
        message: health.message,
        to: '/data',
      }));
    } else if (health?.status !== 'error') {
      lastStorageError.current = null;
    }
  }, [health]);

  const notify = useCallback((entry) => {
    if (!entry) return;
    setState((prev) => addNotification(prev, entry));
  }, []);

  const markRead = useCallback((id) => {
    setState((prev) => markNotificationRead(prev, id));
  }, []);

  const markAllRead = useCallback(() => {
    setState((prev) => markAllNotificationsRead(prev));
  }, []);

  const remove = useCallback((id) => {
    setState((prev) => removeNotification(prev, id));
  }, []);

  const clear = useCallback((mode = 'all') => {
    setState((prev) => clearNotifications(prev, mode));
  }, []);

  const value = useMemo(() => ({
    notifications: state.items,
    unreadCount: state.items.filter((x) => !x.read).length,
    notify,
    markRead,
    markAllRead,
    removeNotification: remove,
    clearNotifications: clear,
  }), [state.items, notify, markRead, markAllRead, remove, clear]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
