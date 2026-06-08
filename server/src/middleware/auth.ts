import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../services/authService';
import { getDb } from '../db/connection';
import { Permission } from '../../../shared/types/enums';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const token = header.slice(7);
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function requireLibraryPermission(requiredPerm: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role === 'admin') {
      next();
      return;
    }

    const libraryId = req.params.libraryId || req.params.id;
    if (!libraryId) {
      res.status(400).json({ error: 'Library ID required' });
      return;
    }

    const db = getDb();
    const perm = await db('library_permissions')
      .where({ user_id: req.user.userId, library_id: Number(libraryId) })
      .first();

    if (!perm) {
      res.status(403).json({ error: 'No access to this library' });
      return;
    }

    const hierarchy: Record<string, number> = { read: 1, write: 2, manage: 3 };
    if ((hierarchy[perm.permission] || 0) < (hierarchy[requiredPerm] || 0)) {
      res.status(403).json({ error: 'Insufficient library permissions' });
      return;
    }

    next();
  };
}

export async function requireBookPermission(requiredPerm: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role === 'admin') {
      next();
      return;
    }

    const bookId = req.params.bookId || req.params.id;
    if (!bookId) {
      res.status(400).json({ error: 'Book ID required' });
      return;
    }

    const db = getDb();
    const book = await db('books').where('id', Number(bookId)).first();
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const perm = await db('library_permissions')
      .where({ user_id: req.user.userId, library_id: book.library_id })
      .first();

    if (!perm) {
      res.status(403).json({ error: 'No access to this library' });
      return;
    }

    const hierarchy: Record<string, number> = { read: 1, write: 2, manage: 3 };
    if ((hierarchy[perm.permission] || 0) < (hierarchy[requiredPerm] || 0)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
