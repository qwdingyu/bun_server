#!/usr/bin/env bun

// Lightweight service controller for development/single-node deployments.
// Usage:
//   bun run scripts/service.mjs start
//   bun run scripts/service.mjs stop
//   bun run scripts/service.mjs restart
//   bun run scripts/service.mjs status

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import { resolveProjectPath } from '../src/utils/paths.js';

const PID_FILE = resolveProjectPath('data', 'service.pid');

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid() {
  try {
    if (!existsSync(PID_FILE)) return null;
    const pid = parseInt(readFileSync(PID_FILE, 'utf8'));
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function cleanupPidFile() {
  try { if (existsSync(PID_FILE)) unlinkSync(PID_FILE); } catch {}
}

function start() {
  const existing = readPid();
  if (existing && isAlive(existing)) {
    console.log(`Service already running (pid=${existing}).`);
    process.exit(0);
  }
  console.log('Starting service in background...');
  const bunBin = process.execPath || 'bun';
  const child = spawn(bunBin, ['run', 'src/main.js'], {
    cwd: resolveProjectPath(),
    detached: true,
    stdio: 'ignore'
  });
  child.on('error', (e) => {
    console.error('Failed to start service:', e?.message || e);
    process.exit(1);
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  console.log(`✅ Service started (pid=${child.pid}).`);
}

function stop() {
  const pid = readPid();
  if (!pid || !isAlive(pid)) {
    console.log('Service not running.');
    cleanupPidFile();
    return;
  }
  try {
    process.kill(pid);
    console.log('Service stop signal sent.');
  } catch (e) {
    console.log('Failed to stop service:', e?.message || e);
  } finally {
    cleanupPidFile();
  }
}

function restart() {
  const pid = readPid();
  if (pid && isAlive(pid)) {
    try {
      process.kill(pid);
      console.log('Service stop signal sent.');
    } catch {}
  }
  cleanupPidFile();
  // Start again
  start();
}

function status() {
  const pid = readPid();
  if (pid && isAlive(pid)) {
    console.log(`Service is running (pid=${pid}).`);
  } else {
    console.log('Service is not running.');
  }
}

const cmd = process.argv[2] || 'status';
switch (cmd) {
  case 'start':
    start(); break;
  case 'stop':
    stop(); break;
  case 'restart':
    restart(); break;
  case 'status':
  default:
    status(); break;
}