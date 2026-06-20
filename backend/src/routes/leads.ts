import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RunModel } from '../db/models/run';
import { enqueueRun } from '../queue';
import { Lead } from '../types';

export const leadsRouter = Router();

leadsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const lead = req.body as Lead;

  if (!lead.url && !lead.name && !lead.company) {
    res.status(400).json({ error: 'Provide at least one of: url, name, company' });
    return;
  }

  const runId = uuidv4();

  await RunModel.create({
    runId,
    lead,
    status: 'queued',
    events: [],
  });

  await enqueueRun(runId, lead);

  res.status(201).json({ runId });
});
