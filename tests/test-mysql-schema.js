/**
 * MySQL schema parity smoke test.
 *
 * 只验证 Drizzle MySQL schema 导出完整核心表，不连接真实 MySQL。
 */
import { testRunner } from './test-utils.js'

console.log('🧪 开始 MySQL schema parity 冒烟测试...')

const mysqlSchema = await import('../src/models/schema/mysql.js')

await testRunner.test('MySQL schema 导出后台核心表', async () => {
  const requiredTables = [
    'users',
    'system_config',
    'roles',
    'permissions',
    'user_roles',
    'role_permissions',
    'user_permissions',
    'user_sessions'
  ]

  for (const tableName of requiredTables) {
    testRunner.assert(mysqlSchema[tableName], `MySQL schema 应导出 ${tableName}`)
    testRunner.assert(mysqlSchema.schema[tableName], `MySQL schema 集合应包含 ${tableName}`)
  }
})

await testRunner.test('MySQL RBAC 表包含关键列', async () => {
  testRunner.assert(mysqlSchema.roles.name, 'roles 应包含 name')
  testRunner.assert(mysqlSchema.permissions.resource, 'permissions 应包含 resource')
  testRunner.assert(mysqlSchema.user_roles.user_id, 'user_roles 应包含 user_id')
  testRunner.assert(mysqlSchema.role_permissions.permission_id, 'role_permissions 应包含 permission_id')
  testRunner.assert(mysqlSchema.user_permissions.permission_type, 'user_permissions 应包含 permission_type')
  testRunner.assert(mysqlSchema.user_sessions.refresh_token_hash, 'user_sessions 应包含 refresh_token_hash')
})

testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
