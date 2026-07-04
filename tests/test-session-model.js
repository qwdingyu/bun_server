/**
 * 用户会话模型测试。
 *
 * 专门验证 refresh token 只保存 hash、可查找、可轮换、可撤销，支撑本地轻量认证闭环。
 */
import { initTestEnv, testRunner } from './test-utils.js'
import { sessionModel, userModel } from '../src/models/index.js'
import { generateTokenPair } from '../src/utils/jwt/index.js'

await initTestEnv()

console.log('🧪 开始用户会话模型测试...')

const unique = String(Date.now()).slice(-6)
const user = await userModel.createUser({
  username: `sess${unique}`,
  email: `session${unique}@example.com`,
  password: 'password123'
})

await testRunner.test('创建会话时只返回安全字段', async () => {
  const tokenPair = generateTokenPair(user)
  const session = await sessionModel.createSession({
    userId: user.id,
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresAt: tokenPair.refreshTokenExpiresAt,
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1'
  })

  testRunner.assert(session.id, '会话应该有 ID')
  testRunner.assertEqual(session.user_id, user.id, '会话用户应匹配')
  testRunner.assert(!session.token_hash, '不应返回 access token hash')
  testRunner.assert(!session.refresh_token_hash, '不应返回 refresh token hash')

  const activeSession = await sessionModel.findActiveByRefreshToken(tokenPair.refreshToken)
  testRunner.assert(activeSession, '应能通过 refresh token 找到活动会话')
  testRunner.assertEqual(activeSession.id, session.id, '活动会话 ID 应匹配')
})

await testRunner.test('轮换 refresh token 后旧 token 失效', async () => {
  const oldTokenPair = generateTokenPair(user)
  const session = await sessionModel.createSession({
    userId: user.id,
    accessToken: oldTokenPair.accessToken,
    refreshToken: oldTokenPair.refreshToken,
    expiresAt: oldTokenPair.refreshTokenExpiresAt
  })

  const newTokenPair = generateTokenPair(user)
  await sessionModel.rotateRefreshToken(session.id, {
    accessToken: newTokenPair.accessToken,
    refreshToken: newTokenPair.refreshToken,
    expiresAt: newTokenPair.refreshTokenExpiresAt
  })

  const oldSession = await sessionModel.findActiveByRefreshToken(oldTokenPair.refreshToken)
  const newSession = await sessionModel.findActiveByRefreshToken(newTokenPair.refreshToken)

  testRunner.assert(!oldSession, '旧 refresh token 应失效')
  testRunner.assert(newSession, '新 refresh token 应可用')
  testRunner.assertEqual(newSession.id, session.id, '轮换应复用同一会话记录')
})

await testRunner.test('撤销 refresh token 后无法再次使用', async () => {
  const tokenPair = generateTokenPair(user)
  await sessionModel.createSession({
    userId: user.id,
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresAt: tokenPair.refreshTokenExpiresAt
  })

  const revoked = await sessionModel.revokeByRefreshToken(tokenPair.refreshToken)
  const activeSession = await sessionModel.findActiveByRefreshToken(tokenPair.refreshToken)

  testRunner.assertEqual(revoked, true, '撤销应成功')
  testRunner.assert(!activeSession, '撤销后不应找到活动会话')
})

testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
