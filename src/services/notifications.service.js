import { ENTITIES, routeFor } from './schema';

export const NOTIFICATIONS_KEY = 'brickhouse.notifications.v1';
export const MAX_NOTIFICATIONS = 50;

const SYSTEM_ACTIVITY_MAP = {
  'Backup exported': { tone: 'success', title: 'Backup exported', to: '/data' },
  'Backup restored': { tone: 'info', title: 'Backup restored', to: '/data' },
  'Registry reset': { tone: 'warning', title: 'Registry reset to seed', to: '/data' },
};

const ENTITY_BY_LABEL = Object.fromEntries(
  Object.entries(ENTITIES).map(([k, def]) => [def.label.toLowerCase(), k]),
);

function getStorage(customStorage) {
  if (customStorage !== undefined) return customStorage;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadNotifications(customStorage) {
  const s = getStorage(customStorage);
  if (!s) return { items: [], dismissedFailedKeys: [] };
  try {
    const raw = s.getItem(NOTIFICATIONS_KEY);
    if (!raw) return { items: [], dismissedFailedKeys: [] };
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed?.items) ? parsed.items.slice(0, MAX_NOTIFICATIONS) : [],
      dismissedFailedKeys: Array.isArray(parsed?.dismissedFailedKeys) ? parsed.dismissedFailedKeys : [],
    };
  } catch {
    return { items: [], dismissedFailedKeys: [] };
  }
}

export function saveNotifications(state, customStorage) {
  const s = getStorage(customStorage);
  if (!s) return;
  try {
    s.setItem(NOTIFICATIONS_KEY, JSON.stringify({
      items: (state.items || []).slice(0, MAX_NOTIFICATIONS),
      dismissedFailedKeys: (state.dismissedFailedKeys || []).slice(-MAX_NOTIFICATIONS),
    }));
  } catch {
    // Ignore storage quota / private mode failures for notification cache.
  }
}

function makeId(prefix = 'n') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function addNotification(state, entry) {
  const item = {
    id: entry.id || makeId(entry.kind || 'n'),
    kind: entry.kind || 'activity',
    tone: entry.tone || 'info',
    title: entry.title || 'Notification',
    message: entry.message || '',
    to: entry.to || null,
    createdAt: entry.createdAt || new Date().toISOString(),
    read: Boolean(entry.read),
  };
  const items = [item, ...(state.items || []).filter((x) => x.id !== item.id)].slice(0, MAX_NOTIFICATIONS);
  return { ...state, items };
}

export function markNotificationRead(state, id) {
  let changed = false;
  const items = (state.items || []).map((item) => {
    if (item.id !== id || item.read) return item;
    changed = true;
    return { ...item, read: true };
  });
  return changed ? { ...state, items } : state;
}

export function markAllNotificationsRead(state) {
  if (!(state.items || []).some((x) => !x.read)) return state;
  return { ...state, items: state.items.map((x) => (x.read ? x : { ...x, read: true })) };
}

function failedKeyOf(id) {
  return String(id || '').startsWith('dep-fail:') ? String(id).slice('dep-fail:'.length) : null;
}

export function removeNotification(state, id) {
  const nextItems = (state.items || []).filter((x) => x.id !== id);
  if (nextItems.length === (state.items || []).length) return state;
  const fk = failedKeyOf(id);
  const dismissedFailedKeys = fk
    ? [...new Set([...(state.dismissedFailedKeys || []), fk])]
    : (state.dismissedFailedKeys || []);
  return { ...state, items: nextItems, dismissedFailedKeys };
}

export function clearNotifications(state, mode = 'all') {
  const current = state.items || [];
  const removed = mode === 'read' ? current.filter((x) => x.read) : current;
  if (!removed.length) return state;
  const kept = mode === 'read' ? current.filter((x) => !x.read) : [];
  const dismissedKeys = removed.map((x) => failedKeyOf(x.id)).filter(Boolean);
  return {
    ...state,
    items: kept,
    dismissedFailedKeys: [...new Set([...(state.dismissedFailedKeys || []), ...dismissedKeys])],
  };
}

/**
 * Keep failed deployment notifications aligned with active `failed` deployment records.
 * Dismissed failed deployments stay hidden until their `updatedAt` / `lastDeployedAt` changes.
 */
export function syncFailedDeployments(state, deployments = []) {
  const failed = (deployments || []).filter((d) => d.status === 'failed');
  const activeMap = new Map(failed.map((d) => [`${d.id}@${d.updatedAt || d.lastDeployedAt || ''}`, d]));
  const dismissed = new Set(state.dismissedFailedKeys || []);

  let changed = false;
  // Drop stale failed deployment alerts that resolved or changed timestamp.
  const keptItems = (state.items || []).filter((item) => {
    const fk = failedKeyOf(item.id);
    if (!fk) return true;
    if (activeMap.has(fk)) return true;
    changed = true;
    return false;
  });

  // Clean up dismissed keys that are no longer failed.
  const nextDismissed = (state.dismissedFailedKeys || []).filter((fk) => activeMap.has(fk));
  if (nextDismissed.length !== (state.dismissedFailedKeys || []).length) changed = true;

  const existingIds = new Set(keptItems.map((x) => x.id));
  const additions = [];
  for (const [fk, d] of activeMap) {
    const notifId = `dep-fail:${fk}`;
    if (existingIds.has(notifId) || dismissed.has(fk)) continue;
    additions.push({
      id: notifId,
      kind: 'deployment',
      tone: 'danger',
      title: `Deployment failed · ${d.name}`,
      message: `${d.environment || 'Deployment'}${d.platform ? ` (${d.platform})` : ''} is currently in failed status.`,
      to: `/deployments/${d.id}`,
      createdAt: d.lastDeployedAt || d.updatedAt || new Date().toISOString(),
      read: false,
    });
    changed = true;
  }

  if (!changed) return state;
  return {
    ...state,
    items: [...additions, ...keptItems].slice(0, MAX_NOTIFICATIONS),
    dismissedFailedKeys: nextDismissed,
  };
}

function routeForActivity(act) {
  if (act.category === 'system') return SYSTEM_ACTIVITY_MAP[act.action]?.to || '/data';
  const entityKey = ENTITY_BY_LABEL[String(act.resourceType || '').toLowerCase()];
  if (!entityKey) {
    return act.applicationId ? `/applications/${act.applicationId}` : null;
  }
  const def = ENTITIES[entityKey];
  if (act.category === 'delete') return def?.route || (act.applicationId ? `/applications/${act.applicationId}` : null);
  if (entityKey === 'endpoints') return act.applicationId ? `/applications/${act.applicationId}` : '/apis';
  if (entityKey === 'companies') return '/settings';
  return (act.resourceId && routeFor(entityKey, act.resourceId)) || def?.route || null;
}

/** Convert newly recorded important registry activities into bell notification items. */
export function notificationsFromActivities(activities = []) {
  const out = [];
  for (const act of activities) {
    if (!act?.id) continue;
    if (act.category === 'system') {
      const meta = SYSTEM_ACTIVITY_MAP[act.action];
      if (!meta) continue;
      out.push({
        id: `act:${act.id}`,
        kind: 'activity',
        tone: meta.tone,
        title: meta.title,
        message: act.description || act.action,
        to: meta.to,
        createdAt: act.timestamp || new Date().toISOString(),
        read: false,
      });
      continue;
    }
    if (!['create', 'delete', 'lifecycle'].includes(act.category)) continue;
    const tone = act.category === 'delete' ? 'warning' : act.category === 'lifecycle' ? 'info' : 'success';
    out.push({
      id: `act:${act.id}`,
      kind: 'activity',
      tone,
      title: act.action || 'Registry updated',
      message: act.description || '',
      to: routeForActivity(act),
      createdAt: act.timestamp || new Date().toISOString(),
      read: false,
    });
  }
  return out;
}
