import { createHash } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import BaseModel from './BaseModel.js'
import { user_sessions } from './schema/index.js'
import { getDrizzleInstance } from '../config/database.js'
import { getCurrentTimestamp } from '../utils/datetime.js'

/**
 * 用户会话模型。
 *
 * 负责 refresh token 的服务端状态闭环：只保存 token hash，支持刷新轮换和登出撤销。
 * 这比仅验证 refresh token 签名更安全，可让禁用会话即时失效。
 */
class SessionModel extends BaseModel {
  constructor() {
    super('user_sessions', user_sessions)
    this.safeFields = [
      'id',
      'user_id',
      'token_hash',
      'refresh_token_hash',
      'device_info',
      'user_agent',
      'ip_address',
      'location',
      'is_active',
      'expires_at',
      'last_used_at',
      'created_at'
    ]
    this.safeOrderFields = ['id', 'user_id', 'expires_at', 'last_used_at', 'created_at']
  }

  hashToken(token) {
    return createHash('sha256').update(token).digest('hex')
  }

  async createSession({ userId, accessToken, refreshToken, expiresAt, userAgent = null, ipAddress = null, deviceInfo = null }) {
    const now = getCurrentTimestamp()
    const session = await this.create({
      user_id: userId,
      token_hash: this.hashToken(accessToken),
      refresh_token_hash: this.hashToken(refreshToken),
      user_agent: userAgent,
      ip_address: ipAddress,
      device_info: deviceInfo,
      is_active: 1,
      expires_at: expiresAt,
      last_used_at: now
    })

    return this.sanitizeSession(session)
  }

  async findActiveByRefreshToken(refreshToken) {
    const db = getDrizzleInstance()
    const now = getCurrentTimestamp()
    const refreshTokenHash = this.hashToken(refreshToken)

    const result = await db
      .select()
      .from(this.schema)
      .where(
        and(
          eq(this.schema.refresh_token_hash, refreshTokenHash),
          eq(this.schema.is_active, 1),
          gt(this.schema.expires_at, now)
        )
      )
      .limit(1)

    return result[0] ? this.sanitizeSession(result[0]) : null
  }

  async rotateRefreshToken(sessionId, { accessToken, refreshToken, expiresAt }) {
    const db = getDrizzleInstance()
    const now = getCurrentTimestamp()

    const result = await db
      .update(this.schema)
      .set({
        token_hash: this.hashToken(accessToken),
        refresh_token_hash: this.hashToken(refreshToken),
        expires_at: expiresAt,
        last_used_at: now
      })
      .where(eq(this.schema.id, sessionId))
      .returning()

    return result[0] ? this.sanitizeSession(result[0]) : null
  }

  async revokeByRefreshToken(refreshToken) {
    const session = await this.findActiveByRefreshToken(refreshToken)
    if (!session) {
      return false
    }

    await this.revokeSession(session.id)
    return true
  }

  async revokeSession(sessionId) {
    const db = getDrizzleInstance()
    const now = getCurrentTimestamp()

    await db
      .update(this.schema)
      .set({
        is_active: 0,
        last_used_at: now
      })
      .where(eq(this.schema.id, sessionId))

    return true
  }

  sanitizeSession(session) {
    if (!session) {
      return null
    }

    const { token_hash: _tokenHash, refresh_token_hash: _refreshTokenHash, ...safeSession } = session
    return safeSession
  }
}

export default SessionModel
