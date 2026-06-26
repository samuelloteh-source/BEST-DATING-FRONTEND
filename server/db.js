const fs = require('fs');
const path = require('path');
let sqlite3;
let Pool;
try {
  ({ Pool } = require('pg'));
} catch (_) {
  // pg may not be installed in local dev until dependencies are updated
}

const DB_MODE = process.env.DB_MODE
  ? process.env.DB_MODE.toLowerCase()
  : process.env.NODE_ENV === 'production'
    ? 'postgres'
    : 'sqlite';

// Only require sqlite3 if we actually intend to use it. Requiring the native
// sqlite3 module at top-level causes Vercel serverless functions to attempt
// loading a binary incompatible with the runtime (GLIBC mismatch).
if (DB_MODE === 'sqlite') {
  sqlite3 = require('sqlite3');
}

const SQLITE_FILE = path.join(__dirname, 'database.sqlite');
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

let client = null;

function buildPgPlaceholders(count, offset = 1) {
  return Array.from({ length: count }, (_, idx) => `$${idx + offset}`).join(', ');
}

function openSqlite() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_FILE, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

function sqliteRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initSqlite() {
  const db = await openSqlite();
  const wrapper = {
    mode: 'sqlite',
    db,
    query: (sql, params = []) => sqliteAll(db, sql, params),
    run: (sql, params = []) => sqliteRun(db, sql, params),
    transaction: async (fn) => {
      await sqliteRun(db, 'BEGIN');
      try {
        const result = await fn(wrapper);
        await sqliteRun(db, 'COMMIT');
        return result;
      } catch (error) {
        await sqliteRun(db, 'ROLLBACK');
        throw error;
      }
    }
  };
  return wrapper;
}

async function initPostgres() {
  if (!Pool) {
    throw new Error('Postgres support requires installing the pg package.');
  }

  const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
      host: process.env.PGHOST,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: process.env.PGSSLMODE ? { rejectUnauthorized: process.env.PGSSLMODE !== 'disable' } : undefined,
    };

  const pool = new Pool(config);
  await pool.query('SELECT 1');

  return {
    mode: 'postgres',
    pool,
    query: async (sql, params = []) => {
      const { rows } = await pool.query(sql, params);
      return rows;
    },
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

async function ensureTables() {
  if (!client) throw new Error('DB client is not initialized');

  if (client.mode === 'sqlite') {
    await client.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      data TEXT NOT NULL,
      created_at INTEGER
    )`);
    await client.run(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER
    )`);
    await client.run(`CREATE TABLE IF NOT EXISTS pending_signups (
      token TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      data TEXT NOT NULL,
      created_at INTEGER,
      expires_at INTEGER
    )`);
    await client.run(`CREATE TABLE IF NOT EXISTS user_likes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      liked_user_id TEXT NOT NULL,
      created_at INTEGER,
      UNIQUE(user_id, liked_user_id)
    )`);
    await client.run(`CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      created_at INTEGER,
      UNIQUE(user1_id, user2_id)
    )`);
  } else {
    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      data TEXT NOT NULL,
      created_at BIGINT
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at BIGINT
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS pending_signups (
      token TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      data TEXT NOT NULL,
      created_at BIGINT,
      expires_at BIGINT
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS user_likes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      liked_user_id TEXT NOT NULL,
      created_at BIGINT,
      UNIQUE(user_id, liked_user_id)
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      created_at BIGINT,
      UNIQUE(user1_id, user2_id)
    )`);
  }
}

function parseRow(row) {
  if (!row || typeof row.data !== 'string') return null;
  try {
    return JSON.parse(row.data);
  } catch (error) {
    console.error('Failed to parse DB row JSON', error);
    return null;
  }
}

async function loadUsersFromDb() {
  const rows = await client.query('SELECT data FROM users ORDER BY created_at ASC');
  const users = rows.map(parseRow).filter(Boolean);
  // Some older JSON files use `passwordHash` instead of `password`.
  // Normalize so callers can always use `user.password` for bcrypt checks.
  return users.map(u => {
    if (!u) return u;
    if (!u.password && u.passwordHash) {
      u.password = u.passwordHash;
    }
    return u;
  });
}

async function loadPendingSignupsFromDb() {
  const rows = await client.query('SELECT data FROM pending_signups ORDER BY created_at ASC');
  return rows.map(parseRow).filter(Boolean);
}

async function loadMessagesFromDb() {
  const rows = await client.query('SELECT data FROM messages ORDER BY created_at ASC');
  return rows.map(parseRow).filter(Boolean);
}

async function countTable(table) {
  if (client.mode === 'sqlite') {
    const rows = await client.query(`SELECT COUNT(*) AS count FROM ${table}`);
    return Number(rows[0]?.count || 0);
  }
  const rows = await client.query(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(rows[0]?.count || 0);
}

async function saveUsersToDb(users) {
  const data = users.map(u => ({
    id: String(u.id),
    email: u.email || '',
    password: u.password || '',
    json: JSON.stringify(u),
    created_at: typeof u.created_at === 'number' ? u.created_at : Date.now()
  }));

  if (client.mode === 'sqlite') {
    await client.transaction(async (trx) => {
      const insertSql = 'INSERT OR REPLACE INTO users (id, email, password, data, created_at) VALUES (?, ?, ?, ?, ?)';
      for (const row of data) {
        await trx.run(insertSql, [row.id, row.email, row.password, row.json, row.created_at]);
      }
      if (data.length > 0) {
        const placeholders = data.map(() => '?').join(', ');
        await trx.run(`DELETE FROM users WHERE id NOT IN (${placeholders})`, data.map(r => r.id));
      } else {
        await trx.run('DELETE FROM users');
      }
    });
  } else {
    await client.transaction(async (trx) => {
      const insertSql = `INSERT INTO users (id, email, password, data, created_at) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password, data = EXCLUDED.data, created_at = EXCLUDED.created_at`;
      for (const row of data) {
        await trx.query(insertSql, [row.id, row.email, row.password, row.json, row.created_at]);
      }
      if (data.length > 0) {
        const placeholders = buildPgPlaceholders(data.length);
        await trx.query(`DELETE FROM users WHERE id NOT IN (${placeholders})`, data.map(r => r.id));
      } else {
        await trx.query('DELETE FROM users');
      }
    });
  }
}

async function savePendingSignupsToDb(signups) {
  const data = signups.map(u => ({
    token: String(u.token),
    email: u.email || '',
    json: JSON.stringify(u),
    created_at: typeof u.created_at === 'number' ? u.created_at : Date.now(),
    expires_at: typeof u.expires_at === 'number' ? u.expires_at : Date.now() + 3600 * 1000
  }));

  if (client.mode === 'sqlite') {
    await client.transaction(async (trx) => {
      const insertSql = 'INSERT OR REPLACE INTO pending_signups (token, email, data, created_at, expires_at) VALUES (?, ?, ?, ?, ?)';
      for (const row of data) {
        await trx.run(insertSql, [row.token, row.email, row.json, row.created_at, row.expires_at]);
      }
      if (data.length > 0) {
        const placeholders = data.map(() => '?').join(', ');
        await trx.run(`DELETE FROM pending_signups WHERE token NOT IN (${placeholders})`, data.map(r => r.token));
      } else {
        await trx.run('DELETE FROM pending_signups');
      }
    });
  } else {
    await client.transaction(async (trx) => {
      const insertSql = `INSERT INTO pending_signups (token, email, data, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (token) DO UPDATE SET email = EXCLUDED.email, data = EXCLUDED.data, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at`;
      for (const row of data) {
        await trx.query(insertSql, [row.token, row.email, row.json, row.created_at, row.expires_at]);
      }
      if (data.length > 0) {
        const placeholders = buildPgPlaceholders(data.length);
        await trx.query(`DELETE FROM pending_signups WHERE token NOT IN (${placeholders})`, data.map(r => r.token));
      } else {
        await trx.query('DELETE FROM pending_signups');
      }
    });
  }
}

async function saveMessagesToDb(messages) {
  const data = messages.map(m => ({
    id: String(m.id),
    json: JSON.stringify(m),
    created_at: typeof m.created_at === 'number' ? m.created_at : Date.now()
  }));

  if (client.mode === 'sqlite') {
    await client.transaction(async (trx) => {
      const insertSql = 'INSERT OR REPLACE INTO messages (id, data, created_at) VALUES (?, ?, ?)';
      for (const row of data) {
        await trx.run(insertSql, [row.id, row.json, row.created_at]);
      }
      if (data.length > 0) {
        const placeholders = data.map(() => '?').join(', ');
        await trx.run(`DELETE FROM messages WHERE id NOT IN (${placeholders})`, data.map(r => r.id));
      } else {
        await trx.run('DELETE FROM messages');
      }
    });
  } else {
    await client.transaction(async (trx) => {
      const insertSql = `INSERT INTO messages (id, data, created_at) VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at`;
      for (const row of data) {
        await trx.query(insertSql, [row.id, row.json, row.created_at]);
      }
      if (data.length > 0) {
        const placeholders = buildPgPlaceholders(data.length);
        await trx.query(`DELETE FROM messages WHERE id NOT IN (${placeholders})`, data.map(r => r.id));
      } else {
        await trx.query('DELETE FROM messages');
      }
    });
  }
}

async function seedFromJsonIfNeeded() {
  const userCount = await countTable('users');
  if (userCount === 0 && fs.existsSync(USERS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        await saveUsersToDb(raw);
      }
    } catch (error) {
      console.warn('Failed to seed users from JSON file', error);
    }
  }

  const messageCount = await countTable('messages');
  if (messageCount === 0 && fs.existsSync(MESSAGES_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        await saveMessagesToDb(raw);
      }
    } catch (error) {
      console.warn('Failed to seed messages from JSON file', error);
    }
  }
}

async function addLike(userId, likedUserId) {
  const id = `${userId}_${likedUserId}_${Date.now()}`;
  if (client.mode === 'sqlite') {
    await client.run('INSERT OR REPLACE INTO user_likes (id, user_id, liked_user_id, created_at) VALUES (?, ?, ?, ?)',
      [id, userId, likedUserId, Date.now()]);
  } else {
    await client.query(
      'INSERT INTO user_likes (id, user_id, liked_user_id, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [id, userId, likedUserId, Date.now()]);
  }
}

async function hasUserLiked(userId, likedUserId) {
  const likes = await client.query(
    client.mode === 'sqlite' 
      ? 'SELECT id FROM user_likes WHERE user_id = ? AND liked_user_id = ?' 
      : 'SELECT id FROM user_likes WHERE user_id = $1 AND liked_user_id = $2',
    client.mode === 'sqlite' ? [userId, likedUserId] : [userId, likedUserId]
  );
  return likes.length > 0;
}

async function createMatch(userId1, userId2) {
  const id = `match_${Math.min(userId1, userId2)}_${Math.max(userId1, userId2)}_${Date.now()}`;
  const user1_id = userId1;
  const user2_id = userId2;
  
  if (client.mode === 'sqlite') {
    await client.run('INSERT OR REPLACE INTO matches (id, user1_id, user2_id, created_at) VALUES (?, ?, ?, ?)',
      [id, user1_id, user2_id, Date.now()]);
  } else {
    await client.query(
      'INSERT INTO matches (id, user1_id, user2_id, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [id, user1_id, user2_id, Date.now()]);
  }
}

async function getMatches(userId) {
  const matches = await client.query(
    client.mode === 'sqlite'
      ? 'SELECT * FROM matches WHERE user1_id = ? OR user2_id = ?'
      : 'SELECT * FROM matches WHERE user1_id = $1 OR user2_id = $2',
    client.mode === 'sqlite' ? [userId, userId] : [userId, userId]
  );
  return matches;
}

async function isMatched(userId1, userId2) {
  const matches = await client.query(
    client.mode === 'sqlite'
      ? 'SELECT id FROM matches WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)'
      : 'SELECT id FROM matches WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $3 AND user2_id = $4)',
    client.mode === 'sqlite' 
      ? [userId1, userId2, userId2, userId1] 
      : [userId1, userId2, userId2, userId1]
  );
  return matches.length > 0;
}

async function initDb() {
  if (client) return;

  if (DB_MODE === 'postgres') {
    client = await initPostgres();
  } else {
    client = await initSqlite();
  }

  await ensureTables();
  await seedFromJsonIfNeeded();
}

module.exports = {
  DB_MODE,
  initDb,
  loadUsersFromDb,
  loadPendingSignupsFromDb,
  loadMessagesFromDb,
  saveUsersToDb,
  savePendingSignupsToDb,
  saveMessagesToDb,
  addLike,
  hasUserLiked,
  createMatch,
  getMatches,
  isMatched,
};
