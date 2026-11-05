/**
 * マルテツフーズ株式会社 — local development server
 *
 * Default: local file storage (data/ + public/uploads/).
 * If DATABASE_URL (Neon) and Cloudinary keys are set — in .env or the
 * environment — cloud storage is used instead. See DEPLOY-GUIDE.md.
 */
const app = require('./src/app');
const store = require('./src/storage');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('  マルテツフーズ website running:');
  console.log(`  → http://localhost:${PORT}        (site)`);
  console.log(`  → http://localhost:${PORT}/admin  (admin)`);
  console.log(
    `  storage: ${
      store.mode === 'cloud'
        ? 'Neon Postgres + Cloudinary (cloud)'
        : 'local files (data/, public/uploads/)'
    }`
  );
  console.log('');
  console.log(`  初期ログイン情報: ${store.DEFAULT_USERNAME} / ${store.DEFAULT_PASSWORD}（必ず変更してください）`);
  console.log('');
});
