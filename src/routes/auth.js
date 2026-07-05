import { Hono } from 'hono'
import { authController } from '../controllers/AuthController.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validation/index.js'
import { loginSchema, refreshTokenSchema, registerSchema } from './user-schemas.js'

const authRoutes = new Hono()

authRoutes.post('/register', validateBody(registerSchema), authController.register)
authRoutes.post('/login', validateBody(loginSchema), authController.login)
authRoutes.post('/refresh', validateBody(refreshTokenSchema), authController.refreshToken)
authRoutes.post('/logout', authMiddleware, authController.logout)

export default authRoutes
