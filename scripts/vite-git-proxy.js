import fs from 'node:fs/promises';
import path from 'node:path';
import { readDatabaseFromDisk } from './vite-db-plugin.js';

const DEFAULT_ALLOWED_ORIGINS = {
  github: ['https://api.github.com'],
  gitlab: ['https://gitlab.com'],
  bitbucket: ['https://api.bitbucket.org'],
};

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

export function parseEnvFile(text = '') {
  const out = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

export async function loadServerEnv(rootDir) {
  const merged = {};
  for (const file of ['.env', '.env.local']) {
    try {
      const text = await fs.readFile(path.join(rootDir, file), 'utf8');
      Object.assign(merged, parseEnvFile(text));
    } catch {
      // File optional
    }
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (v && (k.startsWith('BRICKHOUSE_') || k === 'GITHUB_TOKEN' || k === 'GH_TOKEN')) {
      if (!(k in merged)) merged[k] = v;
    }
  }
  return merged;
}

export function normalizeOrgEnvSuffix(org = '') {
  return String(org || '').trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

export function resolveServerToken(env, provider, organization = '') {
  const p = String(provider || '').toLowerCase();
  if (!['github', 'gitlab', 'bitbucket'].includes(p)) return { token: '', source: null };
  const prefix = `BRICKHOUSE_${p.toUpperCase()}_TOKEN`;
  const suffix = normalizeOrgEnvSuffix(organization);
  if (suffix) {
    const orgKey = `${prefix}_${suffix}`;
    if (env[orgKey]?.trim()) return { token: env[orgKey].trim(), source: 'env-org' };
  }
  if (env[prefix]?.trim()) return { token: env[prefix].trim(), source: 'env-provider' };
  if (p === 'github') {
    const fallback = env.GITHUB_TOKEN?.trim() || env.GH_TOKEN?.trim() || '';
    if (fallback) return { token: fallback, source: 'env-provider' };
  }
  return { token: '', source: null };
}

export function maskToken(token = '') {
  const t = String(token || '').trim();
  if (!t) return null;
  if (t.length <= 8) return '••••';
  return `${t.slice(0, 4)}••••${t.slice(-4)}`;
}

async function allowedApiPrefixes(rootDir, provider) {
  const defaults = DEFAULT_ALLOWED_ORIGINS[provider] || [];
  const prefixes = [...defaults];
  try {
    const ds = await readDatabaseFromDisk(path.join(rootDir, 'database'));
    const integrations = ds?.settings?.integrations || {};
    const list = Array.isArray(integrations.connections) ? integrations.connections : [];
    for (const conn of list) {
      if (conn?.provider !== provider || !conn?.apiBaseUrl) continue;
      const u = new URL(conn.apiBaseUrl);
      if (u.protocol === 'https:' && !u.username && !u.password) {
        prefixes.push(u.origin);
      }
    }
    const legacyUrl = integrations[provider]?.apiBaseUrl;
    if (legacyUrl) {
      const u = new URL(legacyUrl);
      if (u.protocol === 'https:' && !u.username && !u.password) prefixes.push(u.origin);
    }
  } catch {
    // Ignore read issues and rely on defaults
  }
  return [...new Set(prefixes)];
}

export async function isAllowedProxyUrl(rootDir, provider, rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  const origins = await allowedApiPrefixes(rootDir, provider);
  if (!origins.includes(u.origin)) return false;
  if (provider === 'github' && u.origin !== 'https://api.github.com' && !u.pathname.startsWith('/api/v3/')) return false;
  if (provider === 'gitlab' && !u.pathname.includes('/api/v4/')) return false;
  if (provider === 'bitbucket' && u.origin !== 'https://api.bitbucket.org') return false;
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Payload too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function brickhouseGitProxyPlugin({ fetchImpl = fetch } = {}) {
  let rootDir = process.cwd();

  const middleware = async (req, res, next) => {
    const urlPath = (req.url || '').split('?')[0];
    if (urlPath !== '/api/git/env-status' && urlPath !== '/api/git/proxy') return next();

    if (urlPath === '/api/git/env-status') {
      if (req.method !== 'POST' && req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
      try {
        const env = await loadServerEnv(rootDir);
        const body = req.method === 'POST' ? await readJsonBody(req) : {};
        const connections = Array.isArray(body?.connections) ? body.connections : [];
        const statuses = {};
        for (const c of connections) {
          if (!c?.id) continue;
          const resolved = resolveServerToken(env, c.provider, c.organization);
          statuses[c.id] = {
            configured: Boolean(resolved.token),
            source: resolved.source,
            masked: maskToken(resolved.token),
          };
        }
        return sendJson(res, 200, {
          ok: true,
          providers: {
            github: Boolean(resolveServerToken(env, 'github').token),
            gitlab: Boolean(resolveServerToken(env, 'gitlab').token),
            bitbucket: Boolean(resolveServerToken(env, 'bitbucket').token),
          },
          statuses,
        });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: String(e?.message || e) });
      }
    }

    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    try {
      const body = await readJsonBody(req);
      const provider = String(body?.provider || '').toLowerCase();
      const organization = String(body?.organization || '');
      const targetUrl = String(body?.url || '');
      if (!(await isAllowedProxyUrl(rootDir, provider, targetUrl))) {
        return sendJson(res, 403, { ok: false, error: 'Blocked proxy URL: host or API path is not allow-listed.' });
      }
      const env = await loadServerEnv(rootDir);
      const { token } = resolveServerToken(env, provider, organization);
      if (!token) {
        return sendJson(res, 400, { ok: false, error: 'No server-side token configured in .env / .env.local for this integration.' });
      }
      const headers = {
        Accept: typeof body?.accept === 'string' ? body.accept : (provider === 'github' ? 'application/vnd.github+json' : 'application/json'),
        'User-Agent': 'Brickhouse-Local-Registry',
      };
      headers[provider === 'gitlab' ? 'PRIVATE-TOKEN' : 'Authorization'] = provider === 'gitlab' ? token : `Bearer ${token}`;

      const upstream = await fetchImpl(targetUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(20000),
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      });

      const forwardedHeaders = {};
      for (const h of ['x-ratelimit-remaining', 'x-ratelimit-limit', 'x-ratelimit-reset', 'x-oauth-scopes']) {
        const v = upstream.headers?.get?.(h);
        if (v !== null && v !== undefined) forwardedHeaders[h] = v;
      }

      let parsedBody = null;
      try { parsedBody = await upstream.json(); } catch { parsedBody = null; }
      return sendJson(res, 200, {
        ok: upstream.ok,
        status: upstream.status,
        headers: forwardedHeaders,
        body: parsedBody,
      });
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: String(e?.message || e) });
    }
  };

  return {
    name: 'brickhouse-git-proxy',
    configResolved(config) {
      rootDir = config.root;
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
