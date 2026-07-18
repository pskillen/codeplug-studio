import type { VerifyDiagnostic } from '../types.ts';

const DEFAULT_SENTINELS = new Set(['None', 'Off', '']);

export interface FkCheckOptions {
  file: string;
  column: string;
  row: number;
  value: string;
  /** Allowed target names (exact match). */
  targets: Set<string>;
  /** Values that skip FK resolution. */
  sentinels?: Set<string>;
  /** Split pipe-separated multi-refs. */
  pipeSeparated?: boolean;
}

/** Resolve a single or pipe-separated name FK against a target name set. */
export function checkForeignKey(opts: FkCheckOptions): VerifyDiagnostic[] {
  const sentinels = opts.sentinels ?? DEFAULT_SENTINELS;
  const diagnostics: VerifyDiagnostic[] = [];
  const parts = opts.pipeSeparated
    ? opts.value.split('|').map((p) => p.trim())
    : [opts.value.trim()];

  for (const part of parts) {
    if (sentinels.has(part)) continue;
    if (!opts.targets.has(part)) {
      diagnostics.push({
        rule: 'foreign-key',
        file: opts.file,
        row: opts.row,
        column: opts.column,
        message: `Referenced name ${JSON.stringify(part)} not found in target table.`,
      });
    }
  }
  return diagnostics;
}

/** Count pipe-separated members (empty string → 0). */
export function countPipeMembers(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split('|').filter((p) => p.trim().length > 0).length;
}

export function checkCardinality(
  file: string,
  column: string,
  row: number,
  value: string,
  max: number,
  label: string,
): VerifyDiagnostic[] {
  const count = countPipeMembers(value);
  if (count > max) {
    return [
      {
        rule: 'cardinality',
        file,
        row,
        column,
        message: `${label} has ${count} members but max is ${max}.`,
      },
    ];
  }
  return [];
}

export function checkNameLength(
  file: string,
  column: string,
  row: number,
  value: string,
  max: number,
): VerifyDiagnostic[] {
  if (value.length > max) {
    return [
      {
        rule: 'name-length',
        file,
        row,
        column,
        message: `Name length ${value.length} exceeds limit ${max}.`,
      },
    ];
  }
  return [];
}
