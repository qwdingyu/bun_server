import { Hono } from 'hono';
import { healthController } from '../controllers/HealthController.js';

// 创建健康检查路由
const healthRoutes = new Hono();

healthRoutes.get('/', healthController.getHealth.bind(healthController));
healthRoutes.get('/db', healthController.getDatabaseHealth.bind(healthController));
healthRoutes.get('/system', healthController.getSystemHealth.bind(healthController));

export default healthRoutes;