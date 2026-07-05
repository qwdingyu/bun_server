/**
 * 当前用户权限、菜单按钮和审计日志闭环测试。
 *
 * 覆盖后台前端初始化最依赖的 /me/permissions、/me/menus，
 * 并验证高价值用户批量操作会沉淀可追溯的 audit_logs 记录。
 */
import { Hono } from 'hono'
import userRoutes from '../src/routes/users.js'
import { initTestEnv, testRunner, cleanupTestData, getTestDbConnection } from './test-utils.js'
import { roleModel, userModel } from '../src/models/index.js'
import { generateTokenPair } from '../src/utils/jwt/index.js'

await initTestEnv()

console.log('🧪 开始用户权限菜单与审计日志测试...')

const unique = String(Date.now()).slice(-6)
const superAdmin = await userModel.createUser({
  username: `testmenusa${unique}`,
  email: `testmenusa${unique}@example.com`,
  password: 'password123'
})
const normalUser = await userModel.createUser({
  username: `testmenuu${unique}`,
  email: `testmenuu${unique}@example.com`,
  password: 'password123'
})
const targetUser = await userModel.createUser({
  username: `testmenut${unique}`,
  email: `testmenut${unique}@example.com`,
  password: 'password123'
})

const superAdminRole = await roleModel.findOne({ name: 'super_admin' })
const userRole = await roleModel.findOne({ name: 'user' })
await roleModel.assignRoleToUser(superAdmin.id, superAdminRole.id)
await roleModel.assignRoleToUser(normalUser.id, userRole.id)

const superTokenPair = generateTokenPair(superAdmin)
const normalTokenPair = generateTokenPair(normalUser)
const app = new Hono()
app.route('/api/users', userRoutes)

function jsonHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }
}

await testRunner.test('当前用户权限接口返回有效权限名', async () => {
  const response = await app.request('/api/users/me/permissions', {
    method: 'GET',
    headers: jsonHeaders(superTokenPair.accessToken)
  })

  const body = await response.json()
  testRunner.assertStatus(response, 200, `权限接口应该成功: ${JSON.stringify(body)}`)
  testRunner.assert(Array.isArray(body.data.permissions), '应返回权限明细数组')
  testRunner.assert(body.data.permissionNames.includes('users:read'), '超级管理员应拥有 users:read')
  testRunner.assert(body.data.permissionNames.includes('roles:read'), '超级管理员应拥有 roles:read')
})

await testRunner.test('菜单接口按权限过滤菜单和按钮', async () => {
  const superResponse = await app.request('/api/users/me/menus', {
    method: 'GET',
    headers: jsonHeaders(superTokenPair.accessToken)
  })
  const superBody = await superResponse.json()
  testRunner.assertStatus(superResponse, 200, `超级管理员菜单应该成功: ${JSON.stringify(superBody)}`)
  testRunner.assert(superBody.data.menus.some((menu) => menu.key === 'users'), '超级管理员应看到用户管理菜单')
  testRunner.assert(superBody.data.menus.find((menu) => menu.key === 'users').buttons.some((button) => button.key === 'delete'), '超级管理员应看到删除按钮')

  const normalResponse = await app.request('/api/users/me/menus', {
    method: 'GET',
    headers: jsonHeaders(normalTokenPair.accessToken)
  })
  const normalBody = await normalResponse.json()
  testRunner.assertStatus(normalResponse, 200, `普通用户菜单应该成功: ${JSON.stringify(normalBody)}`)
  testRunner.assert(normalBody.data.menus.some((menu) => menu.key === 'dashboard'), '普通用户应看到控制台')
  testRunner.assert(!normalBody.data.menus.some((menu) => menu.key === 'roles'), '普通用户不应看到角色管理菜单')
})

await testRunner.test('批量用户操作写入审计日志', async () => {
  const response = await app.request('/api/users/batch/update-status', {
    method: 'POST',
    headers: jsonHeaders(superTokenPair.accessToken),
    body: JSON.stringify({ userIds: [targetUser.id], status: 'inactive' })
  })

  const body = await response.json()
  testRunner.assertStatus(response, 200, `批量更新应该成功: ${JSON.stringify(body)}`)

  const db = getTestDbConnection()
  const auditLog = db
    .query('SELECT * FROM audit_logs WHERE action = ? AND resource_type = ? AND user_id = ? ORDER BY id DESC LIMIT 1')
    .get('users.batch_update_status', 'users', superAdmin.id)

  testRunner.assert(auditLog, '应写入批量更新审计日志')
  testRunner.assertEqual(auditLog.resource_id, String(targetUser.id), '审计日志应记录目标用户 ID')
  testRunner.assert(JSON.parse(auditLog.new_values).status === 'inactive', '审计日志应记录新状态')
})

await cleanupTestData()
testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
