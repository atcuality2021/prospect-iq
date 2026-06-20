'use client';
import { useState } from 'react';
import { Pitch } from '@/lib/types';

const CHANNEL_META: Record<string, { icon: string; label: string; color: string }> = {
  email:    { icon: '✉',  label: 'Email',       color: 'text-blue-600   bg-blue-50   border-blue-100'   },
  linkedin: { icon: '💼', label: 'LinkedIn DM', color: 'text-sky-600    bg-sky-50    border-sky-100'    },
  twitter:  { icon: '𝕏',  label: 'Twitter/X',   color: 'text-gray-700  bg-gray-50   border-gray-200'   },
};

export default function PitchOutput({ pitch }: { pitch: Pitch }) {
  const [copied, setCopied]       = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const ch = CHANNEL_META[pitch.channel] ?? CHANNEL_META.email;

  const copyText = pitch.subject
    ? `Subject: ${pitch.subject}\n\n${pitch.body}`
    : pitch.body;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([copyText], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `pitch-${pitch.channel}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card p-6 space-y-5 animate-slide-up">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`badge border ${ch.color}`}>
            {ch.icon} {ch.label}
          </span>
          {pitch.revised ? (
            <span className="badge border border-violet-200 bg-violet-50 text-violet-700">
              ✦ auto-revised
            </span>
          ) : pitch.reflectionNotes ? (
            <span className="badge border border-green-200 bg-green-50 text-green-700">
              ✓ passed review
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {pitch.reflectionNotes && (
            <button className="btn-ghost text-xs" onClick={() => setShowNotes((s) => !s)}>
              {showNotes ? 'Hide' : 'Critic'} notes
            </button>
          )}
          <button className="btn-ghost text-xs" onClick={handleCopy}>
            {copied ? (
              <><span className="text-green-500">✓</span> Copied!</>
            ) : (
              <><CopyIcon /> Copy</>
            )}
          </button>
          <button className="btn-ghost text-xs" onClick={handleExport} title="Download as .txt">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Critic notes */}
      {showNotes && pitch.reflectionNotes && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 animate-fade-in">
          <p className="section-label mb-1.5">Critic assessment</p>
          <p className="text-sm text-gray-600 leading-relaxed">{pitch.reflectionNotes}</p>
        </div>
      )}

      {/* Email frame */}
      <div className="border border-gray-100 rounded-2xl overflow-hidden">
        {/* Subject bar */}
        {pitch.subject && (
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
            <p className="section-label mb-0.5">Subject</p>
            <p className="text-sm font-medium text-gray-900">{pitch.subject}</p>
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4 bg-white">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-[inherit] leading-relaxed">
            {pitch.body}
          </pre>
        </div>

        {/* CTA strip */}
        <div className="px-5 py-3.5 border-t border-brand-100 bg-gradient-to-r from-brand-50 to-violet-50">
          <p className="section-label text-brand-500 mb-0.5">Call to Action</p>
          <p className="text-sm text-brand-800 font-medium">{pitch.callToAction}</p>
        </div>
      </div>

      {/* Personalisation points */}
      {pitch.personalizationPoints.length > 0 && (
        <div>
          <p className="section-label mb-2.5">Personalisation used</p>
          <ul className="space-y-1.5">
            {pitch.personalizationPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="mt-0.5 text-brand-400 flex-shrink-0">✦</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}
