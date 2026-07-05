import { sessionModel, userModel } from '../models/index.js'
import { generateTokenPair, verifyToken } from '../utils/jwt/index.js'
import { asyncHandler } from '../middleware/error/index.js'
import { patterns } from '../middleware/validation/index.js'
import AppError from '../utils/AppError.js'
import * as logger from '../utils/logger/index.js'

function getRequestMeta(c) {
  return {
    clientIp: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    userAgent: c.req.header('user-agent') || 'unknown'
  }
}

class AuthController {
  /**
   * 用户登录。
   *
   * 认证流程独立于用户管理控制器，后续接入 Logto 或调整本地认证时只需要改这里和 AuthProvider seam。
   */
  login = asyncHandler(async (c) => {
    const startTime = Date.now()
    const { clientIp, userAgent } = getRequestMeta(c)
    let body = {}

    try {
      body = await c.req.json()
      const { identifier, password } = body

      if (!identifier || !password) {
        throw new AppError('用户名/邮箱和密码是必需的', 400, 'MISSING_CREDENTIALS')
      }

      const user = await userModel.authenticate(identifier, password)

      // 登录成功后同时签发 access token 与 refresh token，并把 refresh token hash 落到服务端会话表。
      const tokenPair = generateTokenPair(user)
      await sessionModel.createSession({
        userId: user.id,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.refreshTokenExpiresAt,
        userAgent,
        ipAddress: clientIp
      })

      const duration = Date.now() - startTime
      logger.performance('userLogin', duration, { user_id: user.id })

      logger.auth('login', user.id, true, {
        client_ip: clientIp,
        user_agent: userAgent,
        login_method: 'password'
      })

      logger.business('user_logged_in', {
        user_id: user.id,
        username: user.username,
        client_ip: clientIp,
        user_agent: userAgent
      })

      return c.json({
        success: true,
        message: '登录成功',
        data: {
          user,
          ...tokenPair
        },
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      const duration = Date.now() - startTime

      logger.auth('login', null, false, {
        identifier: body?.identifier,
        client_ip: clientIp,
        user_agent: userAgent,
        error: error.message,
        duration
      })

      logger.security('failed_login_attempt', 'medium', {
        identifier: body?.identifier,
        client_ip: clientIp,
        user_agent: userAgent,
        error: error.message
      })

      if (!(error instanceof AppError)) {
        logger.error('用户登录失败', error)
      }
      throw error
    }
  })

  /**
   * 刷新 token。
   *
   * refresh token 必须同时通过 JWT 校验和服务端会话校验；刷新成功后轮换 refresh token，旧 token 立即失效。
   */
  refreshToken = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const body = await c.req.json()
      const { refreshToken } = body

      if (!refreshToken) {
        throw new AppError('刷新令牌是必需的', 400, 'MISSING_REFRESH_TOKEN')
      }

      const tokenResult = verifyToken(refreshToken)
      if (!tokenResult.success) {
        throw new AppError('刷新令牌无效或已过期', 401, 'INVALID_REFRESH_TOKEN')
      }

      const session = await sessionModel.findActiveByRefreshToken(refreshToken)
      if (!session) {
        throw new AppError('刷新令牌已失效或会话已登出', 401, 'REFRESH_SESSION_REVOKED')
      }

      const user = await userModel.findById(tokenResult.payload.id)

      if (!user || user.status !== 'active' || session.user_id !== user.id) {
        throw new AppError('用户不存在或已被禁用', 401, 'USER_INVALID')
      }

      const newTokenPair = generateTokenPair(user)
      await sessionModel.rotateRefreshToken(session.id, {
        accessToken: newTokenPair.accessToken,
        refreshToken: newTokenPair.refreshToken,
        expiresAt: newTokenPair.refreshTokenExpiresAt
      })

      const duration = Date.now() - startTime
      logger.performance('refreshToken', duration, { user_id: user.id })

      logger.auth('token_refresh', user.id, true)

      return c.json({
        success: true,
        message: '令牌刷新成功',
        data: newTokenPair,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      logger.auth('token_refresh', null, false, {
        error: error.message
      })

      if (!(error instanceof AppError)) {
        logger.error('刷新令牌失败', error)
      }
      throw error
    }
  })

  /**
   * 用户注册。
   *
   * 注册仍属于认证入口：创建用户后立即签发 token pair，并建立 refresh token 服务端会话。
   */
  register = asyncHandler(async (c) => {
    const startTime = Date.now()
    const { clientIp, userAgent } = getRequestMeta(c)
    let body = {}

    try {
      body = await c.req.json()

      const requiredFields = ['username', 'email', 'password']
      for (const field of requiredFields) {
        if (!body[field]) {
          throw new AppError(`字段 ${field} 是必需的`, 400, 'MISSING_REQUIRED_FIELD')
        }
      }

      const emailRegex = new RegExp(patterns.email.pattern)
      if (!emailRegex.test(body.email)) {
        throw new AppError(patterns.email.patternMessage, 400, 'INVALID_EMAIL')
      }

      const usernameRegex = new RegExp(patterns.username.pattern)
      if (!usernameRegex.test(body.username)) {
        throw new AppError(patterns.username.patternMessage, 400, 'INVALID_USERNAME')
      }

      const user = await userModel.createUser(body)

      const tokenPair = generateTokenPair(user)
      await sessionModel.createSession({
        userId: user.id,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.refreshTokenExpiresAt,
        userAgent,
        ipAddress: clientIp
      })

      const duration = Date.now() - startTime
      logger.performance('userRegister', duration, { user_id: user.id })

      logger.business('user_registered', {
        user_id: user.id,
        username: user.username,
        email: user.email,
        client_ip: clientIp,
        user_agent: userAgent
      })

      logger.info('用户注册成功', {
        user_id: user.id,
        username: user.username,
        email: user.email,
        client_ip: clientIp
      })

      return c.json(
        {
          success: true,
          message: '注册成功',
          data: {
            user,
            ...tokenPair
          },
          meta: {
            timestamp: new Date().toISOString(),
            duration: `${duration}ms`
          }
        },
        201
      )
    } catch (error) {
      logger.security('failed_registration_attempt', 'low', {
        username: body?.username,
        email: body?.email,
        client_ip: clientIp,
        user_agent: userAgent,
        error: error.message
      })

      if (!(error instanceof AppError)) {
        logger.error('用户注册失败', error)
      }
      throw error
    }
  })

  /**
   * 用户登出。
   *
   * 如果请求体带 refreshToken，则撤销对应服务端会话；未传时保持兼容，仅返回登出成功。
   */
  logout = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const user = c.get('user')
      let refreshToken = null

      try {
        const body = await c.req.json()
        refreshToken = body?.refreshToken || null
      } catch (_) {
        refreshToken = null
      }

      if (refreshToken) {
        await sessionModel.revokeByRefreshToken(refreshToken)
      }

      const duration = Date.now() - startTime
      logger.performance('userLogout', duration, { user_id: user?.id })

      logger.auth('logout', user?.id, true)

      logger.business('user_logged_out', {
        user_id: user?.id,
        username: user?.username
      })

      return c.json({
        success: true,
        message: '登出成功',
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('用户登出失败', error)
      }
      throw error
    }
  })
}

export const authController = new AuthController()
export default authController
