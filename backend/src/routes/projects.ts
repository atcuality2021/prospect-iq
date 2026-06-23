import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ProjectModel } from '../db/models/project';
import { RunModel } from '../db/models/run';
import { CompanyChatModel } from '../db/models/companyChat';
import { groupRunsByCompany, normalizeCompany } from '../util/groupByCompany';
import { buildCompanyContext, ContextRun } from '../util/companyContext';
import { callText } from '../llm/client';

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

// ── Company-level chat (BILTIQ-004) ───────────────────────────────────────────
projectsRouter.get('/:id/companies/:company/chat', async (req: Request, res: Response): Promise<void> => {
  const key = normalizeCompany(decodeURIComponent(req.params.company)).toLowerCase();
  const doc = await CompanyChatModel.findOne({ projectId: req.params.id, companyKey: key }).lean();
  res.json({ history: doc?.history ?? [] });
});

projectsRouter.post('/:id/companies/:company/chat', async (req: Request, res: Response): Promise<void> => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) { res.status(400).json({ error: 'message required' }); return; }

  const companyDisplay = normalizeCompany(decodeURIComponent(req.params.company));
  const key = companyDisplay.toLowerCase();

  const allRuns = await RunModel.find({ projectId: req.params.id }).sort({ createdAt: 1 }).lean();
  const runs = allRuns.filter((r) => normalizeCompany((r.lead as { company?: string })?.company).toLowerCase() === key);
  if (runs.length === 0) { res.status(400).json({ error: 'No research for this company yet' }); return; }

  const context = buildCompanyContext(companyDisplay, runs as unknown as ContextRun[]);
  const chat = await CompanyChatModel.findOne({ projectId: req.params.id, companyKey: key });
  const history = chat?.history ?? [];

  const messages = [
    { role: 'user' as const, content: `[SYSTEM CONTEXT — all research on ${companyDisplay}]\n${context}\n\nAnswer the user's questions and help improve outreach, grounded strictly in the research above.` },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  try {
    const reply = await callText(messages, 1500);
    const newHistory = [
      ...history,
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: reply, timestamp: new Date() },
    ];
    await CompanyChatModel.updateOne(
      { projectId: req.params.id, companyKey: key },
      { $set: { history: newHistory, company: companyDisplay } },
      { upsert: true },
    );
    res.json({ reply });
  } catch (err) {
    console.error('company chat error:', err);
    res.status(500).json({ error: 'LLM call failed' });
  }
});
