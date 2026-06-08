import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();
  const { since } = req.query;

  if (!since) {
    res.status(400).json({ error: 'Parameter "since" is required (ISO timestamp)' });
    return;
  }

  const sinceTime = since as string;
  const userId = req.user!.userId;

  const [progressChanges, bookmarksChanges, ratingsChanges, tagsChanges] = await Promise.all([
    db('reading_progress')
      .where('user_id', userId)
      .where('updated_at', '>', sinceTime)
      .select('*'),

    db('bookmarks')
      .where('user_id', userId)
      .where('created_at', '>', sinceTime)
      .select('*'),

    db('user_ratings')
      .where('user_id', userId)
      .where('updated_at', '>', sinceTime)
      .select('*'),

    db('book_tags')
      .where('user_id', userId)
      .where('created_at', '>', sinceTime)
      .join('user_tags', 'book_tags.tag_id', 'user_tags.id')
      .select('book_tags.*', 'user_tags.name as tag_name', 'user_tags.color as tag_color'),
  ]);

  res.json({
    progress_changes: progressChanges,
    bookmarks_changes: bookmarksChanges,
    ratings_changes: ratingsChanges,
    tags_changes: tagsChanges,
    server_time: new Date().toISOString(),
  });
});

export default router;
