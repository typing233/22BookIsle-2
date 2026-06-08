import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  if (err.name === 'ZodError') {
    res.status(400).json({ error: 'Validation failed', details: (err as any).errors });
    return;
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
