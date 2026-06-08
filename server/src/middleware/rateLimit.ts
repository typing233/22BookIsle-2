import rateLimit from 'express-rate-limit';
import { Request } from 'express';

export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req: Request) => {
    if (req.user) return 300;
    return 100;
  },
  keyGenerator: (req: Request) => {
    if (req.user) return `user:${req.user.userId}`;
    return req.ip || 'unknown';
  },
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req: Request) => {
    if (req.user) return `user:${req.user.userId}`;
    return req.ip || 'unknown';
  },
  message: { error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});
