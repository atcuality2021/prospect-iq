import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ProjectModel } from '../db/models/project';
import { RunModel } from '../db/models/run';
import { groupRunsByCompany } from '../util/groupByCompany';

export const projectsRouter = Router();

projectsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name || !name.trim()) { res.status(400).json({ error: 'name required' }); return; }
  const projectId = uuidv4();
  const project = await ProjectModel.create({ projectId, name: name.trim(), description });
  res.status(201).json(project);
});

projectsRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  const list = await ProjectModel.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json(list);
});

projectsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const project = await ProjectModel.findOne({ projectId: req.params.id }).lean();
  if (!project) { res.status(404).json({ error: 'Not found' }); return; }
  const runs = await RunModel.find({ projectId: req.params.id }).sort({ createdAt: -1 }).lean();
  res.json({ project, companies: groupRunsByCompany(runs as { lead?: { company?: string } }[]) });
});
