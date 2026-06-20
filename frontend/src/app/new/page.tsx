'use client';
import { useRouter } from 'next/navigation';
import LeadForm from '@/components/LeadForm';

export default function NewResearchPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Research</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Fill in what you know — more data gives agents more to work with
        </p>
      </div>

      {/* Pipeline preview strip */}
      <div className="card px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">What happens next</p>
        <div className="flex items-center gap-0 flex-wrap">
          {[
            { icon: '🔍', label: 'Research',    color: 'text-blue-600   bg-blue-50'   },
            { icon: '✓',  label: 'Verify',      color: 'text-cyan-600   bg-cyan-50'   },
            { icon: '⚡', label: 'Synthesize',  color: 'text-violet-600 bg-violet-50' },
            { icon: '⇄',  label: 'Match',       color: 'text-amber-600  bg-amber-50'  },
            { icon: '✉',  label: 'Pitch',       color: 'text-orange-600 bg-orange-50' },
            { icon: '◎',  label: 'Reflect',     color: 'text-purple-600 bg-purple-50' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${step.color}`}>
                <span>{step.icon}</span>
                <span>{step.label}</span>
              </div>
              {i < arr.length - 1 && (
                <svg className="w-4 h-4 text-gray-300 mx-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      <LeadForm onSubmit={(id) => router.push(`/runs/${id}`)} />
    </div>
  );
}
