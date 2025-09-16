import { readFileSync, existsSync } from 'fs';
import { resolveProjectPath } from './paths.js';

const envPath = resolveProjectPath('.env');

export function loadEnvToProcess() {
  if (!existsSync(envPath)) {
    console.log('.env file not found, skipping environment variable loading');
    return;
  }

  try {
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0) {
          const value = rest.join('=').replace(/^["']|["']$/g, '');
          // 只设置未在 process.env 中存在的变量
          if (!(key in process.env)) {
            process.env[key] = value;
          }
        }
      }
    });

    console.log('Environment variables loaded from .env file');
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
}

export function getEnvVar(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

export function getBoolEnvVar(key, defaultValue = false) {
  const value = getEnvVar(key);
  if (value === undefined || value === null) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}