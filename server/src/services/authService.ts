import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDb } from '../db/connection';
import { UserRole } from '../../../shared/types/enums';

export interface TokenPayload {
  userId: number;
  username: string;
  role: UserRole;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiry });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.refreshSecret, { expiresIn: config.refreshExpiry });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.refreshSecret) as TokenPayload;
}

export async function authenticateUser(username: string, password: string) {
  const db = getDb();
  const user = await db('users').where('username', username).first();
  if (!user) return null;

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role as UserRole,
    display_name: user.display_name,
  };
}

export async function createUser(
  username: string,
  password: string,
  role: UserRole,
  displayName?: string
) {
  const db = getDb();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const [id] = await db('users').insert({
    username,
    password_hash: passwordHash,
    role,
    display_name: displayName || null,
    created_at: now,
    updated_at: now,
  });

  return { id, username, role, display_name: displayName || null };
}
