import { Worker } from 'bullmq';
import { config } from '../config';
import { connectMongo } from '../db/mongo';
import { OrchestrationRunModel } from '../db/models/orchestrationRun';
import { OrchestrationEngine, EngineDeps } from '../orchestrator2/engine';
import { planGoal } from '../orchestrator2/planner';
import { replan } from '../orchestrator2/replanner';
import { gradeGoal } from '../orchestrator2/goal-grader';
import { synthesize } from '../orchestrator2/synthesizer';
import { TOOLS } from '../orchestrator2/tools';
import { emitOrchestrationEvent } from '../events/emitter';
import { OrchestrationEvent } from '../types';

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port || '6379', 10),
};

// Real LLM/DB-backed dependencies. Unit tests inject mocks instead.
const deps: EngineDeps = {
  planner: (goal, hints) => planGoal(goal, hints, config.orchMaxTargets),
  replanner: replan,
  grader: gradeGoal,
  synthesizer: synthesize,
  tools: TOOLS,
};

async function startWorker(): Promise<void> {
  await connectMongo();

  const worker = new Worker(
    'orchestration',
    async (job) => {
      const { orchestrationId } = job.data as { orchestrationId: string };
      const doc = await OrchestrationRunModel.findOne({ orchestrationId });
      if (!doc) return;

      await OrchestrationRunModel.updateOne({ orchestrationId }, { status: 'planning' });

      const emit = async (event: OrchestrationEvent): Promise<void> => {
        emitOrchestrationEvent(orchestrationId, event);
        await OrchestrationRunModel.updateOne({ orchestrationId }, { $push: { events: event } });
      };

      const engine = new OrchestrationEngine(deps, emit);
      try {
        const result = await engine.run({
          orchestrationId,
          goal: doc.goal,
          hints: doc.hints,
          maxIterations: doc.maxIterations || config.orchMaxIterations,
          projectId: doc.projectId,
        });
        await OrchestrationRunModel.updateOne({ orchestrationId }, {
          status: 'completed',
          plan: result.plan,
          iterations: result.iterations,
          goalMet: result.goalMet,
          partial: result.partial,
          finalAnswer: result.finalAnswer,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await emit({ type: 'orchestration_failed', message, timestamp: new Date() });
        await OrchestrationRunModel.updateOne({ orchestrationId }, { status: 'failed' });
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.error(`Orchestration ${job?.id} failed:`, err.message);
  });

  console.log('Orchestration worker started');
}

startWorker().catch(console.error);
