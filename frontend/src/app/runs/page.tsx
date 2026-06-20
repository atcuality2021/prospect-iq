'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { listRuns } from '@/lib/api';
import { Run } from '@/lib/types';

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  queued:       { bg: 'bg-gray-50',    text: 'text-gray-500',   dot: 'bg-gray-300',   label: 'Queued'       },
  researching:  { bg: 'bg-blue-50',    text: 'text-blue-600',   dot: 'bg-blue-400',   label: 'Researching'  },
  verifying:    { bg: 'bg-cyan-50',    text: 'text-cyan-600',   dot: 'bg-cyan-400',   label: 'Verifying'    },
  synthesizing: { bg: 'bg-violet-50',  text: 'text-violet-600', dot: 'bg-violet-400', label: 'Synthesizing' },
  matching:     { bg: 'bg-amber-50',   text: 'text-amber-600',  dot: 'bg-amber-400',  label: 'Matching'     },
  pitching:     { bg: 'bg-orange-50',  text: 'text-orange-600', dot: 'bg-orange-400', label: 'Pitching'     },
  reflecting:   { bg: 'bg-purple-50',  text: 'text-purple-600', dot: 'bg-purple-400', label: 'Reflecting'   },
  completed:    { bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-400',  label: 'Completed'    },
  failed:       { bg: 'bg-red-50',     text: 'text-red-600',    dot: 'bg-red-400',    label: 'Failed'       },
};

const ACTIVE_STATUSES = new Set(['queued','researching','verifying','synthesizing','matching','pitching','reflecting']);

type FilterTab = 'all' | 'active' | 'completed' | 'failed';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'active',    label: 'Active'    },
  { key: 'completed', label: 'Completed' },
  { key: 'failed',    label: 'Failed'    },
];

export default function RunsPage() {
  const router = useRouter();
  const [runs, setRuns]     = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<FilterTab>('all');
  const [query, setQuery]   = useState('');

  useEffect(() => {
    listRuns().then(setRuns).catch(console.error).finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all:       runs.length,
    active:    runs.filter(r => ACTIVE_STATUSES.has(r.status)).length,
    completed: runs.filter(r => r.status === 'completed').length,
    failed:    runs.filter(r => r.status === 'failed').length,
  }), [runs]);

  const filtered = useMemo(() => {
    let out = runs;
    if (tab === 'active')    out = out.filter(r => ACTIVE_STATUSES.has(r.status));
    if (tab === 'completed') out = out.filter(r => r.status === 'completed');
    if (tab === 'failed')    out = out.filter(r => r.status === 'failed');
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(r =>
        (r.lead.name    ?? '').toLowerCase().includes(q) ||
        (r.lead.company ?? '').toLowerCase().includes(q) ||
        (r.lead.url     ?? '').toLowerCase().includes(q)
      );
    }
    return out;
  }, [runs, tab, query]);

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Runs</h1>
          <p className="mt-0.5 text-sm text-gray-500">Full history of research pipeline executions.</p>
        </div>
        <button onClick={() => router.push('/')} className="btn-primary text-sm flex-shrink-0">
          + New Research
        </button>
      </div>

      {/* Stats strip */}
      {!loading && runs.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total', value: counts.all, color: 'text-gray-900' },
            { label: 'Active', value: counts.active, color: 'text-blue-600' },
            { label: 'Completed', value: counts.completed, color: 'text-green-600' },
            { label: 'Failed', value: counts.failed, color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card px-4 py-3 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                ${tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full font-semibold
                  ${tab === t.key ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 relative min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, company, or URL…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Run list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-white border border-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 bg-white border border-gray-100 rounded-2xl text-gray-400 text-sm">
          {query ? `No runs match "${query}"` : 'No runs in this category yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((run) => {
            const cfg      = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.queued;
            const name     = run.lead.name || run.lead.company || '—';
            const subtitle = run.lead.company && run.lead.name ? run.lead.company : run.lead.url;
            const isLive   = ACTIVE_STATUSES.has(run.status);
            return (
              <button
                key={run.runId}
                onClick={() => router.push(`/runs/${run.runId}`)}
                className="w-full text-left bg-white border border-gray-100 rounded-xl px-4 py-3.5
                           hover:border-indigo-200 hover:shadow-sm transition-all duration-150 group"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${isLive ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {subtitle && <span className="mr-2">{subtitle}</span>}
                      {new Date(run.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {(run as any).saved && (
                    <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  )}
                  <span className={`badge border text-[11px] ${cfg.bg} ${cfg.text} border-current/20 flex-shrink-0`}>
                    {cfg.label}
                  </span>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
