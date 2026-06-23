import { callWithTool } from '../llm/client';
import { TaskResult, GoalGrade } from './engine';

export function buildGraderPrompt(goal: string, summaries: string[]): string {
  return `You are judging whether a sales-research GOAL has been satisfied by the work done.

GOAL: ${goal}

WORK COMPLETED:
${summaries.map((s, i) => `${i + 1}. ${s}`).join('\n') || '(nothing yet)'}

Decide if the goal is fully met. Be strict: if key prospects are unresearched or pitches are missing, it is NOT met.`;
}

export async function gradeGoal(goal: string, results: TaskResult[]): Promise<GoalGrade> {
  const summaries = results.map((r) => r.result.summary);
  return callWithTool<GoalGrade>(
    [{ role: 'user', content: buildGraderPrompt(goal, summaries) }],
    {
      name: 'grade_goal',
      description: 'Judge whether the goal is fully met by the completed work.',
      schema: {
        type: 'object',
        properties: {
          met: { type: 'boolean' },
          reasoning: { type: 'string' },
          score: { type: 'number', description: '0-100 completeness' },
        },
        required: ['met', 'reasoning', 'score'],
      },
    },
    600,
  );
}
