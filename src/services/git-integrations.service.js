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

function classifyBranch(name = '') {
  const lower = name.toLowerCase();
  if (lower === 'main' || lower === 'master') return 'main';
  if (lower === 'develop' || lower === 'dev' || lower === 'staging') return 'develop';
  if (lower.startsWith('feat') || lower.includes('/feat')) return 'feature';
  if (lower.startsWith('fix') || lower.startsWith('bugfix') || lower.startsWith('hotfix') || lower.includes('/fix')) return 'fix';
  if (lower.startsWith('rel') || lower.startsWith('v')) return 'release';
  return 'chore';
}

async function safeGitHubJson(url, headers, { signal, fetchImpl }) {
  try {
    const response = await fetchImpl(url, {
      headers,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) return { ok: false, status: response.status, data: null };
    const data = await response.json();
    return { ok: true, status: response.status, data };
  } catch (e) {
    if (signal?.aborted) throw e;
    return { ok: false, status: 0, data: null };
  }
}

async function fetchGitHubExtras(base, path, token, { signal, fetchImpl }) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const headers = { Accept: 'application/vnd.github+json' };
  if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;

  const [repoRes, branchesRes, prsRes] = await Promise.all([
    safeGitHubJson(`${base}/repos/${encodedPath}`, headers, { signal, fetchImpl }),
    safeGitHubJson(`${base}/repos/${encodedPath}/branches?per_page=100`, headers, { signal, fetchImpl }),
    safeGitHubJson(`${base}/repos/${encodedPath}/pulls?state=all&per_page=100`, headers, { signal, fetchImpl }),
  ]);

  const inaccessible = repoRes.status === 404 || repoRes.status === 403;
  const metadata = repoRes.ok && repoRes.data ? {
    mainBranch: repoRes.data.default_branch || '',
    language: repoRes.data.language || '',
    visibility: repoRes.data.private ? 'private' : 'public',
    description: repoRes.data.description || '',
    topics: Array.isArray(repoRes.data.topics) ? repoRes.data.topics : [],
    accessStatus: 'accessible',
  } : null;

  const branches = branchesRes.ok && Array.isArray(branchesRes.data)
    ? branchesRes.data.map((b) => ({ name: b.name, kind: classifyBranch(b.name), sha: b.commit?.sha || null }))
    : null;

  const prs = prsRes.ok && Array.isArray(prsRes.data)
    ? prsRes.data.map((pr) => ({
      number: pr.number,
      title: pr.title || '',
      status: pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : 'closed',
      author: pr.user?.login || null,
      createdAt: pr.created_at || null,
      url: pr.html_url || null,
    }))
    : null;

  return { metadata, branches, prs, inaccessible };
}

/** Full GitHub sync: commits + repository metadata + branches + pull requests. */
export async function fetchIntegrationFullSync(connection, repositories, token = '', { signal, fetchImpl = fetch } = {}) {
  const commitSync = await fetchIntegrationCommits(connection, repositories, token, { signal, fetchImpl });
  if (connection.provider !== 'github') return { ...commitSync, inaccessibleIds: [] };

  const base = apiBase(connection);
  const matches = matchingRepositories(repositories, connection);
  const byId = new Map(matches.map((r) => [r.id, r]));
  const extrasByRepo = new Map();
  const inaccessibleIds = [];

  for (const success of commitSync.successes) {
    signal?.throwIfAborted();
    const repo = byId.get(success.repositoryId);
    const path = repo ? repositoryPath(repo, connection) : null;
    if (path) {
      const extras = await fetchGitHubExtras(base, path, token, { signal, fetchImpl });
      extrasByRepo.set(success.repositoryId, extras);
      if (extras.inaccessible) inaccessibleIds.push(success.repositoryId);
    }
  }

  for (const failure of commitSync.failures) {
    if (failure.message?.includes('not found') || failure.message?.includes('Access denied')) {
      inaccessibleIds.push(failure.repositoryId);
    }
  }

  const successes = commitSync.successes.map((s) => {
    const extras = extrasByRepo.get(s.repositoryId);
    return {
      ...s,
      metadata: extras?.metadata || null,
      branches: extras?.branches || null,
      prs: extras?.prs || null,
    };
  });

  return { successes, failures: commitSync.failures, inaccessibleIds };
}

/** Build temporary connection and sync a single GitHub repository on demand. */
export async function syncSingleGitHubRepo(repo, connections = [], token = '', { signal, fetchImpl = fetch } = {}) {
  if (repo?.provider?.toLowerCase() !== 'github' || !repo.url) {
    throw new Error('Only GitHub repositories with a valid URL can be synced directly.');
  }
  let url;
  try {
    url = new URL(repo.url);
  } catch {
    throw new Error('Invalid repository URL.');
  }
  const parts = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '').replace(/\.git$/, '').split('/');
  if (parts.length < 2) throw new Error('Invalid GitHub repository path.');
  const owner = parts[0];
  const matched = connections.find((c) => c.provider === 'github' && c.organization.toLowerCase() === owner.toLowerCase());
  const connection = matched || {
    id: 'direct-github-sync',
    provider: 'github',
    name: `GitHub · ${owner}`,
    organization: owner,
    apiBaseUrl: url.origin === 'https://github.com' ? 'https://api.github.com' : `${url.origin}/api/v3`,
    notes: '',
  };
  return { connection, sync: await fetchIntegrationFullSync(connection, [repo], token, { signal, fetchImpl }) };
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
  let totalBranches = 0;
  let totalPrs = 0;
  const at = new Date().toISOString();
  tx.set('commits', commits);
  for (const success of successes) {
    for (const commit of success.commits) {
      const index = commits.findIndex((c) => c.repositoryId === commit.repositoryId && (c.sha === commit.sha || (c.sha.length >= 7 && (commit.sha.startsWith(c.sha) || c.sha.startsWith(commit.sha)))));
      if (index >= 0) commits[index] = { ...commits[index], ...commit };
      else { commits.push({ ...commit, id: tx.nextId('GC'), createdAt: at }); added += 1; }
    }
    if (Array.isArray(success.branches)) totalBranches += success.branches.length;
    if (Array.isArray(success.prs)) totalPrs += success.prs.length;
  }

  const byRepoSuccess = new Map(successes.map((s) => [s.repositoryId, s]));
  const inaccessibleSet = new Set(sync.inaccessibleIds || []);
  const updatedRepos = (ds.repositories || []).map((r) => {
    const s = byRepoSuccess.get(r.id);
    if (s) {
      return {
        ...r,
        mainBranch: s.metadata?.mainBranch || r.mainBranch,
        language: s.metadata?.language || r.language,
        visibility: s.metadata?.visibility || r.visibility,
        description: r.description && r.description !== 'Kept in registry' ? r.description : (s.metadata?.description || r.description),
        topics: s.metadata?.topics?.length ? s.metadata.topics : r.topics,
        accessStatus: s.metadata?.accessStatus || 'accessible',
        ...(Array.isArray(s.branches) ? { syncedBranches: s.branches } : {}),
        ...(Array.isArray(s.prs) ? { syncedPrs: s.prs } : {}),
        syncedAt: at,
        updatedAt: at,
      };
    }
    if (inaccessibleSet.has(r.id)) {
      return { ...r, accessStatus: 'inaccessible' };
    }
    return r;
  });
  tx.set('repositories', updatedRepos);

  const connections = integrationConnections(ds.settings.integrations).map((c) => c.id === connection.id ? { ...c, lastSyncedAt: at, lastRepositoryCount: successes.length } : c);
  tx.set('settings', { ...ds.settings, integrations: { ...ds.settings.integrations, connections } });
  logActivity(tx, { category: 'system', action: 'Git commits synchronized', resourceType: 'Settings', resourceId: connection.id, description: `${connection.name}: ${added} new commits, ${totalBranches} branches, ${totalPrs} PRs from ${successes.length} repositories; ${sync.failures.length} failed; ${successes.filter((s) => s.truncated).length} reached the 500-commit limit.` });
  return { dataset: tx.data, result: { added, repositories: successes.length, branches: totalBranches, prs: totalPrs } };
}

/** Apply single repository GitHub sync results (metadata, commits, branches, PRs). */
export function applySingleRepoSync(ds, repo, sync) {
  const s = sync.successes.find((x) => x.repositoryId === repo.id);
  if (!s) {
    const fail = sync.failures.find((f) => f.repositoryId === repo.id);
    if (sync.inaccessibleIds?.includes(repo.id)) {
      const tx = transaction(ds);
      tx.set('repositories', (ds.repositories || []).map((r) => r.id === repo.id ? { ...r, accessStatus: 'inaccessible' } : r));
      return { dataset: tx.data, result: { added: 0, inaccessible: true, error: fail?.message } };
    }
    throw new Error(fail?.message || 'Repository synchronization failed.');
  }
  const tx = transaction(ds);
  const commits = [...(ds.commits || [])];
  let added = 0;
  const at = new Date().toISOString();
  tx.set('commits', commits);
  for (const commit of s.commits) {
    const index = commits.findIndex((c) => c.repositoryId === commit.repositoryId && (c.sha === commit.sha || (c.sha.length >= 7 && (commit.sha.startsWith(c.sha) || c.sha.startsWith(commit.sha)))));
    if (index >= 0) commits[index] = { ...commits[index], ...commit };
    else { commits.push({ ...commit, id: tx.nextId('GC'), createdAt: at }); added += 1; }
  }
  tx.set('repositories', (ds.repositories || []).map((r) => r.id === repo.id ? {
    ...r,
    mainBranch: s.metadata?.mainBranch || r.mainBranch,
    language: s.metadata?.language || r.language,
    visibility: s.metadata?.visibility || r.visibility,
    description: r.description && r.description !== 'Kept in registry' ? r.description : (s.metadata?.description || r.description),
    topics: s.metadata?.topics?.length ? s.metadata.topics : r.topics,
    accessStatus: s.metadata?.accessStatus || 'accessible',
    ...(Array.isArray(s.branches) ? { syncedBranches: s.branches } : {}),
    ...(Array.isArray(s.prs) ? { syncedPrs: s.prs } : {}),
    syncedAt: at,
    updatedAt: at,
  } : r));
  logActivity(tx, { category: 'system', action: 'Repository synchronized', resourceType: 'Repository', resourceId: repo.id, description: `Synced ${repo.name} from GitHub: ${added} new commits, ${s.branches?.length ?? 0} branches, ${s.prs?.length ?? 0} PRs.` });
  return { dataset: tx.data, result: { added, branches: s.branches?.length ?? 0, prs: s.prs?.length ?? 0 } };
}

/** Test connectivity and token validity against provider API */
export async function testGitConnection(connection, token = '', { signal, fetchImpl = fetch } = {}) {
  const errors = validateIntegration(connection);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const base = apiBase(connection);
  const headers = { Accept: connection.provider === 'github' ? 'application/vnd.github+json' : 'application/json' };
  if (token?.trim()) {
    headers[connection.provider === 'gitlab' ? 'PRIVATE-TOKEN' : 'Authorization'] = connection.provider === 'gitlab' ? token.trim() : `Bearer ${token.trim()}`;
  }

  let endpoint;
  if (connection.provider === 'github') {
    endpoint = token?.trim() ? `${base}/user` : `${base}/rate_limit`;
  } else if (connection.provider === 'gitlab') {
    endpoint = token?.trim() ? `${base}/user` : `${base}/version`;
  } else {
    endpoint = `${base}/user`;
  }

  let response;
  try {
    response = await fetchImpl(endpoint, {
      headers,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(e.name === 'TimeoutError' ? 'Connection timed out. Check your network.' : 'Connection failed. Check network or CORS settings.');
  }

  const rateRemaining = response.headers.get('x-ratelimit-remaining');
  const rateLimit = response.headers.get('x-ratelimit-limit');

  if (!response.ok) {
    if (response.status === 401) throw new Error('Authentication failed (401). Token is invalid, expired, or missing required scopes.');
    if (response.status === 403) throw new Error('Access denied or rate limit reached (403). Enter a GitHub token for 5,000 req/hr.');
    if (response.status === 404) throw new Error('Resource not found (404). Check API Base URL.');
    throw new Error(`Provider returned HTTP ${response.status}.`);
  }

  let data = {};
  try { data = await response.json(); } catch { data = {}; }

  let user = null;
  if (connection.provider === 'github') {
    user = token?.trim() ? (data.login || data.name || null) : null;
  } else if (connection.provider === 'gitlab') {
    user = data.username || data.name || null;
  } else if (connection.provider === 'bitbucket') {
    user = data.display_name || data.username || null;
  }

  return {
    ok: true,
    user,
    provider: connection.provider,
    authenticated: Boolean(token?.trim()),
    rateLimitRemaining: rateRemaining ? Number(rateRemaining) : (data.rate ? data.rate.remaining : null),
    rateLimitTotal: rateLimit ? Number(rateLimit) : (data.rate ? data.rate.limit : null),
  };
}
