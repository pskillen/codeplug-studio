/** Return warnings with duplicate strings removed, preserving first-seen order. */
export function dedupeWarnings(warnings: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const warning of warnings) {
    if (seen.has(warning)) continue;
    seen.add(warning);
    result.push(warning);
  }
  return result;
}
