import { createHash } from 'crypto';

export function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

export function generateUUID() {
  return createHash('md5').update(Date.now().toString() + Math.random().toString()).digest('hex');
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

export function sanitizeUser(user) {
  const { password_hash, ...sanitizedUser } = user;
  return sanitizedUser;
}