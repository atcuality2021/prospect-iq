import { callText } from '../llm/client';
import { TaskResult } from './engine';

export function buildSynthesisPrompt(goal: string, summaries: string[]): string {
  return `Write a concise final answer addressing the GOAL, based on the research completed.

GOAL: ${goal}

RESEARCH COMPLETED:
${summaries.map((s, i) => `${i + 1}. ${s}`).join('\n') || '(no research completed)'}

Summarize what was found and produced, and explicitly note any gaps. Keep it tight.`;
}

export async function synthesize(goal: string, results: TaskResult[]): Promise<string> {
  const summaries = results.map((r) => r.result.summary);
  return callText([{ role: 'user', content: buildSynthesisPrompt(goal, summaries) }], 800);
}
