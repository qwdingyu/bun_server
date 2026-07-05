#!/usr/bin/env bun

/**
 * 测试启动脚本
 * 此脚本按顺序运行所有测试，包括初始化数据库、用户测试、角色权限测试和配置测试
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 所有测试脚本，按执行顺序排列
const testScripts = ['init-db.js', 'test-app-bootstrap.js', 'test-auth-provider.js', 'test-session-model.js', 'test-auth-session-flow.js', 'test-rbac-priority.js', 'test-rbac-routes.js', 'test-user-batch-routes.js', 'test-user-permissions-menu-audit.js', 'test-mysql-schema.js', 'test-mysql-init-plan.js', 'test-config.js', 'test-roles-permissions.js', 'test-users.js', 'test-api.js']

// 控制台颜色
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
}

console.log(`${colors.bright}${colors.blue}
====================================
         测试套件启动器
====================================
${colors.reset}`)

let allTestsPassed = true
const startTime = Date.now()

// 运行每个测试脚本
for (const script of testScripts) {
  const scriptPath = path.join(__dirname, script)

  if (!fs.existsSync(scriptPath)) {
    console.error(`${colors.red}❌ 错误: 找不到测试脚本 ${scriptPath}${colors.reset}`)
    continue
  }

  console.log(`\n${colors.cyan}=== 运行测试: ${script} ===${colors.reset}\n`)

  // 使用 spawnSync 运行测试脚本，可以看到实时输出
  const result = spawnSync('bun', ['run', scriptPath], {
    stdio: 'inherit',
    env: process.env
  })

  if (result.status !== 0) {
    console.error(`${colors.red}❌ 测试失败: ${script} (退出码: ${result.status})${colors.reset}`)
    allTestsPassed = false

    // 如果是初始化脚本失败，则终止整个测试流程
    if (script === 'init-db.js') {
      console.error(`${colors.red}${colors.bright}数据库初始化失败，终止测试!${colors.reset}`)
      process.exit(1)
    }
  } else {
    console.log(`${colors.green}✓ 测试完成: ${script}${colors.reset}`)
  }
}

const endTime = Date.now()
const duration = (endTime - startTime) / 1000

console.log(`\n${colors.bright}${colors.blue}
====================================
         测试套件完成
====================================
${colors.reset}`)

console.log(`${colors.white}总运行时间: ${duration.toFixed(2)} 秒${colors.reset}`)

if (allTestsPassed) {
  console.log(`${colors.green}${colors.bright}🎉 所有测试通过!${colors.reset}`)
  process.exit(0)
} else {
  console.log(`${colors.red}${colors.bright}❗ 有测试失败，请检查输出!${colors.reset}`)
  process.exit(1)
}
