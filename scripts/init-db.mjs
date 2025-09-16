#!/usr/bin/env bun

// Database initialization script
import { initializeDatabase } from '../src/config/database.js';

console.log('🚀 Initializing database...');

try {
  const success = await initializeDatabase();
  if (success) {
    console.log('✅ Database initialized successfully');
    process.exit(0);
  } else {
    console.error('❌ Database initialization failed');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Database initialization error:', error);
  process.exit(1);
}