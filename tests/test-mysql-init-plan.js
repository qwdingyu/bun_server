/**
 * MySQL 初始化计划测试。
 *
 * 不依赖真实 MySQL 服务，验证当前脚手架已经具备可执行的 MySQL DDL 与默认 seed 路径。
 * 真实连接级验证仍应在具备 MySQL 服务的 CI/部署环境中执行。
 */
import { testRunner } from './test-utils.js'
import { MYSQL_INDEX_STATEMENTS, MYSQL_SCHEMA_STATEMENTS, applyMysqlSchema } from '../src/db/mysql-schema.js'
import { DEFAULT_PERMISSIONS, DEFAULT_ROLES, DEFAULT_SYSTEM_CONFIGS, seedMysqlDefaults } from '../src/db/seed.js'

console.log('🧪 开始 MySQL 初始化计划测试...')

await testRunner.test('MySQL DDL 覆盖后台核心表并可重复执行索引', async () => {
  const schemaSql = MYSQL_SCHEMA_STATEMENTS.join('\n')
  const requiredTables = [
    'users',
    'system_config',
    'roles',
    'permissions',
    'user_roles',
    'role_permissions',
    'user_permissions',
    'user_sessions',
    'audit_logs'
  ]

  for (const tableName of requiredTables) {
    testRunner.assert(schemaSql.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`), `DDL 应创建 ${tableName}`)
  }

  const calls = []
  const fakePool = {
    async query(sql) {
      calls.push(sql)
      if (sql.startsWith('CREATE INDEX')) {
        const error = new Error('duplicate index')
        error.code = 'ER_DUP_KEYNAME'
        throw error
      }
      return [[], undefined]
    }
  }

  await applyMysqlSchema(fakePool)
  testRunner.assertEqual(calls.length, MYSQL_SCHEMA_STATEMENTS.length + MYSQL_INDEX_STATEMENTS.length, '应执行全部建表和索引语句')
})

await testRunner.test('MySQL 默认 seed 复用统一角色权限配置', async () => {
  const executed = []
  const queries = []
  const roleRows = DEFAULT_ROLES.map((role, index) => ({ id: index + 1, name: role.name }))
  const permissionRows = DEFAULT_PERMISSIONS.map((permission, index) => ({ id: index + 1, name: permission.name }))

  const fakeConnection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, params = []) {
      executed.push({ sql, params })
      return [{ affectedRows: 1 }, undefined]
    },
    async query(sql, params = []) {
      queries.push({ sql, params })
      if (sql === 'SELECT id, name FROM roles') return [roleRows, undefined]
      if (sql === 'SELECT id, name FROM permissions') return [permissionRows, undefined]
      if (sql === 'SELECT id FROM users WHERE username = ?') return [[{ id: 1 }], undefined]
      return [[], undefined]
    }
  }

  const fakePool = {
    async getConnection() {
      return fakeConnection
    }
  }

  await seedMysqlDefaults(fakePool)

  const executedSql = executed.map((item) => item.sql).join('\n')
  testRunner.assert(executedSql.includes('INSERT INTO roles'), '应写入默认角色')
  testRunner.assert(executedSql.includes('INSERT INTO permissions'), '应写入默认权限')
  testRunner.assert(executedSql.includes('INSERT INTO role_permissions'), '应写入角色权限关系')
  testRunner.assert(executedSql.includes('INSERT INTO users'), '应写入默认管理员')
  testRunner.assert(executedSql.includes('INSERT INTO user_roles'), '应写入默认管理员角色')
  testRunner.assert(executedSql.includes('INSERT INTO system_config'), '应写入系统配置')

  const roleInsertCount = executed.filter((item) => item.sql.includes('INSERT INTO roles')).length
  const permissionInsertCount = executed.filter((item) => item.sql.includes('INSERT INTO permissions')).length
  const configInsertCount = executed.filter((item) => item.sql.includes('INSERT INTO system_config')).length

  testRunner.assertEqual(roleInsertCount, DEFAULT_ROLES.length, '默认角色数量应与统一 seed 一致')
  testRunner.assertEqual(permissionInsertCount, DEFAULT_PERMISSIONS.length, '默认权限数量应与统一 seed 一致')
  testRunner.assertEqual(configInsertCount, DEFAULT_SYSTEM_CONFIGS.length, '默认配置数量应与统一 seed 一致')
  testRunner.assert(queries.some((item) => item.sql === 'SELECT id, name FROM roles'), '应查询角色 ID 映射')
  testRunner.assert(queries.some((item) => item.sql === 'SELECT id, name FROM permissions'), '应查询权限 ID 映射')
})

testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
