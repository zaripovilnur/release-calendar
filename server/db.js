const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');
const { monthStart, monthEnd } = require('./util');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS directions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS statuses (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  background TEXT NOT NULL,
  color TEXT NOT NULL,
  border TEXT NULL,
  is_release INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  direction_id INTEGER NOT NULL REFERENCES directions(id),
  description TEXT NOT NULL DEFAULT '',
  released_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stages (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status_id INTEGER NOT NULL REFERENCES statuses(id),
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  contact_url TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('link', 'file')),
  title TEXT NOT NULL,
  url TEXT NULL,
  category TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  note TEXT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS file_versions (
  id INTEGER PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  stored_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  mime TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS date_history (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  reason TEXT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stages_product ON stages(product_id);
CREATE INDEX IF NOT EXISTS idx_materials_product ON materials(product_id);
CREATE INDEX IF NOT EXISTS idx_versions_material ON file_versions(material_id);
`;

// Раньше сроки этапов хранились месяцами ('2027-04'). Переводим в даты: с 1-го по последнее число месяца
function migrateStagesToDates(db) {
  const cols = db.prepare("SELECT name FROM pragma_table_info('stages')").all().map((c) => c.name);
  if (!cols.includes('from_month')) return;
  db.transaction(() => {
    db.exec('ALTER TABLE stages ADD COLUMN from_date TEXT');
    db.exec('ALTER TABLE stages ADD COLUMN to_date TEXT');
    const upd = db.prepare('UPDATE stages SET from_date = ?, to_date = ? WHERE id = ?');
    for (const s of db.prepare('SELECT id, from_month, to_month FROM stages').all()) {
      upd.run(monthStart(s.from_month), monthEnd(s.to_month), s.id);
    }
    db.exec('ALTER TABLE stages DROP COLUMN from_month');
    db.exec('ALTER TABLE stages DROP COLUMN to_month');
  })();
}

// Отметка «Релиз состоялся»: дата, когда администратор её поставил. В старых базах колонки нет — добавляем
function addReleasedAt(db) {
  const cols = db.prepare("SELECT name FROM pragma_table_info('products')").all().map((c) => c.name);
  if (!cols.includes('released_at')) db.exec('ALTER TABLE products ADD COLUMN released_at TEXT NULL');
}

function open() {
  fs.mkdirSync(path.dirname(config.DB_FILE), { recursive: true });
  const db = new Database(config.DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrateStagesToDates(db);
  db.exec(SCHEMA);
  addReleasedAt(db);
  // Галочки «Закрепить в карточке» больше нет: ссылки, добавленные без неё, тоже показываем в карточке
  db.prepare("UPDATE materials SET pinned = 1 WHERE kind = 'link' AND pinned = 0").run();
  // Тип «Планы» заменён на «Другое»
  db.prepare("UPDATE materials SET category = 'Другое' WHERE category = 'Планы'").run();
  return db;
}

module.exports = { open };
