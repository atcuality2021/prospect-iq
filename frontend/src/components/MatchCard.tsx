import { ServiceMatch } from '@/lib/types';

export default function MatchCard({ match }: { match: ServiceMatch }) {
  const score      = Math.round(match.score);
  const confidence = Math.round(match.confidence ?? 0);

  const scoreGrade =
    score >= 80 ? { bg: 'from-green-400 to-emerald-500', ring: 'border-green-200 bg-green-50',  text: 'text-green-700' }
  : score >= 60 ? { bg: 'from-amber-400 to-orange-400',  ring: 'border-amber-200 bg-amber-50',  text: 'text-amber-700' }
  :               { bg: 'from-gray-300  to-gray-400',    ring: 'border-gray-200  bg-gray-50',   text: 'text-gray-500'  };

  const confColor =
    confidence >= 80 ? 'bg-green-50  border-green-200  text-green-700'
  : confidence >= 60 ? 'bg-amber-50  border-amber-200  text-amber-700'
  :                   'bg-gray-50   border-gray-200   text-gray-500';

  return (
    <div className={`card border p-5 space-y-3 ${scoreGrade.ring} animate-slide-up`}>
      <div className="flex items-start gap-4">
        {/* Score ring */}
        <div className="flex-shrink-0 relative w-14 h-14">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke="url(#scoreGrad)" strokeWidth="3"
              strokeDasharray={`${score} ${100 - score}`}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={score >= 80 ? '#4ade80' : score >= 60 ? '#fb923c' : '#9ca3af'} />
                <stop offset="100%" stopColor={score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#6b7280'} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-bold ${scoreGrade.text}`}>{score}</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-sm">{match.service.name}</h3>
            <span className="badge border-gray-200 bg-white text-gray-500 text-[11px]">
              {match.service.category}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-snug">{match.service.description}</p>
        </div>

        {/* Confidence */}
        <div className="flex-shrink-0">
          <span className={`badge border text-[11px] ${confColor}`}>
            {confidence}% conf.
          </span>
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-sm text-gray-700 leading-relaxed pl-1">{match.reasoning}</p>

      {/* Matched signals */}
      {match.matchedSignals.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {match.matchedSignals.map((s, i) => (
            <span key={i} className="badge border-brand-100 bg-brand-50 text-brand-600 text-[11px]">
              ✦ {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
