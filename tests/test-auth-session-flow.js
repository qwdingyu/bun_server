/**
 * 本地认证会话流测试。
 *
 * 覆盖登录创建会话、refresh token 轮换、旧 refresh token 失效、登出撤销会话。
 */
import { Hono } from 'hono'
import { initTestEnv, testRunner } from './test-utils.js'
import { userModel, sessionModel } from '../src/models/index.js'
import { userController } from '../src/controllers/UserController.js'
import { authMiddleware } from '../src/middleware/auth.js'

await initTestEnv()

console.log('🧪 开始认证会话流测试...')

const unique = String(Date.now()).slice(-6)
const credentials = {
  username: `flow${unique}`,
  email: `flow${unique}@example.com`,
  password: 'password123'
}

await userModel.createUser({ ...credentials })

const app = new Hono()
app.post('/login', async (c, next) => userController.login(c, next))
app.post('/refresh', async (c, next) => userController.refreshToken(c, next))
app.post('/logout', authMiddleware, async (c, next) => userController.logout(c, next))

let accessToken
let refreshToken
let rotatedRefreshToken

await testRunner.test('登录后创建可用会话', async () => {
  const response = await app.request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': 'flow-test' },
    body: JSON.stringify({ identifier: credentials.username, password: credentials.password })
  })

  testRunner.assertStatus(response, 200, '登录应该成功')
  const body = await response.json()
  testRunner.assert(body.success, '响应应该成功')

  accessToken = body.data.accessToken
  refreshToken = body.data.refreshToken

  const session = await sessionModel.findActiveByRefreshToken(refreshToken)
  testRunner.assert(session, '登录后 refresh token 应对应活动会话')
})

await testRunner.test('刷新令牌会轮换 refresh token', async () => {
  const response = await app.request('/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })

  testRunner.assertStatus(response, 200, '刷新应该成功')
  const body = await response.json()

  rotatedRefreshToken = body.data.refreshToken
  testRunner.assert(rotatedRefreshToken, '应该返回新的 refresh token')
  testRunner.assert(rotatedRefreshToken !== refreshToken, '新旧 refresh token 应不同')

  const oldSession = await sessionModel.findActiveByRefreshToken(refreshToken)
  const newSession = await sessionModel.findActiveByRefreshToken(rotatedRefreshToken)

  testRunner.assert(!oldSession, '旧 refresh token 应失效')
  testRunner.assert(newSession, '新 refresh token 应有效')
})

await testRunner.test('旧 refresh token 不能再次刷新', async () => {
  const response = await app.request('/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })

  testRunner.assertStatus(response, 401, '旧 refresh token 应被拒绝')
})

await testRunner.test('登出后 refresh token 被撤销', async () => {
  const response = await app.request('/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ refreshToken: rotatedRefreshToken })
  })

  testRunner.assertStatus(response, 200, '登出应该成功')

  const session = await sessionModel.findActiveByRefreshToken(rotatedRefreshToken)
  testRunner.assert(!session, '登出后 refresh token 应被撤销')
})

testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
