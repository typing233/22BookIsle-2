import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requireLibraryPermission } from '../middleware/auth';
import { getDb } from '../db/connection';
import { writeAuditLog } from '../middleware/audit';
import { AuditAction, Permission } from '../../../shared/types/enums';

const router = Router();
router.use(requireAuth);

const createLibrarySchema = z.object({
  name: z.string().min(1).max(200),
  paths: z.array(z.string().min(1)).min(1),
  scan_schedule: z.string().optional(),
});

const updateLibrarySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  paths: z.array(z.string().min(1)).min(1).optional(),
  scan_schedule: z.string().nullable().optional(),
});

const setPermissionSchema = z.object({
  user_id: z.number().int().positive(),
  permission: z.enum(['read', 'write', 'manage']),
});

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();

  if (req.user!.role === 'admin') {
    const libraries = await db('libraries').select('*');
    const parsed = libraries.map((l: any) => ({ ...l, paths: JSON.parse(l.paths) }));
    res.json(parsed);
    return;
  }

  const libraries = await db('libraries')
    .join('library_permissions', 'libraries.id', 'library_permissions.library_id')
    .where('library_permissions.user_id', req.user!.userId)
    .select('libraries.*', 'library_permissions.permission');

  const parsed = libraries.map((l: any) => ({ ...l, paths: JSON.parse(l.paths) }));
  res.json(parsed);
});

router.get('/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const libraryId = Number(req.params.id);
  const library = await db('libraries').where('id', libraryId).first();
  if (!library) {
    res.status(404).json({ error: 'Library not found' });
    return;
  }

  if (req.user!.role !== 'admin') {
    const perm = await db('library_permissions')
      .where({ user_id: req.user!.userId, library_id: libraryId })
      .first();
    if (!perm) {
      res.status(403).json({ error: 'No access to this library' });
      return;
    }
  }

  res.json({ ...library, paths: JSON.parse(library.paths) });
});

router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const data = createLibrarySchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    const [id] = await db('libraries').insert({
      name: data.name,
      paths: JSON.stringify(data.paths),
      scan_schedule: data.scan_schedule || null,
      created_at: now,
      updated_at: now,
    });

    await writeAuditLog(req.user!.userId, AuditAction.LibraryCreate, 'library', id, data);
    res.status(201).json({ id, name: data.name, paths: data.paths, scan_schedule: data.scan_schedule || null });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireLibraryPermission(Permission.Manage), async (req: Request, res: Response) => {
  try {
    const data = updateLibrarySchema.parse(req.body);
    const db = getDb();
    const id = Number(req.params.id);

    const library = await db('libraries').where('id', id).first();
    if (!library) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (data.name) updates.name = data.name;
    if (data.paths) updates.paths = JSON.stringify(data.paths);
    if (data.scan_schedule !== undefined) updates.scan_schedule = data.scan_schedule;

    await db('libraries').where('id', id).update(updates);
    await writeAuditLog(req.user!.userId, AuditAction.LibraryUpdate, 'library', id, data);

    res.json({ id, ...data });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);

  const library = await db('libraries').where('id', id).first();
  if (!library) {
    res.status(404).json({ error: 'Library not found' });
    return;
  }

  await db('libraries').where('id', id).delete();
  await writeAuditLog(req.user!.userId, AuditAction.LibraryDelete, 'library', id, { name: library.name });

  res.json({ message: 'Library deleted' });
});

router.get('/:id/permissions', requireLibraryPermission(Permission.Manage), async (req: Request, res: Response) => {
  const db = getDb();
  const perms = await db('library_permissions')
    .where('library_id', Number(req.params.id))
    .join('users', 'library_permissions.user_id', 'users.id')
    .select('library_permissions.*', 'users.username', 'users.display_name');
  res.json(perms);
});

router.put('/:id/permissions', requireLibraryPermission(Permission.Manage), async (req: Request, res: Response) => {
  try {
    const data = setPermissionSchema.parse(req.body);
    const db = getDb();
    const libraryId = Number(req.params.id);

    await db('library_permissions')
      .insert({
        user_id: data.user_id,
        library_id: libraryId,
        permission: data.permission,
        granted_by: req.user!.userId,
        created_at: new Date().toISOString(),
      })
      .onConflict(['user_id', 'library_id'])
      .merge({ permission: data.permission, granted_by: req.user!.userId });

    await writeAuditLog(req.user!.userId, AuditAction.PermissionChange, 'library', libraryId, data);
    res.json({ message: 'Permission updated' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/permissions/:userId', requireLibraryPermission(Permission.Manage), async (req: Request, res: Response) => {
  const db = getDb();
  await db('library_permissions')
    .where({ library_id: Number(req.params.id), user_id: Number(req.params.userId) })
    .delete();

  await writeAuditLog(req.user!.userId, AuditAction.PermissionChange, 'library', Number(req.params.id), {
    removed_user_id: Number(req.params.userId),
  });

  res.json({ message: 'Permission removed' });
});

export default router;
