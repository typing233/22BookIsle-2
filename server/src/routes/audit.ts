import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();
  const { page = '1', limit = '50', action, user_id } = req.query;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  let query = db('audit_log');
  if (action) query = query.where('action', action as string);
  if (user_id) query = query.where('user_id', Number(user_id));

  const countResult = await query.clone().count('* as total').first();
  const total = (countResult as any)?.total || 0;

  const entries = await query
    .orderBy('created_at', 'desc')
    .limit(limitNum)
    .offset(offset);

  res.json({
    data: entries,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

export default router;
