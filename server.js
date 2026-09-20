/**
 * マルテツフーズ株式会社 — Website + CMS server
 * ---------------------------------------------
 * - Serves the public site from /public
 * - Content stored in data/content.json (editable via admin)
 * - Admin auth: data/users.json (default created on first run)
 * - Image uploads saved to /uploads
 */
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const CONTENT_BACKUP = path.join(DATA_DIR, 'content.backup.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

/* ---------------------------------- auth ---------------------------------- */

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'marutetsu123';

function hashPw(password, salt) {
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    const salt = crypto.randomBytes(16).toString('hex');
    const users = {
      username: DEFAULT_USERNAME,
      salt: salt,
      hash: hashPw(DEFAULT_PASSWORD, salt),
      isDefault: true
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    return users;
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

// in-memory sessions (token -> username)
const sessions = new Map();

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
  if (token && sessions.has(token)) return next();
  res.status(401).json({ error: 'ログインしてください' });
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const users = loadUsers();
  if (
    username === users.username &&
    hashPw(String(password || ''), users.salt) === users.hash
  ) {
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, users.username);
    res.setHeader(
      'Set-Cookie',
      `mt_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
    );
    return res.json({ ok: true, username: users.username, isDefault: !!users.isDefault });
  }
  res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
});

app.post('/api/logout', (req, res) => {
  const token = getCookie(req, 'mt_session');
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'mt_session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const token = getCookie(req, 'mt_session');
  if (token && sessions.has(token)) {
    return res.json({ authenticated: true, username: sessions.get(token) });
  }
  const users = loadUsers();
  res.json({ authenticated: false, defaultActive: !!users.isDefault });
});

app.post('/api/change-credentials', requireAuth, (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body || {};
  const users = loadUsers();
  if (hashPw(String(currentPassword || ''), users.salt) !== users.hash) {
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
  const updated = {
    username: nextUsername,
    salt: salt,
    hash: hashPw(nextPassword || currentPassword, salt),
    // default flag only survives while the password is still the factory default
    isDefault: nextPassword
      ? (nextPassword === DEFAULT_PASSWORD && users.isDefault)
      : users.isDefault
  };
  fs.writeFileSync(USERS_FILE, JSON.stringify(updated, null, 2), 'utf8');
  res.json({ ok: true, username: nextUsername });
});

/* -------------------------------- content --------------------------------- */

app.get('/api/content', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const content = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  res.json(content);
});

app.put('/api/content', requireAuth, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !body.site) {
    return res.status(400).json({ error: 'コンテンツの形式が正しくありません' });
  }
  // keep a backup of the previous version
  try {
    if (fs.existsSync(CONTENT_FILE)) fs.copyFileSync(CONTENT_FILE, CONTENT_BACKUP);
  } catch (e) { /* ignore backup errors */ }
  const tmp = CONTENT_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2), 'utf8');
  fs.renameSync(tmp, CONTENT_FILE);
  res.json({ ok: true });
});

/* -------------------------------- uploads --------------------------------- */

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('画像ファイルのみアップロードできます'));
  }
});

app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: '画像が選択されていません' });
    res.json({ ok: true, url: '/uploads/' + req.file.filename });
  });
});

app.get('/api/images', requireAuth, (req, res) => {
  const files = fs
    .readdirSync(UPLOADS_DIR)
    .filter((f) => /\.(jpe?g|png|webp|gif|svg)$/i.test(f))
    .map((f) => ({ name: f, url: '/uploads/' + f }))
    .sort((a, b) => b.name.localeCompare(a.name));
  res.json(files);
});

/* --------------------------------- pages ---------------------------------- */

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/page/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'page.html'));
});

// clean URLs: /business → public/business.html
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  const p = req.path.replace(/\/+$/, '') || '/';
  if (p.includes('.')) return next();
  const file = path.join(__dirname, 'public', (p === '/' ? 'index' : p.slice(1)) + '.html');
  if (fs.existsSync(file)) return res.sendFile(file);
  next();
});

// everything else → home (simple SPA-style fallback)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.redirect('/');
});

app.listen(PORT, () => {
  loadUsers(); // create default user file on first run
  console.log('');
  console.log('  マルテツフーズ website running:');
  console.log(`  → http://localhost:${PORT}        (site)`);
  console.log(`  → http://localhost:${PORT}/admin  (admin)`);
  console.log('');
  console.log(`  初期ログイン情報: ${DEFAULT_USERNAME} / ${DEFAULT_PASSWORD}（必ず変更してください）`);
  console.log('');
});
