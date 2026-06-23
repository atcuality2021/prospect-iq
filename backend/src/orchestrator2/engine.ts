import { OrchestrationEvent, PlanTask } from '../types';
import { Tool, ToolResult } from './tools';
import { config } from '../config';
import { rankResults } from './aggregate';

// Run `fn` over items with at most `concurrency` in flight at once.
export async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < items.length) {
      const idx = next++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

export interface TaskResult {
  task: PlanTask;
  result: ToolResult;
}

export interface GoalGrade {
  met: boolean;
  reasoning: string;
  score: number;
}

// All deps are injected so the loop is unit-testable without an LLM or DB.
export interface EngineDeps {
  planner: (goal: string, hints?: Record<string, unknown>) => Promise<PlanTask[]>;
  replanner: (goal: string, plan: PlanTask[], results: TaskResult[]) => Promise<PlanTask[]>;
  grader: (goal: string, results: TaskResult[]) => Promise<GoalGrade>;
  synthesizer: (goal: string, results: TaskResult[]) => Promise<string>;
  tools: Record<string, Tool>;
}

export interface EngineInput {
  orchestrationId: string;
  goal: string;
  hints?: Record<string, unknown>;
  maxIterations: number;
  projectId?: string;
}

export interface EngineResult {
  plan: PlanTask[];
  iterations: number;
  goalMet: boolean;
  partial: boolean;
  finalAnswer: string;
}

export class OrchestrationEngine {
  private concurrency: number;

  constructor(
    private deps: EngineDeps,
    private emit: (e: OrchestrationEvent) => Promise<void>,
    opts: { concurrency?: number } = {},
  ) {
    this.concurrency = opts.concurrency ?? config.orchFanoutConcurrency;
  }

  async run(input: EngineInput): Promise<EngineResult> {
    const { orchestrationId, goal, hints, maxIterations, projectId } = input;
    await this.emit({ type: 'orchestration_start', message: goal, timestamp: new Date() });

    const plan = await this.deps.planner(goal, hints);
    await this.emit({ type: 'plan_created', data: { tasks: plan.length }, timestamp: new Date() });

    const results: TaskResult[] = [];
    let iterations = 0;
    let goalMet = false;

    while (iterations < maxIterations) {
      iterations++;

      const pending = plan.filter((t) => t.status === 'pending');
      await runPool(pending, this.concurrency, (task) => this.executeTask(task, results, orchestrationId, projectId));

      const grade = await this.deps.grader(goal, results);
      await this.emit({ type: 'goal_graded', data: grade, timestamp: new Date() });
      if (grade.met) { goalMet = true; break; }

      // Don't replan on the final iteration — queued tasks would never run and would
      // leave dangling 'pending' cards on a capped (partial) run.
      if (iterations >= maxIterations) break;

      // Adapt: ask the replanner for revised remaining work. Completed tasks are
      // preserved; only the pending set is replaced (replanner never touches done).
      const revised = await this.deps.replanner(goal, plan, results);
      const completed = plan.filter((t) => t.status !== 'pending');
      plan.length = 0;
      plan.push(...completed, ...revised);
      await this.emit({ type: 'plan_revised', data: { added: revised.length }, timestamp: new Date() });
    }

    const finalAnswer = await this.deps.synthesizer(goal, rankResults(results));
    const partial = !goalMet;
    await this.emit({ type: 'orchestration_complete', data: { goalMet, partial, iterations }, timestamp: new Date() });

    return { plan, iterations, goalMet, partial, finalAnswer };
  }

  private async executeTask(task: PlanTask, results: TaskResult[], orchestrationId: string, projectId?: string): Promise<void> {
    task.status = 'running';
    await this.emit({ type: 'task_start', taskId: task.id, message: task.rationale, timestamp: new Date() });

    const tool = this.deps.tools[task.tool];
    const toolResult: ToolResult = tool
      ? await tool(task.args, { emit: this.emit, orchestrationId, projectId })
      : { ok: false, summary: `Unknown tool: ${task.tool}` };

    task.childRunId = toolResult.childRunId;
    task.resultSummary = toolResult.summary;
    task.gatePassed = toolResult.ok;
    task.status = toolResult.ok ? 'done' : 'failed';
    results.push({ task, result: toolResult });

    await this.emit({
      type: toolResult.ok ? 'task_complete' : 'task_failed',
      taskId: task.id,
      data: { summary: toolResult.summary, gatePassed: toolResult.ok },
      timestamp: new Date(),
    });
  }
}
