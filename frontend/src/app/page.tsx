'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listRuns } from '@/lib/api';
import { Run } from '@/lib/types';

const ACTIVE_SET = new Set(['queued','researching','verifying','synthesizing','matching','pitching','reflecting']);

const STATUS_CFG: Record<string, { dot: string; label: string; badge: string }> = {
  queued:       { dot: 'bg-gray-300',   label: 'Queued',       badge: 'bg-gray-50 text-gray-500 border-gray-200'       },
  researching:  { dot: 'bg-blue-400',   label: 'Researching',  badge: 'bg-blue-50 text-blue-600 border-blue-200'       },
  verifying:    { dot: 'bg-cyan-400',   label: 'Verifying',    badge: 'bg-cyan-50 text-cyan-600 border-cyan-200'       },
  synthesizing: { dot: 'bg-violet-400', label: 'Synthesizing', badge: 'bg-violet-50 text-violet-600 border-violet-200' },
  matching:     { dot: 'bg-amber-400',  label: 'Matching',     badge: 'bg-amber-50 text-amber-600 border-amber-200'    },
  pitching:     { dot: 'bg-orange-400', label: 'Pitching',     badge: 'bg-orange-50 text-orange-600 border-orange-200' },
  reflecting:   { dot: 'bg-purple-400', label: 'Reflecting',   badge: 'bg-purple-50 text-purple-600 border-purple-200' },
  completed:    { dot: 'bg-green-400',  label: 'Completed',    badge: 'bg-green-50 text-green-700 border-green-200'    },
  failed:       { dot: 'bg-red-400',    label: 'Failed',       badge: 'bg-red-50 text-red-600 border-red-200'          },
};

function signalCount(run: Run): number {
  return run.profile?.signals?.length ?? 0;
}

function runElapsedMs(run: Run): number | null {
  const evts = run.events ?? [];
  if (!evts.length) return null;
  const first = evts[0];
  const last  = evts.find((e) => e.type === 'run_complete' || e.type === 'run_failed');
  if (!last) return null;
  return new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
}

function fmtMs(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="card p-5 flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [runs, setRuns]     = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRuns().then(setRuns).catch(console.error).finally(() => setLoading(false));
  }, []);

  const completed  = runs.filter((r) => r.status === 'completed');
  const active     = runs.filter((r) => ACTIVE_SET.has(r.status));
  const failed     = runs.filter((r) => r.status === 'failed');
  const saved      = runs.filter((r) => r.saved);

  const successRate = completed.length + failed.length > 0
    ? Math.round((completed.length / (completed.length + failed.length)) * 100)
    : null;

  const elapsedTimes = completed.map(runElapsedMs).filter((n): n is number => n !== null);
  const avgElapsed = elapsedTimes.length
    ? fmtMs(elapsedTimes.reduce((a, b) => a + b, 0) / elapsedTimes.length)
    : null;

  const topBySignals = [...completed]
    .sort((a, b) => signalCount(b) - signalCount(a))
    .slice(0, 5);

  const totalSignals = completed.reduce((sum, r) => sum + signalCount(r), 0);

  const recent = runs.slice(0, 6);

  const channelCounts: Record<string, number> = {};
  completed.forEach((r) => {
    const ch = r.lead?.channel;
    if (ch) channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;
  });

  const MEDAL = ['🥇', '🥈', '🥉', '4.', '5.'];

  return (
    <div className="space-y-7 animate-slide-up">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Overview of your prospect research pipeline</p>
        </div>
        <Link href="/new" className="btn-primary text-sm gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Research
        </Link>
      </div>

      {/* Stats row */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card p-5 h-24 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Runs"  value={runs.length}       color="text-gray-900"    sub={runs.length === 0 ? 'Start your first research' : 'all time'} />
          <StatCard label="Completed"   value={completed.length}  color="text-green-600"   sub={successRate !== null ? `${successRate}% success rate` : undefined} />
          <StatCard label="Active Now"  value={active.length}     color={active.length > 0 ? 'text-blue-600' : 'text-gray-400'} sub={active.length > 0 ? 'in pipeline' : 'pipeline idle'} />
          <StatCard label="Saved"       value={saved.length}      color="text-amber-600"   sub="bookmarked" />
        </div>
      )}

      {/* Middle row: Pipeline health + Top prospects */}
      {!loading && runs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Pipeline health */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm">Pipeline Health</h2>
            <div className="space-y-3">

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-green-500">✓</span>
                  Success rate
                </div>
                <span className="font-mono font-semibold text-sm text-green-600">
                  {successRate !== null ? `${successRate}%` : '—'}
                </span>
              </div>

              {successRate !== null && (
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-700"
                    style={{ width: `${successRate}%` }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-brand-400">⏱</span>
                  Avg completion
                </div>
                <span className="font-mono font-semibold text-sm text-gray-700">
                  {avgElapsed ?? '—'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-violet-400">✦</span>
                  Total signals found
                </div>
                <span className="font-mono font-semibold text-sm text-violet-600">
                  {totalSignals}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-indigo-400">⬡</span>
                  Phases per run
                </div>
                <span className="font-mono font-semibold text-sm text-gray-700">6</span>
              </div>

              {Object.keys(channelCounts).length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2 font-medium">Pitch channels used</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(channelCounts).map(([ch, n]) => (
                      <span key={ch} className="badge border border-gray-200 text-gray-600 text-[11px]">
                        {ch === 'email' ? '✉' : ch === 'linkedin' ? '💼' : '𝕏'} {ch} ×{n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top prospects by signals */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm">Top Prospects by Signals</h2>
            {topBySignals.length === 0 ? (
              <p className="text-sm text-gray-400">No completed runs yet</p>
            ) : (
              <div className="space-y-2.5">
                {topBySignals.map((run, i) => {
                  const sc     = signalCount(run);
                  const name   = run.lead.company || run.lead.name || run.lead.url || 'Unknown';
                  const elapsed = runElapsedMs(run);
                  return (
                    <button
                      key={run.runId}
                      onClick={() => router.push(`/runs/${run.runId}`)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group text-left"
                    >
                      <span className="text-base w-6 flex-shrink-0">{MEDAL[i]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-indigo-700">{name}</p>
                        {elapsed && <p className="text-xs text-gray-400">{fmtMs(elapsed)}</p>}
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-sm font-bold text-violet-600">{sc}</span>
                        <span className="text-[10px] text-gray-400">signals</span>
                      </div>
                      <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}

            {completed.length > 5 && (
              <Link href="/runs" className="block text-center text-xs text-indigo-500 hover:text-indigo-700 font-medium pt-1 transition-colors">
                View all {completed.length} completed →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 text-sm">Recent Research</h2>
          {runs.length > 6 && (
            <Link href="/runs" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
              View all {runs.length} →
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-white border border-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : recent.length === 0 ? (
          <div className="card p-10 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #eef2ff, #ede9fe)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">No research runs yet</p>
            <p className="text-xs text-gray-400">Start your first prospect research to see pipeline results here</p>
            <Link href="/new" className="btn-primary text-sm inline-flex mt-1">
              Research a Prospect
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((run) => {
              const cfg    = STATUS_CFG[run.status] ?? STATUS_CFG.queued;
              const name   = run.lead.name || run.lead.company || run.lead.url || 'Unknown';
              const sub    = run.lead.company && run.lead.name ? run.lead.company : run.lead.url;
              const sc     = signalCount(run);
              const isLive = ACTIVE_SET.has(run.status);
              const elapsed = runElapsedMs(run);
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
                      {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
                    </div>
                    {run.status === 'completed' && (
                      <div className="flex-shrink-0 text-center">
                        <p className="text-sm font-bold text-violet-600">{sc}</p>
                        <p className="text-[10px] text-gray-400 leading-none">signals</p>
                      </div>
                    )}
                    {elapsed && run.status === 'completed' && (
                      <span className="text-[11px] font-mono text-gray-400 flex-shrink-0 hidden sm:block">
                        {fmtMs(elapsed)}
                      </span>
                    )}
                    <span className={`badge border text-[11px] flex-shrink-0 ${cfg.badge}`}>
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

            {runs.length > 6 && (
              <Link
                href="/runs"
                className="block w-full text-center py-3 text-sm text-indigo-500 hover:text-indigo-700 font-medium
                           border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50/50 transition-all duration-150"
              >
                + {runs.length - 6} more runs — view all →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Quick action footer */}
      {!loading && runs.length > 0 && (
        <div
          className="rounded-2xl px-7 py-6 flex items-center justify-between gap-6 text-white"
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 60%, #6d28d9 100%)' }}
        >
          <div>
            <p className="font-semibold text-sm">Ready to research your next prospect?</p>
            <p className="text-indigo-300 text-xs mt-0.5">
              4 agents · 6 phases · evidence-grounded pitch in minutes
            </p>
          </div>
          <Link href="/new" className="flex-shrink-0 bg-white text-indigo-700 hover:bg-indigo-50 transition-colors text-sm font-semibold px-4 py-2 rounded-xl">
            + New Research
          </Link>
        </div>
      )}
    </div>
  );
}
