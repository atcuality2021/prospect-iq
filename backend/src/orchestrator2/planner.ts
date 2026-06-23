import { v4 as uuidv4 } from 'uuid';
import { callWithTool, UnifiedTool } from '../llm/client';
import { PlanTask } from '../types';

export function buildPlannerPrompt(goal: string, hints?: Record<string, unknown>): string {
  return `You are a sales-research planning agent. Break the GOAL into a short ordered list of tasks.

The ONLY tool available is "run_research_pipeline", which researches ONE prospect (company or person)
and drafts an outreach pitch. Each task targets one prospect via
{ "lead": { "company"?, "url"?, "name"?, "linkedinUrl"? } }.

GOAL: ${goal}
${hints && Object.keys(hints).length ? `HINTS: ${JSON.stringify(hints)}` : ''}

Produce 1-3 tasks. Each task has args { "lead": {...} } and a one-line rationale.`;
}

interface PlannerOutput {
  tasks: { args: Record<string, unknown>; rationale: string }[];
}

const TASK_LIST_SCHEMA: UnifiedTool['schema'] = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          args: { type: 'object', description: 'e.g. { "lead": { "company": "Stripe" } }' },
          rationale: { type: 'string' },
        },
        required: ['args', 'rationale'],
      },
    },
  },
  required: ['tasks'],
};

export async function planGoal(goal: string, hints?: Record<string, unknown>): Promise<PlanTask[]> {
  const out = await callWithTool<PlannerOutput>(
    [{ role: 'user', content: buildPlannerPrompt(goal, hints) }],
    { name: 'create_plan', description: 'Create an ordered list of research tasks to satisfy the goal.', schema: TASK_LIST_SCHEMA },
    1000,
  );
  return (out.tasks ?? []).map((t) => ({
    id: uuidv4().slice(0, 8),
    tool: 'run_research_pipeline',
    args: t.args ?? {},
    rationale: t.rationale ?? '',
    status: 'pending',
  }));
}

export { TASK_LIST_SCHEMA };
