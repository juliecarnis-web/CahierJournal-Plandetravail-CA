/**
 * Vercel Serverless Function entry point for Express API
 */

import express from 'express';
import apiRouter from '../src/server/routes.js';

const app = express();

app.use(express.json());

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Mount API router on both /api and root / for Vercel rewrite compatibility
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
