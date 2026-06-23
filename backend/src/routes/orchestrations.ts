import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { OrchestrationRunModel } from '../db/models/orchestrationRun';
import { onOrchestrationEvent } from '../events/emitter';
import { enqueueOrchestration } from '../queue';
import { config } from '../config';

export const orchestrationsRouter = Router();

orchestrationsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const { goal, hints, projectId } = req.body as { goal?: string; hints?: Record<string, unknown>; projectId?: string };
  if (!goal || !goal.trim()) { res.status(400).json({ error: 'goal required' }); return; }

  const orchestrationId = uuidv4();
  await OrchestrationRunModel.create({
    orchestrationId,
    goal: goal.trim(),
    hints,
    ...(projectId && { projectId }),
    status: 'queued',
    plan: [],
    iterations: 0,
    maxIterations: config.orchMaxIterations,
    goalMet: false,
    partial: false,
    events: [],
  });
  await enqueueOrchestration(orchestrationId);
  res.status(201).json({ orchestrationId });
});

orchestrationsRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  const list = await OrchestrationRunModel.find().sort({ createdAt: -1 }).limit(50).lean();
  res.json(list);
});

orchestrationsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const doc = await OrchestrationRunModel.findOne({ orchestrationId: req.params.id }).lean();
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(doc);
});

orchestrationsRouter.get('/:id/events', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const doc = await OrchestrationRunModel.findOne({ orchestrationId: id }).lean();
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Already finished — replay stored events and close.
  if (doc.status === 'completed' || doc.status === 'failed') {
    for (const event of doc.events) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.write('data: {"type":"stream_end"}\n\n');
    res.end();
    return;
  }

  const unsubscribe = onOrchestrationEvent(id, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === 'orchestration_complete' || event.type === 'orchestration_failed') {
      res.write('data: {"type":"stream_end"}\n\n');
      res.end();
      unsubscribe();
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});
