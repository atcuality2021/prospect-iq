import { TaskResult } from './engine';

// Rank fan-out results best-first: confident successes (ok && not low-confidence)
// ahead of the rest, then by descending gate score. Pure + stable-ish (sort is by
// a numeric key, ties keep input order in V8's stable sort).
export function rankResults(results: TaskResult[]): TaskResult[] {
  const rankKey = (r: TaskResult): number => {
    const score = r.result.score ?? 0;
    // ok results get a +1000 offset so any ok result outranks any non-ok result.
    return (r.result.ok ? 1000 : 0) + score;
  };
  return [...results].sort((a, b) => rankKey(b) - rankKey(a));
}
