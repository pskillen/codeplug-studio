import type { VerifyDiagnostic, VerifyResult } from './types.ts';

/** Format diagnostics for CLI stdout/stderr. */
export function formatDiagnostics(diagnostics: VerifyDiagnostic[]): string {
  if (diagnostics.length === 0) return 'OK — no wire-shape diagnostics.';
  return diagnostics
    .map((d) => {
      const loc = [d.file, d.row != null ? `row ${d.row}` : null, d.column]
        .filter(Boolean)
        .join(', ');
      const prefix = loc ? `[${d.rule}] ${loc}: ` : `[${d.rule}] `;
      return `${prefix}${d.message}`;
    })
    .join('\n');
}

export function formatVerifyResult(result: VerifyResult): string {
  const header = `format=${result.format} profile=${result.profile} ok=${result.ok} diagnostics=${result.diagnostics.length}`;
  if (result.diagnostics.length === 0) return header;
  return `${header}\n${formatDiagnostics(result.diagnostics)}`;
}
