/**
 * 应用入口拆分测试。
 *
 * 固定 createApp / bootstrapApp 的轻量入口契约，防止后续又把启动、数据库初始化、服务监听全部塞回 main.js。
 */
import { initTestEnv, testRunner } from './test-utils.js'
import { createApp } from '../src/app.js'
import { bootstrapApp } from '../src/main.js'

await initTestEnv()

console.log('🧪 开始应用入口拆分测试...')

await testRunner.test('createApp 返回可直接请求的 Hono app', async () => {
  const app = createApp()
  const response = await app.request('/')
  const body = await response.json()

  testRunner.assertStatus(response, 200, '根路径应该可请求')
  testRunner.assertEqual(body.message, '🚀 Bun Server Framework', '根路径应返回框架信息')
})

await testRunner.test('bootstrapApp 可跳过数据库初始化并返回 app/config', async () => {
  const boot = await bootstrapApp({ initializeDb: false, exitOnConfigError: false })

  testRunner.assert(boot.app, 'bootstrapApp 应返回 app')
  testRunner.assert(boot.config, 'bootstrapApp 应返回 config')
  testRunner.assert(typeof boot.app.fetch === 'function', '返回 app 应包含 fetch')
})

testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
