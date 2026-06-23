'use client';
import { RunEvent, RunStatus } from '@/lib/types';

interface Props {
  events: RunEvent[];
  status: RunStatus;
}

const PHASES = [
  { key: 'research',    label: 'Research',          icon: '🔍', desc: '4 agents in parallel — web, LinkedIn, news, YouTube'           },
  { key: 'verifying',  label: 'Verification',       icon: '✓',  desc: 'Every claim grounded in verbatim source quotes'               },
  { key: 'synthesis',  label: 'Synthesis',          icon: '⚡', desc: 'Think-before-act: reason → structured profile'                 },
  { key: 'matching',   label: 'Service Matching',   icon: '⇄',  desc: 'Ranking your catalog against verified signals'                 },
  { key: 'pitching',   label: 'Pitch Generation',   icon: '✉',  desc: 'Channel-specific outreach tied to real evidence'              },
  { key: 'reflecting', label: 'Reflection',         icon: '◎',  desc: 'Critic scores the pitch and re-revises until it clears the quality bar'},
];

const AGENTS = [
  { key: 'website',  icon: '🌐', label: 'Web'       },
  { key: 'linkedin', icon: '💼', label: 'LinkedIn'  },
  { key: 'news',     icon: '📰', label: 'News'      },
  { key: 'youtube',  icon: '▶',  label: 'YouTube'   },
];

type PhaseState = 'pending' | 'active' | 'done' | 'failed';

function fmtSecs(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function RunTimeline({ events, status }: Props) {
  const phaseState = (key: string): PhaseState => {
    const started   = events.some((e) => e.type === 'phase_start'    && e.phase === key);
    const completed = events.some((e) => e.type === 'phase_complete' && e.phase === key);
    if (!started)   return 'pending';
    if (completed)  return 'done';
    if (status === 'failed') return 'failed';
    return 'active';
  };

  const phaseElapsed = (key: string): string | null => {
    const start = events.find(e => e.type === 'phase_start'    && e.phase === key);
    const end   = events.find(e => e.type === 'phase_complete' && e.phase === key);
    if (!start || !end) return null;
    return fmtSecs(new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime());
  };

  const totalElapsed = (): string | null => {
    const first = events[0];
    const last  = events.find(e => e.type === 'run_complete' || e.type === 'run_failed');
    if (!first || !last) return null;
    return fmtSecs(new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime());
  };

  const agentState = (phase: string, agent: string) => {
    const phaseEvts = events.filter((e) => e.phase === phase);
    const started   = phaseEvts.some((e) => e.agent === agent && e.type === 'agent_start');
    const done      = phaseEvts.some((e) => e.agent === agent && e.type === 'agent_complete');
    const errored   = phaseEvts.some((e) => e.agent === agent && e.type === 'agent_error');
    if (!started) return 'pending';
    if (errored)  return 'error';
    if (done)     return 'done';
    return 'active';
  };

  const gateAttempts = (gate: string) =>
    events.filter((e) => e.type === 'gate_attempt' && e.gate === gate).length;
  const lowConfidence = events.some((e) => e.type === 'gate_fail' && e.gate === 'research');

  const completedCount = PHASES.filter((p) => phaseState(p.key) === 'done').length;
  const progress = Math.round((completedCount / PHASES.length) * 100);

  return (
    <div className="card p-6 space-y-5">
      {/* Header + progress */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Pipeline Progress</h2>
        <div className="flex items-center gap-3">
          {totalElapsed() && (
            <span className="text-xs text-gray-400 font-mono bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
              ⏱ {totalElapsed()} total
            </span>
          )}
          {lowConfidence && (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              ⚠ low confidence
            </span>
          )}
          <span className="text-xs font-mono text-gray-400">{completedCount}/{PHASES.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Phase list */}
      <div className="relative mt-1">
        {/* Connector line */}
        <div className="absolute left-4 top-5 bottom-5 w-px bg-gray-100" />

        <div className="space-y-1">
          {PHASES.map((phase, idx) => {
            const ps = phaseState(phase.key);
            const isResearch = phase.key === 'research';

            return (
              <div key={phase.key} className={`relative flex gap-4 py-3 px-1 rounded-xl transition-colors duration-150 ${
                ps === 'active' ? 'bg-brand-50/60' : ''
              }`}>
                {/* Step dot */}
                <div className={`z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  ps === 'done'    ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-sm'
                  : ps === 'active'  ? 'bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-glow animate-pulse-slow'
                  : ps === 'failed'  ? 'bg-red-100 text-red-500 border border-red-200'
                  : 'bg-gray-50 border-2 border-gray-200 text-gray-300'
                }`}>
                  {ps === 'done'    ? '✓'
                   : ps === 'active'  ? <span className="text-xs">{phase.icon}</span>
                   : ps === 'failed'  ? '✗'
                   : <span className="text-xs text-gray-300">{idx + 1}</span>}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${
                      ps === 'pending' ? 'text-gray-400' : 'text-gray-900'
                    }`}>
                      {phase.label}
                    </span>
                    {ps === 'active' && (
                      <span className="text-[11px] font-semibold text-brand-500 bg-brand-50 border border-brand-100 px-1.5 py-0.5 rounded-full animate-pulse-slow">
                        running
                      </span>
                    )}
                    {ps === 'done' && (
                      <span className="text-[11px] text-green-600 flex items-center gap-1">
                        done
                        {phaseElapsed(phase.key) && (
                          <span className="text-gray-400 font-mono">· {phaseElapsed(phase.key)}</span>
                        )}
                      </span>
                    )}
                    {(() => {
                      const gateKey = phase.key === 'verifying' ? 'research' : phase.key === 'reflecting' ? 'pitch' : null;
                      const attempts = gateKey ? gateAttempts(gateKey) : 0;
                      return attempts > 1 ? (
                        <span className="text-[11px] text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full">
                          🔁 retried {attempts - 1}×
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {(ps === 'pending' || ps === 'active') && (
                    <p className="text-xs text-gray-400 mt-0.5 leading-snug">{phase.desc}</p>
                  )}

                  {/* Sub-agents for research phase */}
                  {isResearch && ps !== 'pending' && (
                    <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                      {AGENTS.map((ag) => {
                        const as_ = agentState(phase.key, ag.key);
                        return (
                          <div key={ag.key} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-200 ${
                            as_ === 'done'    ? 'bg-green-50   border-green-200  text-green-700'
                            : as_ === 'active'  ? 'bg-blue-50    border-blue-200   text-blue-600  animate-pulse-slow'
                            : as_ === 'error'   ? 'bg-red-50     border-red-100    text-red-500'
                            : 'bg-gray-50 border-gray-100 text-gray-300'
                          }`}>
                            <span>{ag.icon}</span>
                            <span>{ag.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
