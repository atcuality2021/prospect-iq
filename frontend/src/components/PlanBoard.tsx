'use client';
import Link from 'next/link';
import { OrchestrationRun, PlanTask } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-50 border-gray-200 text-gray-400',
  running: 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse',
  done:    'bg-green-50 border-green-200 text-green-700',
  failed:  'bg-red-50 border-red-100 text-red-500',
  skipped: 'bg-gray-50 border-gray-100 text-gray-300',
};

function TaskCard({ task }: { task: PlanTask }) {
  return (
    <div className={`rounded-xl border p-3 ${STATUS_STYLES[task.status] ?? STATUS_STYLES.pending}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{task.tool}</span>
        <span className="text-[11px] uppercase font-bold tracking-wide">{task.status}</span>
      </div>
      <p className="text-xs mt-1 opacity-80">{task.rationale}</p>
      {task.resultSummary && <p className="text-xs mt-1.5 text-gray-700">{task.resultSummary}</p>}
      {task.childRunId && (
        <Link href={`/runs/${task.childRunId}`} className="text-xs text-indigo-600 hover:underline mt-1.5 inline-block">
          View research run →
        </Link>
      )}
    </div>
  );
}

export default function PlanBoard({ run }: { run: OrchestrationRun }) {
  const running = run.status !== 'completed' && run.status !== 'failed';
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Goal</p>
            <p className="text-sm text-gray-900 mt-0.5">{run.goal}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {run.partial && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠ goal partially met</span>
            )}
            {run.goalMet && (
              <span className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">✓ goal met</span>
            )}
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${running ? 'text-blue-600 bg-blue-50 border border-blue-100 animate-pulse' : 'text-gray-500 bg-gray-50 border border-gray-100'}`}>
              {run.status}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2 font-mono">iteration {run.iterations}/{run.maxIterations}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Plan ({run.plan.length} {run.plan.length === 1 ? 'task' : 'tasks'})
        </p>
        {run.plan.length === 0
          ? <p className="text-sm text-gray-400">{running ? 'Planning…' : 'No tasks.'}</p>
          : run.plan.map((t) => <TaskCard key={t.id} task={t} />)}
      </div>

      {run.finalAnswer && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Final answer</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{run.finalAnswer}</p>
        </div>
      )}
    </div>
  );
}
