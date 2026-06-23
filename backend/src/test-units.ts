/**
 * LLM-free unit tests for Phase A gate logic.
 * Run: npm run test:units   (from backend/)
 */
import { runGate } from './orchestrator/gate';
import { RunEvent } from './types';
import { config } from './config';
import { buildVerificationPrompt } from './orchestrator/nodes/verification';
import { gradeResearch, evaluatePitchCritique } from './orchestrator/grading';
import { gradePipelineResult } from './orchestrator2/result-gate';
import { OrchestrationEngine, EngineDeps } from './orchestrator2/engine';
import { PlanTask } from './types';
import { buildPlannerPrompt } from './orchestrator2/planner';
import { buildReplanPrompt } from './orchestrator2/replanner';

let passed = 0;
let failed = 0;

function assert(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? `  →  ${detail}` : ''}`);
  cond ? passed++ : failed++;
}

// ── gate primitive ──────────────────────────────────────────────────────────
type S = { value: number };

async function gateTests() {
  // 1. pass on first grade → no revision
  {
    const events: RunEvent[] = [];
    let reviserCalls = 0;
    const out = await runGate<S>({ value: 5 }, {
      name: 'g',
      grader: async (s) => ({ pass: s.value >= 3, score: s.value, feedback: 'ok' }),
      reviser: async (s) => { reviserCalls++; return { value: s.value + 1 }; },
      maxRevisions: 2,
      emit: async (e) => { events.push(e); },
    });
    assert('pass-first: passed=true', out.passed === true);
    assert('pass-first: 1 attempt', out.attempts.length === 1, `got ${out.attempts.length}`);
    assert('pass-first: reviser never called', reviserCalls === 0);
    assert('pass-first: emits gate_start + gate_attempt + gate_pass',
      events.map((e) => e.type).join(',') === 'gate_start,gate_attempt,gate_pass',
      events.map((e) => e.type).join(','));
  }

  // 2. fail then pass after revisions
  {
    let reviserCalls = 0;
    const out = await runGate<S>({ value: 1 }, {
      name: 'g',
      grader: async (s) => ({ pass: s.value >= 3, score: s.value, feedback: 'x' }),
      reviser: async (s) => { reviserCalls++; return { value: s.value + 1 }; },
      maxRevisions: 3,
      emit: async () => {},
    });
    assert('fail-then-pass: passed=true', out.passed === true);
    assert('fail-then-pass: 3 attempts', out.attempts.length === 3, `got ${out.attempts.length}`);
    assert('fail-then-pass: 2 revisions', reviserCalls === 2, `got ${reviserCalls}`);
    assert('fail-then-pass: final state value=3', out.state.value === 3, `got ${out.state.value}`);
  }

  // 3. never pass → exhausts to maxRevisions
  {
    let reviserCalls = 0;
    const events: RunEvent[] = [];
    const out = await runGate<S>({ value: 0 }, {
      name: 'g',
      grader: async (s) => ({ pass: false, score: s.value, feedback: 'never' }),
      reviser: async (s) => { reviserCalls++; return { value: s.value }; },
      maxRevisions: 2,
      emit: async (e) => { events.push(e); },
    });
    assert('exhaust: passed=false', out.passed === false);
    assert('exhaust: 3 attempts (1 + 2 revisions)', out.attempts.length === 3, `got ${out.attempts.length}`);
    assert('exhaust: reviser called twice', reviserCalls === 2, `got ${reviserCalls}`);
    assert('exhaust: terminal event is gate_fail',
      events[events.length - 1].type === 'gate_fail', events[events.length - 1].type);
  }

  // 4. maxRevisions=0 → single pass, never revises
  {
    let reviserCalls = 0;
    const out = await runGate<S>({ value: 0 }, {
      name: 'g',
      grader: async (s) => ({ pass: false, score: s.value, feedback: 'single' }),
      reviser: async (s) => { reviserCalls++; return { value: s.value }; },
      maxRevisions: 0,
      emit: async () => {},
    });
    assert('disabled: 1 attempt', out.attempts.length === 1, `got ${out.attempts.length}`);
    assert('disabled: reviser never called', reviserCalls === 0);
    assert('disabled: passed=false', out.passed === false);
  }
}

// ── config ──────────────────────────────────────────────────────────────────
async function configTests() {
  assert('config.gates.minVerifiedFacts default 2', config.gates.minVerifiedFacts === 2, `got ${config.gates.minVerifiedFacts}`);
  assert('config.gates.researchRevisions default 1', config.gates.researchRevisions === 1, `got ${config.gates.researchRevisions}`);
  assert('config.gates.pitchRevisions default 2', config.gates.pitchRevisions === 2, `got ${config.gates.pitchRevisions}`);
  assert('config.gates.pitchQualityThreshold default 70', config.gates.pitchQualityThreshold === 70, `got ${config.gates.pitchQualityThreshold}`);
}

// ── verification prompt builder ───────────────────────────────────────────────
async function verificationTests() {
  const sources = [{ source: 'website', text: 'Acme builds rockets.' }];
  const p60 = buildVerificationPrompt(sources, 60);
  const p40 = buildVerificationPrompt(sources, 40);
  assert('prompt includes floor 60', p60.includes('confidence ≥ 60'));
  assert('relaxed prompt includes floor 40', p40.includes('confidence ≥ 40'));
  assert('prompt includes source header', p60.includes('=== WEBSITE ==='));
  assert('prompt includes source text', p60.includes('Acme builds rockets.'));
}

// ── graders ───────────────────────────────────────────────────────────────────
async function gradingTests() {
  const fail = gradeResearch(0, 2);
  assert('gradeResearch 0/2 fails', fail.pass === false);
  assert('gradeResearch fail score = count', fail.score === 0);
  const pass = gradeResearch(3, 2);
  assert('gradeResearch 3/2 passes', pass.pass === true);
  const edge = gradeResearch(2, 2);
  assert('gradeResearch 2/2 passes (>=)', edge.pass === true);

  const base = { missingSignalRefs: [], ctaStrength: 'strong' as const, needsRevision: false, summaryNotes: 'n' };
  const good = evaluatePitchCritique({ ...base, genericLanguageIssues: [], overallQuality: 80 }, 70);
  assert('pitch 80>=70 & no generic → pass', good.pass === true);
  assert('pitch pass score=80', good.score === 80);
  const lowScore = evaluatePitchCritique({ ...base, genericLanguageIssues: [], overallQuality: 60 }, 70);
  assert('pitch 60<70 → fail', lowScore.pass === false);
  const generic = evaluatePitchCritique({ ...base, genericLanguageIssues: ['Dear Sir'], overallQuality: 90 }, 70);
  assert('pitch high score but generic language → fail', generic.pass === false);
}

// ── orchestrator2: result gate ────────────────────────────────────────────────
async function resultGateTests() {
  const pitch = { channel: 'email' as const, body: 'b', callToAction: 'c', personalizationPoints: [], score: 80 };
  assert('result-gate: pitch + confident → pass', gradePipelineResult({ pitch, lowConfidence: false }).pass === true);
  assert('result-gate: pitch score passes through', gradePipelineResult({ pitch, lowConfidence: false }).score === 80);
  assert('result-gate: pitch but lowConfidence → fail', gradePipelineResult({ pitch, lowConfidence: true }).pass === false);
  assert('result-gate: no pitch → fail', gradePipelineResult({ pitch: undefined, lowConfidence: false }).pass === false);
}

// ── orchestrator2: engine ─────────────────────────────────────────────────────
function mkTask(id: string): PlanTask {
  return { id, tool: 'run_research_pipeline', args: {}, rationale: 'r', status: 'pending' };
}
function mkDeps(over: Partial<EngineDeps>): EngineDeps {
  return {
    planner: async () => [mkTask('t1')],
    replanner: async () => [],
    grader: async () => ({ met: true, reasoning: 'ok', score: 100 }),
    synthesizer: async () => 'final',
    tools: { run_research_pipeline: async () => ({ ok: true, summary: 's', childRunId: 'r1' }) },
    ...over,
  };
}

async function engineTests() {
  // stop-on-met
  {
    const eng = new OrchestrationEngine(mkDeps({}), async () => {});
    const out = await eng.run({ orchestrationId: 'o1', goal: 'g', maxIterations: 6 });
    assert('engine stop-on-met: goalMet=true', out.goalMet === true);
    assert('engine stop-on-met: 1 iteration', out.iterations === 1, `got ${out.iterations}`);
    assert('engine stop-on-met: task done', out.plan[0].status === 'done');
    assert('engine stop-on-met: finalAnswer set', out.finalAnswer === 'final');
  }
  // stop-on-cap
  {
    const eng = new OrchestrationEngine(
      mkDeps({ grader: async () => ({ met: false, reasoning: 'no', score: 0 }) }),
      async () => {},
    );
    const out = await eng.run({ orchestrationId: 'o2', goal: 'g', maxIterations: 3 });
    assert('engine stop-on-cap: goalMet=false', out.goalMet === false);
    assert('engine stop-on-cap: partial=true', out.partial === true);
    assert('engine stop-on-cap: iterations=3', out.iterations === 3, `got ${out.iterations}`);
  }
}

async function engineReplanTests() {
  // replan-applied: grader meets on 2nd pass; replanner injects a new pending task.
  {
    let graderCalls = 0;
    const eng = new OrchestrationEngine(
      mkDeps({
        grader: async () => { graderCalls++; return { met: graderCalls >= 2, reasoning: 'r', score: 50 }; },
        replanner: async () => [mkTask('t2')],
      }),
      async () => {},
    );
    const out = await eng.run({ orchestrationId: 'o3', goal: 'g', maxIterations: 6 });
    assert('engine replan: 2 iterations', out.iterations === 2, `got ${out.iterations}`);
    assert('engine replan: injected task ran (2 tasks done)',
      out.plan.length === 2 && out.plan.every((t) => t.status === 'done'),
      out.plan.map((t) => `${t.id}:${t.status}`).join(','));
    assert('engine replan: t2 present', out.plan.some((t) => t.id === 't2'));
  }
  // status-transition: a failing tool marks the task failed, not done.
  {
    const eng = new OrchestrationEngine(
      mkDeps({ tools: { run_research_pipeline: async () => ({ ok: false, summary: 'no pitch' }) } }),
      async () => {},
    );
    const out = await eng.run({ orchestrationId: 'o4', goal: 'g', maxIterations: 1 });
    assert('engine status: failed task → status=failed', out.plan[0].status === 'failed');
    assert('engine status: failed task → gatePassed=false', out.plan[0].gatePassed === false);
  }
}

// ── orchestrator2: planner / replanner prompt builders ────────────────────────
async function plannerTests() {
  const p = buildPlannerPrompt('Research Stripe', { company: 'Stripe' });
  assert('planner prompt includes goal', p.includes('Research Stripe'));
  assert('planner prompt names the tool', p.includes('run_research_pipeline'));
  assert('planner prompt includes hints', p.includes('"company":"Stripe"') || p.includes('Stripe'));
  const rp = buildReplanPrompt('Outreach goal', [{ summary: 'did X', ok: true }]);
  assert('replan prompt includes goal', rp.includes('Outreach goal'));
  assert('replan prompt includes completed summary', rp.includes('did X'));
  assert('replan prompt empty → nothing yet', buildReplanPrompt('G', []).includes('nothing yet'));
}

async function main() {
  await gateTests();
  await configTests();
  await verificationTests();
  await gradingTests();
  await resultGateTests();
  await engineTests();
  await engineReplanTests();
  await plannerTests();
  console.log(`\n${passed}/${passed + failed} passed${failed ? ` — ${failed} FAILED` : ' 🎉'}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
