/**
 * 本地认证 Provider 测试。
 *
 * 该测试不依赖真实数据库，专门锁定 AuthProvider/AuthContext seam，避免后续接入
 * refresh token 持久化或 Logto Adapter 时破坏认证上下文契约。
 */
import { generateToken } from '../src/utils/jwt/index.js'
import { LocalJwtAuthProvider } from '../src/modules/auth/index.js'
import { testRunner } from './test-utils.js'

function createMockContext(token = null) {
  return {
    req: {
      header(name) {
        if (name === 'Authorization' && token) {
          return `Bearer ${token}`
        }
        return null
      }
    }
  }
}

const activeUser = {
  id: 1001,
  username: 'authuser',
  email: 'auth@example.com',
  status: 'active'
}

const userRepository = {
  async findById(id) {
    return id === activeUser.id ? activeUser : null
  }
}

const provider = new LocalJwtAuthProvider({ userRepository })

console.log('🧪 开始本地认证 Provider 测试...')

await testRunner.test('缺少令牌时返回 MISSING_TOKEN', async () => {
  const result = await provider.authenticateRequest(createMockContext())

  testRunner.assertEqual(result.success, false, '认证应该失败')
  testRunner.assertEqual(result.status, 401, '应该返回 401')
  testRunner.assertEqual(result.error.code, 'MISSING_TOKEN', '错误码应该匹配')
})

await testRunner.test('令牌有效时生成统一 AuthContext', async () => {
  const token = generateToken({
    id: activeUser.id,
    username: activeUser.username,
    email: activeUser.email
  })

  const result = await provider.authenticateRequest(createMockContext(token))

  testRunner.assertEqual(result.success, true, '认证应该成功')
  testRunner.assertEqual(result.user.id, activeUser.id, '应该返回本地用户')
  testRunner.assertEqual(result.authContext.provider, 'local', 'Provider 应该是 local')
  testRunner.assertEqual(result.authContext.localUserId, activeUser.id, '本地用户 ID 应该匹配')
  testRunner.assertEqual(result.authContext.email, activeUser.email, '邮箱应该匹配')
  testRunner.assert(result.authContext.rawClaims.id === activeUser.id, 'rawClaims 应保留 token claims')
})

await testRunner.test('用户不存在时返回 USER_NOT_FOUND', async () => {
  const token = generateToken({
    id: 404,
    username: 'missing',
    email: 'missing@example.com'
  })

  const result = await provider.authenticateRequest(createMockContext(token))

  testRunner.assertEqual(result.success, false, '认证应该失败')
  testRunner.assertEqual(result.status, 401, '应该返回 401')
  testRunner.assertEqual(result.error.code, 'USER_NOT_FOUND', '错误码应该匹配')
})

testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}

