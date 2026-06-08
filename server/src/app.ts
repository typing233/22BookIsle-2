import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { globalRateLimit } from './middleware/rateLimit';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import libraryRoutes from './routes/libraries';
import bookRoutes from './routes/books';
import progressRoutes from './routes/progress';
import bookmarkRoutes from './routes/bookmarks';
import searchRoutes from './routes/search';
import scanRoutes from './routes/scan';
import auditRoutes from './routes/audit';
import ratingsRoutes from './routes/ratings';
import tagsRoutes from './routes/tags';
import metadataRoutes from './routes/metadata';
import statsRoutes from './routes/stats';
import syncRoutes from './routes/sync';
import tokensRoutes from './routes/tokens';
import healthRoutes from './routes/health';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(globalRateLimit);

  const registerRoutes = (prefix: string) => {
    app.use(`${prefix}/auth`, authRoutes);
    app.use(`${prefix}/users`, userRoutes);
    app.use(`${prefix}/libraries`, libraryRoutes);
    app.use(`${prefix}/books`, bookRoutes);
    app.use(`${prefix}/progress`, progressRoutes);
    app.use(`${prefix}/bookmarks`, bookmarkRoutes);
    app.use(`${prefix}/search`, searchRoutes);
    app.use(`${prefix}/scan`, scanRoutes);
    app.use(`${prefix}/audit`, auditRoutes);
    app.use(`${prefix}/ratings`, ratingsRoutes);
    app.use(`${prefix}/tags`, tagsRoutes);
    app.use(`${prefix}/metadata`, metadataRoutes);
    app.use(`${prefix}/stats`, statsRoutes);
    app.use(`${prefix}/sync`, syncRoutes);
    app.use(`${prefix}/tokens`, tokensRoutes);
  };

  app.use('/api/health', healthRoutes);
  registerRoutes('/api');
  registerRoutes('/api/v1');

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
