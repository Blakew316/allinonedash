// Durable storage for records this app owns: candidates added by uploading a
// resume, manual corrections to candidate details, and a record of every
// completed paperwork submission.
//
// On Netlify this is Netlify Blobs, so records survive deploys, restarts, and
// are shared across every device the team signs in from. Running locally it
// falls back to a JSON file, and if neither is available it degrades to memory
// rather than taking the site down — `describe()` reports which is in use.

import fs from 'node:fs';
import path from 'node:path';

const MEMORY = new Map();
let backend = null;
let blobStore = null;
let filePath = null;

// Resolved lazily: computing this at module load would let the bundler trace
// and bake a local data file into the deployed function, and the function's
// own directory is read-only at runtime anyway.
function resolveFilePath() {
  if (filePath) return filePath;
  filePath = process.env.NETLIFY
    ? path.join('/tmp', 'hiring-store.json')
    : path.resolve(process.cwd(), '.data', 'hiring-store.json');
  return filePath;
}

async function resolveBackend() {
  if (backend) return backend;

  // Netlify Blobs configures itself inside a Netlify Function.
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name: 'wholesale-hiring', consistency: 'strong' });
    await store.get('__probe__');
    blobStore = store;
    backend = 'blobs';
    return backend;
  } catch (err) {
    if (process.env.NETLIFY) {
      console.error('Netlify Blobs unavailable, falling back to local storage:', err.message);
    }
  }

  try {
    const p = resolveFilePath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (!fs.existsSync(p)) fs.writeFileSync(p, '{}');
    backend = 'file';
    return backend;
  } catch {
    backend = 'memory';
    return backend;
  }
}

function readFileStore() {
  try {
    return JSON.parse(fs.readFileSync(resolveFilePath(), 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeFileStore(data) {
  const p = resolveFilePath();
  // The directory is created once at startup, but /tmp can be reaped between
  // invocations — recreating it costs nothing and turns a 500 into a write.
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export async function readCollection(name) {
  const kind = await resolveBackend();
  if (kind === 'blobs') {
    const value = await blobStore.get(name, { type: 'json' });
    return Array.isArray(value) ? value : [];
  }
  if (kind === 'file') {
    const all = readFileStore();
    return Array.isArray(all[name]) ? all[name] : [];
  }
  return MEMORY.get(name) || [];
}

export async function writeCollection(name, rows) {
  const kind = await resolveBackend();
  if (kind === 'blobs') {
    await blobStore.setJSON(name, rows);
    return rows;
  }
  if (kind === 'file') {
    const all = readFileStore();
    all[name] = rows;
    writeFileStore(all);
    return rows;
  }
  MEMORY.set(name, rows);
  return rows;
}

// Insert or replace a record by id, newest first, with a bounded history.
export async function upsertRecord(name, record, { limit = 2000 } = {}) {
  const rows = await readCollection(name);
  const without = rows.filter((r) => String(r.id) !== String(record.id));
  const next = [record, ...without].slice(0, limit);
  await writeCollection(name, next);
  return record;
}

export async function deleteRecord(name, id) {
  const rows = await readCollection(name);
  const next = rows.filter((r) => String(r.id) !== String(id));
  await writeCollection(name, next);
  return rows.length !== next.length;
}

export async function describe() {
  const kind = await resolveBackend();
  return {
    backend: kind,
    persistent: kind !== 'memory',
    // Only Blobs is shared across devices and survives a redeploy.
    sharedAcrossDevices: kind === 'blobs',
  };
}

export const COLLECTIONS = {
  candidates: 'uploaded-candidates',
  overrides: 'candidate-overrides',
  sends: 'packet-sends',
  hires: 'completed-hires',
};
