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

export interface PitchCritique {
  genericLanguageIssues: string[];
  missingSignalRefs: string[];
  ctaStrength: 'strong' | 'weak' | 'missing';
  overallQuality: number;
  needsRevision: boolean;
  summaryNotes: string;
}

export function evaluatePitchCritique(c: PitchCritique, threshold: number): GateResult {
  const pass = c.overallQuality >= threshold && c.genericLanguageIssues.length === 0;
  return { pass, score: c.overallQuality, feedback: c.summaryNotes, details: c };
}
