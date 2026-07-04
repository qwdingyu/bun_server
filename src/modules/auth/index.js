import { localJwtAuthProvider } from './providers/local-jwt.js'

/**
 * 当前认证 Provider 注册点。
 *
 * 第一阶段只启用本地 JWT。后续接入 Logto 时，只需要在这里根据配置返回 LogtoAuthProvider，
 * 下游中间件和 RBAC 不需要理解具体身份来源。
 */
export function getAuthProvider() {
  return localJwtAuthProvider
}

export { createAuthContext, attachAuthContext } from './auth-context.js'
export { LocalJwtAuthProvider, localJwtAuthProvider } from './providers/local-jwt.js'
