import express from 'express';
import cors from 'cors';
import { config } from './config';
import { connectMongo } from './db/mongo';
import { leadsRouter } from './routes/leads';
import { catalogRouter } from './routes/catalog';
import { runsRouter } from './routes/runs';
import { settingsRouter } from './routes/settings';
import { orchestrationsRouter } from './routes/orchestrations';
import { projectsRouter } from './routes/projects';

const app = express();

app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

app.use('/api/runs', runsRouter);
app.use('/api/runs', leadsRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/orchestrations', orchestrationsRouter);
app.use('/api/projects', projectsRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

async function start() {
  await connectMongo();
  app.listen(config.port, () => {
    console.log(`API running on http://localhost:${config.port}`);
  });
}

start().catch(console.error);
