'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type Run = {
  runId: string;
  status: string;
  lead: { url?: string; name?: string; company?: string };
  saved?: boolean;
  savedAt?: string;
  createdAt: string;
};

const STATUS_DOT: Record<string, string> = {
  completed: 'bg-green-400',
  failed:    'bg-red-400',
  queued:    'bg-gray-300',
};

export default function SavedRunsPage() {
  const [runs, setRuns]   = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/runs?saved=true')
      .then(r => r.json())
      .then((data: Run[]) => {
        setRuns(Array.isArray(data) ? data.filter(r => r.saved) : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const unsave = async (runId: string) => {
    setRuns(rs => rs.filter(r => r.runId !== runId));
    await fetch(`/api/runs/${runId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saved: false }),
    });
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-xl border border-gray-100" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Saved Research</h1>
        <p className="mt-1 text-sm text-gray-500">
          {runs.length} saved {runs.length === 1 ? 'run' : 'runs'}
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <p className="font-medium text-gray-700 mb-1">No saved research yet</p>
          <p className="text-sm text-gray-400 mb-4">Click the bookmark icon on any completed run to save it here.</p>
          <Link href="/runs" className="btn-ghost text-sm inline-flex">← View all runs</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => {
            const title = run.lead.name || run.lead.company || run.lead.url || 'Research Run';
            const dot   = STATUS_DOT[run.status] ?? 'bg-gray-300';
            const savedDate = run.savedAt ? new Date(run.savedAt).toLocaleDateString() : '—';
            return (
              <div key={run.runId}
                className="card p-4 flex items-center gap-4 hover:shadow-sm transition-shadow group">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                <div className="flex-1 min-w-0">
                  <Link href={`/runs/${run.runId}`} className="font-medium text-gray-900 text-sm hover:text-indigo-600 transition-colors truncate block">
                    {title}
                  </Link>
                  {run.lead.url && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{run.lead.url}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">Saved {savedDate}</span>
                <button
                  onClick={() => unsave(run.runId)}
                  title="Remove from saved"
                  className="flex-shrink-0 text-amber-400 hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                <Link href={`/runs/${run.runId}`} className="flex-shrink-0 text-gray-300 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
