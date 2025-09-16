import { getDatabaseStatus } from '../config/database.js'

class HealthController {
  /**
   * 获取基础健康状态
   */
  async getHealth(c) {
    try {
      const dbStatus = getDatabaseStatus()

      return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: dbStatus
      })
    } catch (error) {
      console.error('健康检查失败:', error)
      return c.json(
        {
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.message
        },
        500
      )
    }
  }

  /**
   * 获取数据库健康状态
   */
  async getDatabaseHealth(c) {
    try {
      const dbStatus = getDatabaseStatus()

      return c.json({
        database: dbStatus,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('数据库健康检查失败:', error)
      return c.json(
        {
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.message
        },
        500
      )
    }
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(c) {
    try {
      const memoryUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()

      return c.json({
        system: {
          uptime: process.uptime(),
          memory: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          node: {
            version: process.version,
            platform: process.platform,
            arch: process.arch
          }
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('系统健康检查失败:', error)
      return c.json(
        {
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.message
        },
        500
      )
    }
  }
}

// 创建实例并导出
const healthController = new HealthController()

export { healthController }
export default healthController
