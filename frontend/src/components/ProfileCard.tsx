'use client';
import { useState } from 'react';
import { ProspectProfile } from '@/lib/types';

const RELEVANCE = {
  high:   { ring: 'border-red-200   bg-red-50/60',   label: 'text-red-600',    dot: 'bg-red-400'   },
  medium: { ring: 'border-amber-200 bg-amber-50/60', label: 'text-amber-600',  dot: 'bg-amber-400' },
  low:    { ring: 'border-gray-200  bg-gray-50',     label: 'text-gray-500',   dot: 'bg-gray-300'  },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'from-green-400 to-emerald-500'
              : value >= 60 ? 'from-amber-400 to-orange-400'
              :               'from-gray-200  to-gray-300';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
             style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] text-gray-400 tabular-nums">{value}%</span>
    </div>
  );
}

export default function ProfileCard({ profile }: { profile: ProspectProfile }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const meta = [profile.company, profile.role, profile.industry, profile.location].filter(Boolean);

  return (
    <div className="card p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-100 to-violet-100 flex items-center justify-center text-brand-600 font-bold text-lg flex-shrink-0">
          {(profile.name || profile.company || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900">{profile.name || profile.company}</h2>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{meta.join(' · ')}</p>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-brand-200 pl-3">
        {profile.summary}
      </p>

      {/* Signals */}
      {profile.signals.length > 0 && (
        <div>
          <p className="section-label mb-3">
            Key Signals
            <span className="ml-2 normal-case font-normal text-gray-300">· click for evidence</span>
          </p>
          <div className="space-y-2">
            {profile.signals.map((signal, i) => {
              const cfg = RELEVANCE[signal.relevance] ?? RELEVANCE.low;
              const isOpen = expanded === i;
              return (
                <div key={i} className={`rounded-xl border overflow-hidden transition-all duration-150 ${cfg.ring}`}>
                  <button
                    className="w-full text-left px-3.5 py-3 flex items-start gap-3 hover:bg-white/50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${cfg.label}`}>{signal.title}</span>
                        <ConfidenceBar value={signal.confidence ?? 0} />
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 leading-snug">{signal.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-400 capitalize bg-white/80 border border-gray-100 px-1.5 py-0.5 rounded-md">
                        {signal.source}
                      </span>
                      <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </button>

                  {isOpen && signal.evidenceQuote && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-current/10 bg-white/60 animate-fade-in">
                      <p className="text-[11px] font-semibold text-gray-400 mb-1.5">Source quote</p>
                      <blockquote className="text-xs text-gray-600 italic border-l-2 border-brand-300 pl-3 leading-relaxed">
                        "{signal.evidenceQuote}"
                      </blockquote>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pain points + Opportunities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {profile.painPoints.length > 0 && (
          <div>
            <p className="section-label mb-2">Pain Points</p>
            <ul className="space-y-1.5">
              {profile.painPoints.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1 w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {profile.opportunities.length > 0 && (
          <div>
            <p className="section-label mb-2">Opportunities</p>
            <ul className="space-y-1.5">
              {profile.opportunities.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1 w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
