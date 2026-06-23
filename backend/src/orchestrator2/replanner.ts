import { v4 as uuidv4 } from 'uuid';
import { callWithTool } from '../llm/client';
import { PlanTask } from '../types';
import { TaskResult } from './engine';
import { TASK_LIST_SCHEMA } from './planner';

export function buildReplanPrompt(goal: string, completed: { summary: string; ok: boolean }[]): string {
  return `You are adapting a research plan. Given the GOAL and what has been done, decide the REMAINING tasks.

GOAL: ${goal}

COMPLETED SO FAR:
${completed.map((c, i) => `${i + 1}. [${c.ok ? 'ok' : 'failed'}] ${c.summary}`).join('\n') || '(nothing yet)'}

Return only the remaining tasks needed (an empty list if the goal is already covered).
Each task has args { "lead": {...} } and a one-line rationale.`;
}

export async function replan(goal: string, _plan: PlanTask[], results: TaskResult[]): Promise<PlanTask[]> {
  const completed = results.map((r) => ({ summary: r.result.summary, ok: r.result.ok }));
  const out = await callWithTool<{ tasks: { args: Record<string, unknown>; rationale: string }[] }>(
    [{ role: 'user', content: buildReplanPrompt(goal, completed) }],
    { name: 'revise_plan', description: 'Return the remaining research tasks needed to satisfy the goal.', schema: TASK_LIST_SCHEMA },
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
