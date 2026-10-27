const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const config = require('./config');

const SESSION_MS = 12 * 60 * 60 * 1000;

// Хранилище сессий в той же базе SQLite
class SqliteStore extends session.Store {
  constructor(db) {
    super();
    this.getStmt = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?');
    this.setStmt = db.prepare('INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires');
    this.delStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStmt = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
    this.cleanStmt = db.prepare('DELETE FROM sessions WHERE expires <= ?');
    setInterval(() => this.cleanStmt.run(Date.now()), 60 * 60 * 1000).unref();
  }
  expiresOf(sess) {
    return sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + SESSION_MS;
  }
  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try { this.setStmt.run(sid, JSON.stringify(sess), this.expiresOf(sess)); cb && cb(null); } catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) {
    try { this.delStmt.run(sid); cb && cb(null); } catch (e) { cb && cb(e); }
  }
  touch(sid, sess, cb) {
    try { this.touchStmt.run(this.expiresOf(sess), sid); cb && cb(null); } catch (e) { cb && cb(e); }
  }
}

function sessionMiddleware(db) {
  return session({
    store: new SqliteStore(db),
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: SESSION_MS, httpOnly: true, sameSite: 'lax' },
  });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ error: 'Требуется вход администратора' });
}

function authRouter(db) {
  const r = express.Router();
  r.post('/login', (req, res) => {
    const { login, password } = req.body || {};
    const admin = typeof login === 'string' ? db.prepare('SELECT * FROM admins WHERE login = ?').get(login.trim()) : null;
    if (!admin || typeof password !== 'string' || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Не удалось войти' });
      req.session.admin = admin.login;
      res.json({ admin: admin.login });
    });
  });
  r.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });
  return r;
}

module.exports = { sessionMiddleware, requireAdmin, authRouter };
