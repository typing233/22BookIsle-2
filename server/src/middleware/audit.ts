import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection';

export function auditLog(action: string, targetType?: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next();
    try {
      const db = getDb();
      await db('audit_log').insert({
        user_id: req.user?.userId || null,
        action,
        target_type: targetType || null,
        target_id: req.params.id ? Number(req.params.id) : null,
        details: JSON.stringify({ body: req.body, params: req.params }),
        ip_address: req.ip || req.socket.remoteAddress,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      // Audit logging should never break the request
    }
  };
}

export async function writeAuditLog(
  userId: number | null,
  action: string,
  targetType?: string,
  targetId?: number,
  details?: any,
  ipAddress?: string
): Promise<void> {
  try {
    const db = getDb();
    await db('audit_log').insert({
      user_id: userId,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      details: details ? JSON.stringify(details) : null,
      ip_address: ipAddress || null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Never throw from audit logging
  }
}
