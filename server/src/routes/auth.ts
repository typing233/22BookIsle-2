import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import {
  authenticateUser,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../services/authService';
import { writeAuditLog } from '../middleware/audit';
import { AuditAction } from '../../../shared/types/enums';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, try again later' },
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const user = await authenticateUser(username, password);

    if (!user) {
      await writeAuditLog(null, AuditAction.LoginFailed, 'user', undefined, { username }, req.ip);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload = { userId: user.id, username: user.username, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await writeAuditLog(user.id, AuditAction.Login, 'user', user.id, undefined, req.ip);

    res.json({ accessToken, refreshToken, user });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid request', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = generateAccessToken({
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    });
    res.json({ accessToken });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

export default router;
