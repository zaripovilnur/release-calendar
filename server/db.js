const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stages (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status_id INTEGER NOT NULL REFERENCES statuses(id),
  from_month TEXT NOT NULL,
  to_month TEXT NOT NULL
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

function open() {
  fs.mkdirSync(path.dirname(config.DB_FILE), { recursive: true });
  const db = new Database(config.DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

module.exports = { open };
