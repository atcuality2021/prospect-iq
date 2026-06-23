import { v4 as uuidv4 } from 'uuid';
import { callWithTool, UnifiedTool } from '../llm/client';
import { PlanTask } from '../types';

export function buildPlannerPrompt(goal: string, hints?: Record<string, unknown>, maxTargets = 10): string {
  return `You are a sales-research planning agent. Break the GOAL into a list of tasks — ONE per prospect.

The ONLY tool available is "run_research_pipeline", which researches ONE prospect (company or person)
and drafts an outreach pitch. Each task targets one prospect via
{ "lead": { "company"?, "url"?, "name"?, "linkedinUrl"? } }.

GOAL: ${goal}
${hints && Object.keys(hints).length ? `HINTS: ${JSON.stringify(hints)}` : ''}

TARGET LIST:
- If the goal names specific prospects (an explicit list), emit exactly one task per named prospect.
- If the goal is descriptive (e.g. "top 5 EU payment processors"), expand it into named prospects FROM
  YOUR OWN KNOWLEDGE — do NOT browse the web. These are best-effort and may be out of date.
- Emit at most ${maxTargets} tasks. Each task has args { "lead": {...} } and a one-line rationale.`;
}

// Cap the planner's task list to maxTargets, never below 1.
export function capTasks(tasks: PlanTask[], maxTargets: number): PlanTask[] {
  return tasks.slice(0, Math.max(1, maxTargets));
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

export async function planGoal(goal: string, hints?: Record<string, unknown>, maxTargets = 10): Promise<PlanTask[]> {
  const out = await callWithTool<PlannerOutput>(
    [{ role: 'user', content: buildPlannerPrompt(goal, hints, maxTargets) }],
    { name: 'create_plan', description: 'Create one research task per prospect to satisfy the goal.', schema: TASK_LIST_SCHEMA },
    1500,
  );
  const tasks: PlanTask[] = (out.tasks ?? []).map((t) => ({
    id: uuidv4().slice(0, 8),
    tool: 'run_research_pipeline',
    args: t.args ?? {},
    rationale: t.rationale ?? '',
    status: 'pending',
  }));
  return capTasks(tasks, maxTargets);
}

export { TASK_LIST_SCHEMA };
