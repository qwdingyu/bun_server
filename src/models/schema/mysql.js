import { sql } from 'drizzle-orm';
import { int, varchar, datetime, mysqlTable } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  first_name: varchar('first_name', { length: 100 }),
  last_name: varchar('last_name', { length: 100 }),
  avatar_url: varchar('avatar_url', { length: 500 }),
  status: varchar('status', { length: 20 }).default('active'),
  email_verified: int('email_verified').default(0),
  last_login_at: datetime('last_login_at'),
  created_at: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deleted_at: datetime('deleted_at')
});

export const system_config = mysqlTable('system_config', {
  id: int('id').autoincrement().primaryKey(),
  config_key: varchar('config_key', { length: 255 }).notNull().unique(),
  config_value: varchar('config_value', { length: 1000 }).notNull(),
  updated_at: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export async function ensureIndexes(db) {
  // MySQL indexes are typically created with the table or via ALTER TABLE
  // This function can be used for any additional indexes needed
}

export const schema = {
  users,
  system_config
};

export default schema;