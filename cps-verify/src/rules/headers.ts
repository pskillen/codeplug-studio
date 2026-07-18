import type { VerifyDiagnostic } from '../types.ts';

/** Exact header set + order check. */
export function checkExactHeaders(
  fileName: string,
  actual: string[],
  expected: string[],
): VerifyDiagnostic[] {
  const diagnostics: VerifyDiagnostic[] = [];
  if (actual.length !== expected.length) {
    diagnostics.push({
      rule: 'headers',
      file: fileName,
      message: `Header column count ${actual.length} !== expected ${expected.length}.`,
    });
  }
  const len = Math.max(actual.length, expected.length);
  for (let i = 0; i < len; i++) {
    const a = actual[i];
    const e = expected[i];
    if (a !== e) {
      diagnostics.push({
        rule: 'headers',
        file: fileName,
        column: e ?? a,
        message: `Header[${i}] is ${JSON.stringify(a)} but expected ${JSON.stringify(e)}.`,
      });
    }
  }
  return diagnostics;
}
