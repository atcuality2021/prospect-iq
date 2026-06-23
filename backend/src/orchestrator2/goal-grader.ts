import { callWithTool } from '../llm/client';
import { TaskResult, GoalGrade } from './engine';

export function buildGraderPrompt(goal: string, summaries: string[]): string {
  return `You are judging COVERAGE of a sales-research GOAL by the work done.

GOAL: ${goal}

WORK COMPLETED (one line per researched target):
${summaries.map((s, i) => `${i + 1}. ${s}`).join('\n') || '(nothing yet)'}

Judge how many of the goal's target prospects now have a confident pitch. The goal is MET when the
targets are adequately covered — you do NOT need one perfect output; a solid set of pitches across the
targets counts as success. It is NOT met only if most targets are still missing, failed, or low-confidence.
Set "score" to the coverage percentage (confident targets / total targets).`;
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
