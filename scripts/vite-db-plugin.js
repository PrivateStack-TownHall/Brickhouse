import fs from 'node:fs/promises';
import path from 'node:path';
import { ENTITIES, RELATIONS, OBJECT_COLLECTIONS, SCHEMA_VERSION } from '../src/services/schema.js';

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB safety cap

export function getDatabaseFileMap() {
  const map = {};
  for (const [k, def] of Object.entries(ENTITIES)) map[k] = def.file;
  for (const [k, def] of Object.entries(RELATIONS)) map[k] = def.file;
  for (const [k, def] of Object.entries(OBJECT_COLLECTIONS)) map[k] = def.file;
  return map;
}

export async function readDatabaseFromDisk(dbDir) {
  const fileMap = getDatabaseFileMap();
  const dataset = {};

  try {
    const schemaRaw = await fs.readFile(path.join(dbDir, 'system/schema-version.json'), 'utf8');
    const parsedSchema = JSON.parse(schemaRaw);
    dataset.schemaVersion = Number(parsedSchema?.version) || SCHEMA_VERSION;
  } catch {
    dataset.schemaVersion = SCHEMA_VERSION;
  }

  await Promise.all(
    Object.entries(fileMap).map(async ([key, relFile]) => {
      const fullPath = path.join(dbDir, relFile);
      try {
        const raw = await fs.readFile(fullPath, 'utf8');
        dataset[key] = JSON.parse(raw);
      } catch {
        dataset[key] = key in OBJECT_COLLECTIONS ? {} : [];
      }
    }),
  );

  return dataset;
}

function serializeSettingsForDisk(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  return settings;
}

export async function writeDatabaseToDisk(dbDir, payload, onFileWritten) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid registry payload.');
  }
  const fileMap = getDatabaseFileMap();
  const written = [];
  const unchanged = [];

  for (const [key, relFile] of Object.entries(fileMap)) {
    if (!(key in payload)) continue;
    const value = key === 'settings' ? serializeSettingsForDisk(payload[key]) : payload[key];
    if (value === undefined) continue;
    const nextText = `${JSON.stringify(value, null, 2)}\n`;
    const fullPath = path.resolve(dbDir, relFile);

    let prevText = null;
    try {
      prevText = await fs.readFile(fullPath, 'utf8');
    } catch {
      prevText = null;
    }

    if (prevText !== null) {
      try {
        if (JSON.stringify(JSON.parse(prevText)) === JSON.stringify(value)) {
          unchanged.push(relFile);
          continue;
        }
      } catch {
        if (prevText === nextText) {
          unchanged.push(relFile);
          continue;
        }
      }
    }

    const eol = prevText && prevText.includes('\r\n') ? '\r\n' : '\n';
    const formatted = eol === '\r\n' ? nextText.replace(/\n/g, '\r\n') : nextText;

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    onFileWritten?.(fullPath);
    await fs.writeFile(fullPath, formatted, 'utf8');
    written.push(relFile);
  }

  return { written, unchanged };
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
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(text));
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

export function brickhouseDatabasePlugin() {
  let dbDir = path.resolve(process.cwd(), 'database');
  let writeQueue = Promise.resolve();
  const recentWrites = new Map();

  const markWritten = (filePath) => {
    recentWrites.set(path.resolve(filePath).toLowerCase(), Date.now());
  };

  const isRecentSelfWrite = (filePath) => {
    const key = path.resolve(filePath).toLowerCase();
    const ts = recentWrites.get(key);
    if (!ts) return false;
    if (Date.now() - ts < 3000) return true;
    recentWrites.delete(key);
    return false;
  };

  const middleware = async (req, res, next) => {
    const urlPath = (req.url || '').split('?')[0];
    if (urlPath !== '/api/db/registry') return next();

    if (req.method === 'GET') {
      try {
        await writeQueue;
        const dataset = await readDatabaseFromDisk(dbDir);
        return sendJson(res, 200, { ok: true, dataset });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: String(e?.message || e) });
      }
    }

    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const payload = body?.dataset && typeof body.dataset === 'object' ? body.dataset : body;
        const result = await (writeQueue = writeQueue.then(
          () => writeDatabaseToDisk(dbDir, payload, markWritten),
          () => writeDatabaseToDisk(dbDir, payload, markWritten),
        ));
        return sendJson(res, 200, { ok: true, ...result });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: String(e?.message || e) });
      }
    }

    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  };

  return {
    name: 'brickhouse-database-json-sync',
    configResolved(config) {
      dbDir = path.resolve(config.root, 'database');
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    handleHotUpdate({ file }) {
      if (isRecentSelfWrite(file)) {
        return [];
      }
      return undefined;
    },
  };
}
