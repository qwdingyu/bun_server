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
  }
};

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
    logging: {}
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

  return envConfig;
}

function mergeConfig(...configs) {
  const merged = { server: {}, database: {}, logging: {} };

  configs.forEach(config => {
    if (config.server) {
      merged.server = { ...merged.server, ...config.server };
    }
    if (config.database) {
      merged.database = { ...merged.database, ...config.database };
    }
    if (config.logging) {
      merged.logging = { ...merged.logging, ...config.logging };
    }
  });

  return merged;
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

  return errors;
}