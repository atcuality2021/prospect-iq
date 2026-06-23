import { OrchestrationEvent, PlanTask } from '../types';
import { Tool, ToolResult } from './tools';

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
}

export interface EngineResult {
  plan: PlanTask[];
  iterations: number;
  goalMet: boolean;
  partial: boolean;
  finalAnswer: string;
}

export class OrchestrationEngine {
  constructor(
    private deps: EngineDeps,
    private emit: (e: OrchestrationEvent) => Promise<void>,
  ) {}

  async run(input: EngineInput): Promise<EngineResult> {
    const { orchestrationId, goal, hints, maxIterations } = input;
    await this.emit({ type: 'orchestration_start', message: goal, timestamp: new Date() });

    const plan = await this.deps.planner(goal, hints);
    await this.emit({ type: 'plan_created', data: { tasks: plan.length }, timestamp: new Date() });

    const results: TaskResult[] = [];
    let iterations = 0;
    let goalMet = false;

    while (iterations < maxIterations) {
      iterations++;

      for (const task of plan.filter((t) => t.status === 'pending')) {
        await this.executeTask(task, results, orchestrationId);
      }

      const grade = await this.deps.grader(goal, results);
      await this.emit({ type: 'goal_graded', data: grade, timestamp: new Date() });
      if (grade.met) { goalMet = true; break; }

      // Step 3b wires the replan step in here.
    }

    const finalAnswer = await this.deps.synthesizer(goal, results);
    const partial = !goalMet;
    await this.emit({ type: 'orchestration_complete', data: { goalMet, partial, iterations }, timestamp: new Date() });

    return { plan, iterations, goalMet, partial, finalAnswer };
  }

  private async executeTask(task: PlanTask, results: TaskResult[], orchestrationId: string): Promise<void> {
    task.status = 'running';
    await this.emit({ type: 'task_start', taskId: task.id, message: task.rationale, timestamp: new Date() });

    const tool = this.deps.tools[task.tool];
    const toolResult: ToolResult = tool
      ? await tool(task.args, { emit: this.emit, orchestrationId })
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
