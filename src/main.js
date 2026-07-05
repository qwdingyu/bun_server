#!/usr/bin/env bun

import { loadConfig, validateConfig } from './utils/config.js'
import { loadEnvToProcess } from './utils/env.js'
import { initializeDatabase } from './config/database.js'
import { createApp } from './app.js'
import { startServer } from './server.js'
import * as logger from './utils/logger/index.js'

loadEnvToProcess()
const config = loadConfig()
const app = createApp({ config })

export async function bootstrapApp(options = {}) {
  const runtimeConfig = options.config || config
  const configErrors = validateConfig(runtimeConfig)
  if (configErrors.length > 0) {
    const message = `Configuration errors: ${configErrors.join('; ')}`
    if (options.exitOnConfigError !== false) {
      console.error('❌ Configuration errors:')
      configErrors.forEach((error) => console.error(`  - ${error}`))
      console.error('Please fix the configuration file and restart the server.')
      process.exit(1)
    }
    throw new Error(message)
  }

  if (options.initializeDb !== false) {
    try {
      await initializeDatabase()
      logger.info('数据库初始化成功')
    } catch (e) {
      logger.warn('数据库初始化失败，继续运行但数据库功能不可用', {
        error: e?.message || e
      })
      console.warn('⚠️ Database initialization failed, continuing without DB:', e?.message || e)
    }
  }

  return { app: options.app || app, config: runtimeConfig }
}

export default app
export const fetch = app.fetch
export { createApp, startServer }

if (import.meta.main) {
  const boot = await bootstrapApp()
  startServer(boot.app, boot.config)
}
