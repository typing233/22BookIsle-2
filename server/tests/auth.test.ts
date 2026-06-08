import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb } from './helpers/setup';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../src/services/authService';
import { UserRole } from '../../shared/types/enums';

describe('Auth Service', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('Password hashing', () => {
    it('should hash and verify password correctly', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(await verifyPassword(hash, password)).toBe(true);
      expect(await verifyPassword(hash, 'wrongpassword')).toBe(false);
    });
  });

  describe('JWT tokens', () => {
    const payload = { userId: 1, username: 'testuser', role: UserRole.User };

    it('should generate and verify access token', () => {
      const token = generateAccessToken(payload);
      expect(token).toBeTruthy();
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(1);
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('user');
    });

    it('should generate and verify refresh token', () => {
      const token = generateRefreshToken(payload);
      expect(token).toBeTruthy();
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(1);
    });

    it('should reject invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });
  });

  describe('Database operations', () => {
    it('should create and find user', async () => {
      const db = getTestDb();
      const hash = await hashPassword('test123');

      await db('users').insert({
        username: 'testuser',
        password_hash: hash,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const user = await db('users').where('username', 'testuser').first();
      expect(user).toBeTruthy();
      expect(user.username).toBe('testuser');
      expect(user.role).toBe('user');
    });
  });
});
