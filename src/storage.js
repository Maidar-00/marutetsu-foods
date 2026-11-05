/**
 * Storage layer — two modes, chosen automatically by environment:
 *
 *  LOCAL (default — `node server.js` / start.bat):
 *    content + users → data/*.json, sessions → memory, images → public/uploads/
 *
 *  CLOUD (DATABASE_URL is set — Netlify + Neon + Cloudinary):
 *    content + users + sessions → Postgres `kv` table (persists forever),
 *    uploaded images → Cloudinary CDN (persists forever)
 *
 * The same API is exposed in both modes, so src/app.js never branches on mode
 * except for the multer destination.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'public', 'uploads');
const SEED_CONTENT = require('../data/content.json');

const useDb = !!process.env.DATABASE_URL;
const mode = useDb ? 'cloud' : 'local';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ------------------------------ kv (Postgres) ----------------------------- */

let poolPromise = null;
function db() {
  if (!poolPromise) {
    poolPromise = (async () => {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
          ? false
          : { rejectUnauthorized: false },
        max: 3
      });
      await pool.query(
        `CREATE TABLE IF NOT EXISTS kv (
           key TEXT PRIMARY KEY,
           value JSONB NOT NULL,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      return pool;
    })();
  }
  return poolPromise;
}

async function kvGet(key) {
  if (!useDb) {
    const file = path.join(DATA_DIR, key + '.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  }
  const pool = await db();
  const r = await pool.query('SELECT value FROM kv WHERE key = $1', [key]);
  return r.rows.length ? r.rows[0].value : null;
}

async function kvSet(key, value) {
  if (!useDb) {
    const final = path.join(DATA_DIR, key + '.json');
    const tmp = final + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, final);
    return;
  }
  const pool = await db();
  await pool.query(
    `INSERT INTO kv (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
}

/* ---------------------------------- users --------------------------------- */

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'marutetsu123';

function hashPw(password, salt) {
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}

function defaultUsers() {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    username: DEFAULT_USERNAME,
    salt,
    hash: hashPw(DEFAULT_PASSWORD, salt),
    isDefault: true
  };
}

async function loadUsers() {
  const users = await kvGet('users');
  if (users) return users;
  const created = defaultUsers(); // first run — create the factory default login
  await kvSet('users', created);
  return created;
}

async function saveUsers(users) {
  await kvSet('users', users);
}

/* -------------------------------- sessions -------------------------------- */
/* In-memory locally; stored in Postgres in cloud mode so the admin stays
   logged in across serverless cold starts. */

const memSessions = new Map();
const SESSION_TTL = 30 * 24 * 3600 * 1000; // 30 days

async function getSession(token) {
  if (!token) return null;
  if (!useDb) return memSessions.get(token) || null;
  const all = (await kvGet('sessions')) || {};
  const rec = all[token];
  if (!rec) return null;
  if (Date.now() - rec.t > SESSION_TTL) {
    delete all[token];
    await kvSet('sessions', all);
    return null;
  }
  return rec.u;
}

async function setSession(token, username) {
  if (!useDb) {
    memSessions.set(token, username);
    return;
  }
  const all = (await kvGet('sessions')) || {};
  for (const t of Object.keys(all)) {
    if (Date.now() - all[t].t > SESSION_TTL) delete all[t];
  }
  all[token] = { u: username, t: Date.now() };
  await kvSet('sessions', all);
}

async function deleteSession(token) {
  if (!token) return;
  if (!useDb) {
    memSessions.delete(token);
    return;
  }
  const all = (await kvGet('sessions')) || {};
  if (all[token]) {
    delete all[token];
    await kvSet('sessions', all);
  }
}

/* --------------------------------- content -------------------------------- */

async function loadContent() {
  const content = await kvGet('content');
  return content || SEED_CONTENT; // seed on first run of a fresh database
}

async function saveContent(content) {
  if (!useDb) {
    // keep a backup of the previous version (local mode only)
    const file = path.join(DATA_DIR, 'content.json');
    try {
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(DATA_DIR, 'content.backup.json'));
      }
    } catch (e) {
      /* ignore backup errors */
    }
  }
  await kvSet('content', content);
}

/* --------------------------------- images --------------------------------- */

function cloudinary() {
  const cld = require('cloudinary').v2;
  if (!cld.config().cloud_name) {
    if (process.env.CLOUDINARY_URL) {
      cld.config(true); // parse CLOUDINARY_URL=cloud://key:secret@cloud_name
    } else if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      cld.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    }
  }
  return cld.config().cloud_name ? cld : null;
}

async function saveImage(file) {
  if (useDb) {
    const cld = cloudinary();
    if (!cld) throw new Error('画像保存先（Cloudinary）が設定されていません');
    const result = await new Promise((resolve, reject) => {
      cld.uploader
        .upload_stream(
          {
            folder: 'marutetsu',
            use_filename: true,
            unique_filename: true,
            resource_type: 'image'
          },
          (err, res) => (err ? reject(err) : resolve(res))
        )
        .end(file.buffer);
    });
    return result.secure_url;
  }
  // local mode: multer (disk storage) already wrote the file into UPLOADS_DIR
  return '/uploads/' + file.filename;
}

async function listImages(bundled) {
  if (!useDb) {
    return fs
      .readdirSync(UPLOADS_DIR)
      .filter((f) => /\.(jpe?g|png|webp|gif|svg)$/i.test(f))
      .map((f) => ({ name: f, url: '/uploads/' + f }))
      .sort((a, b) => b.name.localeCompare(a.name));
  }
  const list = [];
  const cld = cloudinary();
  if (cld) {
    try {
      const res = await cld.api.resources({
        type: 'upload',
        prefix: 'marutetsu/',
        max_results: 100
      });
      for (const r of res.resources) {
        list.push({
          name: (r.public_id.split('/').pop() || 'image') + '.' + r.format,
          url: r.secure_url
        });
      }
    } catch (e) {
      /* listing failure is not fatal — fall back to bundled images */
    }
  }
  // images shipped with the repo (public/uploads/) are served statically
  for (const url of bundled || []) {
    list.push({ name: url.split('/').pop(), url });
  }
  return list;
}

module.exports = {
  mode,
  useDb,
  DATA_DIR,
  UPLOADS_DIR,
  DEFAULT_USERNAME,
  DEFAULT_PASSWORD,
  hashPw,
  loadUsers,
  saveUsers,
  getSession,
  setSession,
  deleteSession,
  loadContent,
  saveContent,
  saveImage,
  listImages
};
