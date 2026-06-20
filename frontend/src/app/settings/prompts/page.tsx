'use client';
import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '@/lib/api';

const PHASE_ORDER = ['verification', 'synthesis', 'matching', 'pitching', 'reflection'];

const PHASE_META: Record<string, { label: string; badge: string; description: string }> = {
  verification: { label: 'Verification',      badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',     description: 'Grounds every claim in a verbatim source quote. No quote = no fact.' },
  synthesis:    { label: 'Synthesis',          badge: 'bg-violet-50 text-violet-700 border-violet-200', description: 'Think-before-act: reason freely first, then call the structured output tool.' },
  matching:     { label: 'Service Matching',   badge: 'bg-amber-50 text-amber-700 border-amber-200',  description: 'Scores catalog services 0–100 against verified signals.' },
  pitching:     { label: 'Pitch Generation',   badge: 'bg-orange-50 text-orange-700 border-orange-200', description: 'Writes channel-specific outreach tied to evidence.' },
  reflection:   { label: 'Reflection / Critic', badge: 'bg-purple-50 text-purple-700 border-purple-200', description: 'Critic agent reviews and flags generic language. Auto-revises if quality < threshold.' },
};

const DEFAULT_PROMPTS: Record<string, string> = {
  verification: "You are a fact-checker. Extract only claims that are directly and verbatim supported by the source text. For each verified fact include an exact quote from the source as evidence.",
  synthesis:    "You are an expert sales researcher. First reason freely about what the verified facts reveal about this prospect's strategic priorities, pain points, and buying signals. Then call the tool.",
  matching:     "You are a service matching expert. Score each service in the catalog 0-100 based on how well it addresses the prospect's verified signals and pain points.",
  pitching:     "You are an expert sales copywriter. Draft a pitch that opens with the prospect's most striking verified signal. Every sentence must earn its place — no generic language.",
  reflection:   "You are a pitch critic. Flag any sentence that could be sent to ANY prospect unchanged. Every claim must be tied to a specific verified signal from this prospect.",
};

export default function PromptsPage() {
  const [prompts, setPrompts]   = useState<Record<string, string>>(DEFAULT_PROMPTS);
  const [original, setOriginal] = useState<Record<string, string>>(DEFAULT_PROMPTS);
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        const p = (s as { prompts: Record<string, string> }).prompts ?? DEFAULT_PROMPTS;
        setPrompts(p);
        setOriginal(p);
      })
      .catch(console.error);
  }, []);

  const handleSave = async (phase: string) => {
    setSaving(phase);
    try {
      await saveSettings({ promptOverrides: { [phase]: prompts[phase] } });
      setOriginal(o => ({ ...o, [phase]: prompts[phase] }));
      setSaved(phase);
      setTimeout(() => setSaved(null), 2500);
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (phase: string) => {
    setPrompts(p => ({ ...p, [phase]: DEFAULT_PROMPTS[phase] }));
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Prompt Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Edit the system prompt for each pipeline node. Changes apply to new runs immediately.
        </p>
      </div>

      <div className="space-y-4">
        {PHASE_ORDER.map((phase, idx) => {
          const meta     = PHASE_META[phase];
          const isDirty  = prompts[phase] !== original[phase];
          const isSaving = saving === phase;
          const isSaved  = saved === phase;

          return (
            <div key={phase} className="card p-0 overflow-hidden">
              {/* Header */}
              <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-indigo-600">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge border text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
                    {isDirty && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Unsaved changes</span>}
                    {isSaved && <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Saved</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                </div>
              </div>

              {/* Editable textarea */}
              <div className="px-5 py-4">
                <textarea
                  rows={4}
                  value={prompts[phase]}
                  onChange={e => setPrompts(p => ({ ...p, [phase]: e.target.value }))}
                  className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono leading-relaxed resize-y
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 focus:bg-white transition-all duration-150"
                  spellCheck={false}
                />
              </div>

              {/* Actions */}
              <div className="px-5 pb-4 flex items-center gap-3">
                <button
                  onClick={() => handleSave(phase)}
                  disabled={isSaving || !isDirty}
                  className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
                >
                  {isSaving ? 'Saving…' : 'Save Prompt'}
                </button>
                <button
                  onClick={() => handleReset(phase)}
                  disabled={prompts[phase] === DEFAULT_PROMPTS[phase]}
                  className="btn-ghost text-xs disabled:opacity-40"
                >
                  Reset to default
                </button>
                <span className="ml-auto text-xs text-gray-400">{prompts[phase].length} chars</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4 border-gray-100">
        <p className="text-xs font-medium text-gray-600 mb-1">About prompt management</p>
        <p className="text-xs text-gray-500">
          Prompt overrides are stored in memory and reset on server restart. For permanent changes, update the <code className="bg-gray-100 rounded px-1">SYSTEM_PROMPT</code> constant in each orchestrator node file. Runtime overrides take precedence.
        </p>
      </div>
    </div>
  );
}
