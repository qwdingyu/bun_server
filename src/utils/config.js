import yaml from 'yaml';
import { readFileSync, existsSync } from 'fs';
import { resolveProjectPath } from './paths.js';

const defaultConfig = {
  server: {
    host: '0.0.0.0',
    port: 5050
  },
  database: {
    type: 'sqlite',
    path: './data/app.db'
  },
  logging: {
    level: 'info',
    log_directory: './logs'
  },
  auth: {
    jwt_expires_in: '24h',
    jwt_refresh_expires_in: '7d'
  },
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowed_headers: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key', 'Accept'],
    credentials: false,
    max_age: 86400
  },
  security: {
    csp: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"]
    }
  }
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target, source) {
  const result = { ...target };

  Object.entries(source || {}).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  });

  return result;
}

function loadConfigFile() {
  const configPath = resolveProjectPath('config.yaml');

  if (!existsSync(configPath)) {
    console.warn('Config file not found, using defaults:', configPath);
    return {};
  }

  try {
    const configContent = readFileSync(configPath, 'utf8');
    return yaml.parse(configContent);
  } catch (error) {
    console.error('Error loading config file:', error);
    return {};
  }
}

function loadEnvConfig() {
  const envConfig = {
    server: {},
    database: {},
    logging: {},
    auth: {},
    cors: {}
  };

  // Server config
  if (process.env.HOST) envConfig.server.host = process.env.HOST;
  if (process.env.PORT) envConfig.server.port = parseInt(process.env.PORT);

  // Database config
  if (process.env.DATABASE_TYPE) envConfig.database.type = process.env.DATABASE_TYPE;
  if (process.env.DATABASE_PATH) envConfig.database.path = process.env.DATABASE_PATH;
  if (process.env.DATABASE_URL) envConfig.database.url = process.env.DATABASE_URL;
  if (process.env.DB_HOST) envConfig.database.host = process.env.DB_HOST;
  if (process.env.DB_PORT) envConfig.database.port = parseInt(process.env.DB_PORT);
  if (process.env.DB_NAME) envConfig.database.name = process.env.DB_NAME;
  if (process.env.DB_USER) envConfig.database.user = process.env.DB_USER;
  if (process.env.DB_PASSWORD) envConfig.database.password = process.env.DB_PASSWORD;

  // Logging config
  if (process.env.LOG_LEVEL) envConfig.logging.level = process.env.LOG_LEVEL;
  if (process.env.LOG_DIRECTORY) envConfig.logging.log_directory = process.env.LOG_DIRECTORY;

  // Auth config
  if (process.env.JWT_SECRET) envConfig.auth.jwt_secret = process.env.JWT_SECRET;
  if (process.env.JWT_EXPIRES_IN) envConfig.auth.jwt_expires_in = process.env.JWT_EXPIRES_IN;
  if (process.env.JWT_REFRESH_EXPIRES_IN) envConfig.auth.jwt_refresh_expires_in = process.env.JWT_REFRESH_EXPIRES_IN;

  // CORS config
  if (process.env.CORS_ORIGIN) {
    envConfig.cors.origin = process.env.CORS_ORIGIN.includes(',')
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
      : process.env.CORS_ORIGIN;
  }
  if (process.env.CORS_CREDENTIALS) envConfig.cors.credentials = process.env.CORS_CREDENTIALS === 'true';

  return envConfig;
}

function mergeConfig(...configs) {
  return configs.reduce((merged, config) => deepMerge(merged, config), {});
}

export function loadConfig() {
  const fileConfig = loadConfigFile();
  const envConfig = loadEnvConfig();

  return mergeConfig(defaultConfig, fileConfig, envConfig);
}

export function validateConfig(config) {
  const errors = [];

  // Validate server config
  if (!config.server.host) {
    errors.push('Server host is required');
  }
  if (!config.server.port || config.server.port < 1 || config.server.port > 65535) {
    errors.push('Server port must be between 1 and 65535');
  }

  // Validate database config
  if (!['sqlite', 'mysql'].includes(config.database?.type)) {
    errors.push('Database type must be either "sqlite" or "mysql"');
  }

  if (config.database?.type === 'sqlite' && !config.database?.path) {
    errors.push('Database path is required for SQLite');
  }

  const unsafeSecrets = [
    'your-super-secret-jwt-key-change-in-production',
    'your-super-secret-jwt-key-change-in-production-please',
    'dev-only-change-me'
  ];

  if (process.env.NODE_ENV === 'production') {
    if (!config.auth?.jwt_secret || unsafeSecrets.includes(config.auth.jwt_secret)) {
      errors.push('JWT secret is required in production and must not use the default placeholder');
    }

    if (config.cors?.credentials === true && config.cors?.origin === '*') {
      errors.push('CORS origin cannot be "*" when credentials are enabled in production');
    }
  }

  return errors;
}
