import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';
import { startScan, cancelScan, getScanStatus } from '../services/scanService';
import { writeAuditLog } from '../middleware/audit';
import { AuditAction } from '../../../shared/types/enums';

const router = Router();
router.use(requireAuth);

router.post('/start', async (req: Request, res: Response) => {
  try {
    const { library_id } = req.body;
    if (!library_id) {
      res.status(400).json({ error: 'library_id is required' });
      return;
    }

    const db = getDb();
    const library = await db('libraries').where('id', Number(library_id)).first();
    if (!library) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }

    if (req.user!.role !== 'admin') {
      const perm = await db('library_permissions')
        .where({ user_id: req.user!.userId, library_id: Number(library_id) })
        .first();
      if (!perm || perm.permission === 'read') {
        res.status(403).json({ error: 'Write permission required to trigger scan' });
        return;
      }
    }

    const jobId = await startScan(Number(library_id));
    await writeAuditLog(req.user!.userId, AuditAction.ScanStart, 'library', Number(library_id), { jobId });

    res.json({ jobId, message: 'Scan started' });
  } catch (err: any) {
    if (err.message?.includes('already running')) {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to start scan' });
  }
});

router.get('/status/:jobId', async (req: Request, res: Response) => {
  const job = await getScanStatus(Number(req.params.jobId));
  if (!job) {
    res.status(404).json({ error: 'Scan job not found' });
    return;
  }
  res.json(job);
});

router.post('/cancel/:jobId', async (req: Request, res: Response) => {
  const cancelled = cancelScan(Number(req.params.jobId));
  if (!cancelled) {
    res.status(404).json({ error: 'No active scan with that ID' });
    return;
  }
  res.json({ message: 'Scan cancellation requested' });
});

router.get('/history/:libraryId', async (req: Request, res: Response) => {
  const db = getDb();
  const jobs = await db('scan_jobs')
    .where('library_id', Number(req.params.libraryId))
    .orderBy('created_at', 'desc')
    .limit(20);
  res.json(jobs);
});

export default router;
