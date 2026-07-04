/**
 * API 契约冒烟测试。
 *
 * 只覆盖当前真实暴露的后台脚手架接口，避免继续验证已不存在的旧路由。
 */
import { initTestEnv, testRunner, cleanupTestData } from './test-utils.js'
import { roleModel, sessionModel, userModel } from '../src/models/index.js'
import { verifyToken } from '../src/utils/jwt/index.js'

await initTestEnv()

console.log('🧪 开始 API 契约冒烟测试...')

const appModule = await import('../src/main.js')
const app = appModule.default
const unique = String(Date.now()).slice(-6)

let accessToken
let refreshToken
let rotatedRefreshToken
let currentUserId
let adminToken
let targetUserId

function jsonHeaders(token = null) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

await testRunner.test('健康检查接口按当前契约可用', async () => {
  const healthResponse = await app.request('/health')
  testRunner.assertStatus(healthResponse, 200, '根健康检查应该成功')
  const health = await healthResponse.json()
  testRunner.assert(health.status, '健康检查应该返回 status')

  const apiHealthResponse = await app.request('/api/health')
  testRunner.assertStatus(apiHealthResponse, 200, 'API 健康检查应该成功')
  const apiHealth = await apiHealthResponse.json()
  testRunner.assert(apiHealth.timestamp, 'API 健康检查应该返回 timestamp')
})

await testRunner.test('注册接口返回用户和 token 对', async () => {
  const response = await app.request('/api/users/auth/register', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      username: `apiuser${unique}`,
      email: `apiuser${unique}@example.com`,
      password: 'password123',
      first_name: 'API',
      last_name: 'User'
    })
  })

  testRunner.assertStatus(response, 201, '注册应该成功')
  const body = await response.json()
  testRunner.assert(body.success, '注册响应 success 应为 true')
  testRunner.assert(body.data.user.id, '注册应返回用户 ID')
  testRunner.assert(body.data.accessToken, '注册应返回 accessToken')
  testRunner.assert(body.data.refreshToken, '注册应返回 refreshToken')

  accessToken = body.data.accessToken
  refreshToken = body.data.refreshToken
  currentUserId = body.data.user.id

  const verified = verifyToken(accessToken)
  testRunner.assert(verified.success, 'accessToken 应可验证')
  testRunner.assertEqual(verified.payload.username, `apiuser${unique}`, 'token 应包含用户名')

  const session = await sessionModel.findActiveByRefreshToken(refreshToken)
  testRunner.assert(session, '注册后应创建服务端会话')
})

await testRunner.test('登录、当前用户、刷新和登出形成闭环', async () => {
  const loginResponse = await app.request('/api/users/auth/login', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ identifier: `apiuser${unique}`, password: 'password123' })
  })

  testRunner.assertStatus(loginResponse, 200, '登录应该成功')
  const loginBody = await loginResponse.json()
  testRunner.assert(loginBody.data.accessToken, '登录应返回 accessToken')
  accessToken = loginBody.data.accessToken
  refreshToken = loginBody.data.refreshToken

  const meResponse = await app.request('/api/users/me', {
    method: 'GET',
    headers: jsonHeaders(accessToken)
  })
  testRunner.assertStatus(meResponse, 200, '当前用户接口应该成功')
  const meBody = await meResponse.json()
  testRunner.assertEqual(meBody.data.id, currentUserId, '当前用户 ID 应匹配')

  const refreshResponse = await app.request('/api/users/auth/refresh', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ refreshToken })
  })
  testRunner.assertStatus(refreshResponse, 200, '刷新令牌应该成功')
  const refreshBody = await refreshResponse.json()
  rotatedRefreshToken = refreshBody.data.refreshToken
  testRunner.assert(rotatedRefreshToken !== refreshToken, '刷新应轮换 refreshToken')

  const oldRefreshResponse = await app.request('/api/users/auth/refresh', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ refreshToken })
  })
  testRunner.assertStatus(oldRefreshResponse, 401, '旧 refreshToken 应失效')

  accessToken = refreshBody.data.accessToken
  const logoutResponse = await app.request('/api/users/auth/logout', {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ refreshToken: rotatedRefreshToken })
  })
  testRunner.assertStatus(logoutResponse, 200, '登出应该成功')

  const session = await sessionModel.findActiveByRefreshToken(rotatedRefreshToken)
  testRunner.assert(!session, '登出后会话应撤销')
})

await testRunner.test('用户列表、详情和统计接口可用', async () => {
  const listResponse = await app.request('/api/users?page=1&limit=10')
  testRunner.assertStatus(listResponse, 200, '用户列表应该成功')
  const listBody = await listResponse.json()
  testRunner.assert(Array.isArray(listBody.data.users), '用户列表应返回 users 数组')
  testRunner.assert(listBody.data.pagination, '用户列表应返回分页信息')

  const detailResponse = await app.request(`/api/users/${currentUserId}`, {
    method: 'GET',
    headers: jsonHeaders(accessToken)
  })
  testRunner.assertStatus(detailResponse, 200, '用户详情应该成功')
  const detailBody = await detailResponse.json()
  testRunner.assertEqual(detailBody.data.id, currentUserId, '用户详情 ID 应匹配')

  const statsResponse = await app.request('/api/users/stats')
  testRunner.assertStatus(statsResponse, 200, '用户统计应该成功')
  const statsBody = await statsResponse.json()
  testRunner.assert(typeof statsBody.data.total === 'number', '用户统计应包含 total')
})

await testRunner.test('超级管理员批量接口按契约执行', async () => {
  const admin = await userModel.createUser({
    username: `apiadmin${unique}`,
    email: `apiadmin${unique}@example.com`,
    password: 'password123'
  })
  const superAdminRole = await roleModel.findOne({ name: 'super_admin' })
  await roleModel.assignRoleToUser(admin.id, superAdminRole.id)

  const adminLoginResponse = await app.request('/api/users/auth/login', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ identifier: `apiadmin${unique}`, password: 'password123' })
  })
  testRunner.assertStatus(adminLoginResponse, 200, '超级管理员登录应该成功')
  const adminLoginBody = await adminLoginResponse.json()
  adminToken = adminLoginBody.data.accessToken

  const target = await userModel.createUser({
    username: `apitarget${unique}`,
    email: `apitarget${unique}@example.com`,
    password: 'password123'
  })
  targetUserId = target.id

  const updateStatusResponse = await app.request('/api/users/batch/update-status', {
    method: 'POST',
    headers: jsonHeaders(adminToken),
    body: JSON.stringify({ userIds: [targetUserId], status: 'inactive' })
  })
  testRunner.assertStatus(updateStatusResponse, 200, '批量更新状态应该成功')
  const updateStatusBody = await updateStatusResponse.json()
  testRunner.assertEqual(updateStatusBody.data.affected, 1, '应更新一个用户')

  const deleteResponse = await app.request('/api/users/batch', {
    method: 'DELETE',
    headers: jsonHeaders(adminToken),
    body: JSON.stringify({ userIds: [targetUserId] })
  })
  testRunner.assertStatus(deleteResponse, 200, '批量删除应该成功')
  const deleteBody = await deleteResponse.json()
  testRunner.assertEqual(deleteBody.data.affected, 1, '应软删除一个用户')
})

await cleanupTestData()
testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
