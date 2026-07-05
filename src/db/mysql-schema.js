export const MYSQL_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    status VARCHAR(20) DEFAULT 'active',
    email_verified INT DEFAULT 0,
    last_login_at BIGINT,
    created_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
    updated_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
    deleted_at BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    updated_at BIGINT DEFAULT (UNIX_TIMESTAMP())
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    level INT NOT NULL DEFAULT 1,
    is_system INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
    updated_at BIGINT DEFAULT (UNIX_TIMESTAMP())
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    is_system INT DEFAULT 0,
    created_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
    updated_at BIGINT DEFAULT (UNIX_TIMESTAMP())
  )`,
  `CREATE TABLE IF NOT EXISTS user_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_by INT,
    assigned_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
    expires_at BIGINT,
    is_active INT DEFAULT 1,
    UNIQUE KEY uq_user_roles_user_role (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    granted_by INT,
    granted_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
    is_active INT DEFAULT 1,
    UNIQUE KEY uq_role_permissions_role_permission (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_granted_by FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    permission_id INT NOT NULL,
    permission_type VARCHAR(20) NOT NULL DEFAULT 'grant',
    granted_by INT,
    granted_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
    expires_at BIGINT,
    reason TEXT,
    is_active INT DEFAULT 1,
    UNIQUE KEY uq_user_permissions_user_permission (user_id, permission_id),
    CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_permissions_granted_by FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    refresh_token_hash VARCHAR(255) UNIQUE,
    device_info TEXT,
    user_agent TEXT,
    ip_address VARCHAR(100),
    location VARCHAR(255),
    is_active INT DEFAULT 1,
    expires_at BIGINT NOT NULL,
    last_used_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
    created_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    old_values TEXT,
    new_values TEXT,
    ip_address VARCHAR(100),
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`
]

export const MYSQL_INDEX_STATEMENTS = [
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

export async function applyMysqlSchema(pool) {
  for (const statement of MYSQL_SCHEMA_STATEMENTS) {
    await pool.query(statement)
  }

  for (const statement of MYSQL_INDEX_STATEMENTS) {
    try {
      await pool.query(statement)
    } catch (error) {
      if (error?.code !== 'ER_DUP_KEYNAME') {
        throw error
      }
    }
  }
}
