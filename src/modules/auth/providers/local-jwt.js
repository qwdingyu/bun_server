import { extractBearerToken, verifyToken } from '../../../utils/jwt/index.js'
import { userModel } from '../../../models/index.js'
import { createAuthContext } from '../auth-context.js'

function authFailure(status, code, message, details = {}) {
  return {
    success: false,
    status,
    error: {
      code,
      message,
      ...details
    }
  }
}

/**
 * 本地 JWT 认证 Provider。
 *
 * 这是当前框架的默认认证实现：验证本项目签发的 JWT，并从数据库读取最新用户状态。
 * 数据库用户状态检查是安全闭环的一部分，用于确保禁用用户能立即失效。
 */
export class LocalJwtAuthProvider {
  constructor({ userRepository = userModel, tokenVerifier = verifyToken } = {}) {
    this.name = 'local'
    this.userRepository = userRepository
    this.tokenVerifier = tokenVerifier
  }

  async authenticateRequest(c) {
    const token = extractBearerToken(c.req.header('Authorization'))

    if (!token) {
      return authFailure(401, 'MISSING_TOKEN', '缺少认证令牌')
    }

    const tokenResult = this.tokenVerifier(token)
    if (!tokenResult.success) {
      return authFailure(
        401,
        tokenResult.error?.expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        tokenResult.error?.expired ? '认证令牌已过期' : '认证令牌无效',
        { tokenPayload: tokenResult.payload }
      )
    }

    const tokenPayload = tokenResult.payload

    try {
      const user = await this.userRepository.findById(tokenPayload.id, ['id', 'username', 'email', 'status'])

      if (!user) {
        return authFailure(401, 'USER_NOT_FOUND', '用户不存在', { tokenPayload })
      }

      if (user.status !== 'active') {
        return authFailure(403, 'USER_INACTIVE', '用户已被禁用', { user, tokenPayload })
      }

      return {
        success: true,
        user,
        tokenPayload,
        authContext: createAuthContext({
          provider: this.name,
          subject: tokenPayload.id,
          user,
          tokenPayload
        })
      }
    } catch (error) {
      return authFailure(500, 'AUTH_USER_LOOKUP_FAILED', '认证用户状态查询失败', {
        cause: error,
        tokenPayload
      })
    }
  }

  async optionalAuthenticateRequest(c) {
    const token = extractBearerToken(c.req.header('Authorization'))
    if (!token) {
      return { success: false, optional: true }
    }

    const result = await this.authenticateRequest(c)
    return result.success ? result : { success: false, optional: true }
  }
}

export const localJwtAuthProvider = new LocalJwtAuthProvider()
