'use client';
import { useState, useEffect } from 'react';

type Suggestions = {
  whatTheyAreDoingNow:    string[];
  whatTheyCurrentlyNeed:  string[];
  recommendedApproach:    string;
  bestTopicsToLeadWith:   string[];
  topicsToAvoid:          string[];
  timingInsight:          string;
  oneLineSummary:         string;
};

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${color}`}>
      {text}
    </span>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-indigo-500">{icon}</span>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      </div>
      {children}
    </div>
  );
}

function BulletList({ items, dotColor }: { items: string[]; dotColor: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SuggestionsCard({ runId }: { runId: string }) {
  const [data, setData]       = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/runs/${runId}/suggestions`)
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(setData)
      .catch(() => setError('Could not generate suggestions — LLM call failed.'))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg" />
          <div className="h-5 w-48 bg-gray-100 rounded-lg" />
        </div>
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-4 bg-gray-100 rounded" style={{ width: `${70 + i * 8}%` }} />)}
        </div>
        <p className="mt-4 text-xs text-indigo-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          AI is analysing verified signals and generating approach recommendations…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-5 border-red-100 bg-red-50">
        <p className="text-sm text-red-600">{error ?? 'No suggestions available.'}</p>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">AI Approach Recommendations</h3>
          <p className="text-xs text-gray-500 mt-0.5">Based on {data.whatTheyAreDoingNow.length + data.whatTheyCurrentlyNeed.length} verified signals</p>
        </div>
      </div>

      {/* One-line summary */}
      <div className="rounded-xl px-4 py-3 border border-indigo-100"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)' }}>
        <p className="text-sm font-medium text-indigo-800">{data.oneLineSummary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* What they're doing now */}
        <Section
          title="What they're doing now"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        >
          <BulletList items={data.whatTheyAreDoingNow} dotColor="bg-blue-400" />
        </Section>

        {/* What they currently need */}
        <Section
          title="What they currently need"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        >
          <BulletList items={data.whatTheyCurrentlyNeed} dotColor="bg-violet-400" />
        </Section>
      </div>

      {/* Recommended approach */}
      <Section
        title="Recommended approach"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        }
      >
        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
          {data.recommendedApproach}
        </p>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Best topics to lead with */}
        <Section
          title="Lead with these topics"
          icon={
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          }
        >
          <div className="flex flex-wrap gap-2">
            {data.bestTopicsToLeadWith.map((t, i) => (
              <Pill key={i} text={t} color="bg-green-50 text-green-700 border-green-200" />
            ))}
          </div>
        </Section>

        {/* Topics to avoid */}
        <Section
          title="Avoid these angles"
          icon={
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          }
        >
          <div className="flex flex-wrap gap-2">
            {data.topicsToAvoid.map((t, i) => (
              <Pill key={i} text={t} color="bg-red-50 text-red-600 border-red-200" />
            ))}
          </div>
        </Section>
      </div>

      {/* Timing insight */}
      {data.timingInsight && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Timing Insight</p>
            <p className="text-sm text-amber-800">{data.timingInsight}</p>
          </div>
        </div>
      )}
    </div>
  );
}
