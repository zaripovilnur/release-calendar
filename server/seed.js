// npm run seed       — создать базу и загрузить data/seed.json
// npm run seed:demo  — дополнительно загрузить data/demo.json (для сверки с эталоном)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { open } = require('./db');
const { normalizeDateTime, monthStart, monthEnd, rangeText } = require('./util');

const IMPORT_AUTHOR = 'Импорт из таблицы';
const IMPORT_DATE = '2026-10-27T00:00:00';

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(config.ROOT, 'data', name), 'utf8'));
}

function clearUploads() {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  for (const f of fs.readdirSync(config.UPLOAD_DIR)) {
    fs.rmSync(path.join(config.UPLOAD_DIR, f), { force: true, recursive: true });
  }
}

function seed(db) {
  const data = readJson('seed.json');
  db.transaction(() => {
    for (const t of ['date_history', 'file_versions', 'materials', 'team_members', 'stages', 'products', 'statuses', 'directions', 'sessions']) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    const dirIds = {};
    const insDir = db.prepare('INSERT INTO directions (name, sort) VALUES (?, ?)');
    for (const d of data.directions) dirIds[d.name] = insDir.run(d.name, d.sort).lastInsertRowid;

    const statusIds = {};
    const insStatus = db.prepare('INSERT INTO statuses (key, name, sort, background, color, border, is_release) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const s of data.statuses) {
      statusIds[s.key] = insStatus.run(s.key, s.name, s.sort, s.style.background, s.style.color, s.style.border, s.isRelease ? 1 : 0).lastInsertRowid;
    }
    const releaseKey = data.statuses.find((s) => s.isRelease).key;

    const insProduct = db.prepare("INSERT INTO products (name, direction_id, description, created_at, updated_at) VALUES (?, ?, '', ?, ?)");
    const insStage = db.prepare('INSERT INTO stages (product_id, status_id, from_date, to_date) VALUES (?, ?, ?, ?)');
    const insHistory = db.prepare('INSERT INTO date_history (product_id, text, reason, author, created_at) VALUES (?, ?, NULL, ?, ?)');
    for (const p of data.products) {
      const id = insProduct.run(p.name, dirIds[p.direction], IMPORT_DATE, IMPORT_DATE).lastInsertRowid;
      // В таблице сроки месяцами: этап идёт с 1-го числа первого месяца по последнее число последнего
      for (const s of p.stages) insStage.run(id, statusIds[s.status], monthStart(s.from), monthEnd(s.to));
      const ga = p.stages.find((s) => s.status === releaseKey);
      if (ga) insHistory.run(id, `Сроки внесены: GA — ${rangeText(monthStart(ga.from), monthEnd(ga.to))}`, IMPORT_AUTHOR, IMPORT_DATE);
    }

    const hash = bcrypt.hashSync(config.ADMIN_PASSWORD, 10);
    db.prepare('INSERT INTO admins (login, password_hash) VALUES (?, ?) ON CONFLICT(login) DO UPDATE SET password_hash = excluded.password_hash')
      .run(config.ADMIN_LOGIN, hash);
  })();
  clearUploads();
  console.log(`Готово: ${data.directions.length} направления, ${data.statuses.length} статуса, ${data.products.length} продуктов. Администратор: ${config.ADMIN_LOGIN}`);
}

function seedDemo(db) {
  const demo = readJson('demo.json');
  const product = db.prepare('SELECT id FROM products WHERE name = ?').get(demo.product);
  if (!product) {
    console.error(`Продукт «${demo.product}» не найден. Сначала выполните npm run seed`);
    process.exit(1);
  }
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  db.transaction(() => {
    const pid = product.id;
    const oldFiles = db.prepare('SELECT v.stored_name FROM file_versions v JOIN materials m ON m.id = v.material_id WHERE m.product_id = ?').all(pid);
    for (const f of oldFiles) fs.rmSync(path.join(config.UPLOAD_DIR, f.stored_name), { force: true });
    db.prepare('DELETE FROM materials WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM team_members WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM date_history WHERE product_id = ? AND author <> ?').run(pid, IMPORT_AUTHOR);

    db.prepare('UPDATE products SET description = ? WHERE id = ?').run(demo.description || '', pid);

    const insMember = db.prepare('INSERT INTO team_members (product_id, full_name, role, contact_url, sort) VALUES (?, ?, ?, ?, ?)');
    demo.team.forEach((m, i) => insMember.run(pid, m.fullName, m.role, m.contactUrl, i));

    const insHistory = db.prepare('INSERT INTO date_history (product_id, text, reason, author, created_at) VALUES (?, ?, ?, ?, ?)');
    for (const h of demo.dateHistory) insHistory.run(pid, h.text, h.reason || null, h.author, normalizeDateTime(h.createdAt));

    const insMaterial = db.prepare('INSERT INTO materials (product_id, kind, title, url, category, pinned, note, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insVersion = db.prepare('INSERT INTO file_versions (material_id, version, stored_name, original_name, size, mime, author, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)');
    for (const m of demo.materials) {
      const created = normalizeDateTime(m.createdAt);
      const mid = insMaterial.run(pid, m.kind, m.title, m.kind === 'link' ? m.url : null, m.category, m.pinned ? 1 : 0, m.note || null, m.author, created).lastInsertRowid;
      if (m.kind === 'file') {
        // Пустая заглушка с указанным именем и номером версии
        const stored = crypto.randomBytes(16).toString('hex');
        fs.writeFileSync(path.join(config.UPLOAD_DIR, stored), '');
        insVersion.run(mid, m.version || 1, stored, m.title, 'application/octet-stream', m.author, created);
      }
    }
  })();
  console.log(`Демо-данные загружены для «${demo.product}»: ${demo.materials.length} материалов, ${demo.team.length} участника команды`);
}

const db = open();
if (process.argv.includes('--demo')) seedDemo(db);
else seed(db);
db.close();
