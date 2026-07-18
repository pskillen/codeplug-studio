import type { VerifyDiagnostic } from '../types.ts';

/**
 * Require LF-only line endings (Studio OpenGD77 / CHIRP export).
 * Empty files and files with no newlines are treated as OK.
 */
export function checkLfLineEndings(fileName: string, text: string): VerifyDiagnostic[] {
  if (!text.includes('\n') && !text.includes('\r')) return [];
  const diagnostics: VerifyDiagnostic[] = [];
  let crlfCount = 0;
  let crOnly = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\r') {
      if (text[i + 1] === '\n') {
        crlfCount++;
        i++;
      } else {
        crOnly++;
      }
    }
  }
  if (crlfCount > 0 || crOnly > 0) {
    diagnostics.push({
      rule: 'line-endings',
      file: fileName,
      message: `Expected LF line endings; found ${crlfCount} CRLF and ${crOnly} CR-only newline(s).`,
    });
  }
  return diagnostics;
}
