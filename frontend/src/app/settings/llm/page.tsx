'use client';
import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '@/lib/api';

type ProviderKey = 'openai' | 'localvllm' | 'anthropic' | 'gemini';

type ProviderConfig = {
  model: string;
  baseUrl?: string;
  status: 'configured' | 'missing' | 'optional';
  statusLabel: string;
};

type Settings = {
  provider: string;
  openaiModel: string;
  openaiBaseUrl: string;
  anthropicModel: string;
  hasOpenAiKey: boolean;
  hasAnthropicKey: boolean;
  hasSerpApiKey: boolean;
  hasYoutubeKey: boolean;
};

const PROVIDERS: { key: ProviderKey; label: string; icon: string; modelPlaceholder: string; hasBaseUrl?: boolean }[] = [
  { key: 'openai',    label: 'OpenAI',      icon: '⬡', modelPlaceholder: 'gpt-4o' },
  { key: 'localvllm', label: 'Local vLLM',  icon: '⚙', modelPlaceholder: 'Qwen3.6-35B-A3B', hasBaseUrl: true },
  { key: 'anthropic', label: 'Anthropic',   icon: '◈', modelPlaceholder: 'claude-sonnet-4-6' },
  { key: 'gemini',    label: 'Gemini',      icon: '✦', modelPlaceholder: 'gemini-1.5-pro' },
];

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-green-400' : 'bg-gray-300'}`} />;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function LLMSettingsPage() {
  const [settings, setSettings]   = useState<Settings | null>(null);
  const [active, setActive]       = useState<ProviderKey>('openai');
  const [models, setModels]       = useState<Record<ProviderKey, string>>({
    openai: '', localvllm: '', anthropic: '', gemini: '',
  });
  const [baseUrls, setBaseUrls]   = useState<Record<ProviderKey, string>>({
    openai: '', localvllm: '', anthropic: '', gemini: '',
  });
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderKey>('openai');

  useEffect(() => {
    getSettings().then((s) => {
      const d = s as Settings;
      setSettings(d);
      const prov = (d.provider === 'openai' && d.openaiBaseUrl ? 'localvllm' : d.provider) as ProviderKey;
      setActiveProvider(prov);
      setActive(prov);
      setModels({
        openai:    d.openaiModel,
        localvllm: d.openaiModel,
        anthropic: d.anthropicModel,
        gemini:    '',
      });
      setBaseUrls({
        openai:    '',
        localvllm: d.openaiBaseUrl,
        anthropic: '',
        gemini:    '',
      });
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const isLocal = active === 'localvllm';
      await saveSettings({
        provider:      isLocal ? 'openai' : active,
        openaiModel:   active === 'openai' || isLocal ? models[active] : undefined,
        openaiBaseUrl: isLocal ? baseUrls.localvllm : '',
        anthropicModel: active === 'anthropic' ? models.anthropic : undefined,
      });
      setActiveProvider(active);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <div className="space-y-3 animate-pulse">{[1,2,3].map(i=><div key={i} className="h-16 bg-white rounded-xl border border-gray-100"/>)}</div>;
  }

  const keyStatus: Record<ProviderKey, boolean> = {
    openai:    settings.hasOpenAiKey,
    localvllm: true,
    anthropic: settings.hasAnthropicKey,
    gemini:    false,
  };

  const p = PROVIDERS.find(x => x.key === active)!;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-gray-900">LLM Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">Configure each provider independently. Select the active provider for new runs.</p>
      </div>

      {/* Provider tabs */}
      <div className="flex gap-2 flex-wrap">
        {PROVIDERS.map((prov) => (
          <button
            key={prov.key}
            onClick={() => setActive(prov.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150
              ${active === prov.key
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}
          >
            <span className={`text-base ${active === prov.key ? 'text-indigo-500' : 'text-gray-400'}`}>{prov.icon}</span>
            {prov.label}
            {activeProvider === prov.key && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded-full">ACTIVE</span>
            )}
          </button>
        ))}
      </div>

      {/* Provider config card */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{p.icon}</span>
            <div>
              <h2 className="font-semibold text-gray-900">{p.label}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusDot ok={keyStatus[active]} />
                <span className="text-xs text-gray-500">{keyStatus[active] ? 'API key configured' : 'API key not set'}</span>
              </div>
            </div>
          </div>
          {activeProvider === active && (
            <span className="badge bg-green-50 text-green-700 border-green-200 text-xs font-semibold">Currently Active</span>
          )}
        </div>

        <Field label="Model" hint="Model name or ID">
          <input
            className="input"
            value={models[active]}
            onChange={e => setModels(m => ({ ...m, [active]: e.target.value }))}
            placeholder={p.modelPlaceholder}
          />
        </Field>

        {p.hasBaseUrl && (
          <Field label="Base URL" hint="OpenAI-compatible endpoint">
            <input
              className="input font-mono text-xs"
              value={baseUrls[active]}
              onChange={e => setBaseUrls(b => ({ ...b, [active]: e.target.value }))}
              placeholder="https://your-vllm-host/v1"
            />
          </Field>
        )}

        {/* API key hint */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">API Key</p>
          <p className="text-xs text-gray-500">
            {active === 'localvllm'
              ? 'No API key required — the local endpoint uses your vLLM server.'
              : keyStatus[active]
                ? `Key is set in .env (${active.toUpperCase()}_API_KEY). Rotate by editing .env and restarting.`
                : `Add ${active === 'openai' ? 'OPENAI_API_KEY' : active === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'} to .env and restart the server.`}
          </p>
        </div>

        {active === 'gemini' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-medium text-amber-700">Gemini support is planned — the LLM adapter will be extended in a future update.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
          <button onClick={handleSave} disabled={saving || active === 'gemini'} className="btn-primary">
            {saving ? 'Saving…' : `Save & Activate ${p.label}`}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved — {p.label} is now active
            </span>
          )}
        </div>
      </div>

      {/* API key status grid */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">All API Key Status</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'OpenAI Key',       ok: settings.hasOpenAiKey    },
            { label: 'Anthropic Key',    ok: settings.hasAnthropicKey },
            { label: 'SerpAPI Key',      ok: settings.hasSerpApiKey   },
            { label: 'YouTube Data Key', ok: settings.hasYoutubeKey   },
          ].map(({ label, ok }) => (
            <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <StatusDot ok={ok} />
              {label}
              <span className="ml-auto text-xs font-medium">{ok ? 'Set' : 'Missing'}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">Edit <code className="bg-gray-100 px-1 rounded">backend/.env</code> to add keys. Server restart required.</p>
      </div>

      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        Runtime overrides reset on server restart. For permanent changes, update <code className="bg-white border border-amber-200 rounded px-1">.env</code>.
      </p>
    </div>
  );
}
