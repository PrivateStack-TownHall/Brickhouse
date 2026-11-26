import { ENTITIES, routeFor } from './schema';
import seedNotifications from '../../database/system/notifications.json';

export const NOTIFICATIONS_KEY = 'brickhouse.notifications.v1';
export const MAX_NOTIFICATIONS = 50;
const MAX_DISMISSED = 200;

const SYSTEM_ACTIVITY_MAP = {
  'Workbook imported': { tone: 'info', title: 'Workbook imported', to: '/data' },
  'Registry initialized': { tone: 'info', title: 'Registry initialized', to: '/data' },
  'Schema migrated': { tone: 'info', title: 'Schema migrated', to: '/data' },
  'Backup exported': { tone: 'success', title: 'Backup exported', to: '/data' },
  'Backup restored': { tone: 'info', title: 'Backup restored', to: '/data' },
  'Registry reset': { tone: 'warning', title: 'Registry reset to seed', to: '/data' },
  'Integration saved': { tone: 'info', title: 'Integration saved', to: '/settings' },
  'Integration removed': { tone: 'warning', title: 'Integration removed', to: '/settings' },
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

function emptyState() {
  return { items: [], dismissedIds: [], dismissedFailedKeys: [], clearedAt: null };
}

export function loadNotifications(customStorage) {
  const s = getStorage(customStorage);
  if (!s) return emptyState();
  try {
    const raw = s.getItem(NOTIFICATIONS_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items)
      ? parsed.items.filter((x) => !String(x?.id || '').startsWith('sample-')).slice(0, MAX_NOTIFICATIONS)
      : [];
    return {
      items,
      dismissedIds: Array.isArray(parsed?.dismissedIds) ? parsed.dismissedIds.slice(-MAX_DISMISSED) : [],
      dismissedFailedKeys: Array.isArray(parsed?.dismissedFailedKeys) ? parsed.dismissedFailedKeys : [],
      clearedAt: typeof parsed?.clearedAt === 'string' ? parsed.clearedAt : null,
    };
  } catch {
    return emptyState();
  }
}

export function saveNotifications(state, customStorage) {
  const s = getStorage(customStorage);
  if (!s) return;
  try {
    s.setItem(NOTIFICATIONS_KEY, JSON.stringify({
      items: (state.items || []).slice(0, MAX_NOTIFICATIONS),
      dismissedIds: (state.dismissedIds || []).slice(-MAX_DISMISSED),
      dismissedFailedKeys: (state.dismissedFailedKeys || []).slice(-MAX_NOTIFICATIONS),
      clearedAt: state.clearedAt || null,
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
  const dismissedIds = [...new Set([...(state.dismissedIds || []), id])].slice(-MAX_DISMISSED);
  return { ...state, items: nextItems, dismissedIds, dismissedFailedKeys };
}

export function clearNotifications(state, mode = 'all') {
  const current = state.items || [];
  const removed = mode === 'read' ? current.filter((x) => x.read) : current;
  if (!removed.length) return state;
  const kept = mode === 'read' ? current.filter((x) => !x.read) : [];
  const removedIds = removed.map((x) => x.id).filter(Boolean);
  const dismissedKeys = removed.map((x) => failedKeyOf(x.id)).filter(Boolean);
  return {
    ...state,
    items: kept,
    dismissedIds: [...new Set([...(state.dismissedIds || []), ...removedIds])].slice(-MAX_DISMISSED),
    dismissedFailedKeys: [...new Set([...(state.dismissedFailedKeys || []), ...dismissedKeys])],
    clearedAt: mode === 'all' ? new Date().toISOString() : state.clearedAt || null,
  };
}

function sortByNewest(items) {
  return [...items].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

function isBeforeClear(iso, clearedAt) {
  if (!clearedAt || !iso) return false;
  const ts = Date.parse(iso);
  const cut = Date.parse(clearedAt);
  return Number.isFinite(ts) && Number.isFinite(cut) && ts <= cut;
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
  const dismissedIds = new Set(state.dismissedIds || []);
  const additions = [];
  for (const [fk, d] of activeMap) {
    const notifId = `dep-fail:${fk}`;
    if (existingIds.has(notifId) || dismissed.has(fk) || dismissedIds.has(notifId)) continue;
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
    items: sortByNewest([...additions, ...keptItems]).slice(0, MAX_NOTIFICATIONS),
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

/** Convert important registry activities into bell notification items. */
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

/** Derive notifications from existing repository sync snapshots and inaccessible repository states. */
function buildRepositoryNotifications(repositories = [], commits = [], existingItems = []) {
  const additions = [];
  const commitsByRepo = new Map();
  for (const c of commits || []) {
    if (!c?.repositoryId) continue;
    commitsByRepo.set(c.repositoryId, (commitsByRepo.get(c.repositoryId) || 0) + 1);
  }

  const syncGroups = new Map();
  for (const r of repositories || []) {
    if (!r?.syncedAt) continue;
    const groupKey = r.organization || r.provider || 'Git';
    if (!syncGroups.has(groupKey)) syncGroups.set(groupKey, []);
    syncGroups.get(groupKey).push(r);
  }

  const liveSyncTimes = (existingItems || [])
    .filter((n) => n.kind === 'sync' && !String(n.id || '').startsWith('repo-sync:') && !String(n.id || '').startsWith('repo-inacc:'))
    .map((n) => Date.parse(n.createdAt))
    .filter(Number.isFinite);

  for (const [org, repos] of syncGroups) {
    const latestSyncedAt = repos.map((r) => r.syncedAt).filter(Boolean).sort().pop();
    if (!latestSyncedAt) continue;
    const latestMs = Date.parse(latestSyncedAt);
    if (Number.isFinite(latestMs) && liveSyncTimes.some((t) => Math.abs(t - latestMs) < 60_000)) continue;
    const totalCommits = repos.reduce((sum, r) => sum + (commitsByRepo.get(r.id) || 0), 0);
    const totalBranches = repos.reduce((sum, r) => sum + (Array.isArray(r.syncedBranches) ? r.syncedBranches.length : 0), 0);
    const totalPrs = repos.reduce((sum, r) => sum + (Array.isArray(r.syncedPrs) ? r.syncedPrs.length : 0), 0);
    additions.push({
      id: `repo-sync:${org}@${latestSyncedAt}`,
      kind: 'sync',
      tone: 'success',
      title: `Git sync · ${org}`,
      message: `${repos.length} repositories synced · ${totalCommits} commits · ${totalBranches} branches · ${totalPrs} PRs.`,
      to: '/settings',
      createdAt: latestSyncedAt,
      read: false,
    });
  }

  const inaccessible = (repositories || []).filter((r) => r?.accessStatus === 'inaccessible');
  let activeInaccId = null;
  if (inaccessible.length) {
    const sig = inaccessible.map((r) => r.id).sort().join(',');
    activeInaccId = `repo-inacc:${sig}`;
    const latestAt = inaccessible.map((r) => r.updatedAt || r.createdAt).filter(Boolean).sort().pop() || new Date().toISOString();
    const previewNames = inaccessible.slice(0, 4).map((r) => r.name).join(', ');
    const more = inaccessible.length > 4 ? ` (+${inaccessible.length - 4} more)` : '';
    additions.push({
      id: activeInaccId,
      kind: 'sync',
      tone: 'warning',
      title: `${inaccessible.length} ${inaccessible.length === 1 ? 'repository' : 'repositories'} inaccessible`,
      message: `${previewNames}${more}. Check access or configure a GitHub token in Settings -> Integrations.`,
      to: inaccessible.length === 1 ? `/repositories/${inaccessible[0].id}` : '/settings',
      createdAt: latestAt,
      read: false,
    });
  }

  return { additions, activeInaccId };
}

/**
 * Reconcile notifications against the active registry dataset (`deployments`, `repositories`, `commits`, `activities`).
 * Idempotent: returns the exact same state reference when nothing changes.
 */
export function syncRegistryNotifications(state, data = {}) {
  let next = syncFailedDeployments(state, data.deployments);
  const dismissedIds = new Set(next.dismissedIds || []);
  const { additions: repoNotes, activeInaccId } = buildRepositoryNotifications(data.repositories, data.commits, next.items);

  let changed = next !== state;
  const activeActivityIds = Array.isArray(data.activities)
    ? new Set(data.activities.map((a) => `act:${a?.id}`).filter(Boolean))
    : null;
  // Drop stale inaccessible-repo notices and activity notices not in the active dataset.
  let keptItems = (next.items || []).filter((item) => {
    const id = String(item?.id || '');
    if (id.startsWith('repo-inacc:')) {
      if (id === activeInaccId) return true;
      changed = true;
      return false;
    }
    if (activeActivityIds && id.startsWith('act:') && !activeActivityIds.has(id)) {
      changed = true;
      return false;
    }
    return true;
  });

  const existingIds = new Set(keptItems.map((x) => x.id));
  const activityNotes = notificationsFromActivities(data.activities || []).slice(-MAX_NOTIFICATIONS);
  const seedNotes = Array.isArray(seedNotifications) ? seedNotifications.filter((x) => x?.id) : [];
  const candidates = [...repoNotes, ...activityNotes, ...seedNotes];
  const additions = [];
  for (const item of candidates) {
    if (existingIds.has(item.id) || dismissedIds.has(item.id)) continue;
    if (isBeforeClear(item.createdAt, next.clearedAt)) continue;
    additions.push(item);
    existingIds.add(item.id);
  }

  if (additions.length) {
    const merged = sortByNewest([...additions, ...keptItems]).slice(0, MAX_NOTIFICATIONS);
    const mergedIds = merged.map((x) => x.id);
    const prevIds = (next.items || []).map((x) => x.id);
    if (mergedIds.length !== prevIds.length || mergedIds.some((id, idx) => id !== prevIds[idx])) {
      keptItems = merged;
      changed = true;
    }
  }

  if (!changed) return state;
  return { ...next, items: keptItems };
}
