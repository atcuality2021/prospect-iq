'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listProjects, createProject } from '@/lib/api';
import { Project } from '@/lib/types';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => listProjects().then(setProjects).catch(() => setProjects([]));
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createProject({ name: name.trim(), description: desc.trim() || undefined });
      setName(''); setDesc(''); await load();
    } finally { setCreating(false); }
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-400 mt-0.5">Group research by campaign or initiative.</p>
      </div>

      <div className="card p-5 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">New project</p>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 Fintech Outreach"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          <button onClick={create} disabled={creating || !name.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
      </div>

      <div className="space-y-2">
        {projects.length === 0
          ? <p className="text-sm text-gray-400">No projects yet — create one above.</p>
          : projects.map((p) => (
            <Link key={p.projectId} href={`/projects/${p.projectId}`} className="card p-4 block hover:shadow-md transition-shadow">
              <p className="font-semibold text-gray-900">{p.name}</p>
              {p.description && <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>}
            </Link>
          ))}
      </div>
    </div>
  );
}
