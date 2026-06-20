'use client';
import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '@/lib/api';

type AgentCfg    = { enabled: boolean; description: string };
type PipelineCfg = { enabled: boolean; description: string; qualityThreshold?: number };
type Settings    = { agents: Record<string, AgentCfg>; pipeline: Record<string, PipelineCfg> };

const AGENT_META: Record<string, { label: string; keyEnv: string; color: string }> = {
  website:  { label: 'Website Scraper',      keyEnv: 'Always available',           color: 'bg-blue-50 border-blue-200 text-blue-700'   },
  linkedin: { label: 'LinkedIn Agent',        keyEnv: 'Always available',           color: 'bg-sky-50 border-sky-200 text-sky-700'      },
  news:     { label: 'News Search (SerpAPI)', keyEnv: 'SERPAPI_KEY required',       color: 'bg-amber-50 border-amber-200 text-amber-700' },
  youtube:  { label: 'YouTube Search',        keyEnv: 'YOUTUBE_API_KEY required',   color: 'bg-red-50 border-red-200 text-red-700'      },
};

const PIPELINE_META: Record<string, { label: string; color: string }> = {
  verification: { label: 'Verification',      color: 'text-cyan-600'   },
  synthesis:    { label: 'Synthesis',          color: 'text-violet-600' },
  matching:     { label: 'Service Matching',   color: 'text-amber-600'  },
  pitching:     { label: 'Pitch Generation',   color: 'text-orange-600' },
  reflection:   { label: 'Reflection / Critic', color: 'text-purple-600' },
};
const PIPELINE_ORDER = ['verification','synthesis','matching','pitching','reflection'];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
        ${on ? 'bg-indigo-500' : 'bg-gray-200'}`}
      style={{ height: 22, width: 40 }}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${on ? 'translate-x-[18px]' : ''}`} />
    </button>
  );
}

export default function AgentSettingsPage() {
  const [settings, setSettings]   = useState<Settings | null>(null);
  const [agents, setAgents]       = useState<Record<string, boolean>>({});
  const [threshold, setThreshold] = useState(70);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      const d = s as Settings;
      setSettings(d);
      setAgents(Object.fromEntries(Object.entries(d.agents).map(([k, v]) => [k, v.enabled])));
      setThreshold(d.pipeline?.reflection?.qualityThreshold ?? 70);
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({ agentOverrides: agents, reflectionThreshold: threshold });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <div className="space-y-3 animate-pulse">{[1,2,3].map(i=><div key={i} className="h-16 bg-white rounded-xl border border-gray-100"/>)}</div>;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Agent Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Enable or disable research agents and configure pipeline behaviour.</p>
      </div>

      {/* Research agents */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-800">Research Agents</h2>
          <span className="badge bg-blue-50 text-blue-700 border-blue-200 text-xs">Phase 1 — parallel</span>
        </div>
        <p className="text-xs text-gray-400 mb-5">All enabled agents fire simultaneously. Results are merged before the Verification node.</p>

        <div className="space-y-3">
          {Object.entries(settings.agents).map(([name, cfg]) => {
            const meta = AGENT_META[name] ?? { label: name, keyEnv: '', color: 'bg-gray-50 border-gray-200 text-gray-600' };
            const isOn = agents[name] ?? cfg.enabled;
            return (
              <div key={name} className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 ${isOn ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-70'}`}>
                <Toggle on={isOn} onChange={v => setAgents(a => ({ ...a, [name]: v }))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{meta.label}</span>
                    <span className={`badge border text-[11px] ${meta.color}`}>{meta.keyEnv}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{cfg.description}</p>
                </div>
                <span className={`text-xs font-semibold ${isOn ? 'text-green-600' : 'text-gray-400'}`}>
                  {isOn ? 'Active' : 'Off'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline nodes */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-800">Pipeline Nodes</h2>
          <span className="badge bg-purple-50 text-purple-700 border-purple-200 text-xs">Sequential</span>
        </div>
        <p className="text-xs text-gray-400 mb-5">Each node receives the previous node's output. All are required for a complete run.</p>

        <div className="space-y-2">
          {PIPELINE_ORDER.map((name, idx) => {
            const cfg  = settings.pipeline[name];
            const meta = PIPELINE_META[name];
            if (!cfg) return null;
            return (
              <div key={name} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-white">
                <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-indigo-600">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                    {name === 'reflection' && (
                      <span className="badge bg-purple-50 text-purple-600 border-purple-200 text-[11px]">critic</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{cfg.description}</p>
                  {name === 'reflection' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-600">Quality threshold (auto-revise below this score)</label>
                        <span className="text-sm font-bold text-purple-600">{threshold}</span>
                      </div>
                      <input
                        type="range" min={0} max={100} value={threshold}
                        onChange={e => setThreshold(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-1.5"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>0 — never revise</span>
                        <span>100 — always revise</span>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold text-green-600 flex-shrink-0">Active</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Agent Config'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
        <p className="text-xs text-gray-400 ml-2">Changes apply to new runs only. Restart not required.</p>
      </div>
    </div>
  );
}
