import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { getDb } from '../db/connection';
import { hashPassword } from '../services/authService';
import { writeAuditLog } from '../middleware/audit';
import { AuditAction, UserRole } from '../../../shared/types/enums';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin'));

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  role: z.enum(['admin', 'user']),
  display_name: z.string().optional(),
});

const updateUserSchema = z.object({
  role: z.enum(['admin', 'user']).optional(),
  display_name: z.string().optional(),
  password: z.string().min(6).optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();
  const users = await db('users').select('id', 'username', 'role', 'display_name', 'created_at', 'updated_at');
  res.json(users);
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);
    const db = getDb();

    const existing = await db('users').where('username', data.username).first();
    if (existing) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }

    const passwordHash = await hashPassword(data.password);
    const now = new Date().toISOString();
    const [id] = await db('users').insert({
      username: data.username,
      password_hash: passwordHash,
      role: data.role,
      display_name: data.display_name || null,
      created_at: now,
      updated_at: now,
    });

    await writeAuditLog(req.user!.userId, AuditAction.UserCreate, 'user', id, { username: data.username });

    res.status(201).json({ id, username: data.username, role: data.role, display_name: data.display_name || null });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const db = getDb();
    const userId = Number(req.params.id);

    const user = await db('users').where('id', userId).first();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (data.role) updates.role = data.role;
    if (data.display_name !== undefined) updates.display_name = data.display_name;
    if (data.password) updates.password_hash = await hashPassword(data.password);

    await db('users').where('id', userId).update(updates);
    await writeAuditLog(req.user!.userId, AuditAction.UserUpdate, 'user', userId, data);

    res.json({ id: userId, ...updates, password_hash: undefined });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const userId = Number(req.params.id);

  if (userId === req.user!.userId) {
    res.status(400).json({ error: 'Cannot delete yourself' });
    return;
  }

  const user = await db('users').where('id', userId).first();
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  await db('users').where('id', userId).delete();
  await writeAuditLog(req.user!.userId, AuditAction.UserDelete, 'user', userId, { username: user.username });

  res.json({ message: 'User deleted' });
});

export default router;
