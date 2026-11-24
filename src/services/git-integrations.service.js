import { transaction } from './registry.service';
import { logActivity } from './activity.service';

export const GIT_PROVIDERS = [
  { key: 'github', label: 'GitHub', apiBaseUrl: 'https://api.github.com' },
  { key: 'gitlab', label: 'GitLab', apiBaseUrl: 'https://gitlab.com/api/v4' },
  { key: 'bitbucket', label: 'Bitbucket', apiBaseUrl: 'https://api.bitbucket.org/2.0' },
];

export function integrationConnections(settings = {}) {
  if (Array.isArray(settings.connections)) return settings.connections;
  return GIT_PROVIDERS.filter((p) => settings[p.key]?.organization || settings[p.key]?.notes).map((p) => ({
    ...settings[p.key], id: `legacy-${p.key}`, provider: p.key,
    name: `${p.label} · ${settings[p.key].organization || 'Default'}`,
  }));
}

function apiBase(connection) {
  const base = new URL(connection.apiBaseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('Use an HTTPS API URL without credentials, query parameters or fragments.');
  base.pathname = base.pathname.replace(/\/+$/, '');
  if (connection.provider === 'github' && base.href !== 'https://api.github.com/' && !base.pathname.endsWith('/api/v3')) throw new Error('Use api.github.com or a GitHub Enterprise URL ending in /api/v3.');
  if (connection.provider === 'gitlab' && !base.pathname.endsWith('/api/v4')) throw new Error('GitLab API URLs must end in /api/v4.');
  if (connection.provider === 'bitbucket' && base.href !== 'https://api.bitbucket.org/2.0') throw new Error('Use the Bitbucket Cloud API: https://api.bitbucket.org/2.0.');
  return base.href.replace(/\/$/, '');
}

function webBase(connection) {
  const base = apiBase(connection);
  if (base === 'https://api.github.com') return 'https://github.com/';
  if (connection.provider === 'bitbucket') return 'https://bitbucket.org/';
  return `${base.replace(/\/api\/v[34]$/, '')}/`;
}

export function validateIntegration(connection) {
  const errors = {};
  if (!GIT_PROVIDERS.some((p) => p.key === connection.provider)) errors.provider = 'Choose a supported Git provider.';
  if (!connection.name?.trim()) errors.name = 'Enter a name for this integration.';
  if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(connection.organization?.trim() || '')) errors.organization = 'Enter an organization, user or group path (for example team/platform).';
  try { apiBase(connection); } catch (e) { errors.apiBaseUrl = e instanceof TypeError ? 'Enter a valid API URL.' : e.message; }
  return errors;
}

function repositoryPath(repo, connection) {
  if (repo.provider?.toLowerCase() !== connection.provider) return null;
  try {
    const root = new URL(webBase(connection));
    const url = new URL(repo.url);
    if (url.protocol !== 'https:' || url.origin !== root.origin || url.username || url.password || !url.pathname.startsWith(root.pathname)) return null;
    const path = decodeURIComponent(url.pathname.slice(root.pathname.length)).replace(/\/$/, '').replace(/\.git$/, '');
    const parts = path.split('/');
    if (parts.length < 2 || parts.some((part) => !/^[\w.-]+$/.test(part)) || (connection.provider !== 'gitlab' && parts.length !== 2)) return null;
    const organization = connection.organization.trim().toLowerCase();
    return path.toLowerCase().startsWith(`${organization}/`) ? path : null;
  } catch { return null; }
}

export function matchingRepositories(repositories, connection) {
  return repositories.filter((repo) => repositoryPath(repo, connection));
}

export function saveIntegration(ds, values) {
  const errors = validateIntegration(values);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const connections = integrationConnections(ds.settings.integrations);
  // Allow-list settings so credentials can never enter backups or Local Storage.
  const record = { id: values.id, provider: values.provider, name: values.name.trim(), organization: values.organization.trim(), apiBaseUrl: apiBase(values), notes: values.notes?.trim() || '' };
  if (!record.id) throw new Error('The integration needs an ID.');
  const tx = transaction(ds);
  const next = connections.some((c) => c.id === record.id) ? connections.map((c) => c.id === record.id ? record : c) : [...connections, record];
  tx.set('settings', { ...ds.settings, integrations: { ...ds.settings.integrations, connections: next } });
  logActivity(tx, { category: 'system', action: 'Integration saved', resourceType: 'Settings', resourceId: record.id, description: `Saved ${record.name} (${record.provider}).` });
  return { dataset: tx.data, result: record.id };
}

export function removeIntegration(ds, id) {
  const tx = transaction(ds);
  tx.set('settings', { ...ds.settings, integrations: { ...ds.settings.integrations, connections: integrationConnections(ds.settings.integrations).filter((c) => c.id !== id) } });
  logActivity(tx, { category: 'system', action: 'Integration removed', resourceType: 'Settings', resourceId: id, description: 'Removed integration configuration; recorded commits were retained.' });
  return { dataset: tx.data, result: id };
}

function commitRecord(item, repo, connection, path) {
  const github = connection.provider === 'github';
  const bitbucket = connection.provider === 'bitbucket';
  const sha = github ? item.sha : bitbucket ? item.hash : item.id;
  const committedAt = github ? item.commit?.committer?.date || item.commit?.author?.date : bitbucket ? item.date : item.committed_date;
  const message = github ? item.commit?.message : item.message;
  if (!/^[a-f0-9]{7,64}$/i.test(sha || '') || !Number.isFinite(Date.parse(committedAt)) || typeof message !== 'string') throw new Error('The provider returned an invalid commit record.');
  return {
    repositoryId: repo.id, sha, message, committedAt: new Date(committedAt).toISOString(),
    author: github ? item.author?.login || item.commit?.author?.name || null : bitbucket ? item.author?.user?.display_name || item.author?.raw || null : item.author_name || null,
    url: `${webBase(connection)}${path.split('/').map(encodeURIComponent).join('/')}/${github ? 'commit' : bitbucket ? 'commits' : '-/commit'}/${sha}`,
    source: `${GIT_PROVIDERS.find((p) => p.key === connection.provider).label} API`, integrationId: connection.id,
  };
}

/** Up to 500 latest primary-branch commits per registered repository, with explicit partial failures. */
export async function fetchIntegrationCommits(connection, repositories, token = '', { signal, fetchImpl = fetch } = {}) {
  const errors = validateIntegration(connection);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const matches = matchingRepositories(repositories, connection);
  if (!matches.length) throw new Error('No registered repositories match this provider, host and organization. Add a repository or update this integration.');
  const successes = [];
  const failures = [];
  for (const repo of matches) {
    signal?.throwIfAborted();
    const path = repositoryPath(repo, connection);
    const base = apiBase(connection);
    const endpoint = connection.provider === 'github' ? `${base}/repos/${path.split('/').map(encodeURIComponent).join('/')}/commits`
      : connection.provider === 'gitlab' ? `${base}/projects/${encodeURIComponent(path)}/repository/commits`
        : `${base}/repositories/${path.split('/').map(encodeURIComponent).join('/')}/commits${repo.mainBranch ? `/${encodeURIComponent(repo.mainBranch)}` : ''}`;
    const headers = { Accept: connection.provider === 'github' ? 'application/vnd.github+json' : 'application/json' };
    if (token.trim()) headers[connection.provider === 'gitlab' ? 'PRIVATE-TOKEN' : 'Authorization'] = connection.provider === 'gitlab' ? token.trim() : `Bearer ${token.trim()}`;
    const commits = [];
    let next = null;
    let truncated = false;
    try {
      for (let page = 1; page <= 5; page += 1) {
        const url = new URL(next || endpoint);
        if (!next) {
          url.searchParams.set(connection.provider === 'bitbucket' ? 'pagelen' : 'per_page', '100');
          url.searchParams.set('page', String(page));
          if (repo.mainBranch && connection.provider !== 'bitbucket') url.searchParams.set(connection.provider === 'github' ? 'sha' : 'ref_name', repo.mainBranch);
        }
        if (url.origin !== new URL(endpoint).origin || url.pathname !== new URL(endpoint).pathname || url.username || url.password) throw new Error('The provider returned an unsafe pagination URL.');
        let response;
        try {
          response = await fetchImpl(url.href, { headers, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000), credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
        } catch (e) {
          if (signal?.aborted) throw e;
          throw new Error(e.name === 'TimeoutError' ? 'Request timed out. Try syncing again.' : 'Request failed. Check your connection and the provider’s browser (CORS) access.');
        }
        if (!response.ok) throw new Error(response.status === 401 ? 'Authentication failed. Check your access token.' : response.status === 403 || response.status === 429 ? 'Access denied or rate limit reached. Check token permissions or try later.' : response.status === 404 ? 'Repository or branch not found, or the token has no access.' : `Provider returned HTTP ${response.status}.`);
        let body;
        try { body = await response.json(); } catch { throw new Error('The provider returned invalid JSON.'); }
        const items = connection.provider === 'bitbucket' ? body.values : body;
        if (!Array.isArray(items)) throw new Error('The provider returned an invalid commit list.');
        commits.push(...items.map((item) => commitRecord(item, repo, connection, path)));
        next = connection.provider === 'bitbucket' ? body.next || null : null;
        const more = connection.provider === 'bitbucket' ? !!next : items.length === 100;
        if (!more) break;
        if (page === 5) truncated = true;
      }
      successes.push({ repositoryId: repo.id, commits, truncated });
    } catch (e) {
      if (signal?.aborted) throw e;
      failures.push({ repositoryId: repo.id, name: repo.name, message: e.message });
    }
  }
  return { successes, failures };
}

export function applyIntegrationSync(ds, connection, sync) {
  const current = integrationConnections(ds.settings.integrations).find((c) => c.id === connection.id);
  if (!current || ['provider', 'organization', 'apiBaseUrl'].some((key) => current[key] !== connection[key])) throw new Error('This integration changed during sync. Please sync again.');
  const allowed = new Set(matchingRepositories(ds.repositories, current).map((r) => r.id));
  const successes = sync.successes.filter((s) => allowed.has(s.repositoryId));
  if (!successes.length) throw new Error('No repositories were synchronized. Existing commits were retained.');
  const tx = transaction(ds);
  const commits = [...(ds.commits || [])];
  let added = 0;
  const at = new Date().toISOString();
  tx.set('commits', commits);
  for (const success of successes) {
    for (const commit of success.commits) {
      const index = commits.findIndex((c) => c.repositoryId === commit.repositoryId && (c.sha === commit.sha || (c.sha.length >= 7 && (commit.sha.startsWith(c.sha) || c.sha.startsWith(commit.sha)))));
      if (index >= 0) commits[index] = { ...commits[index], ...commit };
      else { commits.push({ ...commit, id: tx.nextId('GC'), createdAt: at }); added += 1; }
    }
  }
  const connections = integrationConnections(ds.settings.integrations).map((c) => c.id === connection.id ? { ...c, lastSyncedAt: at, lastRepositoryCount: successes.length } : c);
  tx.set('settings', { ...ds.settings, integrations: { ...ds.settings.integrations, connections } });
  logActivity(tx, { category: 'system', action: 'Git commits synchronized', resourceType: 'Settings', resourceId: connection.id, description: `${connection.name}: ${added} new commits from ${successes.length} repositories; ${sync.failures.length} failed; ${successes.filter((s) => s.truncated).length} reached the 500-commit limit.` });
  return { dataset: tx.data, result: { added, repositories: successes.length } };
}
