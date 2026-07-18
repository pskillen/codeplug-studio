import { anytoneVerifier } from './anytone/index.ts';
import { chirpVerifier } from './chirp/index.ts';
import { dm32Verifier } from './dm32/index.ts';
import { opengd77Verifier } from './opengd77/index.ts';
import type { FormatVerifier } from '../types.ts';

const VERIFIERS: FormatVerifier[] = [
  anytoneVerifier,
  dm32Verifier,
  opengd77Verifier,
  chirpVerifier,
];

export function getVerifier(formatId: string): FormatVerifier | undefined {
  return VERIFIERS.find((v) => v.id === formatId);
}

export function listVerifierIds(): string[] {
  return VERIFIERS.map((v) => v.id);
}

export function listProfilesForFormat(formatId: string): string[] {
  return getVerifier(formatId)?.supportedProfileIds.slice() ?? [];
}

/** Register additional format plugins (called from sibling modules at import time if needed). */
export function addVerifier(verifier: FormatVerifier): void {
  if (!VERIFIERS.some((v) => v.id === verifier.id)) {
    VERIFIERS.push(verifier);
  }
}
