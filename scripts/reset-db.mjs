#!/usr/bin/env bun

// Database reset script
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { resolveProjectPath } from '../src/utils/paths.js';
import { getDatabaseType } from '../src/db/index.js';

console.log('⚠️  This will reset the database. All data will be lost.');
console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...');

setTimeout(async () => {
  try {
    const dbType = getDatabaseType();

    if (dbType === 'sqlite') {
      const dbPath = process.env.DATABASE_PATH || resolveProjectPath('data', 'app.db');

      if (existsSync(dbPath)) {
        unlinkSync(dbPath);
        console.log('✅ SQLite database file deleted');
      } else {
        console.log('⚠️  SQLite database file not found');
      }
    } else if (dbType === 'mysql') {
      console.log('⚠️  MySQL reset requires manual database deletion');
      console.log('Please connect to MySQL and run: DROP DATABASE IF EXISTS bun_server; CREATE DATABASE bun_server;');
    }

    // Re-initialize database
    const { initializeDatabase } = await import('../src/config/database.js');
    await initializeDatabase();

    console.log('✅ Database reset and reinitialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}, 5000);