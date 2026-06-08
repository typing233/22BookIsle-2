import path from 'path';
import dotenv from 'dotenv';

const configRoot = path.resolve(__dirname, '..', '..').includes('dist')
  ? path.resolve(__dirname, '..', '..', '..', '..')
  : path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.resolve(configRoot, '.env') });

const dataDir = process.env.DATA_DIR || path.resolve(configRoot, 'data');

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiry: '15m',
  refreshSecret: process.env.REFRESH_SECRET || 'dev-refresh-secret',
  refreshExpiry: '7d',
  dataDir,
  dbPath: path.join(dataDir, 'bookisle.db'),
  coverDir: path.join(dataDir, 'covers'),
  scanBatchSize: 50,
  maxConcurrentScans: 2,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  rateLimitWindow: 60 * 1000,
  rateLimitMaxDefault: 100,
  rateLimitMaxAuthenticated: 300,
};
