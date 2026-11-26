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
  syncRegistryNotifications,
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
  const [state, setState] = useState(() => syncRegistryNotifications(loadNotifications(), data));
  const lastStorageError = useRef(null);

  // Persist changes to localStorage whenever state updates.
  useEffect(() => {
    saveNotifications(state);
  }, [state]);

  // Keep notifications synchronized with registry deployments, repositories, commits, and activities.
  useEffect(() => {
    setState((prev) => syncRegistryNotifications(prev, data));
  }, [data.deployments, data.repositories, data.commits, data.activities]);

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
