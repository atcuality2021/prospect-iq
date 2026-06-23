// Normalize a company label: trimmed; blank/undefined becomes "Unassigned".
export function normalizeCompany(company?: string): string {
  return (company ?? '').trim() || 'Unassigned';
}

export interface CompanyGroup<T> {
  company: string;
  runs: T[];
}

// Group runs by their (normalized, case-insensitive) company. Generic so it works
// with full Run docs and with test stubs alike. Blanks collapse into "Unassigned".
export function groupRunsByCompany<T extends { lead?: { company?: string } }>(runs: T[]): CompanyGroup<T>[] {
  const map = new Map<string, CompanyGroup<T>>();
  for (const run of runs) {
    const display = normalizeCompany(run.lead?.company);
    const key = display.toLowerCase();
    if (!map.has(key)) map.set(key, { company: display, runs: [] });
    map.get(key)!.runs.push(run);
  }
  return Array.from(map.values());
}
