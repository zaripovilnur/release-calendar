const path = require('path');

const ROOT = path.resolve(__dirname, '..');

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // .env необязателен: значения по умолчанию ниже
}

function fromRoot(p) {
  return path.isAbsolute(p) ? p : path.join(ROOT, p);
}

module.exports = {
  ROOT,
  PORT: Number(process.env.PORT) || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'release-calendar-dev-secret',
  ADMIN_LOGIN: process.env.ADMIN_LOGIN || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin',
  UPLOAD_DIR: fromRoot(process.env.UPLOAD_DIR || './storage/uploads'),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 200,
  DB_FILE: fromRoot(process.env.DB_FILE || './storage/app.db'),
};
