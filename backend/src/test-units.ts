/**
 * LLM-free unit tests for Phase A gate logic.
 * Run: npm run test:units   (from backend/)
 */
import { runGate } from './orchestrator/gate';
import { RunEvent } from './types';
import { config } from './config';
import { buildVerificationPrompt } from './orchestrator/nodes/verification';
import { gradeResearch } from './orchestrator/grading';

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
}

async function main() {
  await gateTests();
  await configTests();
  await verificationTests();
  await gradingTests();
  console.log(`\n${passed}/${passed + failed} passed${failed ? ` — ${failed} FAILED` : ' 🎉'}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
