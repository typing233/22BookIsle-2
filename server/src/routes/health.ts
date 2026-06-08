import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.raw('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

export default router;
