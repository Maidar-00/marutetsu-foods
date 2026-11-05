/**
 * Express app shared by:
 *   - server.js                  (local:  `node server.js`, file storage)
 *   - netlify/functions/app.js   (cloud:  Netlify + Neon Postgres + Cloudinary)
 *
 * All dynamic state (content / users / sessions / uploads) goes through
 * src/storage.js so both entry points behave identically.
 */
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./storage');

const app = express();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const BUNDLED_IMAGES = require('./bundled-images.json');

app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use(express.static(PUBLIC_DIR));

/* ---------------------------------- auth ---------------------------------- */

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function requireAuth(req, res, next) {
  const token = getCookie(req, 'mt_session');
  store
    .getSession(token)
    .then((username) => {
      if (!username) return res.status(401).json({ error: 'ログインしてください' });
      req.username = username;
      next();
    })
    .catch(() => res.status(500).json({ error: 'サーバーエラーが発生しました' }));
}

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const users = await store.loadUsers();
    if (
      username === users.username &&
      store.hashPw(String(password || ''), users.salt) === users.hash
    ) {
      const token = crypto.randomBytes(24).toString('hex');
      await store.setSession(token, users.username);
      res.setHeader(
        'Set-Cookie',
        `mt_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
      );
      return res.json({ ok: true, username: users.username, isDefault: !!users.isDefault });
    }
    res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
  } catch (e) {
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    await store.deleteSession(getCookie(req, 'mt_session'));
  } catch (e) {
    /* ignore */
  }
  res.setHeader('Set-Cookie', 'mt_session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  try {
    const username = await store.getSession(getCookie(req, 'mt_session'));
    if (username) {
      return res.json({ authenticated: true, username });
    }
    const users = await store.loadUsers();
    res.json({ authenticated: false, defaultActive: !!users.isDefault });
  } catch (e) {
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.post('/api/change-credentials', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body || {};
    const users = await store.loadUsers();
    if (store.hashPw(String(currentPassword || ''), users.salt) !== users.hash) {
      return res.status(400).json({ error: '現在のパスワードが正しくありません' });
    }
    const nextUsername = String(newUsername || users.username).trim();
    const nextPassword = String(newPassword || '').trim();
    if (nextUsername.length < 3) {
      return res.status(400).json({ error: 'ユーザー名は3文字以上にしてください' });
    }
    if (nextPassword && nextPassword.length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
    }
    const salt = users.salt;
    await store.saveUsers({
      username: nextUsername,
      salt,
      hash: store.hashPw(nextPassword || currentPassword, salt),
      // default flag only survives while the password is still the factory default
      isDefault: nextPassword
        ? nextPassword === store.DEFAULT_PASSWORD && users.isDefault
        : users.isDefault
    });
    res.json({ ok: true, username: nextUsername });
  } catch (e) {
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/* -------------------------------- content --------------------------------- */

app.get('/api/content', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await store.loadContent());
  } catch (e) {
    res.status(500).json({ error: 'コンテンツを読み込めませんでした' });
  }
});

app.put('/api/content', requireAuth, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !body.site) {
    return res.status(400).json({ error: 'コンテンツの形式が正しくありません' });
  }
  try {
    await store.saveContent(body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '保存できませんでした' });
  }
});

/* -------------------------------- uploads --------------------------------- */

const imageFilter = (req, file, cb) => {
  if (/^image\//.test(file.mimetype)) cb(null, true);
  else cb(new Error('画像ファイルのみアップロードできます'));
};

// local mode → disk (public/uploads/), cloud mode → memory → Cloudinary
const uploadLocal = multer({
  storage: multer.diskStorage({
    destination: store.UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter
});
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter
});

app.post('/api/upload', requireAuth, (req, res) => {
  const done = (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: '画像が選択されていません' });
    store
      .saveImage(req.file)
      .then((url) => res.json({ ok: true, url }))
      .catch(() => res.status(500).json({ error: 'アップロードに失敗しました' }));
  };
  const handler = store.useDb ? uploadMemory.single('file') : uploadLocal.single('file');
  handler(req, res, done);
});

app.get('/api/images', requireAuth, async (req, res) => {
  try {
    res.json(await store.listImages(BUNDLED_IMAGES));
  } catch (e) {
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/* --------------------------------- pages ---------------------------------- */

if (!process.env.NETLIFY) {
  // Local server serves HTML pages through Express.
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
  });

  app.get('/page/:slug', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'page.html'));
  });

  // clean URLs: /business → public/business.html
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    const p = req.path.replace(/\/+$/, '') || '/';
    if (p.includes('.')) return next();
    const file = path.join(PUBLIC_DIR, (p === '/' ? 'index' : p.slice(1)) + '.html');
    if (fs.existsSync(file)) return res.sendFile(file);
    next();
  });

  // everything else → home (simple SPA-style fallback)
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.redirect('/');
  });
} else {
  // On Netlify the CDN serves static pages (pretty URLs + the /page/* redirect
  // in netlify.toml); the function only ever receives /api/* requests.
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
}

module.exports = app;
