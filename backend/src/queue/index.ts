import { Queue } from 'bullmq';
import { config } from '../config';

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port || '6379', 10),
};

export const researchQueue = new Queue('prospect-research', { connection });

export async function enqueueRun(runId: string, lead: object): Promise<void> {
  await researchQueue.add('research', { runId, lead }, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
  });
}

export const orchestrationQueue = new Queue('orchestration', { connection });

export async function enqueueOrchestration(orchestrationId: string): Promise<void> {
  await orchestrationQueue.add('orchestrate', { orchestrationId }, { attempts: 1 });
}
