'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRun } from '@/lib/api';
import { Run, RunEvent } from '@/lib/types';
import RunTimeline from '@/components/RunTimeline';
import ProfileCard from '@/components/ProfileCard';
import MatchCard from '@/components/MatchCard';
import PitchOutput from '@/components/PitchOutput';
import SuggestionsCard from '@/components/SuggestionsCard';
import RerunModal from '@/components/RerunModal';
import ChatDrawer from '@/components/ChatDrawer';

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  queued:       { bg: 'bg-gray-50',    text: 'text-gray-500',   dot: 'bg-gray-300'   },
  researching:  { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-400 animate-pulse'   },
  verifying:    { bg: 'bg-cyan-50',   text: 'text-cyan-700',   dot: 'bg-cyan-400 animate-pulse'   },
  synthesizing: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400 animate-pulse' },
  matching:     { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400 animate-pulse'  },
  pitching:     { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400 animate-pulse' },
  reflecting:   { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400 animate-pulse' },
  completed:    { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400'  },
  failed:       { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400'    },
};

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun]           = useState<Run | null>(null);
  const [events, setEvents]     = useState<RunEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saved, setSaved]       = useState(false);
  const [showRerun, setShowRerun] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const toggleSave = async () => {
    if (!run) return;
    const next = !saved;
    setSaved(next);
    await fetch(`/api/runs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saved: next }),
    });
  };

  useEffect(() => {
    let mounted = true;

    async function init() {
      const data = await getRun(id);
      if (!mounted) return;
      setRun(data);
      setEvents(data.events ?? []);
      setSaved(!!(data as any).saved);
      setLoading(false);

      if (data.status === 'completed' || data.status === 'failed') return;

      const es = new EventSource(`/api/runs/${id}/events`);
      esRef.current = es;

      es.onmessage = async (e) => {
        const event: RunEvent & { type: string } = JSON.parse(e.data);
        if (event.type === 'stream_end') {
          es.close();
          const updated = await getRun(id);
          if (mounted) setRun(updated);
          return;
        }
        setEvents((prev) => [...prev, event]);
        if (event.type === 'run_complete' || event.type === 'run_failed') {
          es.close();
          const updated = await getRun(id);
          if (mounted) setRun(updated);
        }
      };
      es.onerror = () => es.close();
    }

    init().catch(console.error);
    return () => {
      mounted = false;
      esRef.current?.close();
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-white border border-gray-100 rounded-2xl w-1/2" />
        <div className="h-48 bg-white border border-gray-100 rounded-2xl" />
        <div className="h-64 bg-white border border-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">🔍</p>
        <p className="font-medium text-gray-600">Run not found</p>
        <button className="btn-ghost mt-4" onClick={() => router.push('/')}>← Back home</button>
      </div>
    );
  }

  const cfg   = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.queued;
  const title = run.lead.name || run.lead.company || run.lead.url || 'Research Run';
  const isLive = !['completed', 'failed'].includes(run.status);

  return (
    <>
    {showRerun && <RerunModal runId={run.runId} lead={run.lead as any} onClose={() => setShowRerun(false)} />}
    {showChat  && <ChatDrawer runId={run.runId} onClose={() => setShowChat(false)} />}

    <div className="space-y-6 animate-fade-in">
      {/* Run header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push('/')}
          className="mt-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          title="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{title}</h1>
            <span className={`badge border ${cfg.bg} ${cfg.text} border-current/20 flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {run.status}
            </span>
            {isLive && (
              <span className="text-xs text-brand-500 font-medium animate-pulse-slow">
                Live updating…
              </span>
            )}
          </div>
          {run.lead.url && (
            <a href={run.lead.url} target="_blank" rel="noopener noreferrer"
               className="text-xs text-gray-400 hover:text-brand-500 transition-colors mt-1 inline-block">
              {run.lead.url} ↗
            </a>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Save / bookmark */}
          <button
            onClick={toggleSave}
            title={saved ? 'Remove from saved' : 'Save research'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-150
              ${saved
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'}`}
          >
            <svg className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {saved ? 'Saved' : 'Save'}
          </button>

          {/* Improve / re-run */}
          {run.status === 'completed' && (
            <button
              onClick={() => setShowRerun(true)}
              className="btn-ghost text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Improve
            </button>
          )}

          {/* Chat */}
          {run.status === 'completed' && (
            <button
              onClick={() => setShowChat(true)}
              className="btn-primary text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <RunTimeline events={events} status={run.status} />

      {/* Profile */}
      {run.profile && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-3 px-1">Prospect Profile</h2>
          <ProfileCard profile={run.profile} />
        </div>
      )}

      {/* Matches */}
      {run.matches && run.matches.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-3 px-1">
            Service Matches
            <span className="ml-2 font-normal text-gray-400">({run.matches.length})</span>
          </h2>
          <div className="space-y-3">
            {run.matches.map((match, i) => (
              <MatchCard key={i} match={match} />
            ))}
          </div>
        </div>
      )}

      {/* Pitch */}
      {run.pitch && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-3 px-1">Generated Pitch</h2>
          <PitchOutput pitch={run.pitch} />
        </div>
      )}

      {/* AI Approach Suggestions — lazy-loaded only once completed */}
      {run.status === 'completed' && run.profile && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-3 px-1">AI Approach Recommendations</h2>
          <SuggestionsCard runId={run.runId} />
        </div>
      )}

      {/* Error */}
      {run.error && (
        <div className="card border border-red-100 bg-red-50 p-4 text-red-700">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1">Error</p>
          <p className="text-sm">{run.error}</p>
        </div>
      )}
    </div>
    </>
  );
}
