import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export function idempotencyCheck() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.headers['idempotency-key'] as string | undefined;
    if (!key || (req.method !== 'POST' && req.method !== 'PUT')) {
      next();
      return;
    }

    if (!req.user) {
      next();
      return;
    }

    const db = getDb();

    await db('idempotency_keys')
      .where('created_at', '<', new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString())
      .limit(100)
      .delete();

    const existing = await db('idempotency_keys')
      .where({ key, user_id: req.user.userId })
      .first();

    if (existing) {
      const cached = JSON.parse(existing.response);
      res.status(cached.status).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      db('idempotency_keys')
        .insert({
          key,
          user_id: req.user!.userId,
          response: JSON.stringify({ status: res.statusCode, body }),
          created_at: new Date().toISOString(),
        })
        .catch(() => {});
      return originalJson(body);
    };

    next();
  };
}
