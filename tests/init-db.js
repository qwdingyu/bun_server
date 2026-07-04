/**
 * 数据库初始化测试脚本
 * 该脚本将创建新的数据库并填充基础数据
 */
import { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 数据库文件路径
const DB_PATH = path.join(__dirname, '..', 'data', 'app.db')
const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'db', 'sqlite-schema.sql')

// 确保数据目录存在
const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
  console.log('📁 创建数据目录:', dataDir)
}

// 如果数据库文件存在，先删除
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH)
  console.log('🗑️ 已删除旧数据库文件:', DB_PATH)
}

// 创建新的数据库连接
const db = new Database(DB_PATH)
console.log('🔌 已连接到数据库:', DB_PATH)

// 直接创建所有表结构
console.log('📝 创建数据库表结构...')

// 用户表
db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended', 'banned')),
  email_verified INTEGER DEFAULT 0,
  last_login_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  deleted_at INTEGER
);
`)

// 系统配置表
db.run(`
CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);
`)

// 角色表
db.run(`
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);
`)

// 权限表
db.run(`
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  is_system INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);
`)

// 用户角色关联表
db.run(`
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  assigned_by INTEGER,
  assigned_at INTEGER DEFAULT (strftime('%s','now')),
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, role_id)
);
`)

// 角色权限关联表
db.run(`
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  granted_by INTEGER,
  granted_at INTEGER DEFAULT (strftime('%s','now')),
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(role_id, permission_id)
);
`)

// 用户权限关联表
db.run(`
CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  permission_type TEXT NOT NULL CHECK(permission_type IN ('grant', 'deny')),
  granted_by INTEGER,
  granted_at INTEGER DEFAULT (strftime('%s','now')),
  expires_at INTEGER,
  reason TEXT,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, permission_id)
);
`)

// 用户会话表
db.run(`
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  refresh_token_hash TEXT UNIQUE,
  device_info TEXT,
  user_agent TEXT,
  ip_address TEXT,
  location TEXT,
  is_active INTEGER DEFAULT 1,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  last_used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`)

// API限制表
db.run(`
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK(identifier_type IN ('ip', 'user')),
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start INTEGER NOT NULL,
  window_size INTEGER NOT NULL,
  max_requests INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(identifier, identifier_type, endpoint, window_start)
);
`)

// 创建索引
console.log('📝 创建索引...')
db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);')
db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);')
db.run('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);')
db.run('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);')
db.run('CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);')
db.run('CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);')
db.run('CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);')
db.run('CREATE INDEX IF NOT EXISTS idx_roles_level ON roles(level);')
db.run('CREATE INDEX IF NOT EXISTS idx_roles_status ON roles(status);')
db.run('CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);')
db.run('CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);')
db.run('CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);')
db.run('CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);')
db.run('CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);')
db.run('CREATE INDEX IF NOT EXISTS idx_user_roles_is_active ON user_roles(is_active);')
db.run('CREATE INDEX IF NOT EXISTS idx_user_roles_expires_at ON user_roles(expires_at);')
db.run('CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);')
db.run('CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);')
db.run('CREATE INDEX IF NOT EXISTS idx_role_permissions_is_active ON role_permissions(is_active);')
db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);')
db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);')
db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_type ON user_permissions(permission_type);')
db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_is_active ON user_permissions(is_active);')
db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_expires_at ON user_permissions(expires_at);')

console.log('✅ 数据库模式创建完成')

// 创建系统默认角色
console.log('👑 创建系统默认角色...')
db.transaction(() => {
  // 超级管理员角色
  db.run(`
    INSERT INTO roles (name, display_name, description, level, is_system, status)
    VALUES ('super_admin', '超级管理员', '系统最高权限角色，可以执行所有操作', 100, 1, 'active')
  `)

  // 管理员角色
  db.run(`
    INSERT INTO roles (name, display_name, description, level, is_system, status)
    VALUES ('admin', '管理员', '系统管理员，可以执行大部分管理操作', 50, 1, 'active')
  `)

  // 普通用户角色
  db.run(`
    INSERT INTO roles (name, display_name, description, level, is_system, status)
    VALUES ('user', '普通用户', '标准用户权限', 10, 1, 'active')
  `)

  // 访客角色
  db.run(`
    INSERT INTO roles (name, display_name, description, level, is_system, status)
    VALUES ('guest', '访客', '最低权限，只能查看公开内容', 1, 1, 'active')
  `)
})()
console.log('✅ 系统角色创建完成')

// 创建系统默认权限
console.log('🔑 创建系统默认权限...')
db.transaction(() => {
  // 用户资源权限
  const userPermissions = [
    ['users:create', '创建用户', '创建新用户账户', 'users', 'create'],
    ['users:read', '查看用户', '查看用户信息', 'users', 'read'],
    ['users:update', '更新用户', '更新用户信息', 'users', 'update'],
    ['users:delete', '删除用户', '删除用户账户', 'users', 'delete'],
    ['users:list', '用户列表', '查看用户列表', 'users', 'list'],
    ['users:manage', '管理用户', '管理用户（包括状态变更）', 'users', 'manage']
  ]

  // 角色资源权限
  const rolePermissions = [
    ['roles:create', '创建角色', '创建新角色', 'roles', 'create'],
    ['roles:read', '查看角色', '查看角色信息', 'roles', 'read'],
    ['roles:update', '更新角色', '更新角色信息', 'roles', 'update'],
    ['roles:delete', '删除角色', '删除角色', 'roles', 'delete'],
    ['roles:list', '角色列表', '查看角色列表', 'roles', 'list'],
    ['roles:assign', '分配角色', '为用户分配角色', 'roles', 'assign']
  ]

  // 权限资源权限
  const permissionPermissions = [
    ['permissions:create', '创建权限', '创建新权限', 'permissions', 'create'],
    ['permissions:read', '查看权限', '查看权限信息', 'permissions', 'read'],
    ['permissions:update', '更新权限', '更新权限信息', 'permissions', 'update'],
    ['permissions:delete', '删除权限', '删除权限', 'permissions', 'delete'],
    ['permissions:list', '权限列表', '查看权限列表', 'permissions', 'list'],
    ['permissions:assign', '分配权限', '分配权限给角色或用户', 'permissions', 'assign']
  ]

  // 系统配置权限
  const configPermissions = [
    ['config:read', '查看配置', '查看系统配置', 'config', 'read'],
    ['config:update', '更新配置', '更新系统配置', 'config', 'update']
  ]

  // 所有权限集合
  const allPermissions = [...userPermissions, ...rolePermissions, ...permissionPermissions, ...configPermissions]

  // 插入所有权限
  const now = Math.floor(Date.now() / 1000) // 当前时间戳（秒）

  for (const [name, display_name, description, resource, action] of allPermissions) {
    db.run(
      `
      INSERT INTO permissions (name, display_name, description, resource, action, is_system, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `,
      [name, display_name, description, resource, action, now, now]
    )
  }
})()
console.log('✅ 系统权限创建完成')

// 为角色分配权限
console.log('🔄 为角色分配默认权限...')
db.transaction(() => {
  // 获取角色ID
  const superAdminRole = db.query('SELECT id FROM roles WHERE name = "super_admin"').get()
  const adminRole = db.query('SELECT id FROM roles WHERE name = "admin"').get()
  const userRole = db.query('SELECT id FROM roles WHERE name = "user"').get()
  const guestRole = db.query('SELECT id FROM roles WHERE name = "guest"').get()

  // 获取所有权限
  const allPermissions = db.query('SELECT id FROM permissions').all()

  // 为超级管理员分配所有权限
  for (const perm of allPermissions) {
    db.run(
      `
      INSERT INTO role_permissions (role_id, permission_id, is_active)
      VALUES (?, ?, 1)
    `,
      [superAdminRole.id, perm.id]
    )
  }

  // 为管理员分配管理权限
  const adminPermissionNames = ['users:read', 'users:update', 'users:list', 'users:manage', 'roles:read', 'roles:list', 'permissions:read', 'permissions:list', 'config:read']

  for (const permName of adminPermissionNames) {
    const perm = db.query('SELECT id FROM permissions WHERE name = ?', [permName]).get()
    if (perm) {
      db.run(
        `
        INSERT INTO role_permissions (role_id, permission_id, is_active)
        VALUES (?, ?, 1)
      `,
        [adminRole.id, perm.id]
      )
    }
  }

  // 为普通用户分配基本权限
  const userPermissionNames = ['users:read']

  for (const permName of userPermissionNames) {
    const perm = db.query('SELECT id FROM permissions WHERE name = ?', [permName]).get()
    if (perm) {
      db.run(
        `
        INSERT INTO role_permissions (role_id, permission_id, is_active)
        VALUES (?, ?, 1)
      `,
        [userRole.id, perm.id]
      )
    }
  }
})()
console.log('✅ 角色权限分配完成')

// 创建默认管理员用户
console.log('👤 创建默认管理员用户...')
db.transaction(() => {
  // 创建超级管理员用户
  db.run(`
    INSERT INTO users (
      username, email, password_hash, first_name, last_name,
      status, email_verified, created_at, updated_at
    )
    VALUES (
      'admin', 'admin@example.com',
      '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', -- admin
      'System', 'Administrator',
      'active', 1, strftime('%s','now'), strftime('%s','now')
    )
  `)

  // 获取用户ID和角色ID
  const adminUser = db.query('SELECT id FROM users WHERE username = "admin"').get()
  const superAdminRole = db.query('SELECT id FROM roles WHERE name = "super_admin"').get()

  // 分配超级管理员角色
  const currentTime = Math.floor(Date.now() / 1000) // 当前时间戳（秒）

  db.run(
    `
    INSERT INTO user_roles (user_id, role_id, is_active, assigned_at)
    VALUES (?, ?, 1, ?)
  `,
    [adminUser.id, superAdminRole.id, currentTime]
  )
})()
console.log('✅ 默认管理员用户创建完成')

// 创建默认系统配置
console.log('⚙️ 创建默认系统配置...')
db.transaction(() => {
  const configs = [
    ['app.name', 'Bun Server'],
    ['app.description', '基于Bun的高性能服务器'],
    ['app.version', '1.0.0'],
    ['app.maintenance_mode', 'false'],
    ['app.debug_mode', 'true'],
    ['security.allow_registration', 'true'],
    ['security.verify_email', 'false'],
    ['security.password_policy', 'medium'],
    ['security.session_timeout', '86400'], // 24小时
    ['security.max_login_attempts', '5'],
    ['ui.theme', 'light'],
    ['ui.language', 'zh-CN']
  ]

  for (const [key, value] of configs) {
    db.run(
      `
      INSERT INTO system_config (config_key, config_value)
      VALUES (?, ?)
    `,
      [key, value]
    )
  }
})()
console.log('✅ 系统配置创建完成')

console.log('🎉 数据库初始化完成!')
console.log(`📊 数据库文件位置: ${DB_PATH}`)

// 显示一些数据统计
const stats = {
  users: db.query('SELECT COUNT(*) as count FROM users').get().count,
  roles: db.query('SELECT COUNT(*) as count FROM roles').get().count,
  permissions: db.query('SELECT COUNT(*) as count FROM permissions').get().count,
  role_permissions: db.query('SELECT COUNT(*) as count FROM role_permissions').get().count,
  user_roles: db.query('SELECT COUNT(*) as count FROM user_roles').get().count,
  configs: db.query('SELECT COUNT(*) as count FROM system_config').get().count
}

console.log('📝 数据统计:')
console.log(`  用户: ${stats.users}`)
console.log(`  角色: ${stats.roles}`)
console.log(`  权限: ${stats.permissions}`)
console.log(`  角色权限: ${stats.role_permissions}`)
console.log(`  用户角色: ${stats.user_roles}`)
console.log(`  系统配置: ${stats.configs}`)

// 关闭数据库连接
db.close()

export default async function initDatabase() {
  const { Database } = await import('bun:sqlite')
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { fileURLToPath } = await import('node:url')

  // 获取当前文件的目录
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  // 数据库文件路径
  const DB_PATH = path.join(__dirname, '..', 'data', 'app.db')
  const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'db', 'sqlite-schema.sql')

  // 确保数据目录存在
  const dataDir = path.join(__dirname, '..', 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
    console.log('📁 创建数据目录:', dataDir)
  }

  // 如果数据库文件存在，先删除
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH)
    console.log('🗑️ 已删除旧数据库文件:', DB_PATH)
  }

  // 创建新的数据库连接
  const db = new Database(DB_PATH)
  console.log('🔌 已连接到数据库:', DB_PATH)

  // 直接创建所有表结构
  console.log('📝 创建数据库表结构...')

  // 用户表
  db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended', 'banned')),
  email_verified INTEGER DEFAULT 0,
  last_login_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  deleted_at INTEGER
);
`)

  // 系统配置表
  db.run(`
CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);
`)

  // 角色表
  db.run(`
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);
`)

  // 权限表
  db.run(`
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  is_system INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);
`)

  // 用户角色关联表
  db.run(`
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  assigned_by INTEGER,
  assigned_at INTEGER DEFAULT (strftime('%s','now')),
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, role_id)
);
`)

  // 角色权限关联表
  db.run(`
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  granted_by INTEGER,
  granted_at INTEGER DEFAULT (strftime('%s','now')),
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(role_id, permission_id)
);
`)

  // 用户权限关联表
  db.run(`
CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  permission_type TEXT NOT NULL CHECK(permission_type IN ('grant', 'deny')),
  granted_by INTEGER,
  granted_at INTEGER DEFAULT (strftime('%s','now')),
  expires_at INTEGER,
  reason TEXT,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, permission_id)
);
`)

  // 用户会话表
  db.run(`
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  refresh_token_hash TEXT UNIQUE,
  device_info TEXT,
  user_agent TEXT,
  ip_address TEXT,
  location TEXT,
  is_active INTEGER DEFAULT 1,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  last_used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`)

  // API限制表
  db.run(`
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK(identifier_type IN ('ip', 'user')),
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start INTEGER NOT NULL,
  window_size INTEGER NOT NULL,
  max_requests INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(identifier, identifier_type, endpoint, window_start)
);
`)

  // 创建索引
  console.log('📝 创建索引...')
  db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);')
  db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);')
  db.run('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);')
  db.run('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);')
  db.run('CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);')
  db.run('CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);')
  db.run('CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);')
  db.run('CREATE INDEX IF NOT EXISTS idx_roles_level ON roles(level);')
  db.run('CREATE INDEX IF NOT EXISTS idx_roles_status ON roles(status);')
  db.run('CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);')
  db.run('CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);')
  db.run('CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);')
  db.run('CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);')
  db.run('CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);')
  db.run('CREATE INDEX IF NOT EXISTS idx_user_roles_is_active ON user_roles(is_active);')
  db.run('CREATE INDEX IF NOT EXISTS idx_user_roles_expires_at ON user_roles(expires_at);')
  db.run('CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);')
  db.run('CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);')
  db.run('CREATE INDEX IF NOT EXISTS idx_role_permissions_is_active ON role_permissions(is_active);')
  db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);')
  db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);')
  db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_type ON user_permissions(permission_type);')
  db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_is_active ON user_permissions(is_active);')
  db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_expires_at ON user_permissions(expires_at);')

  console.log('✅ 数据库模式创建完成')

  // 创建系统默认角色
  console.log('👑 创建系统默认角色...')
  db.transaction(() => {
    // 超级管理员角色
    db.run(`
    INSERT INTO roles (name, display_name, description, level, is_system, status)
    VALUES ('super_admin', '超级管理员', '系统最高权限角色，可以执行所有操作', 100, 1, 'active')
  `)

    // 管理员角色
    db.run(`
    INSERT INTO roles (name, display_name, description, level, is_system, status)
    VALUES ('admin', '管理员', '系统管理员，可以执行大部分管理操作', 50, 1, 'active')
  `)

    // 普通用户角色
    db.run(`
    INSERT INTO roles (name, display_name, description, level, is_system, status)
    VALUES ('user', '普通用户', '标准用户权限', 10, 1, 'active')
  `)

    // 访客角色
    db.run(`
    INSERT INTO roles (name, display_name, description, level, is_system, status)
    VALUES ('guest', '访客', '最低权限，只能查看公开内容', 1, 1, 'active')
  `)
  })()
  console.log('✅ 系统角色创建完成')

  // 创建系统默认权限
  console.log('🔑 创建系统默认权限...')
  db.transaction(() => {
    // 用户资源权限
    const userPermissions = [
      ['users:create', '创建用户', '创建新用户账户', 'users', 'create'],
      ['users:read', '查看用户', '查看用户信息', 'users', 'read'],
      ['users:update', '更新用户', '更新用户信息', 'users', 'update'],
      ['users:delete', '删除用户', '删除用户账户', 'users', 'delete'],
      ['users:list', '用户列表', '查看用户列表', 'users', 'list'],
      ['users:manage', '管理用户', '管理用户（包括状态变更）', 'users', 'manage']
    ]

    // 角色资源权限
    const rolePermissions = [
      ['roles:create', '创建角色', '创建新角色', 'roles', 'create'],
      ['roles:read', '查看角色', '查看角色信息', 'roles', 'read'],
      ['roles:update', '更新角色', '更新角色信息', 'roles', 'update'],
      ['roles:delete', '删除角色', '删除角色', 'roles', 'delete'],
      ['roles:list', '角色列表', '查看角色列表', 'roles', 'list'],
      ['roles:assign', '分配角色', '为用户分配角色', 'roles', 'assign']
    ]

    // 权限资源权限
    const permissionPermissions = [
      ['permissions:create', '创建权限', '创建新权限', 'permissions', 'create'],
      ['permissions:read', '查看权限', '查看权限信息', 'permissions', 'read'],
      ['permissions:update', '更新权限', '更新权限信息', 'permissions', 'update'],
      ['permissions:delete', '删除权限', '删除角色', 'permissions', 'delete'],
      ['permissions:list', '权限列表', '查看权限列表', 'permissions', 'list'],
      ['permissions:assign', '分配权限', '分配权限给角色或用户', 'permissions', 'assign']
    ]

    // 系统配置权限
    const configPermissions = [
      ['config:read', '查看配置', '查看系统配置', 'config', 'read'],
      ['config:update', '更新配置', '更新系统配置', 'config', 'update']
    ]

    // 所有权限集合
    const allPermissions = [...userPermissions, ...rolePermissions, ...permissionPermissions, ...configPermissions]

    // 插入所有权限
    const now = Math.floor(Date.now() / 1000) // 当前时间戳（秒）

    for (const [name, display_name, description, resource, action] of allPermissions) {
      db.run(
        `
      INSERT INTO permissions (name, display_name, description, resource, action, is_system, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `,
        [name, display_name, description, resource, action, now, now]
      )
    }
  })()
  console.log('✅ 系统权限创建完成')

  // 为角色分配权限
  console.log('🔄 为角色分配默认权限...')
  db.transaction(() => {
    // 获取角色ID
    const superAdminRole = db.query('SELECT id FROM roles WHERE name = "super_admin"').get()
    const adminRole = db.query('SELECT id FROM roles WHERE name = "admin"').get()
    const userRole = db.query('SELECT id FROM roles WHERE name = "user"').get()
    const guestRole = db.query('SELECT id FROM roles WHERE name = "guest"').get()

    // 获取所有权限
    const allPermissions = db.query('SELECT id FROM permissions').all()

    // 为超级管理员分配所有权限
    for (const perm of allPermissions) {
      db.run(
        `
      INSERT INTO role_permissions (role_id, permission_id, is_active)
      VALUES (?, ?, 1)
    `,
        [superAdminRole.id, perm.id]
      )
    }

    // 为管理员分配管理权限
    const adminPermissionNames = ['users:read', 'users:update', 'users:list', 'users:manage', 'roles:read', 'roles:list', 'permissions:read', 'permissions:list', 'config:read']

    for (const permName of adminPermissionNames) {
      const perm = db.query('SELECT id FROM permissions WHERE name = ?', [permName]).get()
      if (perm) {
        db.run(
          `
        INSERT INTO role_permissions (role_id, permission_id, is_active)
        VALUES (?, ?, 1)
      `,
          [adminRole.id, perm.id]
        )
      }
    }

    // 为普通用户分配基本权限
    const userPermissionNames = ['users:read']

    for (const permName of userPermissionNames) {
      const perm = db.query('SELECT id FROM permissions WHERE name = ?', [permName]).get()
      if (perm) {
        db.run(
          `
        INSERT INTO role_permissions (role_id, permission_id, is_active)
        VALUES (?, ?, 1)
      `,
          [userRole.id, perm.id]
        )
      }
    }
  })()
  console.log('✅ 角色权限分配完成')

  // 创建默认管理员用户
  console.log('👤 创建默认管理员用户...')
  db.transaction(() => {
    // 创建超级管理员用户
    db.run(`
    INSERT INTO users (
      username, email, password_hash, first_name, last_name,
      status, email_verified, created_at, updated_at
    )
    VALUES (
      'admin', 'admin@example.com',
      '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', -- admin
      'System', 'Administrator',
      'active', 1, strftime('%s','now'), strftime('%s','now')
    )
  `)

    // 获取用户ID和角色ID
    const adminUser = db.query('SELECT id FROM users WHERE username = "admin"').get()
    const superAdminRole = db.query('SELECT id FROM roles WHERE name = "super_admin"').get()

    // 分配超级管理员角色
    const currentTime = Math.floor(Date.now() / 1000) // 当前时间戳（秒）

    db.run(
      `
    INSERT INTO user_roles (user_id, role_id, is_active, assigned_at)
    VALUES (?, ?, 1, ?)
  `,
      [adminUser.id, superAdminRole.id, currentTime]
    )
  })()
  console.log('✅ 默认管理员用户创建完成')

  // 创建默认系统配置
  console.log('⚙️ 创建默认系统配置...')
  db.transaction(() => {
    const configs = [
      ['app.name', 'Bun Server'],
      ['app.description', '基于Bun的高性能服务器'],
      ['app.version', '1.0.0'],
      ['app.maintenance_mode', 'false'],
      ['app.debug_mode', 'true'],
      ['security.allow_registration', 'true'],
      ['security.verify_email', 'false'],
      ['security.password_policy', 'medium'],
      ['security.session_timeout', '86400'], // 24小时
      ['security.max_login_attempts', '5'],
      ['ui.theme', 'light'],
      ['ui.language', 'zh-CN']
    ]

    for (const [key, value] of configs) {
      db.run(
        `
      INSERT INTO system_config (config_key, config_value)
      VALUES (?, ?)
    `,
        [key, value]
      )
    }
  })()
  console.log('✅ 系统配置创建完成')

  console.log('🎉 数据库初始化完成!')
  console.log(`📊 数据库文件位置: ${DB_PATH}`)

  // 显示一些数据统计
  const stats = {
    users: db.query('SELECT COUNT(*) as count FROM users').get().count,
    roles: db.query('SELECT COUNT(*) as count FROM roles').get().count,
    permissions: db.query('SELECT COUNT(*) as count FROM permissions').get().count,
    role_permissions: db.query('SELECT COUNT(*) as count FROM role_permissions').get().count,
    user_roles: db.query('SELECT COUNT(*) as count FROM user_roles').get().count,
    configs: db.query('SELECT COUNT(*) as count FROM system_config').get().count
  }

  console.log('📝 数据统计:')
  console.log(`  用户: ${stats.users}`)
  console.log(`  角色: ${stats.roles}`)
  console.log(`  权限: ${stats.permissions}`)
  console.log(`  角色权限: ${stats.role_permissions}`)
  console.log(`  用户角色: ${stats.user_roles}`)
  console.log(`  系统配置: ${stats.configs}`)

  // 关闭数据库连接
  db.close()
}
