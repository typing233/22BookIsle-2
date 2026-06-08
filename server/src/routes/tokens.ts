import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth';
import { getDb } from '../db/connection';
import { generateApiToken, hashApiToken } from '../middleware/apiToken';
import { writeAuditLog } from '../middleware/audit';
import { AuditAction, ApiScope } from '../../../shared/types/enums';

const router = Router();
router.use(requireAuth);

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.nativeEnum(ApiScope)).min(1),
  expires_at: z.string().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();
  const tokens = await db('api_tokens')
    .where('user_id', req.user!.userId)
    .select('id', 'name', 'scopes', 'last_used_at', 'expires_at', 'created_at')
    .orderBy('created_at', 'desc');

  res.json(tokens.map((t: any) => ({ ...t, scopes: JSON.parse(t.scopes) })));
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createTokenSchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    const rawToken = generateApiToken();
    const tokenHash = hashApiToken(rawToken);

    const [id] = await db('api_tokens').insert({
      user_id: req.user!.userId,
      name: data.name,
      token_hash: tokenHash,
      scopes: JSON.stringify(data.scopes),
      expires_at: data.expires_at || null,
      created_at: now,
    });

    await writeAuditLog(req.user!.userId, AuditAction.TokenCreate, 'api_token', id, { name: data.name }, req.ip);

    res.status(201).json({
      id,
      name: data.name,
      token: rawToken,
      scopes: data.scopes,
      expires_at: data.expires_at || null,
      created_at: now,
    });
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
  const token = await db('api_tokens')
    .where({ id: Number(req.params.id), user_id: req.user!.userId })
    .first();

  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }

  await db('api_tokens').where('id', token.id).delete();
  await writeAuditLog(req.user!.userId, AuditAction.TokenRevoke, 'api_token', token.id, { name: token.name }, req.ip);

  res.json({ message: 'Token revoked' });
});

export default router;
