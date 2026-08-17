import { exportWarningIdentity, type ExportWarning } from './exportWarning.ts';

/** Return warnings with duplicates removed (by structural identity, not message text), preserving first-seen order. */
export function dedupeWarnings(warnings: ExportWarning[]): ExportWarning[] {
  const seen = new Set<string>();
  const result: ExportWarning[] = [];
  for (const warning of warnings) {
    const key = exportWarningIdentity(warning);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(warning);
  }
  return result;
}
