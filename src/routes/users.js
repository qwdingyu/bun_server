import { Hono } from 'hono'
import authRoutes from './auth.js'
import userAdminRoutes from './user-admin.js'

// 兼容既有 /api/users/* URL 契约，同时把 Auth 与 User Admin 路由拆到独立模块维护。
const userRoutes = new Hono()

userRoutes.route('/auth', authRoutes)
userRoutes.route('/', userAdminRoutes)

export default userRoutes
