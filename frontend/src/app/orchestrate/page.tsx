'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrchestration } from '@/lib/api';

export default function OrchestratePage() {
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [company, setCompany] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!goal.trim()) { setError('Describe a goal first.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const hints: Record<string, string> = {};
      if (company.trim()) hints.company = company.trim();
      if (url.trim()) hints.url = url.trim();
      const { orchestrationId } = await createOrchestration({
        goal: goal.trim(),
        hints: Object.keys(hints).length ? hints : undefined,
      });
      router.push(`/orchestrate/${orchestrationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start orchestration');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orchestrate</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Describe a goal — the orchestrator plans the steps, runs research, and adapts until it&apos;s met.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Goal</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={4}
            placeholder="e.g. Research Stripe and draft a tailored outreach email for their payments team."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Company (optional)</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Stripe"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">URL (optional)</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://stripe.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Starting…' : 'Run orchestration'}
        </button>
      </div>
    </div>
  );
}
