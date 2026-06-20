import { Worker } from 'bullmq';
import { config } from '../config';
import { connectMongo } from '../db/mongo';
import { RunModel } from '../db/models/run';
import { ProspectOrchestrator } from '../orchestrator';
import { emitRunEvent } from '../events/emitter';
import { RunEvent, Lead } from '../types';

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port || '6379', 10),
};

async function startWorker() {
  await connectMongo();

  const worker = new Worker(
    'prospect-research',
    async (job) => {
      const { runId, lead } = job.data as { runId: string; lead: Lead };

      await RunModel.updateOne({ runId }, { status: 'researching' });

      const orchestrator = new ProspectOrchestrator(runId, lead, async (event: RunEvent) => {
        emitRunEvent(runId, event);
        await RunModel.updateOne({ runId }, {
          $push: { events: event },
          ...(event.type === 'phase_start' && {
            status:
              event.phase === 'research' ? 'researching' :
              event.phase === 'verifying' ? 'verifying' :
              event.phase === 'synthesis' ? 'synthesizing' :
              event.phase === 'matching' ? 'matching' :
              event.phase === 'pitching' ? 'pitching' :
              event.phase === 'reflecting' ? 'reflecting' :
              undefined,
          }),
        });
      });

      const finalState = await orchestrator.run();
      const failed = finalState.errors.length > 0 && !finalState.pitch;

      await RunModel.updateOne({ runId }, {
        status: failed ? 'failed' : 'completed',
        research: finalState.research,
        verification: finalState.verification,
        profile: finalState.profile,
        matches: finalState.matches,
        pitch: finalState.pitch,
        ...(failed && { error: finalState.errors.join('; ') }),
      });
    },
    { connection, concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  console.log('Worker started');
}

startWorker().catch(console.error);
