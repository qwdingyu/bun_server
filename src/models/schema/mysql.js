import { sql } from 'drizzle-orm'
import { bigint, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core'

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
  last_login_at: bigint('last_login_at', { mode: 'number' }),
  created_at: bigint('created_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`),
  updated_at: bigint('updated_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`),
  deleted_at: bigint('deleted_at', { mode: 'number' })
})

export const system_config = mysqlTable('system_config', {
  id: int('id').autoincrement().primaryKey(),
  config_key: varchar('config_key', { length: 255 }).notNull().unique(),
  config_value: text('config_value').notNull(),
  updated_at: bigint('updated_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`)
})

export const roles = mysqlTable('roles', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  display_name: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  level: int('level').notNull().default(1),
  is_system: int('is_system').default(0),
  status: varchar('status', { length: 20 }).default('active'),
  created_at: bigint('created_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`),
  updated_at: bigint('updated_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`)
})

export const permissions = mysqlTable('permissions', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  display_name: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  resource: varchar('resource', { length: 100 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  is_system: int('is_system').default(0),
  created_at: bigint('created_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`),
  updated_at: bigint('updated_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`)
})

export const user_roles = mysqlTable('user_roles', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role_id: int('role_id')
    .notNull()
    .references(() => roles.id, { onDelete: 'cascade' }),
  assigned_by: int('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  assigned_at: bigint('assigned_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`),
  expires_at: bigint('expires_at', { mode: 'number' }),
  is_active: int('is_active').default(1)
})

export const role_permissions = mysqlTable('role_permissions', {
  id: int('id').autoincrement().primaryKey(),
  role_id: int('role_id')
    .notNull()
    .references(() => roles.id, { onDelete: 'cascade' }),
  permission_id: int('permission_id')
    .notNull()
    .references(() => permissions.id, { onDelete: 'cascade' }),
  granted_by: int('granted_by').references(() => users.id, { onDelete: 'set null' }),
  granted_at: bigint('granted_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`),
  is_active: int('is_active').default(1)
})

export const user_permissions = mysqlTable('user_permissions', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  permission_id: int('permission_id')
    .notNull()
    .references(() => permissions.id, { onDelete: 'cascade' }),
  permission_type: varchar('permission_type', { length: 20 }).notNull().default('grant'),
  granted_by: int('granted_by').references(() => users.id, { onDelete: 'set null' }),
  granted_at: bigint('granted_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`),
  expires_at: bigint('expires_at', { mode: 'number' }),
  reason: text('reason'),
  is_active: int('is_active').default(1)
})

export const user_sessions = mysqlTable('user_sessions', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token_hash: varchar('token_hash', { length: 255 }).notNull().unique(),
  refresh_token_hash: varchar('refresh_token_hash', { length: 255 }).unique(),
  device_info: text('device_info'),
  user_agent: text('user_agent'),
  ip_address: varchar('ip_address', { length: 100 }),
  location: varchar('location', { length: 255 }),
  is_active: int('is_active').default(1),
  expires_at: bigint('expires_at', { mode: 'number' }).notNull(),
  last_used_at: bigint('last_used_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`),
  created_at: bigint('created_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`)
})

export const audit_logs = mysqlTable('audit_logs', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  resource_type: varchar('resource_type', { length: 100 }).notNull(),
  resource_id: varchar('resource_id', { length: 100 }),
  old_values: text('old_values'),
  new_values: text('new_values'),
  ip_address: varchar('ip_address', { length: 100 }),
  user_agent: text('user_agent'),
  status: varchar('status', { length: 20 }).default('success'),
  error_message: text('error_message'),
  created_at: bigint('created_at', { mode: 'number' }).default(sql`(UNIX_TIMESTAMP())`)
})

export async function ensureIndexes(db) {
  const indexSql = [
    'CREATE INDEX idx_users_status ON users(status)',
    'CREATE INDEX idx_users_created_at ON users(created_at)',
    'CREATE INDEX idx_users_deleted_at ON users(deleted_at)',
    'CREATE INDEX idx_roles_level ON roles(level)',
    'CREATE INDEX idx_roles_status ON roles(status)',
    'CREATE INDEX idx_permissions_resource ON permissions(resource)',
    'CREATE INDEX idx_permissions_action ON permissions(action)',
    'CREATE INDEX idx_user_roles_user_id ON user_roles(user_id)',
    'CREATE INDEX idx_user_roles_role_id ON user_roles(role_id)',
    'CREATE INDEX idx_user_roles_is_active ON user_roles(is_active)',
    'CREATE INDEX idx_user_roles_expires_at ON user_roles(expires_at)',
    'CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id)',
    'CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id)',
    'CREATE INDEX idx_role_permissions_is_active ON role_permissions(is_active)',
    'CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id)',
    'CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id)',
    'CREATE INDEX idx_user_permissions_permission_type ON user_permissions(permission_type)',
    'CREATE INDEX idx_user_permissions_is_active ON user_permissions(is_active)',
    'CREATE INDEX idx_user_permissions_expires_at ON user_permissions(expires_at)',
    'CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id)',
    'CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at)',
    'CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)',
    'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)',
    'CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id)'
  ]

  for (const sqlText of indexSql) {
    try {
      await db.execute(sql.raw?.(sqlText) ?? sql`${sqlText}`)
    } catch (_) {
      // MySQL 没有 CREATE INDEX IF NOT EXISTS；重复索引或权限不足时保持初始化流程可继续。
    }
  }
}

export const schema = {
  users,
  system_config,
  roles,
  permissions,
  user_roles,
  role_permissions,
  user_permissions,
  user_sessions,
  audit_logs
}

export default schema
