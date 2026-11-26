import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

// Match Vite's extensionless imports and JSON modules without adding a test dependency.
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw error;
      return next(`${specifier}.js`, context);
    }
  },
  load(url, context, next) {
    if (url.endsWith('.json')) return { format: 'module', source: `export default ${readFileSync(new URL(url), 'utf8')}`, shortCircuit: true };
    return next(url, context);
  },
});

const service = await import('../src/services/git-integrations.service.js');
const { normalizeDataset } = await import('../src/services/storage.service.js');
const { buildSeedDataset } = await import('../src/services/seed.js');
const { buildRecordedGit } = await import('../src/services/git-analytics.service.js');
const { validateBackup } = await import('../src/services/validation.service.js');
const connection = { id: 'github-work', provider: 'github', name: 'GitHub Work', organization: 'team', apiBaseUrl: 'https://api.github.com', notes: '' };
const repo = { id: 'REPO-001', name: 'app', provider: 'GitHub', url: 'https://github.com/team/app', mainBranch: 'feature/main' };
const sha = 'a'.repeat(40);
const item = (hash = sha) => ({ sha: hash, commit: { message: 'Real provider commit', committer: { date: '2026-11-23T00:00:00Z' }, author: { name: 'A' } }, author: { login: 'author' } });
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
const dataset = () => service.saveIntegration({ ...normalizeDataset(buildSeedDataset()), repositories: [repo], commits: [] }, connection).dataset;

test('multiple integrations of the same provider survive normalization and backup validation; credentials are excluded', () => {
  const base = dataset();
  const baseCount = base.settings.integrations.connections.length;
  let ds = service.saveIntegration(base, { ...connection, id: 'github-personal', name: 'GitHub Personal', organization: 'personal', token: 'secret', accessToken: 'secret' }).dataset;
  ds = service.saveIntegration(ds, { ...connection, id: 'gitlab-work', name: 'GitLab Work', provider: 'gitlab', apiBaseUrl: 'https://gitlab.com/api/v4' }).dataset;
  const restored = normalizeDataset(JSON.parse(JSON.stringify(ds)));
  assert.equal(restored.settings.integrations.connections.length, baseCount + 2);
  assert.equal(JSON.stringify(restored).includes('secret'), false);
  assert.equal(validateBackup({ format: 'brickhouse-backup', schemaVersion: restored.schemaVersion, data: restored }).ok, true);
  assert.ok(restored.settings.integrations.github);
});

test('legacy configurations migrate once and deleting a connection does not recreate it', () => {
  const old = { github: { organization: 'team', apiBaseUrl: 'https://api.github.com', notes: 'Keep notes' } };
  assert.equal(service.integrationConnections(old)[0].notes, 'Keep notes');
  const ds = service.removeIntegration(dataset(), connection.id).dataset;
  assert.equal(normalizeDataset(ds).settings.integrations.connections.some((c) => c.id === connection.id), false);
});

test('repository matching checks provider, host and namespace, including nested self-hosted GitLab', () => {
  const bad = [{ ...repo, url: 'https://evil.test/team/app' }, { ...repo, url: 'https://github.com/team-other/app' }, { ...repo, provider: 'GitLab' }];
  assert.equal(service.matchingRepositories([repo, ...bad], connection).length, 1);
  const gitlab = { ...connection, provider: 'gitlab', organization: 'team/sub', apiBaseUrl: 'https://git.example.com/gitlab/api/v4' };
  assert.equal(service.matchingRepositories([{ ...repo, provider: 'GitLab', url: 'https://git.example.com/gitlab/team/sub/app.git' }], gitlab).length, 1);
  assert.ok(service.validateIntegration({ ...connection, apiBaseUrl: 'http://api.github.com' }).apiBaseUrl);
  assert.ok(service.validateIntegration({ ...connection, apiBaseUrl: 'https://user:secret@api.github.com' }).apiBaseUrl);
});

test('GitHub sync uses headers, the selected branch and pagination, with deduplicated persistence and refreshed analytics', async () => {
  const calls = [];
  const sync = await service.fetchIntegrationCommits(connection, [repo], 'session-secret', { fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return response(calls.length === 1 ? Array.from({ length: 100 }, (_, i) => item(i.toString(16).padStart(40, '0'))) : [item()]);
  } });
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).searchParams.get('sha'), repo.mainBranch);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer session-secret');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].url.includes('secret'), false);
  let ds = dataset();
  ds.commits = [{ id: 'GC-001', repositoryId: repo.id, sha: sha.slice(0, 7), committedAt: '2026-01-01T00:00:00Z', message: 'old snapshot' }];
  const before = buildRecordedGit(ds);
  ds = service.applyIntegrationSync(ds, connection, sync).dataset;
  assert.equal(ds.commits.length, 101);
  assert.equal(ds.commits.find((c) => c.id === 'GC-001').sha, sha);
  assert.equal(new Set(ds.commits.map((c) => c.id)).size, 101);
  const again = service.applyIntegrationSync(ds, connection, sync);
  assert.equal(again.result.added, 0);
  assert.equal(again.dataset.commits.length, 101);
  assert.notEqual(buildRecordedGit(again.dataset), before);
  assert.equal(buildRecordedGit(again.dataset).source.synced, true);
  assert.equal(JSON.stringify(again.dataset).includes('session-secret'), false);
  // Refresh the same count and IDs: cached analytics must still receive the new message/date.
  const updated = { ...sync, successes: [{ repositoryId: repo.id, commits: [{ ...sync.successes[0].commits.at(-1), message: 'Updated' }] }] };
  const revised = service.applyIntegrationSync(again.dataset, connection, updated).dataset;
  assert.equal(buildRecordedGit(revised).commits.find((c) => c.sha === sha).message, 'Updated');
});

test('GitLab sync encodes subgroup paths and uses PRIVATE-TOKEN', async () => {
  const gitlab = { ...connection, provider: 'gitlab', apiBaseUrl: 'https://gitlab.com/api/v4' };
  const result = await service.fetchIntegrationCommits(gitlab, [{ ...repo, provider: 'GitLab', url: 'https://gitlab.com/team/sub/app' }], 'gitlab-secret', { fetchImpl: async (url, options) => {
    assert.ok(url.includes('/projects/team%2Fsub%2Fapp/repository/commits'));
    assert.equal(options.headers['PRIVATE-TOKEN'], 'gitlab-secret');
    return response([{ id: sha, message: 'GitLab commit', committed_date: '2026-11-23T00:00:00Z', author_name: 'User' }]);
  } });
  assert.equal(result.successes[0].commits[0].url, `https://gitlab.com/team/sub/app/-/commit/${sha}`);
});

test('Bitbucket sync parses commits and rejects pagination that would send a token to another host', async () => {
  const bitbucket = { ...connection, provider: 'bitbucket', apiBaseUrl: 'https://api.bitbucket.org/2.0' };
  const repositories = [{ ...repo, provider: 'Bitbucket', url: 'https://bitbucket.org/team/app' }];
  const body = { values: [{ hash: sha, message: 'Bitbucket commit', date: '2026-11-23T00:00:00Z' }] };
  const result = await service.fetchIntegrationCommits(bitbucket, repositories, '', { fetchImpl: async () => response(body) });
  assert.equal(result.successes[0].commits[0].sha, sha);
  let requests = 0;
  const unsafe = await service.fetchIntegrationCommits(bitbucket, repositories, 'secret', { fetchImpl: async () => { requests += 1; return response({ ...body, next: 'https://evil.test/steal' }); } });
  assert.equal(requests, 1);
  assert.equal(unsafe.successes.length, 0);
  assert.match(unsafe.failures[0].message, /unsafe pagination/);
});

test('authentication failures, partial failures, invalid data and cancellation preserve existing records', async () => {
  const other = { ...repo, id: 'REPO-002', name: 'other', url: 'https://github.com/team/other' };
  const sync = await service.fetchIntegrationCommits(connection, [repo, other], '', { fetchImpl: async (url) => url.includes('/other/') ? response({}, 401) : response([item()]) });
  assert.equal(sync.successes.length, 1);
  assert.match(sync.failures[0].message, /Authentication failed/);
  const ds = dataset();
  ds.repositories.push(other);
  ds.commits = [{ id: 'GC-001', repositoryId: other.id, sha: 'b'.repeat(40), message: 'Keep', committedAt: '2026-01-01T00:00:00Z' }];
  assert.ok(service.applyIntegrationSync(ds, connection, sync).dataset.commits.some((c) => c.message === 'Keep'));
  const malformed = await service.fetchIntegrationCommits(connection, [repo], '', { fetchImpl: async () => response([{ sha: 'invalid' }]) });
  assert.equal(malformed.successes.length, 0);
  assert.throws(() => service.applyIntegrationSync(ds, connection, malformed), /No repositories/);
  await assert.rejects(service.fetchIntegrationCommits(connection, [], '', { fetchImpl: () => assert.fail('No network call expected') }), /No registered repositories/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(service.fetchIntegrationCommits(connection, [repo], '', { signal: controller.signal }), { name: 'AbortError' });
});

test('sync reports the history limit and rejects configuration changes during a request', async () => {
  const sync = await service.fetchIntegrationCommits(connection, [repo], '', { fetchImpl: async () => response(Array.from({ length: 100 }, () => item())) });
  assert.equal(sync.successes[0].truncated, true);
  assert.equal(sync.successes[0].commits.length, 500);
  const ds = service.saveIntegration(dataset(), { ...connection, organization: 'another' }).dataset;
  assert.throws(() => service.applyIntegrationSync(ds, connection, sync), /changed during sync/);
});

test('testGitConnection verifies credentials, handles rate limits and user identity', async () => {
  // 1. Unauthenticated test (checks rate limit)
  const unauthed = await service.testGitConnection(connection, '', {
    fetchImpl: async (url) => {
      assert.equal(url, 'https://api.github.com/rate_limit');
      return {
        ok: true, status: 200,
        headers: new Map([['x-ratelimit-remaining', '58'], ['x-ratelimit-limit', '60']]),
        json: async () => ({ rate: { remaining: 58, limit: 60 } }),
      };
    },
  });
  assert.equal(unauthed.ok, true);
  assert.equal(unauthed.authenticated, false);
  assert.equal(unauthed.rateLimitRemaining, 58);

  // 2. Authenticated test (checks user identity)
  const authed = await service.testGitConnection(connection, 'ghp_validToken', {
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.github.com/user');
      assert.equal(options.headers.Authorization, 'Bearer ghp_validToken');
      return {
        ok: true, status: 200,
        headers: new Map([['x-ratelimit-remaining', '4990'], ['x-ratelimit-limit', '5000']]),
        json: async () => ({ login: 'octocat', name: 'Mona Lisa' }),
      };
    },
  });
  assert.equal(authed.ok, true);
  assert.equal(authed.authenticated, true);
  assert.equal(authed.user, 'octocat');
  assert.equal(authed.rateLimitRemaining, 4990);

  // 3. Invalid token (401 error)
  await assert.rejects(
    service.testGitConnection(connection, 'bad_token', {
      fetchImpl: async () => ({ ok: false, status: 401, headers: new Map(), json: async () => ({}) }),
    }),
    /Authentication failed/,
  );
});

test('fetchIntegrationFullSync and syncSingleGitHubRepo fetch commits, branches, PRs and metadata', async () => {
  const fetchMock = async (url) => {
    if (url.includes('/commits')) return response([item()]);
    if (url.includes('/branches')) return response([{ name: 'main', commit: { sha } }, { name: 'feat/login', commit: { sha } }]);
    if (url.includes('/pulls')) {
      return response([
        { number: 42, title: 'Add login', state: 'closed', merged_at: '2026-11-23T00:00:00Z', user: { login: 'octocat' }, created_at: '2026-11-22T00:00:00Z', html_url: 'https://github.com/team/app/pull/42' },
        { number: 43, title: 'Fix bug', state: 'open', merged_at: null, user: { login: 'author' }, created_at: '2026-11-24T00:00:00Z', html_url: 'https://github.com/team/app/pull/43' },
      ]);
    }
    return response({ default_branch: 'main', language: 'JavaScript', private: false, description: 'App repo', topics: ['react', 'vite'] });
  };

  const full = await service.fetchIntegrationFullSync(connection, [repo], 'tok', { fetchImpl: fetchMock });
  assert.equal(full.successes.length, 1);
  assert.equal(full.successes[0].branches.length, 2);
  assert.equal(full.successes[0].branches[1].kind, 'feature');
  assert.equal(full.successes[0].prs.length, 2);
  assert.equal(full.successes[0].prs[0].status, 'merged');
  assert.equal(full.successes[0].prs[1].status, 'open');
  assert.equal(full.successes[0].metadata.language, 'JavaScript');
  assert.equal(full.successes[0].metadata.visibility, 'public');

  const applied = service.applyIntegrationSync(dataset(), connection, full);
  assert.equal(applied.result.branches, 2);
  assert.equal(applied.result.prs, 2);
  const updatedRepo = applied.dataset.repositories.find((r) => r.id === repo.id);
  assert.equal(updatedRepo.accessStatus, 'accessible');
  assert.equal(updatedRepo.visibility, 'public');
  assert.equal(updatedRepo.language, 'JavaScript');
  assert.equal(updatedRepo.syncedBranches.length, 2);
  assert.equal(updatedRepo.syncedPrs.length, 2);

  const gitAnalytics = buildRecordedGit(applied.dataset);
  const analyticsRepo = gitAnalytics.repos.find((r) => r.repository.id === repo.id);
  assert.equal(analyticsRepo.branches.length, 2);
  assert.equal(analyticsRepo.branches[1].name, 'feat/login');
  assert.equal(analyticsRepo.prs.length, 2);
  assert.equal(analyticsRepo.prs[0].url, 'https://github.com/team/app/pull/42');

  const single = await service.syncSingleGitHubRepo(repo, [connection], 'tok', { fetchImpl: fetchMock });
  const appliedSingle = service.applySingleRepoSync(dataset(), repo, single.sync);
  assert.equal(appliedSingle.result.branches, 2);
  assert.equal(appliedSingle.result.prs, 2);
});

test('rate-limit exhaustion stops remaining requests early, avoids marking repos inaccessible, and flags testGitConnection', async () => {
  const other = { ...repo, id: 'REPO-002', name: 'other', url: 'https://github.com/team/other' };
  const third = { ...repo, id: 'REPO-003', name: 'third', url: 'https://github.com/team/third' };
  let calls = 0;
  const full = await service.fetchIntegrationFullSync(connection, [repo, other, third], '', {
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: false,
        status: 403,
        headers: new Map([['x-ratelimit-remaining', '0'], ['x-ratelimit-reset', '1795680000']]),
        json: async () => ({ message: 'API rate limit exceeded' }),
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(full.rateLimited, true);
  assert.equal(full.skippedCount, 2);
  assert.equal(full.inaccessibleIds.length, 0);
  assert.ok(full.rateLimitReset);

  const testZero = await service.testGitConnection(connection, '', {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Map([['x-ratelimit-remaining', '0'], ['x-ratelimit-limit', '60'], ['x-ratelimit-reset', '1795680000']]),
      json: async () => ({ rate: { remaining: 0, limit: 60, reset: 1795680000 } }),
    }),
  });
  assert.equal(testZero.rateLimitExhausted, true);
  assert.equal(testZero.rateLimitRemaining, 0);
  assert.ok(testZero.rateLimitResetAt);
});

test('testGitConnection warns on broad classic scopes and supports server-env authSource', async () => {
  const broad = await service.testGitConnection(connection, 'ghp_classic', {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Map([['x-ratelimit-remaining', '4999'], ['x-ratelimit-limit', '5000'], ['x-oauth-scopes', 'repo, delete_repo']]),
      json: async () => ({ login: 'octocat' }),
    }),
  });
  assert.equal(broad.authSource, 'session-pat');
  assert.match(broad.scopeWarning, /Fine-grained PAT/);

  const serverEnv = await service.testGitConnection(connection, '', {
    useServerToken: true,
    fetchImpl: async (url) => {
      assert.equal(url, 'https://api.github.com/user');
      return {
        ok: true,
        status: 200,
        headers: new Map([['x-ratelimit-remaining', '4998'], ['x-ratelimit-limit', '5000']]),
        json: async () => ({ login: 'octocat' }),
      };
    },
  });
  assert.equal(serverEnv.authenticated, true);
  assert.equal(serverEnv.authSource, 'server-env');
  assert.equal(serverEnv.scopeWarning, null);
});

test('vite-git-proxy resolves .env.local tokens, masks env-status, and enforces SSRF allow-list', async () => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { brickhouseGitProxyPlugin, resolveServerToken, maskToken, isAllowedProxyUrl } = await import('./vite-git-proxy.js');

  const env = {
    BRICKHOUSE_GITHUB_TOKEN: 'ghp_provider_123456',
    BRICKHOUSE_GITHUB_TOKEN_PRIVATESTACK_TOWNHALL: 'github_pat_org_9999',
  };
  assert.deepEqual(resolveServerToken(env, 'github', 'PrivateStack-TownHall'), { token: 'github_pat_org_9999', source: 'env-org' });
  assert.deepEqual(resolveServerToken(env, 'github', 'vincent-guizot'), { token: 'ghp_provider_123456', source: 'env-provider' });
  assert.equal(maskToken('ghp_provider_123456'), 'ghp_••••3456');

  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bh-git-proxy-'));
  try {
    await fs.writeFile(path.join(rootDir, '.env.local'), 'BRICKHOUSE_GITHUB_TOKEN=github_pat_secret_abcd\n', 'utf8');
    assert.equal(await isAllowedProxyUrl(rootDir, 'github', 'https://api.github.com/user'), true);
    assert.equal(await isAllowedProxyUrl(rootDir, 'github', 'https://evil.example.com/user'), false);
    assert.equal(await isAllowedProxyUrl(rootDir, 'github', 'http://api.github.com/user'), false);

    let forwardedAuth = null;
    const plugin = brickhouseGitProxyPlugin({
      fetchImpl: async (_url, opts) => {
        forwardedAuth = opts.headers.Authorization;
        return { ok: true, status: 200, headers: new Map([['x-ratelimit-remaining', '4995']]), json: async () => ({ login: 'proxy-user' }) };
      },
    });
    plugin.configResolved({ root: rootDir });
    let mw;
    plugin.configureServer({ middlewares: { use: (fn) => { mw = fn; } } });

    const callMw = (method, url, body) => new Promise((resolve) => {
      const listeners = {};
      const req = {
        method,
        url,
        on: (ev, fn) => {
          listeners[ev] = fn;
          if (ev === 'end') {
            if (body && listeners.data) listeners.data(Buffer.from(JSON.stringify(body)));
            fn();
          }
        },
        destroy: () => {},
      };
      const res = { statusCode: 200, setHeader: () => {}, end: (txt) => resolve({ status: res.statusCode, raw: txt, body: JSON.parse(txt) }) };
      mw(req, res, () => resolve({ status: 404 }));
    });

    const statusRes = await callMw('POST', '/api/git/env-status', { connections: [{ id: 'c1', provider: 'github', organization: 'team' }] });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.raw.includes('github_pat_secret_abcd'), false);
    assert.equal(statusRes.body.statuses.c1.configured, true);
    assert.equal(statusRes.body.statuses.c1.masked, 'gith••••abcd');

    const blockedRes = await callMw('POST', '/api/git/proxy', { url: 'https://evil.example.com/steal', provider: 'github', organization: 'team' });
    assert.equal(blockedRes.status, 403);

    const proxyRes = await callMw('POST', '/api/git/proxy', { url: 'https://api.github.com/user', provider: 'github', organization: 'team' });
    assert.equal(proxyRes.status, 200);
    assert.equal(forwardedAuth, 'Bearer github_pat_secret_abcd');
    assert.equal(proxyRes.raw.includes('github_pat_secret_abcd'), false);
    assert.equal(proxyRes.body.body.login, 'proxy-user');
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});
