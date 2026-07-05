/**
 * MySQL 真实连接级初始化测试。
 *
 * 使用方式：
 * MYSQL_TEST_DATABASE_URL="mysql://user:pass@127.0.0.1:3306/bun_server_test" bun run tests/test-mysql-integration.js
 *
 * 注意：该脚本会在目标库中执行幂等建表与默认 seed，必须指向测试库或临时库。
 */
import { createPool } from 'mysql2/promise'
import { testRunner } from './test-utils.js'
import { applyMysqlSchema } from '../src/db/mysql-schema.js'
import { DEFAULT_PERMISSIONS, DEFAULT_ROLES, DEFAULT_SYSTEM_CONFIGS, getMysqlSeedSummary, seedMysqlDefaults } from '../src/db/seed.js'

console.log('🧪 开始 MySQL 真实连接级初始化测试...')

const databaseUrl = process.env.MYSQL_TEST_DATABASE_URL
if (!databaseUrl) {
  console.log('⚠️ 跳过：未设置 MYSQL_TEST_DATABASE_URL。请使用测试库运行真实 MySQL 初始化验证。')
  process.exit(0)
}

const pool = createPool({ uri: databaseUrl, connectionLimit: 2 })

try {
  await testRunner.test('MySQL 可以执行幂等建表与默认 seed', async () => {
    await applyMysqlSchema(pool)
    await seedMysqlDefaults(pool)
    await seedMysqlDefaults(pool)

    const summary = await getMysqlSeedSummary(pool)
    testRunner.assert(summary.roles >= DEFAULT_ROLES.length, '默认角色数量应满足 seed 要求')
    testRunner.assert(summary.permissions >= DEFAULT_PERMISSIONS.length, '默认权限数量应满足 seed 要求')
    testRunner.assert(summary.configs >= DEFAULT_SYSTEM_CONFIGS.length, '默认配置数量应满足 seed 要求')
    testRunner.assert(summary.users >= 1, '默认管理员应存在')
    testRunner.assert(summary.user_roles >= 1, '默认管理员角色关系应存在')
    testRunner.assert(summary.role_permissions >= DEFAULT_PERMISSIONS.length, '超级管理员应拥有默认权限')
  })
} finally {
  await pool.end()
}

testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
