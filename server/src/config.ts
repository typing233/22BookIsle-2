import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');

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
