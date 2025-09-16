import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function resolveProjectPath(...segments) {
  // 从 src/utils/paths.js 回到项目根目录
  const projectRoot = dirname(__dirname); // src
  const appRoot = dirname(projectRoot); // bun_server

  return join(appRoot, ...segments);
}

export function ensureDirectoryExists(path) {
  const fs = require('fs');
  const dir = dirname(path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}