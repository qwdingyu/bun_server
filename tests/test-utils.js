/**
 * 测试辅助工具
 * 提供测试过程中的各种辅助函数和共享状态
 */
import { initDb } from '../src/db/index.js'
import { Database } from 'bun:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_PATH = path.join(__dirname, '..', 'data', 'app.db')

// 测试数据库连接
let testDb = null

/**
 * 初始化测试环境
 * 在每个测试文件的开头调用此函数
 */
export async function initTestEnv() {
  console.log('🔌 初始化测试环境...')

  // 设置测试环境变量
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_TYPE = 'sqlite'
  process.env.DATABASE_PATH = DB_PATH

  // 初始化数据库连接
  await initDb()
  console.log('✅ 数据库连接已初始化')

  return true
}

/**
 * 标准测试运行器
 * 提供标准化的测试断言和报告功能
 */
export const testRunner = {
  passed: 0,
  failed: 0,
  totalTests: 0,

  async test(name, fn) {
    this.totalTests++
    console.log(`\n🔍 测试: ${name}`)

    try {
      await fn()
      console.log(`✅ 通过: ${name}`)
      this.passed++
    } catch (error) {
      console.error(`❌ 失败: ${name}`)
      console.error(`   错误: ${error.message}`)
      if (error.stack) {
        console.error(`   堆栈: ${error.stack.split('\n')[1]}`)
      }
      this.failed++
    }
  },

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || '断言失败')
    }
  },

  assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message || `预期 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`)
    }
  },

  assertNotEqual(actual, expected, message) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
      throw new Error(message || `不应该等于 ${JSON.stringify(expected)}`)
    }
  },

  assertStatus(response, status, message) {
    if (response.status !== status) {
      throw new Error(message || `预期状态码 ${status}, 实际 ${response.status}`)
    }
  },

  printSummary() {
    console.log('\n📊 测试摘要:')
    console.log(`   总测试: ${this.totalTests}`)
    console.log(`   通过: ${this.passed}`)
    console.log(`   失败: ${this.failed}`)

    if (this.failed === 0) {
      console.log('🎉 所有测试通过!')
    } else {
      console.log('❗ 有测试失败，请检查!')
    }
  }
}

/**
 * 获取直接数据库连接（用于测试数据准备和清理）
 */
export function getTestDbConnection() {
  if (!testDb) {
    testDb = new Database(DB_PATH)
  }
  return testDb
}

/**
 * 关闭测试数据库连接
 */
export function closeTestDbConnection() {
  if (testDb) {
    testDb.close()
    testDb = null
  }
}

/**
 * 清理测试数据
 * 在测试完成后清理所有测试数据
 */
export async function cleanupTestData() {
  const db = getTestDbConnection()

  // 清理非默认数据
  try {
    // 根据测试需要清理不同表的数据
    db.exec("DELETE FROM users WHERE username LIKE 'test%' OR username = 'apitest'")
    db.exec("DELETE FROM roles WHERE name LIKE 'test%' OR name LIKE 'role%'")
    db.exec("DELETE FROM permissions WHERE name LIKE 'test%'")
    db.exec("DELETE FROM system_config WHERE config_key LIKE 'test%'")
  } catch (error) {
    console.error('清理测试数据失败:', error)
  }
}

/**
 * 随机字符串生成器
 * 用于生成测试数据
 */
export function randomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 获取当前时间戳（秒）
 */
export function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000)
}
