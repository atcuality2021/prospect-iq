import { Router, Request, Response } from 'express';
import { CatalogModel } from '../db/models/catalog';

export const catalogRouter = Router();

catalogRouter.get('/', async (_req, res: Response): Promise<void> => {
  const entries = await CatalogModel.find({}).sort({ createdAt: -1 }).lean();
  res.json(entries);
});

catalogRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const entry = await CatalogModel.create(req.body);
  res.status(201).json(entry);
});

catalogRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const entry = await CatalogModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!entry) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(entry);
});

catalogRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  await CatalogModel.findByIdAndDelete(req.params.id);
  res.status(204).send();
});
