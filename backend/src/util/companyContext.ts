// Minimal shape needed to build company chat context — kept narrow so it's easy
// to unit-test without constructing full Run documents.
export interface ContextRun {
  profile?: {
    summary?: string;
    signals?: { title: string; description: string; relevance: string }[];
  };
  pitch?: { subject?: string; body: string };
}

const MAX_SIGNALS = 12;

// Merge all of a company's runs into one system context: every run's summary,
// signals deduped by title (capped), and the latest available pitch.
export function buildCompanyContext(company: string, runs: ContextRun[]): string {
  if (runs.length === 0) return `Company: ${company}\n(no research yet)`;

  const summaries = runs
    .map((r, i) => (r.profile?.summary ? `Run ${i + 1}: ${r.profile.summary}` : ''))
    .filter(Boolean);

  const seen = new Set<string>();
  const signals: string[] = [];
  for (const r of runs) {
    for (const s of r.profile?.signals ?? []) {
      const key = s.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      signals.push(`• [${s.relevance}] ${s.title}: ${s.description}`);
      if (signals.length >= MAX_SIGNALS) break;
    }
    if (signals.length >= MAX_SIGNALS) break;
  }

  const latestPitch = [...runs].reverse().find((r) => r.pitch)?.pitch;

  return `Company: ${company} (${runs.length} research run${runs.length === 1 ? '' : 's'})

SUMMARIES:
${summaries.join('\n') || '(none)'}

MERGED SIGNALS (top ${signals.length}):
${signals.join('\n') || '(none)'}

LATEST PITCH:
${latestPitch ? `${latestPitch.subject ? `Subject: ${latestPitch.subject}\n` : ''}${latestPitch.body}` : '(none)'}`;
}
