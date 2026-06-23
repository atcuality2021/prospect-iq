'use client';
import { useEffect, useState } from 'react';
import { listProjects } from '@/lib/api';
import { Project } from '@/lib/types';

export default function ProjectSelector({ value, onChange }: { value?: string; onChange: (id?: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Project (optional)</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
      >
        <option value="">— None (Unassigned) —</option>
        {projects.map((p) => (
          <option key={p.projectId} value={p.projectId}>{p.name}</option>
        ))}
      </select>
      {projects.length === 0 && (
        <p className="text-[11px] text-gray-400 mt-1">No projects yet — create one on the Projects page.</p>
      )}
    </div>
  );
}
