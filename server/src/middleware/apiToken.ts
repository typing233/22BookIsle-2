import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/connection';
import { ApiScope } from '../../../shared/types/enums';

const API_TOKEN_PREFIX = 'bk_';

export function requireApiScope(scope: ApiScope) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = header.slice(7);
    if (!token.startsWith(API_TOKEN_PREFIX)) {
      next();
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const db = getDb();
    const apiToken = await db('api_tokens').where('token_hash', tokenHash).first();

    if (!apiToken) {
      res.status(401).json({ error: 'Invalid API token' });
      return;
    }

    if (apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
      res.status(401).json({ error: 'API token expired' });
      return;
    }

    const scopes: string[] = JSON.parse(apiToken.scopes);
    if (!scopes.includes(scope)) {
      res.status(403).json({ error: `Token missing required scope: ${scope}` });
      return;
    }

    await db('api_tokens')
      .where('id', apiToken.id)
      .update({ last_used_at: new Date().toISOString() });

    const user = await db('users').where('id', apiToken.user_id).first();
    if (!user) {
      res.status(401).json({ error: 'Token owner not found' });
      return;
    }

    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    next();
  };
}

export function generateApiToken(): string {
  return API_TOKEN_PREFIX + crypto.randomBytes(32).toString('hex');
}

export function hashApiToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
