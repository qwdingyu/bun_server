import { hashPassword } from '../utils/auth.js'

export const DEFAULT_ROLES = [
  {
    name: 'super_admin',
    display_name: '超级管理员',
    description: '系统最高权限角色，可以执行所有操作',
    level: 100
  },
  {
    name: 'admin',
    display_name: '管理员',
    description: '系统管理员，可以执行大部分管理操作',
    level: 50
  },
  {
    name: 'user',
    display_name: '普通用户',
    description: '标准用户权限',
    level: 10
  },
  {
    name: 'guest',
    display_name: '访客',
    description: '最低权限，只能查看公开内容',
    level: 1
  }
]

export const DEFAULT_PERMISSIONS = [
  ['users:create', '创建用户', '创建新用户账户', 'users', 'create'],
  ['users:read', '查看用户', '查看用户信息', 'users', 'read'],
  ['users:update', '更新用户', '更新用户信息', 'users', 'update'],
  ['users:delete', '删除用户', '删除用户账户', 'users', 'delete'],
  ['users:list', '用户列表', '查看用户列表', 'users', 'list'],
  ['users:manage', '管理用户', '管理用户（包括状态变更）', 'users', 'manage'],
  ['roles:create', '创建角色', '创建新角色', 'roles', 'create'],
  ['roles:read', '查看角色', '查看角色信息', 'roles', 'read'],
  ['roles:update', '更新角色', '更新角色信息', 'roles', 'update'],
  ['roles:delete', '删除角色', '删除角色', 'roles', 'delete'],
  ['roles:list', '角色列表', '查看角色列表', 'roles', 'list'],
  ['roles:assign', '分配角色', '为用户分配角色', 'roles', 'assign'],
  ['permissions:create', '创建权限', '创建新权限', 'permissions', 'create'],
  ['permissions:read', '查看权限', '查看权限信息', 'permissions', 'read'],
  ['permissions:update', '更新权限', '更新权限信息', 'permissions', 'update'],
  ['permissions:delete', '删除权限', '删除权限', 'permissions', 'delete'],
  ['permissions:list', '权限列表', '查看权限列表', 'permissions', 'list'],
  ['permissions:assign', '分配权限', '分配权限给角色或用户', 'permissions', 'assign'],
  ['config:read', '查看配置', '查看系统配置', 'config', 'read'],
  ['config:update', '更新配置', '更新系统配置', 'config', 'update']
].map(([name, display_name, description, resource, action]) => ({
  name,
  display_name,
  description,
  resource,
  action
}))

export const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: '*',
  admin: [
    'users:read',
    'users:update',
    'users:list',
    'users:manage',
    'roles:read',
    'roles:list',
    'permissions:read',
    'permissions:list',
    'config:read'
  ],
  user: ['users:read'],
  guest: []
}

export const DEFAULT_ADMIN_USER = {
  username: 'admin',
  email: 'admin@example.com',
  password: 'admin',
  first_name: 'System',
  last_name: 'Administrator',
  role: 'super_admin'
}

export const DEFAULT_SYSTEM_CONFIGS = [
  ['app.name', 'Bun Server'],
  ['app.description', '基于Bun的高性能服务器'],
  ['app.version', '1.0.0'],
  ['app.maintenance_mode', 'false'],
  ['app.debug_mode', 'true'],
  ['security.allow_registration', 'true'],
  ['security.verify_email', 'false'],
  ['security.password_policy', 'medium'],
  ['security.session_timeout', '86400'],
  ['security.max_login_attempts', '5'],
  ['ui.theme', 'light'],
  ['ui.language', 'zh-CN']
].map(([config_key, config_value]) => ({ config_key, config_value }))

function run(sqlite, sql, params = []) {
  return sqlite.query(sql).run(...params)
}

function get(sqlite, sql, params = []) {
  return sqlite.query(sql).get(...params)
}

function all(sqlite, sql, params = []) {
  return sqlite.query(sql).all(...params)
}

async function mysqlQuery(pool, sql, params = []) {
  const [rows] = await pool.query(sql, params)
  return rows
}

async function mysqlExecute(pool, sql, params = []) {
  await pool.execute(sql, params)
}

export function seedSqliteDefaults(sqlite, options = {}) {
  const { includeAdmin = true } = options
  const now = Math.floor(Date.now() / 1000)

  sqlite.transaction(() => {
    for (const role of DEFAULT_ROLES) {
      run(
        sqlite,
        `
          INSERT INTO roles (name, display_name, description, level, is_system, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, 'active', ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            display_name = excluded.display_name,
            description = excluded.description,
            level = excluded.level,
            is_system = 1,
            status = 'active',
            updated_at = excluded.updated_at
        `,
        [role.name, role.display_name, role.description, role.level, now, now]
      )
    }

    for (const permission of DEFAULT_PERMISSIONS) {
      run(
        sqlite,
        `
          INSERT INTO permissions (name, display_name, description, resource, action, is_system, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            display_name = excluded.display_name,
            description = excluded.description,
            resource = excluded.resource,
            action = excluded.action,
            is_system = 1,
            updated_at = excluded.updated_at
        `,
        [permission.name, permission.display_name, permission.description, permission.resource, permission.action, now, now]
      )
    }

    const roleRows = all(sqlite, 'SELECT id, name FROM roles')
    const permissionRows = all(sqlite, 'SELECT id, name FROM permissions')
    const roleIdByName = new Map(roleRows.map((role) => [role.name, role.id]))
    const permissionIdByName = new Map(permissionRows.map((permission) => [permission.name, permission.id]))

    for (const [roleName, permissionNames] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const roleId = roleIdByName.get(roleName)
      if (!roleId) continue

      const names = permissionNames === '*' ? [...permissionIdByName.keys()] : permissionNames
      for (const permissionName of names) {
        const permissionId = permissionIdByName.get(permissionName)
        if (!permissionId) continue

        run(
          sqlite,
          `
            INSERT INTO role_permissions (role_id, permission_id, is_active, granted_at)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(role_id, permission_id) DO UPDATE SET
              is_active = 1,
              granted_at = excluded.granted_at
          `,
          [roleId, permissionId, now]
        )
      }
    }

    if (includeAdmin) {
      run(
        sqlite,
        `
          INSERT INTO users (username, email, password_hash, first_name, last_name, status, email_verified, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)
          ON CONFLICT(username) DO UPDATE SET
            email = excluded.email,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            status = 'active',
            email_verified = 1,
            updated_at = excluded.updated_at
        `,
        [
          DEFAULT_ADMIN_USER.username,
          DEFAULT_ADMIN_USER.email,
          hashPassword(DEFAULT_ADMIN_USER.password),
          DEFAULT_ADMIN_USER.first_name,
          DEFAULT_ADMIN_USER.last_name,
          now,
          now
        ]
      )

      const adminUser = get(sqlite, 'SELECT id FROM users WHERE username = ?', [DEFAULT_ADMIN_USER.username])
      const adminRoleId = roleIdByName.get(DEFAULT_ADMIN_USER.role)
      if (adminUser && adminRoleId) {
        run(
          sqlite,
          `
            INSERT INTO user_roles (user_id, role_id, is_active, assigned_at)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(user_id, role_id) DO UPDATE SET
              is_active = 1,
              assigned_at = excluded.assigned_at
          `,
          [adminUser.id, adminRoleId, now]
        )
      }
    }

    for (const config of DEFAULT_SYSTEM_CONFIGS) {
      run(
        sqlite,
        `
          INSERT INTO system_config (config_key, config_value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(config_key) DO UPDATE SET
            config_value = excluded.config_value,
            updated_at = excluded.updated_at
        `,
        [config.config_key, config.config_value, now]
      )
    }
  })()
}

export function getSeedSummary(sqlite) {
  return {
    users: get(sqlite, 'SELECT COUNT(*) as count FROM users')?.count || 0,
    roles: get(sqlite, 'SELECT COUNT(*) as count FROM roles')?.count || 0,
    permissions: get(sqlite, 'SELECT COUNT(*) as count FROM permissions')?.count || 0,
    role_permissions: get(sqlite, 'SELECT COUNT(*) as count FROM role_permissions')?.count || 0,
    user_roles: get(sqlite, 'SELECT COUNT(*) as count FROM user_roles')?.count || 0,
    configs: get(sqlite, 'SELECT COUNT(*) as count FROM system_config')?.count || 0
  }
}

export async function seedMysqlDefaults(pool, options = {}) {
  const { includeAdmin = true } = options
  const now = Math.floor(Date.now() / 1000)

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    for (const role of DEFAULT_ROLES) {
      await mysqlExecute(
        connection,
        `
          INSERT INTO roles (name, display_name, description, level, is_system, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, 'active', ?, ?)
          ON DUPLICATE KEY UPDATE
            display_name = VALUES(display_name),
            description = VALUES(description),
            level = VALUES(level),
            is_system = 1,
            status = 'active',
            updated_at = VALUES(updated_at)
        `,
        [role.name, role.display_name, role.description, role.level, now, now]
      )
    }

    for (const permission of DEFAULT_PERMISSIONS) {
      await mysqlExecute(
        connection,
        `
          INSERT INTO permissions (name, display_name, description, resource, action, is_system, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
          ON DUPLICATE KEY UPDATE
            display_name = VALUES(display_name),
            description = VALUES(description),
            resource = VALUES(resource),
            action = VALUES(action),
            is_system = 1,
            updated_at = VALUES(updated_at)
        `,
        [permission.name, permission.display_name, permission.description, permission.resource, permission.action, now, now]
      )
    }

    const roleRows = await mysqlQuery(connection, 'SELECT id, name FROM roles')
    const permissionRows = await mysqlQuery(connection, 'SELECT id, name FROM permissions')
    const roleIdByName = new Map(roleRows.map((role) => [role.name, role.id]))
    const permissionIdByName = new Map(permissionRows.map((permission) => [permission.name, permission.id]))

    for (const [roleName, permissionNames] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const roleId = roleIdByName.get(roleName)
      if (!roleId) continue

      const names = permissionNames === '*' ? [...permissionIdByName.keys()] : permissionNames
      for (const permissionName of names) {
        const permissionId = permissionIdByName.get(permissionName)
        if (!permissionId) continue

        await mysqlExecute(
          connection,
          `
            INSERT INTO role_permissions (role_id, permission_id, is_active, granted_at)
            VALUES (?, ?, 1, ?)
            ON DUPLICATE KEY UPDATE
              is_active = 1,
              granted_at = VALUES(granted_at)
          `,
          [roleId, permissionId, now]
        )
      }
    }

    if (includeAdmin) {
      await mysqlExecute(
        connection,
        `
          INSERT INTO users (username, email, password_hash, first_name, last_name, status, email_verified, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)
          ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            status = 'active',
            email_verified = 1,
            updated_at = VALUES(updated_at)
        `,
        [
          DEFAULT_ADMIN_USER.username,
          DEFAULT_ADMIN_USER.email,
          hashPassword(DEFAULT_ADMIN_USER.password),
          DEFAULT_ADMIN_USER.first_name,
          DEFAULT_ADMIN_USER.last_name,
          now,
          now
        ]
      )

      const [adminUser] = await mysqlQuery(connection, 'SELECT id FROM users WHERE username = ?', [DEFAULT_ADMIN_USER.username])
      const adminRoleId = roleIdByName.get(DEFAULT_ADMIN_USER.role)
      if (adminUser && adminRoleId) {
        await mysqlExecute(
          connection,
          `
            INSERT INTO user_roles (user_id, role_id, is_active, assigned_at)
            VALUES (?, ?, 1, ?)
            ON DUPLICATE KEY UPDATE
              is_active = 1,
              assigned_at = VALUES(assigned_at)
          `,
          [adminUser.id, adminRoleId, now]
        )
      }
    }

    for (const config of DEFAULT_SYSTEM_CONFIGS) {
      await mysqlExecute(
        connection,
        `
          INSERT INTO system_config (config_key, config_value, updated_at)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            config_value = VALUES(config_value),
            updated_at = VALUES(updated_at)
        `,
        [config.config_key, config.config_value, now]
      )
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getMysqlSeedSummary(pool) {
  const count = async (tableName) => {
    const [row] = await mysqlQuery(pool, `SELECT COUNT(*) as count FROM ${tableName}`)
    return row?.count || 0
  }

  return {
    users: await count('users'),
    roles: await count('roles'),
    permissions: await count('permissions'),
    role_permissions: await count('role_permissions'),
    user_roles: await count('user_roles'),
    configs: await count('system_config')
  }
}
