const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const config = require('./config');
const { open } = require('./db');
const { sessionMiddleware, requireAdmin, authRouter } = require('./auth');
const { nowLocal, isDate, rangeText } = require('./util');

const CATEGORIES = ['Презентации', 'Макеты', 'Визуалы', 'Документы', 'Тексты', 'Сайт', 'Другое'];
const EMPLOYEE_AUTHOR = 'Сотрудник';

const db = open();
fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(sessionMiddleware(db));

const PUBLIC = path.join(config.ROOT, 'public');
const page = (name) => (req, res) => res.sendFile(path.join(PUBLIC, name));
app.get('/', page('index.html'));
app.get('/products', page('products.html'));
app.get('/files', page('files.html'));
app.get('/products/:id', page('product.html'));
app.use(express.static(PUBLIC, { index: false }));

const api = express.Router();
api.use('/auth', authRouter(db));

function author(req) {
  return (req.session && req.session.admin) || EMPLOYEE_AUTHOR;
}

function bad(res, message, code = 400) {
  return res.status(code).json({ error: message });
}

function toId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------- Чтение ----------

function statusRow(s) {
  return { id: s.id, key: s.key, name: s.name, sort: s.sort, background: s.background, color: s.color, border: s.border, isRelease: !!s.is_release };
}

function materialRows(where = '', params = []) {
  const rows = db.prepare(`
    SELECT m.*, p.name AS product_name, p.direction_id,
      v.version, v.original_name, v.author AS v_author, v.created_at AS v_created
    FROM materials m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN file_versions v ON v.id = (SELECT id FROM file_versions WHERE material_id = m.id ORDER BY version DESC LIMIT 1)
    ${where}`).all(...params);
  return rows.map((m) => ({
    id: m.id,
    productId: m.product_id,
    productName: m.product_name,
    directionId: m.direction_id,
    kind: m.kind,
    title: m.title,
    url: m.url,
    category: m.category,
    pinned: !!m.pinned,
    note: m.note,
    version: m.kind === 'file' ? m.version : null,
    author: m.kind === 'file' && m.v_author ? m.v_author : m.author,
    date: m.kind === 'file' && m.v_created ? m.v_created : m.created_at,
  })).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
}

api.get('/state', (req, res) => {
  const directions = db.prepare('SELECT id, name, sort FROM directions ORDER BY sort, id').all();
  const statuses = db.prepare('SELECT * FROM statuses ORDER BY sort, id').all().map(statusRow);
  const stagesBy = new Map();
  for (const s of db.prepare('SELECT product_id, status_id, from_date, to_date FROM stages ORDER BY from_date, id').all()) {
    if (!stagesBy.has(s.product_id)) stagesBy.set(s.product_id, []);
    stagesBy.get(s.product_id).push({ statusId: s.status_id, from: s.from_date, to: s.to_date });
  }
  const counts = db.prepare("SELECT product_id, SUM(kind = 'link') AS links, SUM(kind = 'file') AS files FROM materials GROUP BY product_id").all();
  const countBy = Object.fromEntries(counts.map((c) => [c.product_id, c]));
  const products = db.prepare('SELECT id, name, direction_id, description, released_at FROM products ORDER BY id').all().map((p) => ({
    id: p.id,
    name: p.name,
    directionId: p.direction_id,
    description: p.description,
    releasedAt: p.released_at,
    stages: stagesBy.get(p.id) || [],
    links: countBy[p.id] ? countBy[p.id].links : 0,
    files: countBy[p.id] ? countBy[p.id].files : 0,
  }));
  res.json({ admin: (req.session && req.session.admin) || null, mattermostUrl: config.MATTERMOST_URL, categories: CATEGORIES, directions, statuses, products });
});

api.get('/products/:id', (req, res) => {
  const id = toId(req.params.id);
  const p = id && db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p) return bad(res, 'Продукт не найден', 404);
  res.json({
    team: db.prepare('SELECT full_name, role, contact_url FROM team_members WHERE product_id = ? ORDER BY sort, id').all(id)
      .map((m) => ({ fullName: m.full_name, role: m.role, contactUrl: m.contact_url })),
    history: db.prepare('SELECT text, reason, author, created_at FROM date_history WHERE product_id = ? ORDER BY created_at DESC, id DESC').all(id)
      .map((h) => ({ text: h.text, reason: h.reason, author: h.author, date: h.created_at })),
    materials: materialRows('WHERE m.product_id = ?', [id]),
  });
});

api.get('/materials', (req, res) => {
  res.json(materialRows());
});

// ---------- Направления и статусы (администратор) ----------

api.post('/directions', requireAdmin, (req, res) => {
  const name = String((req.body && req.body.name) || '').trim();
  if (!name) return bad(res, 'Введите название');
  if (db.prepare('SELECT 1 FROM directions WHERE name = ?').get(name)) return bad(res, 'Такое направление уже есть', 409);
  const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM directions').get().s;
  const id = db.prepare('INSERT INTO directions (name, sort) VALUES (?, ?)').run(name, sort).lastInsertRowid;
  res.json({ id });
});

api.put('/directions/:id', requireAdmin, (req, res) => {
  const id = toId(req.params.id);
  const name = String((req.body && req.body.name) || '').trim();
  if (!name) return bad(res, 'Введите название');
  if (db.prepare('SELECT 1 FROM directions WHERE name = ? AND id <> ?').get(name, id)) return bad(res, 'Такое направление уже есть', 409);
  const r = db.prepare('UPDATE directions SET name = ? WHERE id = ?').run(name, id);
  if (!r.changes) return bad(res, 'Направление не найдено', 404);
  res.json({ ok: true });
});

api.delete('/directions/:id', requireAdmin, (req, res) => {
  const id = toId(req.params.id);
  if (db.prepare('SELECT 1 FROM products WHERE direction_id = ?').get(id)) return bad(res, 'В направлении есть продукты', 409);
  db.prepare('DELETE FROM directions WHERE id = ?').run(id);
  res.json({ ok: true });
});

const COLOR = /^#[0-9A-Fa-f]{6}$/;

api.post('/statuses', requireAdmin, (req, res) => {
  const name = String((req.body && req.body.name) || '').trim();
  if (!name) return bad(res, 'Введите название');
  const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM statuses').get().s;
  const key = 'status-' + crypto.randomBytes(4).toString('hex');
  const id = db.prepare("INSERT INTO statuses (key, name, sort, background, color, border, is_release) VALUES (?, ?, ?, '#E0E0F5', '#000000', NULL, 0)")
    .run(key, name, sort).lastInsertRowid;
  res.json({ id });
});

api.put('/statuses/:id', requireAdmin, (req, res) => {
  const id = toId(req.params.id);
  const s = id && db.prepare('SELECT * FROM statuses WHERE id = ?').get(id);
  if (!s) return bad(res, 'Статус не найден', 404);
  const b = req.body || {};
  const next = { name: s.name, background: s.background, color: s.color, border: s.border };
  if (b.name !== undefined) {
    next.name = String(b.name).trim();
    if (!next.name) return bad(res, 'Введите название');
  }
  for (const k of ['background', 'color', 'border']) {
    if (b[k] === undefined) continue;
    if (k === 'border' && b[k] === null) { next.border = null; continue; }
    if (!COLOR.test(b[k])) return bad(res, 'Неверный цвет');
    next[k] = b[k].toUpperCase();
  }
  db.prepare('UPDATE statuses SET name = ?, background = ?, color = ?, border = ? WHERE id = ?')
    .run(next.name, next.background, next.color, next.border, id);
  res.json({ ok: true });
});

api.delete('/statuses/:id', requireAdmin, (req, res) => {
  const id = toId(req.params.id);
  if (db.prepare('SELECT 1 FROM stages WHERE status_id = ?').get(id)) return bad(res, 'Статус используется в сроках продуктов', 409);
  const s = db.prepare('SELECT is_release FROM statuses WHERE id = ?').get(id);
  if (s && s.is_release) return bad(res, 'Статус GA нельзя удалить', 409);
  db.prepare('DELETE FROM statuses WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------- Продукты (администратор) ----------

// Текст записи истории: что поменялось в сроках. Пустая строка — сроки не менялись
function stagesDiff(oldStages, newStages) {
  const statuses = db.prepare('SELECT * FROM statuses ORDER BY is_release DESC, sort, id').all();
  const parts = [];
  for (const s of statuses) {
    const a = oldStages.filter((x) => x.statusId === s.id).map((x) => rangeText(x.from, x.to)).join(', ');
    const b = newStages.filter((x) => x.statusId === s.id).map((x) => rangeText(x.from, x.to)).join(', ');
    if (a !== b) parts.push(`${s.name}: ${a || 'нет'} → ${b || 'нет'}`);
  }
  return parts.join('; ');
}

function parseProduct(body) {
  const b = body || {};
  const name = String(b.name || '').trim();
  if (!name) return { error: 'Введите название продукта' };
  const directionId = toId(b.directionId);
  if (!directionId || !db.prepare('SELECT 1 FROM directions WHERE id = ?').get(directionId)) return { error: 'Выберите направление' };
  const stages = [];
  for (const s of Array.isArray(b.stages) ? b.stages : []) {
    const statusId = toId(s.statusId);
    if (!statusId || !db.prepare('SELECT 1 FROM statuses WHERE id = ?').get(statusId)) return { error: 'Неизвестный статус' };
    if (!isDate(s.from) || !isDate(s.to)) return { error: 'Неверная дата' };
    if (s.from > s.to) return { error: 'Дата начала этапа позже даты окончания' };
    if (stages.some((x) => x.statusId === statusId)) return { error: 'У продукта может быть только один этап каждого статуса' };
    stages.push({ statusId, from: s.from, to: s.to });
  }
  const team = (Array.isArray(b.team) ? b.team : [])
    .map((m) => ({ fullName: String(m.fullName || '').trim(), role: String(m.role || '').trim(), contactUrl: String(m.contactUrl || '').trim() }))
    .filter((m) => m.fullName || m.role || m.contactUrl);
  return {
    name, directionId, stages, team,
    description: String(b.description || '').trim(),
    reason: String(b.reason || '').trim() || null,
  };
}

function writeChildren(id, p) {
  db.prepare('DELETE FROM stages WHERE product_id = ?').run(id);
  const insStage = db.prepare('INSERT INTO stages (product_id, status_id, from_date, to_date) VALUES (?, ?, ?, ?)');
  for (const s of p.stages) insStage.run(id, s.statusId, s.from, s.to);
  db.prepare('DELETE FROM team_members WHERE product_id = ?').run(id);
  const insMember = db.prepare('INSERT INTO team_members (product_id, full_name, role, contact_url, sort) VALUES (?, ?, ?, ?, ?)');
  p.team.forEach((m, i) => insMember.run(id, m.fullName, m.role, m.contactUrl, i));
}

function productStages(id) {
  return db.prepare('SELECT status_id, from_date, to_date FROM stages WHERE product_id = ? ORDER BY from_date, id').all(id)
    .map((s) => ({ statusId: s.status_id, from: s.from_date, to: s.to_date }));
}

api.post('/products', requireAdmin, (req, res) => {
  const p = parseProduct(req.body);
  if (p.error) return bad(res, p.error);
  const now = nowLocal();
  const id = db.transaction(() => {
    const newId = db.prepare('INSERT INTO products (name, direction_id, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(p.name, p.directionId, p.description, now, now).lastInsertRowid;
    writeChildren(newId, p);
    const release = db.prepare('SELECT id FROM statuses WHERE is_release = 1').get();
    const ga = release && p.stages.find((s) => s.statusId === release.id);
    if (ga) {
      db.prepare('INSERT INTO date_history (product_id, text, reason, author, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(newId, `Сроки внесены: GA — ${rangeText(ga.from, ga.to)}`, p.reason, author(req), now);
    }
    return newId;
  })();
  res.json({ id });
});

api.put('/products/:id', requireAdmin, (req, res) => {
  const id = toId(req.params.id);
  if (!id || !db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) return bad(res, 'Продукт не найден', 404);
  const p = parseProduct(req.body);
  if (p.error) return bad(res, p.error);
  const now = nowLocal();
  db.transaction(() => {
    const diff = stagesDiff(productStages(id), p.stages);
    db.prepare('UPDATE products SET name = ?, direction_id = ?, description = ?, updated_at = ? WHERE id = ?')
      .run(p.name, p.directionId, p.description, now, id);
    const release = db.prepare('SELECT id FROM statuses WHERE is_release = 1').get();
    if (!release || !p.stages.some((s) => s.statusId === release.id)) {
      db.prepare('UPDATE products SET released_at = NULL WHERE id = ?').run(id);
    }
    writeChildren(id, p);
    if (diff) {
      db.prepare('INSERT INTO date_history (product_id, text, reason, author, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, diff, p.reason, author(req), now);
    }
  })();
  res.json({ id });
});

// «Релиз состоялся»: поставить или снять отметку
api.post('/products/:id/release', requireAdmin, (req, res) => {
  const id = toId(req.params.id);
  const product = id && db.prepare('SELECT released_at FROM products WHERE id = ?').get(id);
  if (!product) return bad(res, 'Продукт не найден', 404);
  const released = !!(req.body && req.body.released);
  if (released === !!product.released_at) return res.json({ ok: true });
  const now = nowLocal();
  db.transaction(() => {
    db.prepare('UPDATE products SET released_at = ? WHERE id = ?').run(released ? now : null, id);
    // Отметка и её снятие видны в «Истории сроков»
    db.prepare('INSERT INTO date_history (product_id, text, reason, author, created_at) VALUES (?, ?, NULL, ?, ?)')
      .run(id, released ? 'Релиз состоялся' : 'Отметка о релизе снята', author(req), now);
  })();
  res.json({ ok: true });
});

api.delete('/products/:id', requireAdmin, (req, res) => {
  const id = toId(req.params.id);
  const files = db.prepare('SELECT v.stored_name FROM file_versions v JOIN materials m ON m.id = v.material_id WHERE m.product_id = ?').all(id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  for (const f of files) fs.rmSync(path.join(config.UPLOAD_DIR, f.stored_name), { force: true });
  res.json({ ok: true });
});

// ---------- Материалы (все) ----------

function checkMaterialTarget(productId, category) {
  if (!productId || !db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) return 'Выберите продукт';
  if (!CATEGORIES.includes(category)) return 'Выберите тип материала';
  return null;
}

api.post('/materials/link', (req, res) => {
  const b = req.body || {};
  const productId = toId(b.productId);
  const err = checkMaterialTarget(productId, b.category);
  if (err) return bad(res, err);
  let url;
  try {
    url = new URL(String(b.url || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    return bad(res, 'Введите адрес ссылки');
  }
  const title = String(b.title || '').trim() || url.hostname;
  const id = db.prepare('INSERT INTO materials (product_id, kind, title, url, category, pinned, note, author, created_at) VALUES (?, \'link\', ?, ?, ?, ?, NULL, ?, ?)')
    .run(productId, title, url.href, b.category, b.pinned ? 1 : 0, author(req), nowLocal()).lastInsertRowid;
  res.json({ id });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: config.UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex')),
  }),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
});

api.post('/materials/file', (req, res) => {
  upload.single('file')(req, res, (uploadErr) => {
    if (uploadErr) {
      return bad(res, uploadErr.code === 'LIMIT_FILE_SIZE' ? `Файл больше ${config.MAX_UPLOAD_MB} МБ` : 'Не удалось загрузить файл');
    }
    const f = req.file;
    if (!f) return bad(res, 'Выберите файл');
    const productId = toId(req.body.productId);
    const err = checkMaterialTarget(productId, req.body.category);
    if (err) {
      fs.rmSync(f.path, { force: true });
      return bad(res, err);
    }
    // multer отдаёт имя в latin1 — возвращаем UTF-8
    const name = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const who = author(req);
    const now = nowLocal();
    const result = db.transaction(() => {
      const existing = db.prepare("SELECT id FROM materials WHERE product_id = ? AND kind = 'file' AND title = ?").get(productId, name);
      let materialId;
      let version = 1;
      if (existing) {
        materialId = existing.id;
        version = db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM file_versions WHERE material_id = ?').get(materialId).v;
      } else {
        materialId = db.prepare("INSERT INTO materials (product_id, kind, title, url, category, pinned, note, author, created_at) VALUES (?, 'file', ?, NULL, ?, 0, NULL, ?, ?)")
          .run(productId, name, req.body.category, who, now).lastInsertRowid;
      }
      db.prepare('INSERT INTO file_versions (material_id, version, stored_name, original_name, size, mime, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(materialId, version, f.filename, name, f.size, f.mimetype || '', who, now);
      return { id: materialId, version };
    })();
    res.json(result);
  });
});

// Удалить ссылку или файл со всеми версиями (только администратор)
api.delete('/materials/:id', requireAdmin, (req, res) => {
  const id = toId(req.params.id);
  if (!id || !db.prepare('SELECT 1 FROM materials WHERE id = ?').get(id)) return bad(res, 'Материал не найден', 404);
  const files = db.prepare('SELECT stored_name FROM file_versions WHERE material_id = ?').all(id);
  db.prepare('DELETE FROM materials WHERE id = ?').run(id);
  for (const f of files) fs.rmSync(path.join(config.UPLOAD_DIR, f.stored_name), { force: true });
  res.json({ ok: true });
});

api.get('/files/:id', (req, res) => {
  const v = db.prepare('SELECT * FROM file_versions WHERE material_id = ? ORDER BY version DESC LIMIT 1').get(toId(req.params.id));
  if (!v) return bad(res, 'Файл не найден', 404);
  const file = path.join(config.UPLOAD_DIR, v.stored_name);
  if (!fs.existsSync(file)) return bad(res, 'Файл не найден', 404);
  res.download(file, v.original_name);
});

// Название страницы по ссылке: <title>, не дольше 3 секунд
api.get('/link-title', async (req, res) => {
  let url;
  try {
    url = new URL(String(req.query.url || ''));
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    return res.json({ title: '' });
  }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 release-calendar' } });
    const reader = r.body.getReader();
    let html = '';
    const decoder = new TextDecoder();
    while (html.length < 512 * 1024) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/title>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
    res.json({ title });
  } catch {
    res.json({ title: '' });
  }
});

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

app.use('/api', api);
app.use('/api', (req, res) => bad(res, 'Не найдено', 404));

app.listen(config.PORT, () => {
  console.log(`Календарь релизов: http://localhost:${config.PORT}`);
});
