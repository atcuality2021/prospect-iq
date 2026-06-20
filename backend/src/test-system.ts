/**
 * End-to-end system test — every layer: LLM client → agents → nodes → full pipeline.
 * Run: ts-node -r tsconfig-paths/register src/test-system.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { callText, callWithTool } from './llm/client';
import { runWebsiteAgent } from './agents/website';
import { runNewsAgent } from './agents/news';
import { runLinkedInAgent } from './agents/linkedin';
import { runYouTubeAgent } from './agents/youtube';
import { verificationNode } from './orchestrator/nodes/verification';
import { synthesisNode } from './orchestrator/nodes/synthesis';
import { pitchNode } from './orchestrator/nodes/pitch';
import { reflectionNode } from './orchestrator/nodes/reflection';
import { OrchestratorState, RunEvent } from './types';
import { config } from './config';

// ── helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function log(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? `  →  ${detail}` : ''}`);
  ok ? passed++ : failed++;
}

async function test(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    log(label, true);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(label, false, msg.slice(0, 140));
  }
}

const emit = async (_e: RunEvent) => {};

function makeState(overrides: Partial<OrchestratorState> = {}): OrchestratorState {
  return {
    runId: 'test-run',
    lead: { url: 'https://stripe.com', company: 'Stripe', channel: 'email', tone: 'professional' },
    research: {},
    matches: [],
    events: [],
    errors: [],
    ...overrides,
  };
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {

  // 1. Config
  section('1. Config');
  console.log(`  Provider : ${config.provider}`);
  console.log(`  Model    : ${config.provider === 'openai' ? config.openaiModel : config.anthropicModel}`);
  console.log(`  Base URL : ${config.openaiBaseUrl ?? '(default OpenAI)'}`);

  // 2. LLM client
  section('2. LLM Client');

  await test('callText — basic response', async () => {
    const result = await callText(
      [{ role: 'user', content: 'Reply with exactly the word PONG and nothing else.' }],
      50,
    );
    if (!result.toLowerCase().includes('pong')) throw new Error(`Unexpected: "${result}"`);
  });

  await test('callWithTool — structured extraction', async () => {
    const result = await callWithTool<{ city: string; country: string }>(
      [{ role: 'user', content: 'Extract location from: "Our HQ is in San Francisco, USA."' }],
      {
        name: 'extract_location',
        description: 'Extract city and country',
        schema: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['city', 'country'],
        },
      },
      200,
    );
    if (!result.city || !result.country) throw new Error(`Missing fields: ${JSON.stringify(result)}`);
    console.log(`     city=${result.city}  country=${result.country}`);
  });

  await test('callWithTool — nested array schema', async () => {
    const result = await callWithTool<{ items: Array<{ name: string; price: number }> }>(
      [{ role: 'user', content: 'List these products with prices: MacBook $999, iPhone $799' }],
      {
        name: 'list_products',
        description: 'List products with names and prices',
        schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  price: { type: 'number' },
                },
                required: ['name', 'price'],
              },
            },
          },
          required: ['items'],
        },
      },
      400,
    );
    if (!Array.isArray(result.items) || result.items.length === 0) throw new Error('Empty items');
    console.log(`     items: ${result.items.map((i) => `${i.name}=$${i.price}`).join(', ')}`);
  });

  // 3. Research agents
  section('3. Research Agents');

  let websiteData: Awaited<ReturnType<typeof runWebsiteAgent>> | undefined;

  await test('website agent — fetch stripe.com', async () => {
    websiteData = await runWebsiteAgent({ url: 'https://stripe.com', company: 'Stripe' });
    if (websiteData.error && !websiteData.raw) throw new Error(websiteData.error);
    if (!websiteData.raw) throw new Error('Empty raw content');
    console.log(`     chars=${websiteData.raw.length}  citations=${websiteData.citations.length}`);
  });

  await test('news agent — no SERPAPI key → graceful skip', async () => {
    const data = await runNewsAgent({ company: 'Stripe' });
    if (data.error && !data.skipped) throw new Error(data.error);
    console.log(`     skipped=${data.skipped ?? false}  chars=${data.raw.length}`);
  });

  await test('linkedin agent — no URL → skipped', async () => {
    const data = await runLinkedInAgent({});
    if (!data.skipped) throw new Error('Expected skipped=true when no URL provided');
  });

  await test('linkedin agent — with URL (access may be restricted)', async () => {
    const data = await runLinkedInAgent({ linkedinUrl: 'https://linkedin.com/company/stripe' });
    console.log(`     skipped=${data.skipped ?? false}  restricted=${data.error ? 'yes' : 'no'}  chars=${data.raw.length}`);
  });

  await test('youtube agent — no key → graceful skip', async () => {
    const data = await runYouTubeAgent({ company: 'Stripe' });
    if (data.error && !data.skipped) throw new Error(data.error);
  });

  // 4. Verification node
  section('4. Verification Node');

  let verificationState: OrchestratorState | undefined;

  await test('verification — extracts grounded facts with evidence quotes', async () => {
    const state = makeState({
      research: {
        website: websiteData ?? {
          source: 'website',
          raw: 'Stripe is a financial infrastructure platform for businesses. Millions of companies use Stripe to accept payments, send payouts, and manage their businesses online. Stripe is headquartered in San Francisco.',
          citations: [{ text: 'Stripe', url: 'https://stripe.com' }],
        },
      },
    });

    const update = await verificationNode(state, emit);
    const v = update.verification;
    if (!v) throw new Error('No verification result returned');

    verificationState = { ...state, ...update };
    console.log(`     facts=${v.verifiedFacts.length}  discarded=${v.discardedClaims.length}  quality=${v.qualityScore}`);

    if (v.verifiedFacts.length > 0) {
      const f = v.verifiedFacts[0];
      console.log(`     sample claim : "${f.claim.slice(0, 70)}"`);
      console.log(`     evidence quote: "${f.evidenceQuote.slice(0, 70)}"`);
      console.log(`     confidence   : ${f.confidence}%`);
    }

    if (v.verifiedFacts.length === 0) throw new Error('No verified facts extracted from clear source text');
  });

  // 5. Synthesis node
  section('5. Synthesis Node (think-before-act)');

  let synthesisState: OrchestratorState | undefined;

  await test('synthesis — produces grounded prospect profile', async () => {
    const state = verificationState ?? makeState({
      verification: {
        verifiedFacts: [
          { claim: 'Stripe is a financial infrastructure platform', source: 'website', evidenceQuote: 'financial infrastructure platform for businesses', confidence: 95 },
          { claim: 'Millions of companies use Stripe to accept payments', source: 'website', evidenceQuote: 'Millions of companies use Stripe to accept payments', confidence: 90 },
          { claim: 'Stripe is headquartered in San Francisco', source: 'website', evidenceQuote: 'Stripe is headquartered in San Francisco', confidence: 95 },
        ],
        discardedClaims: [],
        qualityScore: 85,
      },
    });

    const update = await synthesisNode(state, emit);
    const p = update.profile;
    if (!p) throw new Error('No profile returned');
    if (!p.company) throw new Error('Profile missing company');
    if (!p.summary) throw new Error('Profile missing summary');
    if (!Array.isArray(p.signals)) throw new Error('Profile missing signals');

    synthesisState = { ...state, ...update };
    console.log(`     company=${p.company}  signals=${p.signals.length}  painPoints=${p.painPoints.length}`);
    console.log(`     summary: "${p.summary.slice(0, 100)}"`);

    if (p.signals.length > 0) {
      const s = p.signals[0];
      const hasQuote = Boolean(s.evidenceQuote);
      const hasConf  = typeof s.confidence === 'number';
      console.log(`     signal[0]: "${s.title}" conf=${s.confidence}%  hasQuote=${hasQuote}`);
      if (!hasQuote) throw new Error('Signal missing evidenceQuote — grounding broken');
      if (!hasConf)  throw new Error('Signal missing confidence score');
    }
  });

  // 6. Pitch node
  section('6. Pitch Node');

  let pitchState: OrchestratorState | undefined;

  await test('pitch — generates email pitch referencing signals', async () => {
    const state = synthesisState ?? makeState({
      profile: {
        name: 'Stripe Team',
        company: 'Stripe',
        summary: 'Stripe is a financial infrastructure platform used by millions of businesses.',
        signals: [{
          title: 'Payments infrastructure at scale',
          description: 'Powers payments for millions of businesses globally',
          source: 'website',
          relevance: 'high',
          confidence: 95,
          evidenceQuote: 'financial infrastructure platform for businesses',
        }],
        painPoints: ['Managing global payment complexity', 'Fraud prevention at scale'],
        opportunities: ['Revenue intelligence', 'Payment analytics automation'],
      },
      matches: [{
        service: {
          name: 'Revenue Intelligence Platform',
          description: 'ML-driven analytics for payment companies',
          category: 'Analytics',
          targetAudience: 'Fintech companies',
          painPointsAddressed: ['Payment visibility', 'Fraud detection'],
          deliverables: ['Dashboard', 'API', 'Alerts'],
          keywords: ['fintech', 'payments', 'ML'],
        },
        score: 88,
        confidence: 85,
        reasoning: 'Stripe processes billions in payments and needs deeper analytics',
        matchedSignals: ['Payments infrastructure at scale'],
      }],
    });

    const update = await pitchNode(state, emit);
    const pitch = update.pitch;
    if (!pitch) throw new Error('No pitch returned');
    if (!pitch.body || pitch.body.length < 50) throw new Error('Pitch body too short');
    if (!pitch.callToAction) throw new Error('Missing CTA');
    if (!Array.isArray(pitch.personalizationPoints) || pitch.personalizationPoints.length === 0) {
      throw new Error('Missing personalization points');
    }

    pitchState = { ...state, ...update };
    console.log(`     channel=${pitch.channel}  bodyLen=${pitch.body.length}  personalizations=${pitch.personalizationPoints.length}`);
    if (pitch.subject) console.log(`     subject: "${pitch.subject}"`);
    console.log(`     CTA: "${pitch.callToAction.slice(0, 80)}"`);
  });

  // 7. Reflection node
  section('7. Reflection Node (reflexive loop)');

  let reflectedState: OrchestratorState | undefined;

  await test('reflection — critiques pitch and returns structured notes', async () => {
    const state = pitchState ?? makeState();
    if (!state.pitch) throw new Error('No pitch state available for reflection');

    const update = await reflectionNode(state, emit);
    const pitch = update.pitch ?? state.pitch;
    if (!pitch) throw new Error('No pitch after reflection');

    reflectedState = { ...state, ...update };
    console.log(`     revised=${pitch.revised ?? false}`);
    console.log(`     notes: "${(pitch.reflectionNotes ?? '').slice(0, 120)}"`);
  });

  // 8. Full pipeline
  section('8. Full Pipeline (website → verify → synthesize → pitch → reflect)');

  await test('end-to-end: Stripe lead produces final pitch', async () => {
    const lead = { url: 'https://stripe.com', company: 'Stripe', channel: 'email' as const, tone: 'professional' as const };
    let state = makeState({ lead });

    // Research
    const website = await runWebsiteAgent(lead);
    state = { ...state, research: { website } };
    if (!website.raw) throw new Error('Website agent returned no content');

    // Verify
    const vUp = await verificationNode(state, emit);
    state = { ...state, ...vUp };
    if (!state.verification) throw new Error('Verification returned nothing');

    // Synthesize
    const sUp = await synthesisNode(state, emit);
    state = { ...state, ...sUp };
    if (!state.profile) throw new Error('Synthesis returned no profile');

    // Mock one catalog match (avoids needing MongoDB)
    state = {
      ...state,
      matches: [{
        service: {
          name: 'Revenue Intelligence Platform',
          description: 'ML-driven analytics for payment companies',
          category: 'Analytics',
          targetAudience: 'Fintech companies',
          painPointsAddressed: ['Payment visibility'],
          deliverables: ['Dashboard'],
          keywords: ['fintech', 'payments'],
        },
        score: 90,
        confidence: 88,
        reasoning: 'Stripe needs payment analytics',
        matchedSignals: state.profile.signals.slice(0, 1).map((s) => s.title),
      }],
    };

    // Pitch
    const pUp = await pitchNode(state, emit);
    state = { ...state, ...pUp };
    if (!state.pitch?.body) throw new Error('Pitch generation returned no body');

    // Reflect
    const rUp = await reflectionNode(state, emit);
    state = { ...state, ...rUp };

    const pitch = state.pitch!;
    console.log('\n  ── Final Pitch ──────────────────────────────────');
    if (pitch.subject) console.log(`  Subject  : ${pitch.subject}`);
    const lines = pitch.body.split('\n').slice(0, 5);
    lines.forEach((l) => console.log(`  ${l}`));
    if (pitch.body.split('\n').length > 5) console.log('  [...]');
    console.log(`  CTA      : ${pitch.callToAction}`);
    if (pitch.revised) console.log('  [auto-revised by reflection agent]');
    if (pitch.reflectionNotes) console.log(`  Critique : ${pitch.reflectionNotes.slice(0, 100)}`);
    console.log('  ────────────────────────────────────────────────');

    console.log(`\n  Pipeline stats:`);
    console.log(`    Verified facts  : ${state.verification?.verifiedFacts.length ?? 0}`);
    console.log(`    Discarded claims: ${state.verification?.discardedClaims.length ?? 0}`);
    console.log(`    Research quality: ${state.verification?.qualityScore ?? 0}/100`);
    console.log(`    Profile signals : ${state.profile?.signals.length ?? 0}`);
    console.log(`    Personalizations: ${pitch.personalizationPoints.length}`);
    console.log(`    Pitch revised   : ${pitch.revised ?? false}`);
  });

  // Summary
  section('Summary');
  const total = passed + failed;
  console.log(`  ${passed}/${total} passed  ${failed > 0 ? `— ${failed} FAILED` : '🎉 all green'}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
