/**
 * 系统配置功能测试脚本
 * 该脚本测试系统配置相关功能，包括配置的CRUD操作
 */
import { systemConfigModel } from '../src/models/index.js'
import { getDrizzleInstance } from '../src/config/database.js'
import { system_config } from '../src/models/schema/index.js'
import { eq } from 'drizzle-orm'
import { initTestEnv, testRunner, cleanupTestData } from './test-utils.js'

// 初始化测试环境
await initTestEnv()

console.log('🧪 开始系统配置功能测试...')

// 测试获取配置
await testRunner.test('获取所有配置', async () => {
  const configs = await systemConfigModel.getAllConfigs()

  testRunner.assert(configs, '应该返回配置对象')
  testRunner.assert(Object.keys(configs).length > 0, '应该有至少一个配置项')
  testRunner.assert(configs['app.name'], '应该包含app.name配置')

  console.log(`   获取到 ${Object.keys(configs).length} 个配置项`)
})

// 测试获取单个配置
await testRunner.test('获取单个配置', async () => {
  const appName = await systemConfigModel.getConfig('app.name')

  testRunner.assert(appName, '应该返回app.name配置值')
  testRunner.assertEqual(typeof appName, 'string', 'app.name配置值应该是字符串')

  console.log(`   app.name = ${appName}`)
})

// 测试获取不存在的配置
await testRunner.test('获取不存在的配置', async () => {
  // 使用默认值
  const nonExistent = await systemConfigModel.getConfig('non.existent.key', 'default value')
  testRunner.assertEqual(nonExistent, 'default value', '不存在的配置应该返回默认值')

  // 不使用默认值
  try {
    await systemConfigModel.getConfig('another.non.existent.key')
    testRunner.assert(false, '应该因为配置不存在而失败')
  } catch (error) {
    testRunner.assert(error.message.includes('配置不存在'), '错误消息应该提及配置不存在')
  }
})

// 测试创建配置
await testRunner.test('创建新配置', async () => {
  const newConfig = {
    key: 'test.new.config',
    value: 'test value'
  }

  const created = await systemConfigModel.setConfig(newConfig.key, newConfig.value)
  testRunner.assert(created, '配置应该被创建')

  // 验证配置已创建
  const value = await systemConfigModel.getConfig(newConfig.key)
  testRunner.assertEqual(value, newConfig.value, '获取的配置值应该匹配创建时的值')
})

// 测试更新配置
await testRunner.test('更新配置', async () => {
  const key = 'test.update.config'
  const originalValue = 'original value'
  const newValue = 'updated value'

  // 先创建配置
  await systemConfigModel.setConfig(key, originalValue)

  // 更新配置
  const updated = await systemConfigModel.setConfig(key, newValue)
  testRunner.assert(updated, '配置应该被更新')

  // 验证配置已更新
  const value = await systemConfigModel.getConfig(key)
  testRunner.assertEqual(value, newValue, '配置值应该被更新')
  testRunner.assertNotEqual(value, originalValue, '配置值不应该是原始值')
})

// 测试删除配置
await testRunner.test('删除配置', async () => {
  const key = 'test.delete.config'

  // 先创建配置
  await systemConfigModel.setConfig(key, 'value to delete')

  // 删除配置
  const deleted = await systemConfigModel.deleteConfig(key)
  testRunner.assert(deleted, '配置应该被删除')

  // 验证配置已删除
  try {
    await systemConfigModel.getConfig(key)
    testRunner.assert(false, '应该因为配置已删除而失败')
  } catch (error) {
    testRunner.assert(error.message.includes('配置不存在'), '错误消息应该提及配置不存在')
  }
})

// 测试批量设置配置
await testRunner.test('批量设置配置', async () => {
  const configBatch = {
    'batch.config.1': 'value 1',
    'batch.config.2': 'value 2',
    'batch.config.3': 'value 3'
  }

  // 批量设置
  const result = await systemConfigModel.setConfigs(configBatch)
  testRunner.assert(result, '配置应该被批量设置')

  // 验证所有配置都已设置
  for (const [key, expectedValue] of Object.entries(configBatch)) {
    const actualValue = await systemConfigModel.getConfig(key)
    testRunner.assertEqual(actualValue, expectedValue, `配置 ${key} 的值应该匹配`)
  }
})

// 测试类型转换
await testRunner.test('配置值类型转换', async () => {
  // 布尔值
  await systemConfigModel.setConfig('test.boolean', 'true')
  const boolValue = await systemConfigModel.getConfig('test.boolean', false, Boolean)
  testRunner.assertEqual(boolValue, true, '字符串"true"应该转换为布尔值true')

  // 数字
  await systemConfigModel.setConfig('test.number', '42')
  const numValue = await systemConfigModel.getConfig('test.number', 0, Number)
  testRunner.assertEqual(numValue, 42, '字符串"42"应该转换为数字42')

  // JSON
  const testObj = { name: 'Test', value: 123, nested: { key: 'value' } }
  await systemConfigModel.setConfig('test.json', JSON.stringify(testObj))
  const jsonValue = await systemConfigModel.getConfig('test.json', {}, JSON.parse)
  testRunner.assertEqual(jsonValue.name, testObj.name, 'JSON对象应该正确解析')
  testRunner.assertEqual(jsonValue.value, testObj.value, 'JSON对象应该正确解析')
  testRunner.assertEqual(jsonValue.nested.key, testObj.nested.key, 'JSON对象应该正确解析')
})

// 测试配置缓存
await testRunner.test('配置缓存', async () => {
  const key = 'test.cache.config'
  const value = 'cached value'

  // 设置配置
  await systemConfigModel.setConfig(key, value)

  // 第一次获取（加载到缓存）
  console.time('first_access')
  const firstAccess = await systemConfigModel.getConfig(key)
  console.timeEnd('first_access')

  // 第二次获取（应该从缓存读取）
  console.time('second_access')
  const secondAccess = await systemConfigModel.getConfig(key)
  console.timeEnd('second_access')

  testRunner.assertEqual(firstAccess, secondAccess, '两次访问的值应该相同')
  console.log('   注意：第二次访问通常应该比第一次快，因为使用了缓存')
})

// 测试刷新配置缓存
await testRunner.test('刷新配置缓存', async () => {
  const key = 'test.refresh.config'
  const originalValue = 'original cached value'
  const newValue = 'new uncached value'

  // 设置初始配置
  await systemConfigModel.setConfig(key, originalValue)

  // 读取到缓存中
  await systemConfigModel.getConfig(key)

  // 直接通过 Drizzle 修改数据库中的值（绕过模型方法），用于验证 refreshCache 是否真的重新加载底层数据。
  await getDrizzleInstance().update(system_config).set({ config_value: newValue }).where(eq(system_config.config_key, key))

  // 不刷新缓存的情况下读取（应该返回旧值）
  const cachedValue = await systemConfigModel.getConfig(key)
  testRunner.assertEqual(cachedValue, originalValue, '不刷新缓存应该返回旧值')

  // 刷新缓存
  await systemConfigModel.refreshCache()

  // 刷新后读取（应该返回新值）
  const refreshedValue = await systemConfigModel.getConfig(key)
  testRunner.assertEqual(refreshedValue, newValue, '刷新缓存后应该返回新值')
})

// 输出测试摘要
testRunner.printSummary()

// 清理测试数据
await cleanupTestData()

// 测试脚本必须在失败时返回非 0，避免 test:all 误判为通过。
if (testRunner.failed > 0) {
  process.exit(1)
}
