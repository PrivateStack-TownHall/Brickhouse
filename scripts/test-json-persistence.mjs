import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

// Match Vite's extensionless imports and JSON modules without adding extra dependencies.
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw error;
      return next(`${specifier}.js`, context);
    }
  },
  load(url, context, next) {
    if (url.endsWith('.json')) {
      return { format: 'module', source: `export default ${readFileSync(new URL(url), 'utf8')}`, shortCircuit: true };
    }
    return next(url, context);
  },
});

const { brickhouseDatabasePlugin, readDatabaseFromDisk, writeDatabaseToDisk } = await import('./vite-db-plugin.js');
const { createEntity, updateEntity, deleteEntity } = await import('../src/services/registry.service.js');
const { initializeRegistry, loadDatasetFromDisk, persistDatasetToDisk, resetToSeed } = await import('../src/services/storage.service.js');
const { syncRegistryNotifications, loadNotifications } = await import('../src/services/notifications.service.js');

async function startTempDbServer() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bh-json-persist-'));
  const dbDir = path.join(rootDir, 'database');
  await fs.cp(path.resolve(process.cwd(), 'database'), dbDir, { recursive: true });

  const plugin = brickhouseDatabasePlugin();
  plugin.configResolved({ root: rootDir });

  const middlewares = [];
  plugin.configureServer({ middlewares: { use: (fn) => middlewares.push(fn) } });

  const server = http.createServer((req, res) => {
    let i = 0;
    const next = () => {
      const fn = middlewares[i++];
      if (fn) fn(req, res, next);
      else {
        res.statusCode = 404;
        res.end('Not found');
      }
    };
    next();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    rootDir,
    dbDir,
    baseUrl,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await fs.rm(rootDir, { recursive: true, force: true });
    },
  };
}

function withMockBrowserEnv(baseUrl) {
  const store = new Map();
  const prevWindow = globalThis.window;
  const prevFetch = globalThis.fetch;

  globalThis.window = {
    location: { protocol: 'http:' },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  };
  globalThis.fetch = (url, opts) => {
    // Enforce the browser Fetch specification 64 KiB limit for keepalive requests.
    if (opts?.keepalive && typeof opts?.body === 'string' && Buffer.byteLength(opts.body) > 65536) {
      return Promise.reject(new TypeError('NetworkError when attempting to fetch resource.'));
    }
    const target = String(url).startsWith('/') ? `${baseUrl}${url}` : url;
    return prevFetch(target, opts);
  };

  return {
    store,
    restore() {
      globalThis.window = prevWindow;
      globalThis.fetch = prevFetch;
    },
  };
}

test('TC-1: Create CRUD saves to database/*.json and survives localStorage wipe', async () => {
  const srv = await startTempDbServer();
  const env = withMockBrowserEnv(srv.baseUrl);
  try {
    const loaded = await loadDatasetFromDisk();
    assert.equal(loaded.ok, true);
    const baseCount = loaded.dataset.applications.length;
    assert.ok(baseCount >= 40);

    const created = createEntity(loaded.dataset, 'applications', {
      name: 'JSON Persist App',
      code: 'JSON-01',
      ownerId: 'COMP-001',
      category: 'Main Applications',
      type: 'web',
      lifecycle: 'development',
    });
    const newId = created.result;
    assert.match(newId, /^APP-\d+$/);

    const saveRes = await persistDatasetToDisk(created.dataset);
    assert.equal(saveRes.ok, true);
    assert.ok(saveRes.written.includes('core/applications.json'));
    assert.ok(saveRes.written.includes('system/activities.json'));

    // Verify directly on disk
    const appsOnDisk = JSON.parse(await fs.readFile(path.join(srv.dbDir, 'core/applications.json'), 'utf8'));
    assert.equal(appsOnDisk.length, baseCount + 1);
    assert.equal(appsOnDisk.find((a) => a.id === newId)?.name, 'JSON Persist App');

    // Wipe localStorage completely and reload from disk
    env.store.clear();
    assert.equal(env.store.size, 0);

    const reloaded = await loadDatasetFromDisk();
    assert.equal(reloaded.ok, true);
    assert.equal(reloaded.dataset.applications.length, baseCount + 1);
    assert.equal(reloaded.dataset.applications.find((a) => a.id === newId)?.code, 'JSON-01');
    assert.ok(reloaded.dataset.activities.some((a) => a.resourceId === newId && a.category === 'create'));
  } finally {
    env.restore();
    await srv.close();
  }
});

test('TC-2: Update & Delete CRUD persist to database/*.json and survive localStorage wipe', async () => {
  const srv = await startTempDbServer();
  const env = withMockBrowserEnv(srv.baseUrl);
  try {
    const { dataset: ds0 } = await loadDatasetFromDisk();
    const { dataset: ds1, result: newId } = createEntity(ds0, 'applications', {
      name: 'Lifecycle Test App',
      code: 'LIFE-01',
      ownerId: 'COMP-001',
      category: 'Main Applications',
      type: 'web',
      lifecycle: 'development',
    });

    const { dataset: ds2 } = updateEntity(ds1, 'applications', newId, {
      name: 'Lifecycle Test App',
      code: 'LIFE-01',
      ownerId: 'COMP-001',
      category: 'Main Applications',
      type: 'web',
      lifecycle: 'active',
    });
    await persistDatasetToDisk(ds2);

    const appsAfterUpdate = JSON.parse(await fs.readFile(path.join(srv.dbDir, 'core/applications.json'), 'utf8'));
    assert.equal(appsAfterUpdate.find((a) => a.id === newId)?.lifecycle, 'active');

    const { dataset: ds3 } = deleteEntity(ds2, 'applications', newId);
    await persistDatasetToDisk(ds3);

    env.store.clear();
    const reloaded = await loadDatasetFromDisk();
    assert.equal(reloaded.dataset.applications.some((a) => a.id === newId), false);
    assert.ok(reloaded.dataset.activities.some((a) => a.resourceId === newId && a.category === 'lifecycle'));
    assert.ok(reloaded.dataset.activities.some((a) => a.resourceId === newId && a.category === 'delete'));
  } finally {
    env.restore();
    await srv.close();
  }
});

test('TC-3: Selective file write preserves untouched files, EOL format, and blocks path traversal', async () => {
  const srv = await startTempDbServer();
  try {
    const initial = await readDatabaseFromDisk(srv.dbDir);
    const commitsBefore = await fs.readFile(path.join(srv.dbDir, 'core/git-commits.json'), 'utf8');

    // Unchanged save writes 0 files
    const noop = await writeDatabaseToDisk(srv.dbDir, initial);
    assert.equal(noop.written.length, 0);
    assert.equal(noop.unchanged.length, 28);

    // Changing only applications writes ONLY core/applications.json and ignores malicious keys
    const modified = {
      ...initial,
      applications: [...initial.applications, {
        id: 'APP-041', name: 'Selective App', code: 'SEL-01', ownerId: 'COMP-001',
        category: 'Main Applications', type: 'web', lifecycle: 'development',
      }],
      '../outside.json': [{ bad: true }],
    };
    const res = await writeDatabaseToDisk(srv.dbDir, modified);
    assert.deepEqual(res.written, ['core/applications.json']);
    assert.equal(await fs.stat(path.join(srv.dbDir, '../outside.json')).catch(() => null), null);

    const commitsAfter = await fs.readFile(path.join(srv.dbDir, 'core/git-commits.json'), 'utf8');
    assert.equal(commitsAfter, commitsBefore);
  } finally {
    await srv.close();
  }
});

test('TC-4: Concurrent rapid writes serialize cleanly without data corruption', async () => {
  const srv = await startTempDbServer();
  const env = withMockBrowserEnv(srv.baseUrl);
  try {
    let { dataset: ds } = await loadDatasetFromDisk();
    const baseCount = ds.applications.length;
    const snapshots = [];
    for (let i = 1; i <= 5; i += 1) {
      ds = createEntity(ds, 'applications', {
        name: `Concurrent App ${i}`,
        code: `CONC-0${i}`,
        ownerId: 'COMP-001',
        category: 'Main Applications',
        type: 'web',
        lifecycle: 'development',
      }).dataset;
      snapshots.push(ds);
    }

    // Fire 5 parallel POST saves; server writeQueue must serialize them in order
    const results = await Promise.all(snapshots.map((snap) => persistDatasetToDisk(snap)));
    assert.ok(results.every((r) => r.ok));

    env.store.clear();
    const reloaded = await loadDatasetFromDisk();
    assert.equal(reloaded.dataset.applications.length, baseCount + 5);
    for (let i = 1; i <= 5; i += 1) {
      assert.ok(reloaded.dataset.applications.some((a) => a.code === `CONC-0${i}`));
    }
  } finally {
    env.restore();
    await srv.close();
  }
});

test('TC-5: Offline/static fallback works via localStorage and notifications stay synced without stale ACT items', async () => {
  // 1. Offline / file:// fallback
  const envOffline = withMockBrowserEnv('http://127.0.0.1:0');
  globalThis.window.location.protocol = 'file:';
  try {
    const diskRes = await loadDatasetFromDisk();
    assert.equal(diskRes.ok, false);
    assert.equal(diskRes.available, false);

    const init = initializeRegistry();
    assert.equal(init.health.persistence, true);
    assert.ok(init.dataset.applications.length >= 40);
  } finally {
    envOffline.restore();
  }

  // 2. Notification sync drops ephemeral Registry initialized ACT not on disk while keeping real disk activities and seed JSON notifs
  const srv = await startTempDbServer();
  const envOnline = withMockBrowserEnv(srv.baseUrl);
  try {
    const init = initializeRegistry(); // appends temporary "Registry initialized" in localStorage
    const tempInitAct = init.dataset.activities.find((a) => a.action === 'Registry initialized');
    assert.ok(tempInitAct?.id);
    const n1 = syncRegistryNotifications(loadNotifications(), init.dataset);
    assert.ok(n1.items.some((x) => x.id === `act:${tempInitAct.id}`));

    const diskLoaded = await loadDatasetFromDisk();
    const n2 = syncRegistryNotifications(n1, diskLoaded.dataset);
    assert.equal(n2.items.some((x) => x.id === `act:${tempInitAct.id}`), false);
    assert.ok(n2.items.some((x) => x.id === 'act:ACT-001'));
    assert.ok(n2.items.some((x) => x.id === 'NOTIF-001'));
  } finally {
    envOnline.restore();
    await srv.close();
  }
});
