import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import libraryRoutes from './routes/libraries';
import bookRoutes from './routes/books';
import progressRoutes from './routes/progress';
import bookmarkRoutes from './routes/bookmarks';
import searchRoutes from './routes/search';
import scanRoutes from './routes/scan';
import auditRoutes from './routes/audit';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/libraries', libraryRoutes);
  app.use('/api/books', bookRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/bookmarks', bookmarkRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/scan', scanRoutes);
  app.use('/api/audit', auditRoutes);

  if (config.isProduction) {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
