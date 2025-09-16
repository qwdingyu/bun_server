// Simplified database bootstrap using src/db
import dbModule from '../db/index.js';
import { ensureIndexes } from '../models/schema/index.js';

let dbInstance = null;

export async function initializeDatabase() {
  if (process.env.SKIP_DB_INIT === 'true') {
    console.warn('[DB] SKIP_DB_INIT=true, skip real database initialization');
    return true;
  }
  await dbModule.initDb();
  dbInstance = dbModule.getDb();
  try {
    await ensureIndexes(dbInstance);
  } catch (e) {}
  console.log('✅ 数据库初始化成功');
  return true;
}

export function getDatabaseStatus() {
  return {
    type: dbModule.getType(),
    initialized: !!dbInstance
  };
}

export async function closeDatabase() {
  await dbModule.closeDb();
  console.log('✅ 数据库连接已关闭');
  return true;
}

export async function testDatabaseConnection() {
  try {
    await dbModule.initDb();
    return true;
  } catch (_) {
    return false;
  }
}

export function getDrizzleInstance() {
  return dbModule.getDb();
}

export function getDatabaseType() {
  return dbModule.getType();
}

// Backwards compatibility: default export a getter to db
const db = new Proxy({}, {
  get(_t, _p) {
    return dbModule.getDb()[_p];
  }
});

export default db;