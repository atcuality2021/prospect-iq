'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getProject } from '@/lib/api';
import { Project, Run } from '@/lib/types';
import CompanyChatDrawer from '@/components/CompanyChatDrawer';

type Detail = { project: Project; companies: { company: string; runs: Run[] }[] };

export default function ProjectDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatCompany, setChatCompany] = useState<string | null>(null);

  useEffect(() => {
    getProject(id).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-400">Loading…</p>;

  const totalRuns = data.companies.reduce((n, c) => n + c.runs.length, 0);

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <Link href="/projects" className="text-xs text-indigo-600 hover:underline">← Projects</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{data.project.name}</h1>
        {data.project.description && <p className="text-sm text-gray-400 mt-0.5">{data.project.description}</p>}
        <p className="text-xs text-gray-400 mt-1 font-mono">{data.companies.length} companies · {totalRuns} runs</p>
      </div>

      {data.companies.length === 0 ? (
        <div className="card p-6 text-center text-sm text-gray-400">
          No research filed under this project yet. Start from <Link href="/new" className="text-indigo-600 hover:underline">New Research</Link> or <Link href="/orchestrate" className="text-indigo-600 hover:underline">Orchestrate</Link> and select this project.
        </div>
      ) : data.companies.map((c) => (
        <div key={c.company} className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-900">
              {c.company} <span className="text-xs text-gray-400 font-mono">· {c.runs.length} runs</span>
            </p>
            <button onClick={() => setChatCompany(c.company)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-100 bg-indigo-50 rounded-lg px-2.5 py-1">
              💬 Chat
            </button>
          </div>
          <div className="space-y-1.5">
            {c.runs.map((r) => (
              <Link key={r.runId} href={`/runs/${r.runId}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 text-sm">
                <span className="text-gray-700">{r.lead?.name || r.lead?.url || r.runId.slice(0, 8)}</span>
                <span className="text-xs text-gray-400">{r.status}{r.lowConfidence ? ' · ⚠ low' : ''}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {chatCompany && (
        <CompanyChatDrawer projectId={id} company={chatCompany} onClose={() => setChatCompany(null)} />
      )}
    </div>
  );
}
