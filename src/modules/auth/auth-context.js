/**
 * 统一认证上下文。
 *
 * 这个对象是认证 Provider 与后续 RBAC/菜单/审计模块之间的稳定契约。
 * 当前默认由本地 JWT 生成，未来可由 Logto 等外部身份服务生成。
 */
export function createAuthContext({ provider, subject, user = null, tokenPayload = null, roles = [], permissions = [] }) {
  return {
    provider,
    subject: String(subject),
    localUserId: user?.id ?? tokenPayload?.id ?? null,
    email: user?.email ?? tokenPayload?.email ?? null,
    username: user?.username ?? tokenPayload?.username ?? null,
    displayName: user?.display_name ?? user?.displayName ?? null,
    roles,
    permissions,
    organizationId: tokenPayload?.organization_id ?? null,
    rawClaims: tokenPayload ?? {}
  }
}

/**
 * 将认证上下文写入 Hono 请求上下文。
 *
 * 兼容保留旧的 `user` 和 `tokenPayload`，避免一次重构影响现有控制器和权限中间件。
 */
export function attachAuthContext(c, authContext, user = null, tokenPayload = null) {
  c.set('authContext', authContext)
  c.set('user', user ?? authContext)
  c.set('tokenPayload', tokenPayload ?? authContext.rawClaims)
}
