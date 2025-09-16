-- SQLite schema for Bun Server Framework (idempotent)
-- Enhanced with Role-Based Access Control (RBAC) system

PRAGMA foreign_keys = ON;

-- ============================================
-- 用户相关表
-- ============================================

-- 用户表
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
  phone_verified INTEGER DEFAULT 0,
  two_factor_enabled INTEGER DEFAULT 0,
  two_factor_secret TEXT,
  last_login_at INTEGER,
  last_login_ip TEXT,
  login_attempts INTEGER DEFAULT 0,
  locked_until INTEGER,
  password_changed_at INTEGER DEFAULT (strftime('%s','now')),
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  deleted_at INTEGER
);

-- 角色表
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 1, -- 角色级别，数字越大权限越高
  is_system INTEGER DEFAULT 0, -- 是否为系统内置角色
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);

-- 权限表
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  resource TEXT NOT NULL, -- 资源名称，如 users, posts, settings
  action TEXT NOT NULL,   -- 操作名称，如 create, read, update, delete
  is_system INTEGER DEFAULT 0, -- 是否为系统内置权限
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  assigned_by INTEGER, -- 分配者用户ID
  assigned_at INTEGER DEFAULT (strftime('%s','now')),
  expires_at INTEGER,  -- 角色过期时间，NULL表示永不过期
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, role_id)
);

-- 角色权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  granted_by INTEGER, -- 授权者用户ID
  granted_at INTEGER DEFAULT (strftime('%s','now')),
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(role_id, permission_id)
);

-- 用户直接权限表（特殊权限，覆盖角色权限）
CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  permission_type TEXT NOT NULL CHECK(permission_type IN ('grant', 'deny')), -- grant=授予, deny=拒绝
  granted_by INTEGER, -- 授权者用户ID
  granted_at INTEGER DEFAULT (strftime('%s','now')),
  expires_at INTEGER,  -- 权限过期时间，NULL表示永不过期
  reason TEXT,         -- 授权原因
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, permission_id)
);

-- ============================================
-- 会话和安全相关表
-- ============================================

-- 用户会话表
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
  last_used_at INTEGER DEFAULT (strftime('%s','now')),
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 登录日志表
CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  login_type TEXT DEFAULT 'password' CHECK(login_type IN ('password', 'oauth', '2fa', 'api_key')),
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'blocked')),
  failure_reason TEXT,
  session_id INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE SET NULL
);

-- 密码重置令牌表
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 邮箱验证令牌表
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  verified_at INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 系统配置和日志表
-- ============================================

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  config_type TEXT DEFAULT 'string' CHECK(config_type IN ('string', 'number', 'boolean', 'json', 'encrypted')),
  description TEXT,
  is_public INTEGER DEFAULT 0, -- 是否可以通过API公开访问
  updated_by INTEGER,
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values TEXT, -- JSON格式存储修改前的值
  new_values TEXT, -- JSON格式存储修改后的值
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- API访问限制表
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL, -- IP地址或用户ID
  identifier_type TEXT NOT NULL CHECK(identifier_type IN ('ip', 'user')),
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start INTEGER NOT NULL,
  window_size INTEGER NOT NULL, -- 窗口大小（秒）
  max_requests INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(identifier, endpoint, window_start)
);

-- ============================================
-- 索引
-- ============================================

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- 角色权限相关索引
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_level ON roles(level);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);

-- 会话相关索引
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_login_logs_ip_address ON login_logs(ip_address);

-- 令牌相关索引
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token_hash ON email_verification_tokens(token_hash);

-- 系统表索引
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_identifier ON api_rate_limits(identifier, endpoint);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start ON api_rate_limits(window_start);

-- ============================================
-- 视图
-- ============================================

-- 用户完整信息视图（包含角色和权限）
CREATE VIEW IF NOT EXISTS user_details AS
SELECT
  u.id,
  u.username,
  u.email,
  u.first_name,
  u.last_name,
  u.avatar_url,
  u.phone,
  u.status,
  u.email_verified,
  u.phone_verified,
  u.two_factor_enabled,
  u.last_login_at,
  u.last_login_ip,
  u.created_at,
  u.updated_at,
  GROUP_CONCAT(DISTINCT r.name) as roles,
  GROUP_CONCAT(DISTINCT r.display_name) as role_names,
  MAX(r.level) as max_role_level
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = 1 AND (ur.expires_at IS NULL OR ur.expires_at > strftime('%s','now'))
LEFT JOIN roles r ON ur.role_id = r.id AND r.status = 'active'
WHERE u.deleted_at IS NULL
GROUP BY u.id;

-- 有效权限视图（合并角色权限和用户直接权限）
CREATE VIEW IF NOT EXISTS effective_permissions AS
SELECT DISTINCT
  u.id as user_id,
  p.name as permission_name,
  p.resource,
  p.action,
  'role' as source,
  r.name as source_name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
  AND ur.is_active = 1
  AND (ur.expires_at IS NULL OR ur.expires_at > strftime('%s','now'))
JOIN roles r ON ur.role_id = r.id AND r.status = 'active'
JOIN role_permissions rp ON r.id = rp.role_id AND rp.is_active = 1
JOIN permissions p ON rp.permission_id = p.id
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = u.id
      AND up.permission_id = p.id
      AND up.permission_type = 'deny'
      AND up.is_active = 1
      AND (up.expires_at IS NULL OR up.expires_at > strftime('%s','now'))
  )

UNION

SELECT DISTINCT
  up.user_id,
  p.name as permission_name,
  p.resource,
  p.action,
  'direct' as source,
  up.permission_type as source_name
FROM user_permissions up
JOIN permissions p ON up.permission_id = p.id
JOIN users u ON up.user_id = u.id
WHERE up.permission_type = 'grant'
  AND up.is_active = 1
  AND (up.expires_at IS NULL OR up.expires_at > strftime('%s','now'))
  AND u.deleted_at IS NULL;

-- ============================================
-- 注释：触发器已移除
-- 更新时间逻辑将在应用层实现
-- ============================================

-- ============================================
-- 默认数据 (已移至初始化脚本)
-- ============================================

/* 以下默认数据插入已经被注释掉，这些数据将在应用层通过测试脚本进行初始化

-- 插入默认角色
-- INSERT OR IGNORE INTO roles (name, display_name, description, level, is_system) VALUES
-- ('super_admin', '超级管理员', '系统最高权限管理员，拥有所有权限', 100, 1),
-- ('admin', '管理员', '系统管理员，拥有大部分管理权限', 80, 1),
-- ('moderator', '版主', '内容管理员，可以管理用户内容', 50, 1),
-- ('user', '普通用户', '普通注册用户', 10, 1),
-- ('guest', '访客', '未注册或未登录用户', 1, 1);

-- 插入默认权限
-- INSERT OR IGNORE INTO permissions (name, display_name, description, resource, action, is_system) VALUES
-- -- 用户管理权限
-- ('users.create', '创建用户', '可以创建新用户', 'users', 'create', 1),
-- ('users.read', '查看用户', '可以查看用户信息', 'users', 'read', 1),
-- ('users.update', '更新用户', '可以修改用户信息', 'users', 'update', 1),
-- ('users.delete', '删除用户', '可以删除用户', 'users', 'delete', 1),
-- ('users.manage_roles', '管理用户角色', '可以分配和移除用户角色', 'users', 'manage_roles', 1),

-- -- 角色管理权限
-- ('roles.create', '创建角色', '可以创建新角色', 'roles', 'create', 1),
-- ('roles.read', '查看角色', '可以查看角色信息', 'roles', 'read', 1),
-- ('roles.update', '更新角色', '可以修改角色信息', 'roles', 'update', 1),
-- ('roles.delete', '删除角色', '可以删除角色', 'roles', 'delete', 1),

-- -- 权限管理权限
-- ('permissions.read', '查看权限', '可以查看权限信息', 'permissions', 'read', 1),
-- ('permissions.assign', '分配权限', '可以分配权限给角色', 'permissions', 'assign', 1),

-- -- 系统管理权限
-- ('system.logs', '查看日志', '可以查看系统日志', 'system', 'logs', 1),
-- ('system.monitor', '系统监控', '可以查看系统监控信息', 'system', 'monitor', 1),
-- ('system.settings', '系统设置', '可以修改系统设置', 'system', 'settings', 1),

-- -- 个人资料权限
-- ('profile.read', '查看个人资料', '可以查看自己的个人资料', 'profile', 'read', 1),
-- ('profile.update', '更新个人资料', '可以更新自己的个人资料', 'profile', 'update', 1);

-- 为超级管理员分配所有权限
-- INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
-- SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'; -- 超级管理员拥有所有权限

-- 为管理员分配权限
-- INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
-- SELECT r.id, p.id FROM roles r, permissions p
-- WHERE r.name = 'admin' AND p.name IN (
--   'users.create', 'users.read', 'users.update', 'users.manage_roles',
--   'roles.read', 'permissions.read', 'system.logs', 'system.monitor',
--   'profile.read', 'profile.update'
-- );

-- 为版主分配权限
-- INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
-- SELECT r.id, p.id FROM roles r, permissions p
-- WHERE r.name = 'moderator' AND p.name IN (
--   'users.read', 'users.update', 'system.logs',
--   'profile.read', 'profile.update'
-- );

-- 为普通用户分配权限
-- INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
-- SELECT r.id, p.id FROM roles r, permissions p
-- WHERE r.name = 'user' AND p.name IN (
--   'profile.read', 'profile.update'
-- );

-- 插入默认系统配置
-- INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description, is_public) VALUES
-- ('site_name', 'Bun Server Framework', 'string', '网站名称', 1),
-- ('site_description', 'Modern lightweight backend framework', 'string', '网站描述', 1),
-- ('allow_registration', 'true', 'boolean', '是否允许用户注册', 0),
-- ('require_email_verification', 'true', 'boolean', '是否需要邮箱验证', 0),
-- ('max_login_attempts', '5', 'number', '最大登录尝试次数', 0),
-- ('account_lockout_duration', '900', 'number', '账户锁定时长（秒）', 0),
-- ('session_timeout', '86400', 'number', '会话超时时间（秒）', 0),
-- ('password_min_length', '6', 'number', '密码最小长度', 0),
-- ('api_rate_limit_requests', '100', 'number', 'API限制请求数', 0),
-- ('api_rate_limit_window', '900', 'number', 'API限制时间窗口（秒）', 0);
*/
