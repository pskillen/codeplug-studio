import type { VerifyDiagnostic, VerifyDetailedResult, VerifyResult } from './types.ts';

/** Format diagnostics for CLI stdout/stderr. */
export function formatDiagnostics(diagnostics: VerifyDiagnostic[]): string {
  if (diagnostics.length === 0) return 'OK — no wire-shape diagnostics.';
  return diagnostics
    .map((d) => {
      const loc = [d.file, d.row != null ? `row ${d.row}` : null, d.column]
        .filter(Boolean)
        .join(', ');
      const rulePart = d.check ? `${d.rule}/${d.check}` : d.rule;
      const prefix = loc ? `[${rulePart}] ${loc}: ` : `[${rulePart}] `;
      return `${prefix}${d.message}`;
    })
    .join('\n');
}

export function formatVerifyResult(result: VerifyResult): string {
  const header = `format=${result.format} profile=${result.profile} ok=${result.ok} diagnostics=${result.diagnostics.length}`;
  if (result.diagnostics.length === 0) return header;
  return `${header}\n${formatDiagnostics(result.diagnostics)}`;
}

/** Format detailed check outcomes for CLI. */
export function formatVerifyDetailedResult(result: VerifyDetailedResult): string {
  const lines = [
    `format=${result.format} profile=${result.profile} ok=${result.ok} checks=${result.outcomes.length} diagnostics=${result.diagnostics.length}`,
  ];
  for (const outcome of result.outcomes) {
    const status = outcome.ok ? 'PASS' : 'FAIL';
    lines.push(`  ${status} ${outcome.check.id} — ${outcome.check.label}`);
    if (!outcome.ok) {
      for (const line of formatDiagnostics(outcome.diagnostics).split('\n')) {
        lines.push(`    ${line}`);
      }
    }
  }
  return lines.join('\n');
}
