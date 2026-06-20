'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Lead = {
  url?: string; name?: string; company?: string;
  linkedinUrl?: string; youtubeChannel?: string;
  channel?: string; tone?: string;
};

export default function RerunModal({ runId, lead, onClose }: { runId: string; lead: Lead; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm]     = useState<Lead>({ ...lead });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = (k: keyof Lead) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const { runId: newId } = await res.json();
      onClose();
      router.push(`/runs/${newId}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Improve Research</h2>
            <p className="text-xs text-gray-500 mt-0.5">Update lead details and re-run the full pipeline</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Website URL</label>
              <input className="input" value={form.url ?? ''} onChange={set('url')} placeholder="https://example.com" />
            </div>
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.name ?? ''} onChange={set('name')} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" value={form.company ?? ''} onChange={set('company')} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="label">LinkedIn URL <span className="text-indigo-500 font-normal normal-case">updated</span></label>
              <input className="input" value={form.linkedinUrl ?? ''} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/…" />
            </div>
          </div>

          <div>
            <label className="label">YouTube Channel (optional)</label>
            <input className="input" value={form.youtubeChannel ?? ''} onChange={set('youtubeChannel')} placeholder="@channelname or full URL" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Pitch Channel</label>
              <select className="input" value={form.channel ?? 'email'} onChange={set('channel')}>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn DM</option>
                <option value="twitter">Twitter/X DM</option>
              </select>
            </div>
            <div>
              <label className="label">Tone</label>
              <select className="input" value={form.tone ?? 'professional'} onChange={set('tone')}>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="friendly">Friendly</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <p className="text-xs text-indigo-700 font-medium">This creates a new run with the updated details above. The original run is preserved.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary">
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Starting…</>
            ) : '→ Re-run Research'}
          </button>
        </div>
      </div>
    </div>
  );
}
