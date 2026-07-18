import { anytoneVerifier } from './anytone/index.ts';
import type { FormatVerifier } from '../types.ts';

const VERIFIERS: FormatVerifier[] = [anytoneVerifier];

export function getVerifier(formatId: string): FormatVerifier | undefined {
  return VERIFIERS.find((v) => v.id === formatId);
}

export function listVerifierIds(): string[] {
  return VERIFIERS.map((v) => v.id);
}
