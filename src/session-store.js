const session = require('express-session');

class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super();

    this.db = database;

    this.getStmt = database.prepare(
      'SELECT sess FROM sessions WHERE sid = ? AND expired_at > ?'
    );

    this.setStmt = database.prepare(`
      INSERT INTO sessions (sid, sess, expired_at)
      VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET
      sess=excluded.sess,
      expired_at=excluded.expired_at
    `);

    this.destroyStmt = database.prepare(
      'DELETE FROM sessions WHERE sid = ?'
    );

    this.touchStmt = database.prepare(
      'UPDATE sessions SET expired_at = ? WHERE sid = ?'
    );

    setInterval(() => {
      try {
        database.prepare(
          'DELETE FROM sessions WHERE expired_at <= ?'
        ).run(Date.now());
      } catch {}
    }, 60 * 60 * 1000).unref();
  }

  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (e) {
      cb(e);
    }
  }

  set(sid, sess, cb) {
    try {
      const expires =
        sess.cookie && sess.cookie.expires
          ? new Date(sess.cookie.expires).getTime()
          : Date.now() + 8 * 60 * 60 * 1000;

      this.setStmt.run(sid, JSON.stringify(sess), expires);
      cb && cb(null);
    } catch (e) {
      cb && cb(e);
    }
  }

  destroy(sid, cb) {
    try {
      this.destroyStmt.run(sid);
      cb && cb(null);
    } catch (e) {
      cb && cb(e);
    }
  }

  touch(sid, sess, cb) {
    try {
      const expires =
        sess.cookie && sess.cookie.expires
          ? new Date(sess.cookie.expires).getTime()
          : Date.now() + 8 * 60 * 60 * 1000;

      this.touchStmt.run(expires, sid);
      cb && cb(null);
    } catch (e) {
      cb && cb(e);
    }
  }
}

module.exports = SQLiteSessionStore;
