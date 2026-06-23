'use client';
import { useState } from 'react';
import { submitLead } from '@/lib/api';
import ProjectSelector from './ProjectSelector';

interface Props { onSubmit: (runId: string) => void; }

const CHANNELS = [
  { value: 'email',    label: 'Email',        icon: '✉' },
  { value: 'linkedin', label: 'LinkedIn DM',  icon: '💼' },
  { value: 'twitter',  label: 'Twitter/X DM', icon: '𝕏' },
];
const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual',       label: 'Casual'       },
  { value: 'friendly',     label: 'Friendly'     },
];

export default function LeadForm({ onSubmit }: Props) {
  const [form, setForm] = useState({
    url: '', name: '', company: '', linkedinUrl: '', youtubeChannel: '',
    channel: 'email', tone: 'professional',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleUrlBlur = () => {
    if (!form.url || form.company) return;
    try {
      const host = new URL(form.url.startsWith('http') ? form.url : `https://${form.url}`).hostname;
      const name = host.replace(/^www\./, '').split('.')[0];
      setForm(p => ({ ...p, company: name.charAt(0).toUpperCase() + name.slice(1) }));
    } catch { /* invalid URL — ignore */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.url && !form.name && !form.company) {
      setError('Provide at least a Website URL, Full Name, or Company.');
      return;
    }
    setLoading(true);
    try {
      const { runId } = await submitLead({ ...form, ...(projectId && { projectId }) });
      onSubmit(runId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Lead Details</h2>
          <p className="text-xs text-gray-400 mt-0.5">Fill in what you know — more data = better pitch</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center text-brand-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Primary fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Website URL" placeholder="https://example.com" value={form.url} onChange={set('url')}
            onBlur={handleUrlBlur} hint="Auto-fills company name on blur"
            icon={<GlobeIcon />} />
          <Field label="Full Name" placeholder="Jane Smith" value={form.name} onChange={set('name')}
            icon={<UserIcon />} />
          <Field label="Company" placeholder="Acme Corp" value={form.company} onChange={set('company')}
            icon={<BuildingIcon />} />
          <Field label="LinkedIn URL" placeholder="https://linkedin.com/in/…" value={form.linkedinUrl} onChange={set('linkedinUrl')}
            icon={<LinkedInIcon />} />
          <div className="md:col-span-2">
            <Field label="YouTube Channel (optional)" placeholder="@channelname or full URL" value={form.youtubeChannel} onChange={set('youtubeChannel')}
              icon={<YoutubeIcon />} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-gray-100" />

        {/* Channel + Tone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Pitch Channel</label>
            <div className="flex gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, channel: c.value }))}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border text-xs font-medium transition-all duration-150 ${
                    form.channel === c.value
                      ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-glow-sm'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <span className="text-base">{c.icon}</span>
                  <span className="leading-none">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Tone</label>
            <select
              value={form.tone}
              onChange={set('tone')}
              className="input"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-100" />
        <ProjectSelector value={projectId} onChange={setProjectId} />

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
            <span className="mt-0.5">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Starting research…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Research Prospect
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, onBlur, hint, icon }: {
  label: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="label mb-0">{label}</label>
        {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4 flex items-center justify-center pointer-events-none">
          {icon}
        </span>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className="input pl-9"
        />
      </div>
    </div>
  );
}

const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const BuildingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 3v18M16 3v18M2 9h20M2 15h20"/>
  </svg>
);
const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
    <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
  </svg>
);
const YoutubeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
  </svg>
);
