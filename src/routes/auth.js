import { Hono } from 'hono'
import { userController } from '../controllers/UserController.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validation/index.js'
import { loginSchema, refreshTokenSchema, registerSchema } from './user-schemas.js'

const authRoutes = new Hono()

authRoutes.post('/register', validateBody(registerSchema), userController.register)
authRoutes.post('/login', validateBody(loginSchema), userController.login)
authRoutes.post('/refresh', validateBody(refreshTokenSchema), userController.refreshToken)
authRoutes.post('/logout', authMiddleware, userController.logout)

export default authRoutes
