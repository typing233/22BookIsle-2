import cron from 'node-cron';
import { getDb } from '../db/connection';
import { startScan } from './scanService';
import { logger } from '../utils/logger';

const scheduledTasks: Map<number, cron.ScheduledTask> = new Map();

export async function initScheduler(): Promise<void> {
  const db = getDb();
  const libraries = await db('libraries').whereNotNull('scan_schedule');

  for (const library of libraries) {
    scheduleLibraryScan(library.id, library.scan_schedule);
  }

  logger.info(`Scheduler initialized with ${libraries.length} scheduled scans`);
}

export function scheduleLibraryScan(libraryId: number, cronExpr: string): void {
  const existing = scheduledTasks.get(libraryId);
  if (existing) {
    existing.stop();
    scheduledTasks.delete(libraryId);
  }

  if (!cron.validate(cronExpr)) {
    logger.warn({ libraryId, cronExpr }, 'Invalid cron expression');
    return;
  }

  const task = cron.schedule(cronExpr, async () => {
    try {
      logger.info({ libraryId }, 'Starting scheduled scan');
      await startScan(libraryId);
    } catch (err: any) {
      logger.error({ err, libraryId }, 'Scheduled scan failed');
    }
  });

  scheduledTasks.set(libraryId, task);
  logger.info({ libraryId, cronExpr }, 'Scan scheduled');
}

export function unscheduleLibraryScan(libraryId: number): void {
  const task = scheduledTasks.get(libraryId);
  if (task) {
    task.stop();
    scheduledTasks.delete(libraryId);
  }
}
