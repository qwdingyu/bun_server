// Unified DB bootstrap for sqlite/mysql using Drizzle
// Small, simple, and focused: exposes initDb, getDb, getType, closeDb

const DB_TYPE = (process.env.DATABASE_TYPE || 'sqlite').toLowerCase()
import { resolveProjectPath } from '../utils/paths.js'

let db = null
let driver = null // underlying driver/pool for cleanup

async function initSqlite() {
  const { Database } = await import('bun:sqlite')
  const { drizzle } = await import('drizzle-orm/bun-sqlite')

  const dbPath = process.env.DATABASE_PATH || './data/app.db'

  const fs = await import('fs')
  const pathMod = await import('path')
  const dir = pathMod.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const sqlite = new Database(dbPath)
  // Pragmas tuned for app use; simple, safe defaults
  sqlite.exec('PRAGMA foreign_keys = ON')
  sqlite.exec('PRAGMA journal_mode = WAL')
  sqlite.exec('PRAGMA synchronous = NORMAL')

  // Apply schema (idempotent)
  try {
    const fs2 = await import('fs')
    const pathMod2 = await import('path')
    const { fileURLToPath } = await import('url')
    // Try multiple locations for robustness
    const candidates = []
    // 1) Relative to this file
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = pathMod2.dirname(__filename)
    candidates.push(pathMod2.join(__dirname, 'sqlite-schema.sql'))
    // 2) Project-root based (deterministic)
    candidates.push(resolveProjectPath('src', 'db', 'sqlite-schema.sql'))

    let schemaPath = null
    for (const p of candidates) {
      if (fs2.existsSync(p)) {
        schemaPath = p
        break
      }
    }

    if (schemaPath) {
      const ddl = fs2.readFileSync(schemaPath, 'utf8')
      // SQLite 可以一次执行多条 DDL；不要按分号手动拆分。
      // 手动拆分会被行注释和块注释干扰，导致建表语句被跳过、索引先执行、残留 `*/` 被当成 SQL。
      sqlite.exec(ddl)
      if (process.env.DB_LOG_DEBUG === 'true') {
        console.log(`[DB] Applied SQLite schema from ${schemaPath}`)
      }
    } else {
      console.warn('[DB] Schema file not found. Tried:', candidates)
    }
    // Verify core table exists
    const check = sqlite.query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()
    if (!check) {
      console.warn('[DB] Core table users missing after schema application')
    }
  } catch (e) {
    console.warn('[DB] SQLite schema application skipped:', e?.message || e)
  }

  const enableSqlLog = process.env.DB_LOG_DEBUG === 'true' || process.env.NODE_ENV === 'development'
  driver = sqlite
  db = drizzle(sqlite, {
    logger: enableSqlLog
  })
}

async function initMySQL() {
  const { createPool } = await import('mysql2/promise')
  const { drizzle } = await import('drizzle-orm/mysql2')

  const url = process.env.DATABASE_URL
  let pool
  if (url) {
    pool = createPool({ uri: url, connectionLimit: parseInt(process.env.DB_POOL_MAX || '10', 10) })
  } else {
    const host = process.env.DB_HOST || 'localhost'
    const port = parseInt(process.env.DB_PORT || '3306', 10)
    const user = process.env.DB_USER || 'root'
    const password = process.env.DB_PASSWORD || ''
    const database = process.env.DB_NAME || 'bun_server'
    pool = createPool({ host, port, user, password, database, connectionLimit: parseInt(process.env.DB_POOL_MAX || '10', 10) })
  }

  const enableSqlLog = process.env.DB_LOG_DEBUG === 'true' || process.env.NODE_ENV === 'development'
  driver = pool
  db = drizzle(pool, {
    logger: enableSqlLog
  })
}

export async function initDb() {
  if (db) return db
  if (DB_TYPE === 'sqlite') {
    await initSqlite()
  } else if (DB_TYPE === 'mysql') {
    await initMySQL()
  } else {
    throw new Error(`Unsupported DATABASE_TYPE: ${DB_TYPE}. Only sqlite/mysql are supported.`)
  }
  return db
}

export function getDb() {
  if (!db) throw new Error('DB not initialized. Call initDb() first.')
  return db
}

export function getType() {
  return DB_TYPE
}

export async function closeDb() {
  if (!driver) return
  try {
    if (DB_TYPE === 'sqlite') {
      driver.close?.()
    } else if (DB_TYPE === 'mysql') {
      await driver.end?.()
    }
  } finally {
    db = null
    driver = null
  }
}

export default {
  initDb,
  getDb,
  getType,
  closeDb
}
