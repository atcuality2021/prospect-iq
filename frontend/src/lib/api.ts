import type { Run, CatalogEntry, OrchestrationRun, Project } from './types';

const BASE = '/api';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const json = (body: object) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const submitLead         = (lead: object)              => req<{ runId: string }>('/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
export const getRun             = (id: string)                => req<Run>(`/runs/${id}`);
export const listRuns           = ()                          => req<Run[]>('/runs');
export const getCatalog         = ()                          => req<CatalogEntry[]>('/catalog');
export const createCatalogEntry = (e: object)                 => req<CatalogEntry>('/catalog', { ...json(e) });
export const updateCatalogEntry = (id: string, e: object)     => req<CatalogEntry>(`/catalog/${id}`, { ...json(e), method: 'PUT' });
export const deleteCatalogEntry = (id: string)                => req<void>(`/catalog/${id}`, { method: 'DELETE' });
export const getSettings        = ()                          => req<object>('/settings');
export const saveSettings       = (d: object)                 => req<{ ok: boolean }>('/settings', { ...json(d), method: 'PUT' });
export const createOrchestration = (body: { goal: string; hints?: object; projectId?: string }) => req<{ orchestrationId: string }>('/orchestrations', { ...json(body) });
export const getOrchestration    = (id: string)               => req<OrchestrationRun>(`/orchestrations/${id}`);
export const listOrchestrations  = ()                         => req<OrchestrationRun[]>('/orchestrations');
export const createProject       = (body: { name: string; description?: string }) => req<Project>('/projects', { ...json(body) });
export const listProjects        = ()                         => req<Project[]>('/projects');
export const getProject          = (id: string)               => req<{ project: Project; companies: { company: string; runs: Run[] }[] }>(`/projects/${id}`);
export const getCompanyChat      = (pid: string, company: string) => req<{ history: { role: string; content: string }[] }>(`/projects/${pid}/companies/${encodeURIComponent(company)}/chat`);
export const sendCompanyChat     = (pid: string, company: string, message: string) => req<{ reply: string }>(`/projects/${pid}/companies/${encodeURIComponent(company)}/chat`, { ...json({ message }) });
