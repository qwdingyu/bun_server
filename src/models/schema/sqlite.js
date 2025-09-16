import { sql } from 'drizzle-orm'
import { integer, text, sqliteTable } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name'),
  last_name: text('last_name'),
  avatar_url: text('avatar_url'),
  status: text('status').default('active'),
  email_verified: integer('email_verified').default(false),
  last_login_at: integer('last_login_at'),
  created_at: integer('created_at').default(sql`strftime('%s','now')`),
  updated_at: integer('updated_at').default(sql`strftime('%s','now')`),
  deleted_at: integer('deleted_at')
})

export const system_config = sqliteTable('system_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  config_key: text('config_key').notNull().unique(),
  config_value: text('config_value').notNull(),
  updated_at: integer('updated_at').default(sql`strftime('%s','now')`)
})

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  display_name: text('display_name').notNull(),
  description: text('description'),
  level: integer('level').notNull().default(1),
  is_system: integer('is_system').default(0),
  status: text('status').default('active'),
  created_at: integer('created_at').default(sql`strftime('%s','now')`),
  updated_at: integer('updated_at').default(sql`strftime('%s','now')`)
})

export const permissions = sqliteTable('permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  display_name: text('display_name').notNull(),
  description: text('description'),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  is_system: integer('is_system').default(0),
  created_at: integer('created_at').default(sql`strftime('%s','now')`),
  updated_at: integer('updated_at').default(sql`strftime('%s','now')`)
})

export const user_roles = sqliteTable('user_roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role_id: integer('role_id')
    .notNull()
    .references(() => roles.id, { onDelete: 'cascade' }),
  assigned_by: integer('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  assigned_at: integer('assigned_at').default(sql`strftime('%s','now')`),
  expires_at: integer('expires_at'),
  is_active: integer('is_active').default(1)
})

export const role_permissions = sqliteTable('role_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  role_id: integer('role_id')
    .notNull()
    .references(() => roles.id, { onDelete: 'cascade' }),
  permission_id: integer('permission_id')
    .notNull()
    .references(() => permissions.id, { onDelete: 'cascade' }),
  granted_by: integer('granted_by').references(() => users.id, { onDelete: 'set null' }),
  granted_at: integer('granted_at').default(sql`strftime('%s','now')`),
  is_active: integer('is_active').default(1)
})

export const user_permissions = sqliteTable('user_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  permission_id: integer('permission_id')
    .notNull()
    .references(() => permissions.id, { onDelete: 'cascade' }),
  permission_type: text('permission_type').notNull().default('grant'),
  granted_by: integer('granted_by').references(() => users.id, { onDelete: 'set null' }),
  granted_at: integer('granted_at').default(sql`strftime('%s','now')`),
  expires_at: integer('expires_at'),
  reason: text('reason'),
  is_active: integer('is_active').default(1)
})

export async function ensureIndexes(db) {
  const indexSql = [
    // users
    'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
    'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at)',
    // system_config
    'CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key)',
    // roles
    'CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name)',
    'CREATE INDEX IF NOT EXISTS idx_roles_level ON roles(level)',
    'CREATE INDEX IF NOT EXISTS idx_roles_status ON roles(status)',
    // permissions
    'CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name)',
    'CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource)',
    'CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action)',
    // user_roles
    'CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_roles_is_active ON user_roles(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_user_roles_expires_at ON user_roles(expires_at)',
    // role_permissions
    'CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id)',
    'CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id)',
    'CREATE INDEX IF NOT EXISTS idx_role_permissions_is_active ON role_permissions(is_active)',
    // user_permissions
    'CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_type ON user_permissions(permission_type)',
    'CREATE INDEX IF NOT EXISTS idx_user_permissions_is_active ON user_permissions(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_user_permissions_expires_at ON user_permissions(expires_at)'
  ]

  for (const sqlText of indexSql) {
    try {
      await db.execute(sql.raw?.(sqlText) ?? sql`${sqlText}`)
    } catch (e) {
      // ignore duplicates across environments
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
  user_permissions
}

export default schema
