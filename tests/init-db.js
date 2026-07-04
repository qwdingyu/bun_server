#!/usr/bin/env bun

/**
 * 数据库初始化测试脚本。
 *
 * 只负责重建测试 SQLite 数据库，并复用 src/db/seed.js 中的默认角色、权限、配置和管理员种子数据。
 */
import { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSeedSummary, seedSqliteDefaults } from '../src/db/seed.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_PATH = path.join(__dirname, '..', 'data', 'app.db')
const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'db', 'sqlite-schema.sql')

export default async function initDatabase() {
  const dataDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
    console.log('📁 创建数据目录:', dataDir)
  }

  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH)
    console.log('🗑️ 已删除旧数据库文件:', DB_PATH)
  }

  const sqlite = new Database(DB_PATH)
  console.log('🔌 已连接到数据库:', DB_PATH)

  try {
    console.log('📝 创建数据库表结构...')
    sqlite.exec('PRAGMA foreign_keys = ON')
    sqlite.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'))
    console.log('✅ 数据库模式创建完成')

    console.log('🌱 写入默认角色、权限、配置和管理员...')
    seedSqliteDefaults(sqlite)
    console.log('✅ 默认 seed 写入完成')

    const stats = getSeedSummary(sqlite)
    console.log('🎉 数据库初始化完成!')
    console.log(`📊 数据库文件位置: ${DB_PATH}`)
    console.log('📝 数据统计:')
    console.log(`  用户: ${stats.users}`)
    console.log(`  角色: ${stats.roles}`)
    console.log(`  权限: ${stats.permissions}`)
    console.log(`  角色权限: ${stats.role_permissions}`)
    console.log(`  用户角色: ${stats.user_roles}`)
    console.log(`  系统配置: ${stats.configs}`)
  } finally {
    sqlite.close()
  }
}

await initDatabase()
