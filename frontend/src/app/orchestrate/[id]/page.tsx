'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getOrchestration } from '@/lib/api';
import { OrchestrationRun } from '@/lib/types';
import PlanBoard from '@/components/PlanBoard';

export default function OrchestrationDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [run, setRun] = useState<OrchestrationRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const r = await getOrchestration(id);
        if (!active) return;
        setRun(r);
        if (r.status !== 'completed' && r.status !== 'failed') {
          timer = setTimeout(poll, 1500);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load');
      }
    }

    poll();
    return () => { active = false; clearTimeout(timer); };
  }, [id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!run) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6 animate-slide-up">
      <h1 className="text-2xl font-bold text-gray-900">Orchestration</h1>
      <PlanBoard run={run} />
    </div>
  );
}
