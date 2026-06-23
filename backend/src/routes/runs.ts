import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RunModel } from '../db/models/run';
import { onRunEvent } from '../events/emitter';
import { callWithTool, callText } from '../llm/client';
import { enqueueRun } from '../queue';

export const runsRouter = Router();

runsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const filter: Record<string, unknown> = {};
  if (req.query.saved === 'true') filter.saved = true;
  if (typeof req.query.projectId === 'string') filter.projectId = req.query.projectId;
  const runs = await RunModel.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  res.json(runs);
});

runsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const run = await RunModel.findOne({ runId: req.params.id }).lean();
  if (!run) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(run);
});

runsRouter.get('/:id/events', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Check run exists
  const run = await RunModel.findOne({ runId: id }).lean();
  if (!run) { res.status(404).json({ error: 'Not found' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // If already completed, send existing events and close
  if (run.status === 'completed' || run.status === 'failed') {
    for (const event of run.events) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.write('data: {"type":"stream_end"}\n\n');
    res.end();
    return;
  }

  // Stream live events
  const unsubscribe = onRunEvent(id, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === 'run_complete' || event.type === 'run_failed') {
      res.write('data: {"type":"stream_end"}\n\n');
      res.end();
      unsubscribe();
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});

// ── PATCH /:id — save/unsave, update notes ───────────────────────────────────
runsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const run = await RunModel.findOne({ runId: req.params.id });
  if (!run) { res.status(404).json({ error: 'Not found' }); return; }

  if (typeof req.body.saved === 'boolean') {
    run.set('saved', req.body.saved);
    run.set('savedAt', req.body.saved ? new Date() : undefined);
  }
  if (typeof req.body.notes === 'string') {
    run.set('notes', req.body.notes);
  }
  await run.save();
  res.json({ ok: true, saved: run.get('saved'), notes: run.get('notes') });
});

// ── POST /:id/rerun — create new run with updated lead ───────────────────────
runsRouter.post('/:id/rerun', async (req: Request, res: Response): Promise<void> => {
  const original = await RunModel.findOne({ runId: req.params.id }).lean();
  if (!original) { res.status(404).json({ error: 'Not found' }); return; }

  const { projectId: bodyProjectId, ...leadOverrides } = req.body as Record<string, unknown>;
  const lead = { ...original.lead, ...leadOverrides };
  const projectId = (typeof bodyProjectId === 'string' ? bodyProjectId : undefined) ?? original.projectId;
  const runId = uuidv4();

  await RunModel.create({ runId, lead, status: 'queued', events: [], ...(projectId && { projectId }) });
  await enqueueRun(runId, lead);
  res.status(201).json({ runId });
});

// ── POST /:id/chat — chat with full run context ──────────────────────────────
runsRouter.post('/:id/chat', async (req: Request, res: Response): Promise<void> => {
  const run = await RunModel.findOne({ runId: req.params.id });
  if (!run) { res.status(404).json({ error: 'Not found' }); return; }

  const { message } = req.body as { message: string };
  if (!message?.trim()) { res.status(400).json({ error: 'message required' }); return; }

  const profile  = (run as any).profile;
  const pitch    = (run as any).pitch;
  const verified = ((run as any).verification?.verifiedFacts ?? []).slice(0, 15);

  const systemContext = `You are a sales research assistant. The user has completed AI research on a prospect. Answer questions, dig deeper, or help improve the pitch and report.

PROSPECT: ${profile?.name ?? ''} — ${profile?.role ?? ''} at ${profile?.company ?? ''}
SUMMARY: ${profile?.summary ?? '(no profile yet)'}

VERIFIED SIGNALS (${profile?.signals?.length ?? 0}):
${(profile?.signals ?? []).slice(0, 6).map((s: any) => `• ${s.title}: ${s.description} [${s.confidence}% confidence]`).join('\n')}

PAIN POINTS: ${(profile?.painPoints ?? []).join(' | ')}
OPPORTUNITIES: ${(profile?.opportunities ?? []).join(' | ')}

CURRENT PITCH SUBJECT: ${pitch?.subject ?? '(none)'}

VERIFIED FACTS (sample):
${verified.slice(0, 8).map((f: any) => `• ${f.claim}`).join('\n')}

When asked to improve the pitch or report, provide the full revised text. When asked to research further, reason from what you know. Always ground your answers in the verified signals above.`.trim();

  const chatHistory: Array<{ role: string; content: string }> = (run.get('chatHistory') ?? []);
  const messages = [
    { role: 'user' as const, content: `[SYSTEM CONTEXT]\n${systemContext}` },
    ...chatHistory.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  try {
    const reply = await callText(messages, 1500);

    const newHistory = [
      ...chatHistory,
      { role: 'user',      content: message, timestamp: new Date() },
      { role: 'assistant', content: reply,   timestamp: new Date() },
    ];
    run.set('chatHistory', newHistory);
    await run.save();

    res.json({ reply, historyLength: newHistory.length });
  } catch (err) {
    console.error('chat error:', err);
    res.status(500).json({ error: 'LLM call failed' });
  }
});

// ── GET /:id/chat — return chat history ──────────────────────────────────────
runsRouter.get('/:id/chat', async (req: Request, res: Response): Promise<void> => {
  const run = await RunModel.findOne({ runId: req.params.id }).lean();
  if (!run) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ chatHistory: (run as any).chatHistory ?? [] });
});

runsRouter.get('/:id/suggestions', async (req: Request, res: Response): Promise<void> => {
  const run = await RunModel.findOne({ runId: req.params.id }).lean();
  if (!run) { res.status(404).json({ error: 'Not found' }); return; }
  if (run.status !== 'completed' || !run.profile) {
    res.status(400).json({ error: 'Run not completed yet' }); return;
  }

  const { profile, verification } = run as any;
  const verifiedFacts = (verification?.verifiedFacts ?? []).slice(0, 12);

  const context = `
PROSPECT: ${profile.name ?? ''} — ${profile.role ?? ''} at ${profile.company ?? ''}
INDUSTRY: ${profile.industry ?? ''} | LOCATION: ${profile.location ?? ''}
SUMMARY: ${profile.summary ?? ''}

VERIFIED SIGNALS (${profile.signals?.length ?? 0} total):
${(profile.signals ?? []).slice(0, 6).map((s: any) => `• [${s.confidence}% confidence] ${s.title}: ${s.description}`).join('\n')}

PAIN POINTS:
${(profile.painPoints ?? []).map((p: string) => `• ${p}`).join('\n')}

OPPORTUNITIES:
${(profile.opportunities ?? []).map((o: string) => `• ${o}`).join('\n')}

VERIFIED FACTS (sample):
${verifiedFacts.slice(0, 6).map((f: any) => `• ${f.claim}`).join('\n')}
`.trim();

  try {
    const result = await callWithTool<{
      whatTheyAreDoingNow: string[];
      whatTheyCurrentlyNeed: string[];
      recommendedApproach: string;
      bestTopicsToLeadWith: string[];
      topicsToAvoid: string[];
      timingInsight: string;
      oneLineSummary: string;
    }>(
      [{ role: 'user', content: `Based on this verified research about a prospect, generate specific, actionable sales approach suggestions. Be concrete — reference actual signals, not generic advice.\n\n${context}` }],
      {
        name: 'output_suggestions',
        description: 'Output structured approach suggestions',
        schema: {
          type: 'object',
          properties: {
            whatTheyAreDoingNow: {
              type: 'array', items: { type: 'string' },
              description: 'Specific things the prospect is actively doing or building right now, based on evidence',
            },
            whatTheyCurrentlyNeed: {
              type: 'array', items: { type: 'string' },
              description: 'Concrete needs or gaps the prospect has right now, derived from their pain points and signals',
            },
            recommendedApproach: {
              type: 'string',
              description: 'A single clear recommended engagement strategy (2-3 sentences), tied to specific evidence',
            },
            bestTopicsToLeadWith: {
              type: 'array', items: { type: 'string' },
              description: 'The 3-4 most resonant topics to open with, in order of priority',
            },
            topicsToAvoid: {
              type: 'array', items: { type: 'string' },
              description: 'Topics or angles that would likely land poorly with this specific prospect',
            },
            timingInsight: {
              type: 'string',
              description: 'Any signal about why NOW is a good or bad time to reach out (funding, hiring, launch, etc.)',
            },
            oneLineSummary: {
              type: 'string',
              description: 'One sentence that captures the single most important thing to know about engaging this prospect',
            },
          },
          required: ['whatTheyAreDoingNow', 'whatTheyCurrentlyNeed', 'recommendedApproach', 'bestTopicsToLeadWith', 'topicsToAvoid', 'timingInsight', 'oneLineSummary'],
        },
      },
      1200
    );
    res.json(result);
  } catch (err) {
    console.error('suggestions error:', err);
    res.status(500).json({ error: 'LLM call failed' });
  }
});
