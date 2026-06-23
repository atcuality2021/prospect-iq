import { GateResult } from './gate';

export function gradeResearch(verifiedFactCount: number, minVerifiedFacts: number): GateResult {
  const pass = verifiedFactCount >= minVerifiedFacts;
  return {
    pass,
    score: verifiedFactCount,
    feedback: pass
      ? `${verifiedFactCount} verified facts (≥ ${minVerifiedFacts} required)`
      : `Only ${verifiedFactCount} verified facts; need ${minVerifiedFacts}. Relaxing confidence floor to recover borderline facts.`,
  };
}
